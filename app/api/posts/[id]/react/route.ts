import { getChatGPTUser } from '../../../../chatgpt-auth';
import { ensureUser, getReadyDb } from '../../../../../lib/db';

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { id: postId } = await params;
  await ensureUser(user);
  const sql = await getReadyDb();
  const existing = await sql.query(`SELECT id FROM reactions WHERE post_id=$1 AND user_id=$2 LIMIT 1`, [postId, user.userId]);
  if (existing.length) await sql.query(`DELETE FROM reactions WHERE id=$1`, [existing[0].id]);
  else await sql.query(`INSERT INTO reactions (id,post_id,user_id) VALUES ($1,$2,$3)`, [crypto.randomUUID(), postId, user.userId]);
  return Response.json({ liked: !existing.length });
}

