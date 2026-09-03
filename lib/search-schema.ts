export const SEARCH_MIGRATION=[
  `ALTER TABLE posts ADD COLUMN IF NOT EXISTS search_vector tsvector GENERATED ALWAYS AS (to_tsvector('simple',coalesce(title,'')||' '||coalesce(description,'')||' '||coalesce(skills::text,'')||' '||coalesce(tags::text,'')||' '||coalesce(category,''))) STORED`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS search_vector tsvector GENERATED ALWAYS AS (to_tsvector('simple',coalesce(username,'')||' '||coalesce(display_name,'')||' '||coalesce(skills::text,''))) STORED`,
  `CREATE INDEX IF NOT EXISTS idx_posts_public_search ON posts USING gin(search_vector) WHERE status='VISIBLE'`,
  `CREATE INDEX IF NOT EXISTS idx_users_public_search ON users USING gin(search_vector) WHERE status='ACTIVE' AND profile_status='VISIBLE'`,
  `CREATE INDEX IF NOT EXISTS idx_users_username_prefix ON users(lower(username) text_pattern_ops)`,
  `CREATE INDEX IF NOT EXISTS idx_users_display_prefix ON users(lower(display_name) text_pattern_ops)`,
  `CREATE INDEX IF NOT EXISTS idx_posts_title_prefix ON posts(lower(title) text_pattern_ops)`,
];
