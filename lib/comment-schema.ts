export const COMMENT_MIGRATION=[
  `ALTER TABLE comments ADD COLUMN IF NOT EXISTS edited_at timestamptz`,
  `ALTER TABLE posts ADD COLUMN IF NOT EXISTS pinned_comment_id text REFERENCES comments(id) ON DELETE SET NULL`,
  `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS event_key text`,
  `CREATE UNIQUE INDEX IF NOT EXISTS notifications_event_key ON notifications(event_key) WHERE event_key IS NOT NULL`,
  `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_url text`,
];
