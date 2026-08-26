import { env } from 'cloudflare:workers';
import { and, eq } from 'drizzle-orm';
import { getChatGPTUser } from '../../../../chatgpt-auth';
import { getReadyDb } from '../../../../../db';
import { comments } from '../../../../../db/schema';
import { ensureUser } from '../../../../../db/users';

type CommentRow = { id: string; user_id: string; body: string; created_at: number; display_name: string; username: string };

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getChatGPTUser();
  await getReadyDb();
  const result = await env.DB.prepare(`
    SELECT c.id, c.user_id, c.body, c.created_at, u.display_name, u.username
    FROM comments c JOIN users u ON u.id = c.user_id
    WHERE c.post_id = ? ORDER BY c.created_at ASC
  `).bind(id).all<CommentRow>();
  return Response.json({ comments: (result.results ?? []).map(row => ({
    id: row.id,
    body: row.body,
    author: row.display_name,
    username: row.username,
    createdAt: Number(row.created_at),
    canDelete: user?.userId === row.user_id,
  })) });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = String((await request.json()).body || '').trim().slice(0, 1000);
  if (!body) return Response.json({ error: 'Comment required' }, { status: 400 });
  await ensureUser(user);
  const item = { id: crypto.randomUUID(), postId: id, userId: user.userId, body, createdAt: new Date() };
  await (await getReadyDb()).insert(comments).values(item);
  const profile = await ensureUser(user);
  return Response.json({
    id: item.id,
    body: item.body,
    author: profile?.displayName ?? user.displayName,
    username: profile?.username ?? user.email.split('@')[0],
    createdAt: item.createdAt.getTime(),
    canDelete: true,
  }, { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const commentId = new URL(request.url).searchParams.get('commentId');
  if (!commentId) return Response.json({ error: 'Missing id' }, { status: 400 });
  await (await getReadyDb()).delete(comments).where(and(eq(comments.id, commentId), eq(comments.postId, id), eq(comments.userId, user.userId)));
  return new Response(null, { status: 204 });
}
