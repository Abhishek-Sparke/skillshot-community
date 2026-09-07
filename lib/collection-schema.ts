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
