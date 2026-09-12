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

  const existing = await sql.query(`
    SELECT 1 FROM saved_discussions WHERE discussion_id = $1 AND user_id = $2 LIMIT 1
  `, [id, user.id]);

  let saved = false;
  if (existing.length) {
    await sql.query(`DELETE FROM saved_discussions WHERE discussion_id = $1 AND user_id = $2`, [id, user.id]);
    saved = false;
  } else {
    await sql.query(`
      INSERT INTO saved_discussions (discussion_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT (discussion_id, user_id) DO NOTHING
    `, [id, user.id]);
    saved = true;
  }

  return Response.json({ saved });
}
