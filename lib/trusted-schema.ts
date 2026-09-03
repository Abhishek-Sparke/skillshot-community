export const TRUSTED_MIGRATION=[
  `CREATE TABLE IF NOT EXISTS community_config(key text PRIMARY KEY,value jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now(),updated_by text REFERENCES users(id))`,
  `INSERT INTO community_config(key,value)VALUES('trusted', '{"accountDays":7,"posts":3,"participation":3,"rejectionDays":30,"appealDays":14,"appealsEnabled":true,"violationDays":90}') ON CONFLICT DO NOTHING`,
  `ALTER TABLE trusted_contributor_applications ADD COLUMN IF NOT EXISTS content_types text NOT NULL DEFAULT ''`,
  `ALTER TABLE trusted_contributor_applications ADD COLUMN IF NOT EXISTS public_note text NOT NULL DEFAULT ''`,
  `ALTER TABLE trusted_contributor_applications ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'APPLICATION'`,
  `ALTER TABLE trusted_contributor_applications ADD COLUMN IF NOT EXISTS parent_id text REFERENCES trusted_contributor_applications(id)`,
  `ALTER TABLE trusted_contributor_applications ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 0`,
  `ALTER TABLE trusted_contributor_applications ADD COLUMN IF NOT EXISTS workflow_v2 boolean NOT NULL DEFAULT false`,
  `CREATE UNIQUE INDEX IF NOT EXISTS trusted_one_active_v2 ON trusted_contributor_applications(user_id) WHERE workflow_v2 AND status IN ('PENDING','UNDER_REVIEW','MORE_INFO','SUSPENDED')`,
  `CREATE INDEX IF NOT EXISTS trusted_user_history ON trusted_contributor_applications(user_id,created_at DESC)`,
];
