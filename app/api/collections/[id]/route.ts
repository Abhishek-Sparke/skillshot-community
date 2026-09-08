import { getReadyDb } from '../../../../lib/db';
import { requirePrincipal } from '../../../../lib/authz';
import { syncCollectionPosts } from '../../../../lib/collection-schema';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requirePrincipal();
  const viewerId = 'principal' in auth && auth.principal ? auth.principal.id : null;

  const sql = await getReadyDb();
  const rows = await sql.query(`SELECT * FROM collections WHERE id = $1 LIMIT 1`, [id]);
  if (!rows.length) return Response.json({ error: 'Collection not found' }, { status: 404 });
  const col = rows[0];

  if (col.is_private && col.user_id !== viewerId) {
    return Response.json({ error: 'Collection is private' }, { status: 403 });
  }

  // Fetch posts inside collection
  const postRows = await sql.query(`
    SELECT p.id, p.title, p.description, p.image_url, p.image_width, p.image_height, p.image_type, p.created_at,
      u.username, u.display_name, u.role,
      (SELECT COUNT(*) FROM reactions r WHERE r.post_id = p.id) AS reaction_count,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.status='VISIBLE') AS comment_count
    FROM collection_posts cp
    JOIN posts p ON p.id = cp.post_id
    JOIN users u ON u.id = p.user_id
    WHERE cp.collection_id = $1 AND p.status='VISIBLE'
    ORDER BY cp.position ASC, cp.created_at DESC
  `, [id]);

  return Response.json({
    collection: {
      id: String(col.id),
      userId: String(col.user_id),
      name: String(col.name),
      description: String(col.description || ''),
      coverUrl: col.cover_url ? String(col.cover_url) : null,
      isPrivate: Boolean(col.is_private),
      isFeatured: Boolean(col.is_featured),
      position: Number(col.position),
      createdAt: new Date(col.created_at as string).getTime(),
      posts: postRows.map(p => ({
        id: String(p.id),
        title: String(p.title),
        description: String(p.description || ''),
        imageWidth: Number(p.image_width) || 4,
        imageHeight: Number(p.image_height) || 3,
        isGif: String(p.image_type).toLowerCase() === 'image/gif',
        imageUrl: String(p.image_type).toLowerCase() === 'image/gif' ? `/api/images/${p.id}` : `/api/images/${p.id}?variant=thumbnail`,
        previewUrl: `/api/images/${p.id}?variant=display`,
        author: String(p.display_name),
        username: String(p.username),
        reactionCount: Number(p.reaction_count),
        commentCount: Number(p.comment_count),
        createdAt: new Date(p.created_at as string).getTime(),
      })),
    },
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requirePrincipal();
  if ('error' in auth) return auth.error;
  const user = auth.principal;

  const sql = await getReadyDb();
  const existing = await sql.query(`SELECT * FROM collections WHERE id = $1 LIMIT 1`, [id]);
  if (!existing.length) return Response.json({ error: 'Collection not found' }, { status: 404 });
  if (existing[0].user_id !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await request.json();
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (typeof body.name === 'string') {
      const trimmed = body.name.trim().slice(0, 60);
      if (!trimmed) return Response.json({ error: 'Name cannot be empty' }, { status: 400 });
      updates.push(`name = $${idx++}`);
      values.push(trimmed);
    }
    if (typeof body.description === 'string') {
      updates.push(`description = $${idx++}`);
      values.push(body.description.trim().slice(0, 280));
    }
    if (typeof body.isPrivate === 'boolean') {
      updates.push(`is_private = $${idx++}`);
      values.push(body.isPrivate);
    }
    if (typeof body.isFeatured === 'boolean') {
      updates.push(`is_featured = $${idx++}`);
      values.push(body.isFeatured);
    }
    if (typeof body.position === 'number') {
      updates.push(`position = $${idx++}`);
      values.push(body.position);
    }
    if (body.coverUrl !== undefined) {
      updates.push(`cover_url = $${idx++}`);
      values.push(body.coverUrl ? String(body.coverUrl) : null);
    }

    const hasPostIds = Array.isArray(body.postIds);
    if (!updates.length && !hasPostIds) return Response.json({ error: 'No updates provided' }, { status: 400 });

    let row = existing[0];
    if (updates.length) {
      updates.push(`updated_at = now()`);
      values.push(id);
      const updated = await sql.query(
        `UPDATE collections SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );
      row = updated[0];
    } else {
      const latest = await sql.query(`SELECT * FROM collections WHERE id = $1 LIMIT 1`, [id]);
      row = latest[0];
    }

    if (hasPostIds) await syncCollectionPosts(sql, id, user.id, body.postIds);
    return Response.json({
      collection: {
        id: String(row.id),
        name: String(row.name),
        description: String(row.description || ''),
        isPrivate: Boolean(row.is_private),
        isFeatured: Boolean(row.is_featured),
        position: Number(row.position),
      },
    });
  } catch {
    return Response.json({ error: 'Failed to update collection' }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requirePrincipal();
  if ('error' in auth) return auth.error;
  const user = auth.principal;

  const sql = await getReadyDb();
  const existing = await sql.query(`SELECT user_id FROM collections WHERE id = $1 LIMIT 1`, [id]);
  if (!existing.length) return Response.json({ error: 'Collection not found' }, { status: 404 });
  if (existing[0].user_id !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 });

  await sql.query(`DELETE FROM collections WHERE id = $1`, [id]);
  return Response.json({ success: true });
}
