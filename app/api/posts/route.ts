import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { getReadyDb } from '../../../db';
import { posts } from '../../../db/schema';
import { ensureUser } from '../../../db/users';

const allowed = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

type FeedRow = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  tags: string;
  created_at: number;
  display_name: string;
  username: string;
  reaction_count: number;
  comment_count: number;
};

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  const mine = new URL(request.url).searchParams.get('mine') === '1';
  if (mine && !user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  await getReadyDb();
  const where = mine ? 'WHERE p.user_id = ?' : '';
  const statement = env.DB.prepare(`
    SELECT p.id, p.user_id, p.title, p.description, p.tags, p.created_at,
      u.display_name, u.username,
      (SELECT COUNT(*) FROM reactions r WHERE r.post_id = p.id) AS reaction_count,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
    FROM posts p
    JOIN users u ON u.id = p.user_id
    ${where}
    ORDER BY p.created_at DESC
    LIMIT 60
  `);
  const result = mine ? await statement.bind(user!.userId).all<FeedRow>() : await statement.all<FeedRow>();

  return Response.json({ posts: (result.results ?? []).map(row => ({
    id: row.id,
    title: row.title,
    description: row.description,
    tags: parseTags(row.tags),
    author: row.display_name,
    username: row.username,
    createdAt: Number(row.created_at),
    reactionCount: Number(row.reaction_count),
    commentCount: Number(row.comment_count),
    imageUrl: `/api/images/${row.id}`,
    downloadUrl: `/api/images/${row.id}?download=1`,
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

  const db = await getReadyDb();
  await ensureUser(user);
  const id = crypto.randomUUID();
  const key = `shots/${user.userId}/${id}`;
  const safeName = image.name.replace(/["\r\n]/g, '') || `skillshot-${id}`;
  await env.FILES.put(key, image.stream(), {
    httpMetadata: { contentType: image.type, contentDisposition: `attachment; filename="${safeName}"` },
  });

  const now = new Date();
  await db.insert(posts).values({
    id,
    userId: user.userId,
    title,
    description: String(data.get('description') || '').trim().slice(0, 1000),
    tags: JSON.stringify(String(data.get('tags') || '').split(',').map(value => value.trim()).filter(Boolean).slice(0, 8)),
    imageKey: key,
    imageType: image.type,
    imageSize: image.size,
    createdAt: now,
    updatedAt: now,
  });
  return Response.json({ id }, { status: 201 });
}

function parseTags(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string') : [];
  } catch {
    return [];
  }
}
