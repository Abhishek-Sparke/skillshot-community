import { getReadyDb } from '../../../../../lib/db';
import { requirePrincipal } from '../../../../../lib/authz';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requirePrincipal();
  if ('error' in auth) return auth.error;
  const user = auth.principal;

  const sql = await getReadyDb();
  const colRows = await sql.query(`SELECT user_id FROM collections WHERE id = $1 LIMIT 1`, [id]);
  if (!colRows.length) return Response.json({ error: 'Collection not found' }, { status: 404 });
  if (colRows[0].user_id !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await request.json();
    const postId = String(body.postId || '');
    if (!postId) return Response.json({ error: 'Post ID is required' }, { status: 400 });

    const postCheck = await sql.query(`SELECT id FROM posts WHERE id = $1 AND user_id = $2 LIMIT 1`, [postId, user.id]);
    if (!postCheck.length) return Response.json({ error: 'You can only add your own Skillshots to your collections' }, { status: 400 });

    const posRes = await sql.query(`SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM collection_posts WHERE collection_id = $1`, [id]);
    const nextPos = Number(posRes[0]?.next_pos || 1);

    await sql.query(`
      INSERT INTO collection_posts (collection_id, post_id, position)
      VALUES ($1, $2, $3)
      ON CONFLICT (collection_id, post_id) DO UPDATE SET position = $3
    `, [id, postId, nextPos]);

    return Response.json({ success: true, added: postId });
  } catch {
    return Response.json({ error: 'Failed to add post to collection' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requirePrincipal();
  if ('error' in auth) return auth.error;
  const user = auth.principal;

  const sql = await getReadyDb();
  const colRows = await sql.query(`SELECT user_id FROM collections WHERE id = $1 LIMIT 1`, [id]);
  if (!colRows.length) return Response.json({ error: 'Collection not found' }, { status: 404 });
  if (colRows[0].user_id !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const url = new URL(request.url);
  const postId = url.searchParams.get('postId');
  if (!postId) return Response.json({ error: 'Post ID is required' }, { status: 400 });

  await sql.query(`DELETE FROM collection_posts WHERE collection_id = $1 AND post_id = $2`, [id, postId]);
  return Response.json({ success: true, removed: postId });
}
