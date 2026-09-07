import { NextResponse } from 'next/server';
import { del, put } from '@vercel/blob';
import { getChatGPTUser } from '../../chatgpt-auth';
import { ensureUser, getReadyDb } from '../../../lib/db';
import { normalizeSocialUrl, SOCIAL_PLATFORMS } from '../../../lib/social-links';
import { requirePrincipal } from '../../../lib/authz';
import { AVATAR_MAX_BYTES, BANNER_MAX_BYTES, processAvatar, processBanner, uploadError, moderationFrames } from '../../../lib/image-processing';
import { rateLimit } from '../../../lib/rate-limit';
import { signInPath } from '../../../lib/auth-path';
import { moderateImage } from '../../../lib/moderation';
import { awardXp, XP_REWARDS } from '../../../lib/xp';

function redirectError(request: Request, error: string) {
  return NextResponse.redirect(new URL(`/profile/edit?error=${encodeURIComponent(error)}`, request.url), 303);
}

async function recordAvatarUpload(userId: string, outcome: string, bytes: number, reason?: string) {
  try { await (await getReadyDb()).query(`INSERT INTO upload_events(id,user_id,kind,outcome,bytes,reason) VALUES($1,$2,'AVATAR',$3,$4,$5)`, [crypto.randomUUID(), userId, outcome, bytes, reason || null]); }
  catch { /* metrics must never block profile updates */ }
}

