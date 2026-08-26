import { getChatGPTUser } from '../../../../chatgpt-auth';
import { ensureUser, getReadyDb } from '../../../../../lib/db';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getChatGPTUser();
  const sql = await getReadyDb();
  const rows = await sql.query(`SELECT c.id,c.user_id,c.body,c.created_at,u.display_name,u.username FROM comments c JOIN users u ON u.id=c.user_id WHERE c.post_id=$1 ORDER BY c.created_at ASC`, [id]);
  return Response.json({ comments: rows.map(row => ({
    id: row.id, body: row.body, author: row.display_name, username: row.username,
    createdAt: new Date(row.created_at as string).getTime(), canDelete: user?.userId === row.user_id,
  })) });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { id: postId } = await params;
  const body = String((await request.json()).body || '').trim().slice(0, 1000);
  if (!body) return Response.json({ error: 'Comment required' }, { status: 400 });
  const profile = await ensureUser(user);
  const id = crypto.randomUUID();
  const sql = await getReadyDb();
  await sql.query(`INSERT INTO comments (id,post_id,user_id,body) VALUES ($1,$2,$3,$4)`, [id, postId, user.userId, body]);
  return Response.json({ id, body, author: profile.display_name ?? user.displayName, username: profile.username ?? user.email.split('@')[0], createdAt: Date.now(), canDelete: true }, { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { id: postId } = await params;
  const commentId = new URL(request.url).searchParams.get('commentId');
  if (!commentId) return Response.json({ error: 'Missing id' }, { status: 400 });
  await (await getReadyDb()).query(`DELETE FROM comments WHERE id=$1 AND post_id=$2 AND user_id=$3`, [commentId, postId, user.userId]);
  return new Response(null, { status: 204 });
}

