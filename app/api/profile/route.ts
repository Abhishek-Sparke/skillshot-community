import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { getChatGPTUser } from '../../chatgpt-auth';
import { ensureUser, getReadyDb } from '../../../lib/db';
import { normalizeSocialUrl, SOCIAL_PLATFORMS } from '../../../lib/social-links';

const avatarTypes: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;

function redirectError(request: Request, error: string) {
  return NextResponse.redirect(new URL(`/profile/edit?error=${encodeURIComponent(error)}`, request.url), 303);
}

async function hasValidImageSignature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (file.type === 'image/png') return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  if (file.type === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (file.type === 'image/webp') return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  return false;
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.redirect(new URL('/signin?callbackUrl=/profile', request.url), 303);
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
    if (!avatarTypes[avatar.type]) return redirectError(request, 'avatar-type');
    if (avatar.size > MAX_AVATAR_SIZE) return redirectError(request, 'avatar-size');
    if (!(await hasValidImageSignature(avatar))) return redirectError(request, 'avatar-invalid');
  }
  const conflict = await sql.query(`SELECT 1 FROM users WHERE lower(username)=lower($1) AND id<>$2 LIMIT 1`, [username, user.userId]);
  if (conflict.length) return redirectError(request, 'username-taken');
  let avatarUrl = removeAvatar ? null : current[0]?.avatar_url ?? null;
  let avatarType = removeAvatar ? null : current[0]?.avatar_type ?? null;
  let avatarSize = removeAvatar ? null : current[0]?.avatar_size ?? null;
  if (!removeAvatar && avatar instanceof File && avatar.size > 0) {
    try {
      const extension = avatarTypes[avatar.type];
      const blob = await put(`avatars/${user.userId}/${crypto.randomUUID()}.${extension}`, avatar, { access: 'private', addRandomSuffix: true, contentType: avatar.type });
      avatarUrl = blob.pathname;
      avatarType = avatar.type;
      avatarSize = avatar.size;
    } catch {
      return redirectError(request, 'avatar-upload');
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
    return redirectError(request, 'save');
  }
  return NextResponse.redirect(new URL('/profile?saved=1', request.url), 303);
}
