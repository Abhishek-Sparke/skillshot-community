import { NextResponse } from 'next/server';
import { del, put } from '@vercel/blob';
import { getChatGPTUser } from '../../chatgpt-auth';
import { ensureUser, getReadyDb } from '../../../lib/db';
import { normalizeSocialUrl, SOCIAL_PLATFORMS } from '../../../lib/social-links';
import { requirePrincipal } from '../../../lib/authz';
import { AVATAR_MAX_BYTES, processAvatar, uploadError } from '../../../lib/image-processing';
import { rateLimit } from '../../../lib/rate-limit';

function redirectError(request: Request, error: string) {
  return NextResponse.redirect(new URL(`/profile/edit?error=${encodeURIComponent(error)}`, request.url), 303);
}

export async function POST(request: Request) {
  const auth=await requirePrincipal();
  if('error'in auth){const denied=auth.error!;return denied.status===401?NextResponse.redirect(new URL('/signin?callbackUrl=/profile',request.url),303):denied;}
  const session=await getChatGPTUser();
  if(!session)return NextResponse.redirect(new URL('/signin?callbackUrl=/profile',request.url),303);
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
  if ((removeAvatar || (avatar instanceof File && avatar.size > 0)) && !await rateLimit(`avatar:${user.userId}`, 12, 86400)) return redirectError(request, 'avatar-rate');
  const requestedFeatured = [...new Set(form.getAll('featuredPost').map(String).filter(Boolean))].slice(0, 3);
  if (!username) return redirectError(request, 'username');
  const sql = await getReadyDb();
  const current = await sql.query(`SELECT avatar_url,avatar_type,avatar_size,social_links FROM users WHERE id=$1 LIMIT 1`, [user.userId]);
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
    try {
      const optimized = await processAvatar(Buffer.from(await avatar.arrayBuffer()));
      const blob = await put(`avatars/${user.userId}/${crypto.randomUUID()}.webp`, optimized, { access: 'private', addRandomSuffix: false, contentType: 'image/webp' });
      avatarUrl = blob.pathname;
      avatarType = 'image/webp';
      avatarSize = optimized.length;
      newlyUploadedAvatar = blob.pathname;
    } catch {
      return redirectError(request, 'avatar-invalid');
    }
  }
  try {
    await sql.query(`UPDATE users SET display_name=$1,username=$2,bio=$3,website=$4,location=$5,skills=$6::jsonb,social_links=$7::jsonb,avatar_url=$8,avatar_type=$9,avatar_size=$10 WHERE id=$11`, [
      displayName, username, bio, safeWebsite, location, JSON.stringify(profileSkills), JSON.stringify(socialLinks), avatarUrl, avatarType, avatarSize, user.userId,
    ]);
    const ownedFeatured = requestedFeatured.length ? await sql.query(`SELECT id FROM posts WHERE user_id=$1 AND id=ANY($2::text[])`, [user.userId, requestedFeatured]) : [];
    const allowedFeatured = new Set(ownedFeatured.map(row => String(row.id)));
    await sql.query(`DELETE FROM featured_posts WHERE user_id=$1`, [user.userId]);
    let position = 1;
    for (const postId of requestedFeatured) {
      if (!allowedFeatured.has(postId)) continue;
      await sql.query(`INSERT INTO featured_posts (user_id,post_id,position) VALUES ($1,$2,$3)`, [user.userId, postId, position++]);
    }
  } catch {
    if (newlyUploadedAvatar) await del(newlyUploadedAvatar).catch(() => undefined);
    return redirectError(request, 'save');
  }
  const previousAvatar = current[0]?.avatar_url ? String(current[0].avatar_url) : null;
  if (previousAvatar && previousAvatar !== avatarUrl) await del(previousAvatar).catch(() => undefined);
  return NextResponse.redirect(new URL('/profile?saved=1', request.url), 303);
}
