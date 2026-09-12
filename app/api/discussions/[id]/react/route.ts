import { getReadyDb } from '../../../../../lib/db';
import { requirePrincipal } from '../../../../../lib/authz';

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requirePrincipal();
  if ('error' in auth) return auth.error;
  const user = auth.principal;

  const sql = await getReadyDb();
  const disc = await sql.query(`SELECT id, user_id, title FROM discussions WHERE id = $1 AND status = 'VISIBLE' LIMIT 1`, [id]);
  if (!disc.length) {
    return Response.json({ error: 'Discussion not found' }, { status: 404 });
  }

  // Check if existing reaction
  const existing = await sql.query(`
    SELECT id FROM discussion_reactions WHERE discussion_id = $1 AND user_id = $2 LIMIT 1
  `, [id, user.id]);

  let reacted = false;
  if (existing.length) {
    await sql.query(`DELETE FROM discussion_reactions WHERE discussion_id = $1 AND user_id = $2`, [id, user.id]);
    await sql.query(`UPDATE discussions SET reaction_count = GREATEST(0, reaction_count - 1) WHERE id = $1`, [id]);
    reacted = false;
  } else {
    await sql.query(`
      INSERT INTO discussion_reactions (discussion_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT (discussion_id, user_id) DO NOTHING
    `, [id, user.id]);
    await sql.query(`UPDATE discussions SET reaction_count = reaction_count + 1 WHERE id = $1`, [id]);
    reacted = true;

    if (disc[0].user_id !== user.id) {
      const actorName = String(user.profile?.display_name || user.profile?.username || 'Someone');
      await sql.query(
        `INSERT INTO notifications (id, user_id, actor_id, category, type, title, body, event_key, target_url, target_id)
         VALUES ($1, $2, $3, 'discussion', 'DISCUSSION_LIKE', $4, $5, $6, $7, $8)
         ON CONFLICT (event_key) WHERE event_key IS NOT NULL DO NOTHING`,
        [
          crypto.randomUUID(),
          disc[0].user_id,
          user.id,
          `${actorName} liked your discussion`,
          disc[0].title ? String(disc[0].title).slice(0, 120) : 'Your discussion received a like.',
          `disc-like:${id}:${user.id}`,
          `/discussion/${id}`,
          id,
        ]
      ).catch(() => undefined);
    }
  }

  const countRow = await sql.query(`SELECT reaction_count FROM discussions WHERE id = $1`, [id]);
  const reactionCount = Number(countRow[0]?.reaction_count || 0);

  return Response.json({
    reacted,
    reactionCount,
  });
}
