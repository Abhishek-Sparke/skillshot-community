import { getReadyDb } from '../../../../../lib/db';
import { requirePrincipal } from '../../../../../lib/authz';

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requirePrincipal();
  if ('error' in auth) return auth.error;
  const user = auth.principal;

  const sql = await getReadyDb();
  const disc = await sql.query(`SELECT id FROM discussions WHERE id = $1 AND status = 'VISIBLE' LIMIT 1`, [id]);
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
  }

  const countRow = await sql.query(`SELECT reaction_count FROM discussions WHERE id = $1`, [id]);
  const reactionCount = Number(countRow[0]?.reaction_count || 0);

  return Response.json({
    reacted,
    reactionCount,
  });
}
