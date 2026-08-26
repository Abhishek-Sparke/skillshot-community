import { put } from '@vercel/blob';
import { getChatGPTUser } from '../../chatgpt-auth';
import { ensureUser, getReadyDb } from '../../../lib/db';

const allowed = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  const mine = new URL(request.url).searchParams.get('mine') === '1';
  if (mine && !user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const sql = await getReadyDb();
  const rows = await sql.query(`
    SELECT p.id, p.user_id, p.title, p.description, p.tags, p.created_at,
      u.display_name, u.username,
      (SELECT COUNT(*) FROM reactions r WHERE r.post_id = p.id) AS reaction_count,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
    FROM posts p JOIN users u ON u.id = p.user_id
    WHERE ($1::text IS NULL OR p.user_id = $1)
    ORDER BY p.created_at DESC LIMIT 60
  `, [mine ? user!.userId : null]);
  return Response.json({ posts: rows.map(row => ({
    id: row.id, title: row.title, description: row.description,
    tags: Array.isArray(row.tags) ? row.tags : [], author: row.display_name,
    username: row.username, createdAt: new Date(row.created_at as string).getTime(),
    reactionCount: Number(row.reaction_count), commentCount: Number(row.comment_count),
    imageUrl: `/api/images/${row.id}`, downloadUrl: `/api/images/${row.id}?download=1`,
    isOwner: user?.userId === row.user_id,
  })) });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const data = await request.formData();
  const image = data.get('image');
  const title = String(data.get('title') || '').trim().slice(0, 100);
  if (!(image instanceof File) || !allowed.has(image.type) || image.size > 10 * 1024 * 1024 || !title) {
    return Response.json({ error: 'Invalid upload' }, { status: 400 });
  }
  await ensureUser(user);
  const id = crypto.randomUUID();
  const cleanName = image.name.replace(/[^a-z0-9._-]/gi, '-') || `${id}.png`;
  const blob = await put(`shots/${user.userId}/${id}-${cleanName}`, image, { access: 'public', addRandomSuffix: true, contentType: image.type });
  const sql = await getReadyDb();
  const tags = String(data.get('tags') || '').split(',').map(value => value.trim()).filter(Boolean).slice(0, 8);
  await sql.query(`INSERT INTO posts (id, user_id, title, description, tags, image_url, image_type, image_size) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8)`, [
    id, user.userId, title, String(data.get('description') || '').trim().slice(0, 1000), JSON.stringify(tags), blob.url, image.type, image.size,
  ]);
  return Response.json({ id }, { status: 201 });
}
