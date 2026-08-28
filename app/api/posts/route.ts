import { put } from '@vercel/blob';
import { getChatGPTUser } from '../../chatgpt-auth';
import { ensureUser, getReadyDb } from '../../../lib/db';
import { normalizeRole } from '../../../lib/roles';
import { rateLimit } from '../../../lib/rate-limit';
import { moderateImage, moderateText } from '../../../lib/moderation';
import { requirePrincipal } from '../../../lib/authz';

const allowed = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
async function validImageSignature(file:File){const bytes=new Uint8Array(await file.slice(0,12).arrayBuffer());if(file.type==='image/png')return bytes.length>=8&&[137,80,78,71,13,10,26,10].every((value,index)=>bytes[index]===value);if(file.type==='image/jpeg')return bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;if(file.type==='image/webp')return bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';if(file.type==='image/gif')return bytes.length>=6&&['GIF87a','GIF89a'].includes(String.fromCharCode(...bytes.slice(0,6)));return false}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  const url = new URL(request.url);
  const mine = url.searchParams.get('mine') === '1';
  const requestedUsername = url.searchParams.get('username')?.trim().toLowerCase().slice(0, 30) || null;
  const likedByUsername = url.searchParams.get('likedBy')?.trim().toLowerCase().slice(0, 30) || null;
  const limit = Math.min(60, Math.max(1, Number(url.searchParams.get('limit')) || 60));
  if (mine && !user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const sql = await getReadyDb();
  const rows = await sql.query(`
    SELECT p.id, p.user_id, p.title, p.description, p.tags, p.created_at,
      u.display_name, u.username, u.email, u.role, u.avatar_url,
      (SELECT COUNT(*) FROM reactions r WHERE r.post_id = p.id) AS reaction_count,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
    FROM posts p JOIN users u ON u.id = p.user_id
    WHERE p.status='VISIBLE' AND u.status='ACTIVE' AND ($1::text IS NULL OR p.user_id = $1)
      AND ($2::text IS NULL OR lower(u.username) = $2)
      AND ($3::text IS NULL OR EXISTS(
        SELECT 1 FROM reactions liked
        JOIN users liker ON liker.id=liked.user_id
        WHERE liked.post_id=p.id AND lower(liker.username)=$3
      ))
    ORDER BY p.created_at DESC LIMIT $4
  `, [mine ? user!.userId : null, requestedUsername, likedByUsername, limit]);
  return Response.json({ posts: rows.map(row => ({
    id: row.id, title: row.title, description: row.description,
    tags: Array.isArray(row.tags) ? row.tags : [], author: row.display_name,
    username: row.username,
    authorRole: normalizeRole(row.role),
    avatarUrl: row.avatar_url ? `/api/avatars/${encodeURIComponent(String(row.username))}?v=${encodeURIComponent(String(row.avatar_url))}` : '',
    createdAt: new Date(row.created_at as string).getTime(),
    reactionCount: Number(row.reaction_count), commentCount: Number(row.comment_count),
    imageUrl: `/api/images/${row.id}`, downloadUrl: `/api/images/${row.id}?download=1`,
    isOwner: user?.userId === row.user_id,
  })) });
}

export async function POST(request: Request) {
  const auth=await requirePrincipal(); if('error'in auth)return auth.error;
  const user={userId:auth.principal.id,email:auth.principal.email,displayName:String(auth.principal.profile.display_name||auth.principal.email.split('@')[0])};
  if (!await rateLimit(`post:${user.userId}`, 8, 3600)) return Response.json({ error: 'Too many uploads. Please try again later.' }, { status: 429 });
  const data = await request.formData();
  const image = data.get('image');
  const skillshotTitle = String(data.get('title') || '').trim().slice(0, 100);
  if (!(image instanceof File) || !allowed.has(image.type) || image.size > 10 * 1024 * 1024 || !skillshotTitle) {
    return Response.json({ error: 'Invalid upload' }, { status: 400 });
  }
  if(!(await validImageSignature(image)))return Response.json({error:'The selected file is not a valid image.'},{status:400});
  const description = String(data.get('description') || '').trim().slice(0, 1000);
  const textDecision = await moderateText(`${skillshotTitle}\n${description}`);
  if (textDecision.level === 'HIGH') return Response.json({ error: "This Skillshot couldn't be posted because it doesn't meet Skillshot's community guidelines." }, { status: 422 });
  await ensureUser(user);
  const id = crypto.randomUUID();
  const cleanName = image.name.replace(/[^a-z0-9._-]/gi, '-') || `${id}.png`;
  const blob = await put(`shots/${user.userId}/${id}-${cleanName}`, image, { access: 'private', addRandomSuffix: true, contentType: image.type });
  const imageDecision = await moderateImage(blob.url);
  const sql = await getReadyDb();
  const tags = String(data.get('tags') || '').split(',').map(value => value.trim()).filter(Boolean).slice(0, 8);
  const held = textDecision.level !== 'SAFE' || imageDecision.level !== 'SAFE';
  await sql.query(`INSERT INTO posts (id, user_id, title, description, tags, image_url, image_type, image_size, status, moderation_category) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10)`, [
    id, user.userId, skillshotTitle, description, JSON.stringify(tags), blob.pathname, image.type, image.size, held ? 'PENDING_MODERATION' : 'VISIBLE', textDecision.category ?? imageDecision.category ?? null,
  ]);
  if (held) await sql.query(`INSERT INTO moderation_queue(id,source,target_type,target_id,creator_id,category,severity,provider_ref) VALUES($1,'AUTOMATIC','SKILLSHOT',$2,$3,$4,$5,$6)`, [crypto.randomUUID(),id,user.userId,textDecision.category ?? imageDecision.category ?? 'REVIEW',imageDecision.level === 'HIGH' ? 'HIGH':'BORDERLINE',textDecision.providerRef ?? imageDecision.providerRef ?? null]);
  return Response.json({ id, status: held ? 'PENDING_MODERATION' : 'VISIBLE' }, { status: 201 });
}
