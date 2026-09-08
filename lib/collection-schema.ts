export const COLLECTION_MIGRATION = [
  `CREATE TABLE IF NOT EXISTS collections (
    id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text NOT NULL DEFAULT '',
    cover_url text,
    is_private boolean NOT NULL DEFAULT false,
    is_featured boolean NOT NULL DEFAULT false,
    position integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS collection_posts (
    collection_id text NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    post_id text NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    position integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (collection_id, post_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_collections_user_pos ON collections(user_id, position ASC, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_collection_posts_order ON collection_posts(collection_id, position ASC, created_at DESC)`
];

type SqlClient = { query: (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]> };

export async function syncCollectionPosts(sql: SqlClient, collectionId: string, userId: string, postIds: unknown) {
  if (!Array.isArray(postIds)) return;
  const unique = [...new Set(postIds.map(id => String(id || '').trim()).filter(Boolean))].slice(0, 80);
  await sql.query(`DELETE FROM collection_posts WHERE collection_id = $1`, [collectionId]);
  if (!unique.length) {
    await sql.query(`UPDATE collections SET cover_url = NULL, updated_at = now() WHERE id = $1`, [collectionId]);
    return;
  }
  const owned = await sql.query(
    `SELECT id FROM posts WHERE user_id = $1 AND status = 'VISIBLE' AND id = ANY($2::text[])`,
    [userId, unique],
  );
  const ownedSet = new Set(owned.map(row => String(row.id)));
  const valid = unique.filter(id => ownedSet.has(id));
  for (let index = 0; index < valid.length; index++) {
    await sql.query(
      `INSERT INTO collection_posts (collection_id, post_id, position) VALUES ($1, $2, $3)`,
      [collectionId, valid[index], index + 1],
    );
  }
  const cover = valid[0] ? `/api/images/${valid[0]}?variant=thumbnail` : null;
  await sql.query(`UPDATE collections SET cover_url = $2, updated_at = now() WHERE id = $1`, [collectionId, cover]);
}
