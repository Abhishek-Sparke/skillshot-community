import { getReadyDb } from '../../../../../lib/db';
import { rateLimit } from '../../../../../lib/rate-limit';
import { requirePrincipal } from '../../../../../lib/authz';
import { awardXp, reverseXp, XP_REWARDS } from '../../../../../lib/xp';

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePrincipal();
  if ('error' in auth) return auth.error;
  const userId = auth.principal.id;
  if (!await rateLimit(`save:${userId}`, 60, 300)) return Response.json({ error: 'Too many requests.' }, { status: 429 });
  const { id: postId } = await params;
  const sql = await getReadyDb();
  const post = await sql.query(`SELECT id,user_id FROM posts WHERE id=$1 AND status='VISIBLE'`, [postId]);
  if (!post.length) return Response.json({ error: 'Post not found' }, { status: 404 });
  const existing = await sql.query(`SELECT 1 FROM saved_posts WHERE post_id=$1 AND user_id=$2 LIMIT 1`, [postId, userId]);
  if (existing.length) {
    await sql.query(`DELETE FROM saved_posts WHERE post_id=$1 AND user_id=$2`, [postId, userId]);
    await reverseXp(`save-received:${postId}:${userId}`,'Save removed');
  } else {
    await sql.query(`INSERT INTO saved_posts (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [userId, postId]);
    if(post[0].user_id!==userId)await awardXp({userId:String(post[0].user_id),amount:XP_REWARDS.SAVE_RECEIVED,eventType:'SAVE_RECEIVED',reason:'Skillshot saved',actionId:`save-received:${postId}:${userId}`,relatedType:'SKILLSHOT',relatedId:postId});
  }
  return Response.json({ saved: !existing.length });
}
