export const CHAT_MIGRATION = [
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at timestamptz DEFAULT now()`,
  `CREATE TABLE IF NOT EXISTS conversations (
    id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS conversation_participants (
    conversation_id text NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at timestamptz NOT NULL DEFAULT now(),
    last_read_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (conversation_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    conversation_id text NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_type text NOT NULL DEFAULT 'TEXT',
    content text NOT NULL DEFAULT '',
    reply_to_id text REFERENCES messages(id) ON DELETE SET NULL,
    status text NOT NULL DEFAULT 'VISIBLE',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS message_attachments (
    id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    message_id text NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    attachment_type text NOT NULL,
    url text NOT NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS message_reactions (
    id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    message_id text NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(message_id, user_id, emoji)
  )`,
  `CREATE TABLE IF NOT EXISTS pinned_messages (
    conversation_id text NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    message_id text NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    pinned_by text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (conversation_id, message_id)
  )`,
  `CREATE TABLE IF NOT EXISTS user_blocks (
    blocker_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (blocker_id, blocked_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_conv_part_user ON conversation_participants(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages(conversation_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id)`,
  `CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON message_reactions(message_id)`,
  `CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks(blocked_id)`,
];
