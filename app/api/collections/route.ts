import { getReadyDb } from '../../../lib/db';
import { requirePrincipal } from '../../../lib/authz';
import { syncCollectionPosts } from '../../../lib/collection-schema';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const username = url.searchParams.get('username');
  if (!username) return Response.json({ error: 'Username required' }, { status: 400 });

  const auth = await requirePrincipal();
  const viewerId = 'principal' in auth && auth.principal ? auth.principal.id : null;

  const sql = await getReadyDb();
  const userRows = await sql.query(`SELECT id FROM users WHERE lower(username)=lower($1) LIMIT 1`, [username]);
  if (!userRows.length) return Response.json({ error: 'User not found' }, { status: 404 });
  const targetUserId = String(userRows[0].id);
  const isOwner = viewerId === targetUserId;

  const collections = await sql.query(`
    SELECT c.id, c.user_id, c.name, c.description, c.cover_url, c.is_private, c.is_featured, c.position, c.created_at,
      (SELECT COUNT(*) FROM collection_posts cp JOIN posts p ON p.id = cp.post_id WHERE cp.collection_id = c.id AND p.status='VISIBLE') AS post_count,
      COALESCE(
        c.cover_url,
        (SELECT CASE WHEN lower(p.image_type) = 'image/gif' THEN '/api/images/' || p.id ELSE '/api/images/' || p.id || '?variant=thumbnail' END
         FROM collection_posts cp JOIN posts p ON p.id = cp.post_id
         WHERE cp.collection_id = c.id AND p.status = 'VISIBLE'
         ORDER BY cp.position ASC, cp.created_at DESC LIMIT 1)
      ) AS folder_cover
    FROM collections c
    WHERE c.user_id = $1 ${isOwner ? '' : 'AND c.is_private = false'}
    ORDER BY c.position ASC, c.created_at DESC
  `, [targetUserId]);

  return Response.json({
    collections: collections.map(col => ({
      id: String(col.id),
      userId: String(col.user_id),
      name: String(col.name),
      description: String(col.description || ''),
      coverUrl: col.folder_cover ? String(col.folder_cover) : null,
      isPrivate: Boolean(col.is_private),
      isFeatured: Boolean(col.is_featured),
      position: Number(col.position),
      postCount: Number(col.post_count),
      createdAt: new Date(col.created_at as string).getTime(),
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requirePrincipal();
  if ('error' in auth) return auth.error;
  const user = auth.principal;

  try {
    const body = await request.json();
    const name = String(body.name || '').trim().slice(0, 60);
    if (!name) return Response.json({ error: 'Collection name is required.' }, { status: 400 });
    const description = String(body.description || '').trim().slice(0, 280);
    const isPrivate = Boolean(body.isPrivate);
    const isFeatured = Boolean(body.isFeatured);
    const coverUrl = body.coverUrl ? String(body.coverUrl) : null;

    const sql = await getReadyDb();
    const posRes = await sql.query(`SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM collections WHERE user_id = $1`, [user.id]);
    const nextPos = Number(posRes[0]?.next_pos || 1);

    const inserted = await sql.query(`
      INSERT INTO collections (id, user_id, name, description, cover_url, is_private, is_featured, position)
      VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [user.id, name, description, coverUrl, isPrivate, isFeatured, nextPos]);

    const row = inserted[0];
    await syncCollectionPosts(sql, String(row.id), user.id, body.postIds);
    const postCountRows = await sql.query(
      `SELECT COUNT(*) AS post_count FROM collection_posts cp JOIN posts p ON p.id = cp.post_id WHERE cp.collection_id = $1 AND p.status='VISIBLE'`,
      [row.id],
    );
    return Response.json({
      collection: {
        id: String(row.id),
        userId: String(row.user_id),
        name: String(row.name),
        description: String(row.description || ''),
        coverUrl: row.cover_url ? String(row.cover_url) : null,
        isPrivate: Boolean(row.is_private),
        isFeatured: Boolean(row.is_featured),
        position: Number(row.position),
        postCount: Number(postCountRows[0]?.post_count || 0),
        createdAt: new Date(row.created_at as string).getTime(),
      },
    }, { status: 201 });
  } catch {
    return Response.json({ error: 'Failed to create collection.' }, { status: 500 });
  }
}
