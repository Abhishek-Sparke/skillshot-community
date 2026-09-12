export const DISCORD_MIGRATION = [
  `CREATE TABLE IF NOT EXISTS discord_connections (
    id text PRIMARY KEY,
    skillshot_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    discord_user_id text NOT NULL,
    discord_username_snapshot text NOT NULL DEFAULT '',
    connected_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    last_sync_at timestamptz,
    sync_status text NOT NULL DEFAULT 'PENDING',
    last_error text,
    UNIQUE(skillshot_user_id),
    UNIQUE(discord_user_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_discord_connections_user ON discord_connections(skillshot_user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_discord_connections_discord_user ON discord_connections(discord_user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_discord_connections_status ON discord_connections(sync_status)`,

  `CREATE TABLE IF NOT EXISTS discord_sync_queue (
    id text PRIMARY KEY,
    skillshot_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    discord_user_id text NOT NULL,
    target_rank text NOT NULL,
    target_role_id text NOT NULL,
    status text NOT NULL DEFAULT 'PENDING',
    attempts integer NOT NULL DEFAULT 0,
    last_attempt_at timestamptz,
    error_message text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_discord_sync_queue_status ON discord_sync_queue(status, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_discord_sync_queue_user ON discord_sync_queue(skillshot_user_id)`,

  `CREATE TABLE IF NOT EXISTS discord_verification_messages (
    id text PRIMARY KEY,
    channel_id text NOT NULL UNIQUE,
    message_id text,
    last_posted_at timestamptz,
    status text NOT NULL DEFAULT 'ACTIVE',
    last_error text
  )`,
  `CREATE INDEX IF NOT EXISTS idx_discord_verif_channel ON discord_verification_messages(channel_id)`
];
