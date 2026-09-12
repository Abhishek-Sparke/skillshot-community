import { getReadyDb } from '../../../../../lib/db';
import { rateLimit } from '../../../../../lib/rate-limit';
import { requirePrincipal } from '../../../../../lib/authz';
import { awardXp, reverseXp, XP_REWARDS } from '../../../../../lib/xp';

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth=await requirePrincipal();if('error'in auth)return auth.error;const userId=auth.principal.id;
  if (!await rateLimit(`reaction:${userId}`, 60, 300)) return Response.json({ error: 'Too many reactions.' }, { status: 429 });
  const { id: postId } = await params;
  const sql = await getReadyDb();
  const post = await sql.query(`SELECT id, user_id, thumbnail_url, title FROM posts WHERE id = $1 AND status = 'VISIBLE'`, [postId]);
  if (!post.length) return Response.json({ error: 'Post not found' }, { status: 404 });
  const existing = await sql.query(`SELECT id FROM reactions WHERE post_id=$1 AND user_id=$2 LIMIT 1`, [postId, userId]);
  if (existing.length) {
    await sql.query(`DELETE FROM reactions WHERE id=$1`, [existing[0].id]);
    await reverseXp(`like-received:${postId}:${userId}`, 'Like removed');
  } else {
    await sql.query(`INSERT INTO reactions (id,post_id,user_id) VALUES ($1,$2,$3)`, [crypto.randomUUID(), postId, userId]);
    if (post[0].user_id !== userId) {
      await awardXp({
        userId: String(post[0].user_id),
        amount: XP_REWARDS.LIKE_RECEIVED,
        eventType: 'LIKE_RECEIVED',
        reason: 'Skillshot liked',
        actionId: `like-received:${postId}:${userId}`,
        relatedType: 'SKILLSHOT',
        relatedId: postId,
      });
      const actorName = String(auth.principal.profile?.display_name || auth.principal.profile?.username || 'Someone');
      await sql.query(
        `INSERT INTO notifications (id, user_id, actor_id, category, type, title, body, event_key, target_url, target_id, thumbnail_url)
         VALUES ($1, $2, $3, 'post', 'LIKE', $4, $5, $6, $7, $8, $9)
         ON CONFLICT (event_key) WHERE event_key IS NOT NULL DO NOTHING`,
        [
          crypto.randomUUID(),
          post[0].user_id,
          userId,
          `${actorName} liked your Skillshot`,
          post[0].title ? String(post[0].title).slice(0, 100) : 'Your Skillshot received a like.',
          `post-like:${postId}:${userId}`,
          `/shots/${postId}`,
          postId,
          post[0].thumbnail_url || null,
        ]
      ).catch(() => undefined);
    }
  }
  return Response.json({ liked: !existing.length });
}
