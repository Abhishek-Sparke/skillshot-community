import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { OWNER_EMAIL, PRIMARY_ADMIN_EMAIL, normalizeRole, roleForEmail } from './roles';

let client: NeonQueryFunction<false, false> | null = null;
let initialization: Promise<unknown> | null = null;

export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not configured.');
  client ??= neon(url);
  return client;
}

export async function getReadyDb() {
  const sql = getDb();
  // These statements depend on one another, so run them in order. Executing
  // them concurrently can try to create posts before users (or indexes before
  // their tables), leaving a fresh database only partially initialized.
  initialization ??= (async () => {
    await sql.query(`CREATE TABLE IF NOT EXISTS users (id text PRIMARY KEY, email text UNIQUE NOT NULL, display_name text NOT NULL, username text UNIQUE NOT NULL, bio text NOT NULL DEFAULT '', website text NOT NULL DEFAULT '', role text NOT NULL DEFAULT 'member', created_at timestamptz NOT NULL DEFAULT now())`);
    await sql.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'USER'`);
    await sql.query(`UPDATE users SET role='USER' WHERE lower(role)='member'`);
    await sql.query(`UPDATE users SET role=upper(role)`);
    await sql.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ACTIVE'`);
    await sql.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_permissions jsonb NOT NULL DEFAULT '[]'::jsonb`);
    await sql.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS location text NOT NULL DEFAULT ''`);
    await sql.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS skills jsonb NOT NULL DEFAULT '[]'::jsonb`);
    await sql.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS social_links jsonb NOT NULL DEFAULT '{}'::jsonb`);
    await sql.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text`);
    await sql.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_type text`);
    await sql.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_size integer`);
    if (PRIMARY_ADMIN_EMAIL) await sql.query(`UPDATE users SET role='ADMIN' WHERE lower(email)=$1 AND role NOT IN ('OWNER','ADMIN')`, [PRIMARY_ADMIN_EMAIL]);
    if (OWNER_EMAIL) await sql.query(`UPDATE users SET role='OWNER' WHERE lower(email)=$1`, [OWNER_EMAIL]);
    await sql.query(`CREATE TABLE IF NOT EXISTS posts (id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, title text NOT NULL, description text NOT NULL DEFAULT '', tags jsonb NOT NULL DEFAULT '[]'::jsonb, image_url text NOT NULL, image_type text NOT NULL, image_size integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`);
    await sql.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'VISIBLE'`);
    await sql.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS moderation_category text`);
    await sql.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS display_url text`);
    await sql.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS thumbnail_url text`);
    await sql.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS display_size integer NOT NULL DEFAULT 0`);
    await sql.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS thumbnail_size integer NOT NULL DEFAULT 0`);
    await sql.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_width integer`);
    await sql.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_height integer`);
    await sql.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS skills jsonb NOT NULL DEFAULT '[]'::jsonb`);
    await sql.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Other'`);
    await sql.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS deleted_at timestamptz`);
    await sql.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS legal_hold boolean NOT NULL DEFAULT false`);
    await sql.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS appeal_hold boolean NOT NULL DEFAULT false`);
    await sql.query(`CREATE TABLE IF NOT EXISTS reactions (id text PRIMARY KEY, post_id text NOT NULL REFERENCES posts(id) ON DELETE CASCADE, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(post_id, user_id))`);
    await sql.query(`CREATE TABLE IF NOT EXISTS comments (id text PRIMARY KEY, post_id text NOT NULL REFERENCES posts(id) ON DELETE CASCADE, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`);
    await sql.query(`ALTER TABLE comments ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'VISIBLE'`);
    await sql.query(`CREATE TABLE IF NOT EXISTS reports (id text PRIMARY KEY, reporter_id text NOT NULL REFERENCES users(id), target_type text NOT NULL, target_id text NOT NULL, category text NOT NULL, details text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'PENDING', created_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz, resolved_by text REFERENCES users(id), UNIQUE(reporter_id,target_type,target_id))`);
    await sql.query(`CREATE TABLE IF NOT EXISTS moderation_queue (id text PRIMARY KEY, source text NOT NULL, target_type text NOT NULL, target_id text NOT NULL, creator_id text REFERENCES users(id), category text NOT NULL, severity text NOT NULL, status text NOT NULL DEFAULT 'PENDING', provider_ref text, created_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz, reviewed_by text REFERENCES users(id))`);
    await sql.query(`CREATE TABLE IF NOT EXISTS appeals (id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id), target_type text NOT NULL, target_id text NOT NULL, reason text NOT NULL, explanation text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'PENDING', created_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz, reviewed_by text REFERENCES users(id))`);
    await sql.query(`CREATE TABLE IF NOT EXISTS trusted_contributor_applications (id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id), reason text NOT NULL, contribution text NOT NULL, portfolio_url text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'PENDING', created_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz, reviewed_by text REFERENCES users(id), review_note text NOT NULL DEFAULT '')`);
    await sql.query(`CREATE TABLE IF NOT EXISTS audit_logs (id text PRIMARY KEY, actor_id text REFERENCES users(id), action text NOT NULL, target_type text NOT NULL, target_id text NOT NULL, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now())`);
    await sql.query(`CREATE TABLE IF NOT EXISTS notifications (id text PRIMARY KEY, user_id text REFERENCES users(id), audience text NOT NULL DEFAULT 'USER', type text NOT NULL, title text NOT NULL, body text NOT NULL DEFAULT '', read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now())`);
    await sql.query(`CREATE TABLE IF NOT EXISTS rate_limits (key text PRIMARY KEY, count integer NOT NULL, window_start timestamptz NOT NULL)`);
    await sql.query(`CREATE TABLE IF NOT EXISTS upload_events (id text PRIMARY KEY, user_id text REFERENCES users(id) ON DELETE SET NULL, kind text NOT NULL, outcome text NOT NULL, bytes integer NOT NULL DEFAULT 0, reason text, created_at timestamptz NOT NULL DEFAULT now())`);
    await sql.query(`CREATE TABLE IF NOT EXISTS upload_sessions (pathname text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id), state text NOT NULL DEFAULT 'PENDING', post_id text, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`);
    await sql.query(`CREATE INDEX IF NOT EXISTS idx_upload_sessions_expiry ON upload_sessions(expires_at)`);
    await sql.query(`CREATE TABLE IF NOT EXISTS storage_cleanup_queue (id text PRIMARY KEY, post_id text, pathname text NOT NULL, reason text NOT NULL, cleanup_after timestamptz NOT NULL, reviewed_at timestamptz, deleted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now())`);
    await sql.query(`CREATE TABLE IF NOT EXISTS storage_orphan_reviews (id text PRIMARY KEY, kind text NOT NULL, pathname text NOT NULL, details text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'OPEN', created_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz, reviewed_by text REFERENCES users(id), UNIQUE(kind,pathname))`);
    await sql.query(`CREATE TABLE IF NOT EXISTS storage_scans (id text PRIMARY KEY, file_count integer NOT NULL, total_bytes bigint NOT NULL, complete boolean NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`);
    await sql.query(`CREATE TABLE IF NOT EXISTS follows (follower_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, followed_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (follower_id, followed_id), CHECK (follower_id <> followed_id))`);
    await sql.query(`CREATE TABLE IF NOT EXISTS featured_posts (user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, post_id text NOT NULL REFERENCES posts(id) ON DELETE CASCADE, position smallint NOT NULL CHECK (position BETWEEN 1 AND 3), created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (user_id, post_id), UNIQUE (user_id, position))`);
    await sql.query(`CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC)`);
    await sql.query(`CREATE INDEX IF NOT EXISTS idx_posts_visible_created ON posts(status, created_at DESC, id DESC)`);
    await sql.query(`CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id)`);
    await sql.query(`CREATE INDEX IF NOT EXISTS idx_comments_post_created ON comments(post_id, created_at)`);
    await sql.query(`CREATE INDEX IF NOT EXISTS idx_follows_followed_id ON follows(followed_id)`);
    await sql.query(`CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows(follower_id)`);
    await sql.query(`CREATE INDEX IF NOT EXISTS idx_featured_posts_user ON featured_posts(user_id, position)`);
    await sql.query(`CREATE INDEX IF NOT EXISTS idx_reports_status_created ON reports(status, created_at)`);
    await sql.query(`CREATE INDEX IF NOT EXISTS idx_moderation_status_created ON moderation_queue(status, created_at)`);
    await sql.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC)`);
    await sql.query(`CREATE INDEX IF NOT EXISTS idx_appeals_user_created ON appeals(user_id, created_at DESC)`);
    await sql.query(`CREATE INDEX IF NOT EXISTS idx_upload_events_created ON upload_events(created_at DESC)`);
    await sql.query(`CREATE INDEX IF NOT EXISTS idx_cleanup_due ON storage_cleanup_queue(cleanup_after) WHERE deleted_at IS NULL`);
    await sql.query(`CREATE INDEX IF NOT EXISTS idx_orphan_reviews_status ON storage_orphan_reviews(status,last_seen_at DESC)`);
  })();
  await initialization;
  return sql;
}

export type AppUser = { userId: string; email: string; displayName: string };

export async function ensureUser(user: AppUser) {
  const sql = await getReadyDb();
  const existing = await sql.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [user.userId]);
  if (existing.length) {
    const assignedRole = roleForEmail(user.email);
    if (assignedRole && normalizeRole(existing[0].role) !== assignedRole) {
      const promoted = await sql.query(`UPDATE users SET role=$2 WHERE id=$1 RETURNING *`, [user.userId, assignedRole]);
      return promoted[0] as Record<string, unknown>;
    }
    return existing[0] as Record<string, unknown>;
  }
  const base = user.email.split('@')[0].replace(/[^a-z0-9_]/gi, '').toLowerCase().slice(0, 20) || 'creator';
  const suffix = crypto.randomUUID().slice(0, 6);
  await sql.query(`INSERT INTO users (id, email, display_name, username, role) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`, [user.userId, user.email, user.displayName, `${base}-${suffix}`, roleForEmail(user.email) ?? 'USER']);
  const created = await sql.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [user.userId]);
  return created[0] as Record<string, unknown>;
}