export async function POST(request: Request) {
  const auth=await requirePrincipal();
  if('error'in auth){const denied=auth.error!;return denied.status===401?NextResponse.redirect(new URL(signInPath('/profile'),request.url),303):denied;}
  const session=await getChatGPTUser();
  if(!session)return NextResponse.redirect(new URL(signInPath('/profile'),request.url),303);
  const user=session;
  await ensureUser(user);
  const form = await request.formData();
  const displayName = String(form.get('displayName') || user.displayName).trim().slice(0, 80) || user.displayName;
  const username = String(form.get('username') || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 30);
  const bio = String(form.get('bio') || '').trim().slice(0, 500);
  const website = String(form.get('website') || '').trim().slice(0, 300);
  const location = String(form.get('location') || '').trim().slice(0, 100);
  const profileSkills = String(form.get('skills') || '').split(',').map(value => value.trim()).filter(Boolean).slice(0, 12).map(value => value.slice(0, 40));
  const avatar = form.get('avatar');
  const removeAvatar = form.get('removeAvatar') === '1';
  const banner = form.get('banner');
  const removeBanner = form.get('removeBanner') === '1';
  if ((removeAvatar || (avatar instanceof File && avatar.size > 0)) && !await rateLimit(`avatar:${user.userId}`, 12, 86400)) {
    if (avatar instanceof File) await recordAvatarUpload(user.userId, 'FAILED', avatar.size, 'RATE_LIMITED');
    return redirectError(request, 'avatar-rate');
  }
  const requestedFeatured = [...new Set(form.getAll('featuredPost').map(String).filter(Boolean))].slice(0, 3);
  if (!username) return redirectError(request, 'username');
  const sql = await getReadyDb();
  const current = await sql.query(`SELECT avatar_url,avatar_type,avatar_size,banner_url,banner_type,banner_size,social_links FROM users WHERE id=$1 LIMIT 1`, [user.userId]);
  const existingSocialLinks = current[0]?.social_links && typeof current[0].social_links === 'object'
    ? current[0].social_links as Record<string, unknown>
    : {};
  let safeWebsite = '';
  const socialLinks: Record<string, string> = {};
  if (website) {
    try {
      const parsed = new URL(website);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Unsupported protocol');
      safeWebsite = parsed.toString().slice(0, 300);
    } catch {
      return redirectError(request, 'website');
    }
  }
  try {
    for (const platform of SOCIAL_PLATFORMS) {
      const raw = String(form.get(platform.key) || '').trim().slice(0, 300);
      if (!raw) continue;
      try {
        socialLinks[platform.key] = normalizeSocialUrl(platform.key, raw);
      } catch {
        if (raw === String(existingSocialLinks[platform.key] || '').trim()) socialLinks[platform.key] = raw;
        else return redirectError(request, `social-${platform.key}`);
      }
    }
  } catch {
    return redirectError(request, 'social');
  }
  if (!removeAvatar && avatar instanceof File && avatar.size > 0) {
    const validation = uploadError(avatar, AVATAR_MAX_BYTES);
    if (validation) await recordAvatarUpload(user.userId, 'FAILED', avatar.size, validation);
    if (validation === 'UNSUPPORTED_FORMAT') return redirectError(request, 'avatar-type');
    if (validation === 'FILE_TOO_LARGE') return redirectError(request, 'avatar-size');
    if (validation) return redirectError(request, 'avatar-invalid');
  }
  const conflict = await sql.query(`SELECT 1 FROM users WHERE lower(username)=lower($1) AND id<>$2 LIMIT 1`, [username, user.userId]);
  if (conflict.length) return redirectError(request, 'username-taken');
  let avatarUrl = removeAvatar ? null : current[0]?.avatar_url ?? null;
  let avatarType = removeAvatar ? null : current[0]?.avatar_type ?? null;
  let avatarSize = removeAvatar ? null : current[0]?.avatar_size ?? null;
  let newlyUploadedAvatar: string | null = null;
  if (!removeAvatar && avatar instanceof File && avatar.size > 0) {
    let optimized: Buffer;
    const isGif = avatar.type === 'image/gif';
    try {
      optimized = await processAvatar(Buffer.from(await avatar.arrayBuffer()), avatar.type, true);
    } catch {
      await recordAvatarUpload(user.userId, 'FAILED', avatar.size, 'INVALID_IMAGE');
      return redirectError(request, 'avatar-invalid');
    }
    let isSafe = false;
    if (isGif) {
      const frames = await moderationFrames(optimized, avatar.type);
      const checks = await Promise.all(frames.map(f => moderateImage(f)));
      isSafe = checks.every(c => c.level === 'SAFE');
    } else {
      const mod = await moderateImage(`data:image/webp;base64,${optimized.toString('base64')}`);
      isSafe = mod.level === 'SAFE';
    }
    if (!isSafe) {
      await recordAvatarUpload(user.userId, 'BLOCKED', avatar.size, 'MODERATION_FAILED');
      return redirectError(request, 'avatar-moderation');
    }
    try {
      const ext = isGif ? 'gif' : 'webp';
      const mime = isGif ? 'image/gif' : 'image/webp';
      const blob = await put(`avatars/${user.userId}/${crypto.randomUUID()}.${ext}`, optimized, { access: 'private', addRandomSuffix: false, contentType: mime });
      avatarUrl = blob.pathname;
      avatarType = mime;
      avatarSize = optimized.length;
      newlyUploadedAvatar = blob.pathname;
    } catch {
      await recordAvatarUpload(user.userId, 'FAILED', avatar.size, 'STORAGE_UNAVAILABLE');
      return redirectError(request, 'avatar-upload');
    }
  }

  let bannerUrl = removeBanner ? null : current[0]?.banner_url ?? null;
  let bannerType = removeBanner ? null : current[0]?.banner_type ?? null;
  let bannerSize = removeBanner ? null : current[0]?.banner_size ?? null;
  let newlyUploadedBanner: string | null = null;
  if (!removeBanner && banner instanceof File && banner.size > 0) {
    const bannerVal = uploadError(banner, BANNER_MAX_BYTES, 'banner');
    if (bannerVal === 'UNSUPPORTED_FORMAT') return redirectError(request, 'banner-type');
    if (bannerVal === 'FILE_TOO_LARGE') return redirectError(request, 'banner-size');
    if (bannerVal) return redirectError(request, 'banner-invalid');

    let optimizedBanner: Buffer;
    const isBannerGif = banner.type === 'image/gif';
    try {
      optimizedBanner = await processBanner(Buffer.from(await banner.arrayBuffer()), banner.type);
    } catch {
      return redirectError(request, 'banner-invalid');
    }
    let bannerSafe = false;
    if (isBannerGif) {
      const frames = await moderationFrames(optimizedBanner, banner.type);
      const checks = await Promise.all(frames.map(f => moderateImage(f)));
      bannerSafe = checks.every(c => c.level === 'SAFE');
    } else {
      const mod = await moderateImage(`data:image/webp;base64,${optimizedBanner.toString('base64')}`);
      bannerSafe = mod.level === 'SAFE';
    }
    if (!bannerSafe) return redirectError(request, 'banner-moderation');

    try {
      const bExt = isBannerGif ? 'gif' : 'webp';
      const bMime = isBannerGif ? 'image/gif' : 'image/webp';
      const bBlob = await put(`banners/${user.userId}/${crypto.randomUUID()}.${bExt}`, optimizedBanner, { access: 'private', addRandomSuffix: false, contentType: bMime });
      bannerUrl = bBlob.pathname;
      bannerType = bMime;
      bannerSize = optimizedBanner.length;
      newlyUploadedBanner = bBlob.pathname;
    } catch {
      return redirectError(request, 'banner-upload');
    }
  }
  try {
    const writes = [sql.query(`UPDATE users SET display_name=$1,username=$2,bio=$3,website=$4,location=$5,skills=$6::jsonb,social_links=$7::jsonb,avatar_url=$8,avatar_type=$9,avatar_size=$10,banner_url=$11,banner_type=$12,banner_size=$13 WHERE id=$14`, [
      displayName, username, bio, safeWebsite, location, JSON.stringify(profileSkills), JSON.stringify(socialLinks), avatarUrl, avatarType, avatarSize, bannerUrl, bannerType, bannerSize, user.userId,
    ])];
    const ownedFeatured = requestedFeatured.length ? await sql.query(`SELECT id FROM posts WHERE user_id=$1 AND id=ANY($2::text[])`, [user.userId, requestedFeatured]) : [];
    const allowedFeatured = new Set(ownedFeatured.map(row => String(row.id)));
    writes.push(sql.query(`DELETE FROM featured_posts WHERE user_id=$1`, [user.userId]));
    let position = 1;
    for (const postId of requestedFeatured) {
      if (!allowedFeatured.has(postId)) continue;
      writes.push(sql.query(`INSERT INTO featured_posts (user_id,post_id,position) VALUES ($1,$2,$3)`, [user.userId, postId, position++]));
    }
    await sql.transaction(writes);
  } catch {
    if (newlyUploadedAvatar) {
      const referenced = await sql.query(`SELECT 1 FROM users WHERE avatar_url=$1`, [newlyUploadedAvatar]).catch(() => null);
      if (referenced && !referenced.length) await del(newlyUploadedAvatar).catch(() => undefined);
    }
    if (newlyUploadedBanner) {
      const bRef = await sql.query(`SELECT 1 FROM users WHERE banner_url=$1`, [newlyUploadedBanner]).catch(() => null);
      if (bRef && !bRef.length) await del(newlyUploadedBanner).catch(() => undefined);
    }
    if (avatar instanceof File && avatar.size > 0) await recordAvatarUpload(user.userId, 'FAILED', avatar.size, 'SAVE_FAILED');
    return redirectError(request, 'save');
  }
  const previousAvatar = current[0]?.avatar_url ? String(current[0].avatar_url) : null;
  if (previousAvatar && previousAvatar !== avatarUrl) {
    await sql.query(`INSERT INTO storage_cleanup_queue(id,post_id,pathname,reason,cleanup_after) VALUES($1,NULL,$2,'AVATAR_REPLACED',now()+interval '7 days')`, [crypto.randomUUID(), previousAvatar]).catch(() => undefined);
  }
  const previousBanner = current[0]?.banner_url ? String(current[0].banner_url) : null;
  if (previousBanner && previousBanner !== bannerUrl) {
    await sql.query(`INSERT INTO storage_cleanup_queue(id,post_id,pathname,reason,cleanup_after) VALUES($1,NULL,$2,'BANNER_REPLACED',now()+interval '7 days')`, [crypto.randomUUID(), previousBanner]).catch(() => undefined);
  }
  if (avatar instanceof File && avatar.size > 0) await recordAvatarUpload(user.userId, 'SUCCESS', avatar.size);
  if (displayName && username && bio.length >= 10 && profileSkills.length > 0 && avatarUrl) {
    await awardXp({userId:user.userId,amount:XP_REWARDS.PROFILE_COMPLETE,eventType:'PROFILE_COMPLETE',reason:'Completed profile',actionId:`profile-complete:${user.userId}`,relatedType:'PROFILE',relatedId:user.userId});
  }
  return NextResponse.redirect(new URL('/profile?saved=1', request.url), 303);
}
