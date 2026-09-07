export const COMMUNITY_MIGRATION = [
  `CREATE TABLE IF NOT EXISTS discussions (
    id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title text NOT NULL,
    summary text NOT NULL DEFAULT '',
    content text NOT NULL,
    category text NOT NULL DEFAULT 'General',
    image_url text,
    image_type text,
    is_gif boolean NOT NULL DEFAULT false,
    is_announcement boolean NOT NULL DEFAULT false,
    is_pinned boolean NOT NULL DEFAULT false,
    is_locked boolean NOT NULL DEFAULT false,
    status text NOT NULL DEFAULT 'VISIBLE',
    reaction_count integer NOT NULL DEFAULT 0,
    reply_count integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS discussion_replies (
    id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    discussion_id text NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body text NOT NULL,
    status text NOT NULL DEFAULT 'VISIBLE',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS discussion_reactions (
    id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    discussion_id text NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(discussion_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS saved_discussions (
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    discussion_id text NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, discussion_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_discussions_feed ON discussions(status, is_pinned DESC, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_discussions_category ON discussions(category, status, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_discussions_user ON discussions(user_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_discussion_replies_parent ON discussion_replies(discussion_id, created_at ASC)`,
  `CREATE INDEX IF NOT EXISTS idx_discussion_reactions_disc ON discussion_reactions(discussion_id)`,
  `CREATE INDEX IF NOT EXISTS idx_saved_discussions_user ON saved_discussions(user_id, created_at DESC)`
];
