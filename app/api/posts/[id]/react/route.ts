import { getReadyDb } from '../../../../../lib/db';
import { rateLimit } from '../../../../../lib/rate-limit';
import { requirePrincipal } from '../../../../../lib/authz';

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth=await requirePrincipal();if('error'in auth)return auth.error;const userId=auth.principal.id;
  if (!await rateLimit(`reaction:${userId}`, 60, 300)) return Response.json({ error: 'Too many reactions.' }, { status: 429 });
  const { id: postId } = await params;
  const sql = await getReadyDb();
  const post=await sql.query(`SELECT id FROM posts WHERE id=$1 AND status='VISIBLE'`,[postId]);if(!post.length)return Response.json({error:'Post not found'},{status:404});
  const existing = await sql.query(`SELECT id FROM reactions WHERE post_id=$1 AND user_id=$2 LIMIT 1`, [postId, userId]);
  if (existing.length) await sql.query(`DELETE FROM reactions WHERE id=$1`, [existing[0].id]);
  else await sql.query(`INSERT INTO reactions (id,post_id,user_id) VALUES ($1,$2,$3)`, [crypto.randomUUID(), postId, userId]);
  return Response.json({ liked: !existing.length });
}
