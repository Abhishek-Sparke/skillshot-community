import { getReadyDb } from '../../../../../lib/db';
import { requirePrincipal } from '../../../../../lib/authz';

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requirePrincipal();
  if ('error' in auth) return auth.error;
  const user = auth.principal;

  const sql = await getReadyDb();

  // 1. Verify post exists, belongs to user, and is visible
  const postRows = await sql.query(
    `SELECT id, user_id FROM posts WHERE id = $1 AND user_id = $2 AND status = 'VISIBLE' LIMIT 1`,
    [id, user.id]
  );
  if (!postRows.length) {
    return Response.json({ error: 'Post not found or you do not have permission to pin it' }, { status: 404 });
  }

  // 2. Check if already pinned
  const existing = await sql.query(
    `SELECT position FROM featured_posts WHERE user_id = $1 AND post_id = $2 LIMIT 1`,
    [user.id, id]
  );

  if (existing.length > 0) {
    // Unpin
    await sql.query(`DELETE FROM featured_posts WHERE user_id = $1 AND post_id = $2`, [user.id, id]);
    return Response.json({ pinned: false, message: 'Unpinned from your profile.' });
  }

  // 3. Pin: check how many currently pinned
  const currentFeatured = await sql.query(
    `SELECT post_id, position FROM featured_posts WHERE user_id = $1 ORDER BY position ASC`,
    [user.id]
  );

  if (currentFeatured.length >= 3) {
    // If already 3 pinned, rotate: remove the 3rd one to make room
    await sql.query(`DELETE FROM featured_posts WHERE user_id = $1 AND position = 3`, [user.id]);
  }

  const occupiedPositions = new Set(currentFeatured.map((r: Record<string, unknown>) => Number(r.position)));
  let targetPosition = 1;
  for (let p = 1; p <= 3; p++) {
    if (!occupiedPositions.has(p)) {
      targetPosition = p;
      break;
    }
  }

  await sql.query(
    `INSERT INTO featured_posts (user_id, post_id, position)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, post_id) DO UPDATE SET position = $3`,
    [user.id, id, targetPosition]
  );

  return Response.json({
    pinned: true,
    position: targetPosition,
    message: 'Pinned to your profile spotlight (top 3)!',
  });
}
