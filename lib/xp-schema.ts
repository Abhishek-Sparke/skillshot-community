export const XP_MIGRATION = [
  `CREATE TABLE IF NOT EXISTS xp_events (
    id text PRIMARY KEY,user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount integer NOT NULL CHECK(amount<>0),event_type text NOT NULL,reason text NOT NULL,
    related_type text,related_id text,action_id text NOT NULL UNIQUE,
    reverses_event_id text REFERENCES xp_events(id),created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_xp_events_user_created ON xp_events(user_id,created_at DESC,id DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_xp_events_related ON xp_events(related_type,related_id)`,
];
