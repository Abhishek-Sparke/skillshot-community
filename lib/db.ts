import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

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
  initialization ??= Promise.all([
    sql.query(`CREATE TABLE IF NOT EXISTS users (id text PRIMARY KEY, email text UNIQUE NOT NULL, display_name text NOT NULL, username text UNIQUE NOT NULL, bio text NOT NULL DEFAULT '', website text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now())`),
    sql.query(`CREATE TABLE IF NOT EXISTS posts (id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, title text NOT NULL, description text NOT NULL DEFAULT '', tags jsonb NOT NULL DEFAULT '[]'::jsonb, image_url text NOT NULL, image_type text NOT NULL, image_size integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`),
    sql.query(`CREATE TABLE IF NOT EXISTS reactions (id text PRIMARY KEY, post_id text NOT NULL REFERENCES posts(id) ON DELETE CASCADE, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(post_id, user_id))`),
    sql.query(`CREATE TABLE IF NOT EXISTS comments (id text PRIMARY KEY, post_id text NOT NULL REFERENCES posts(id) ON DELETE CASCADE, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`),
    sql.query(`CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC)`),
    sql.query(`CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id)`),
    sql.query(`CREATE INDEX IF NOT EXISTS idx_comments_post_created ON comments(post_id, created_at)`),
  ]);
  await initialization;
  return sql;
}

export type AppUser = { userId: string; email: string; displayName: string };

export async function ensureUser(user: AppUser) {
  const sql = await getReadyDb();
  const existing = await sql.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [user.userId]);
  if (existing.length) return existing[0] as Record<string, unknown>;
  const base = user.email.split('@')[0].replace(/[^a-z0-9_]/gi, '').toLowerCase().slice(0, 20) || 'creator';
  const suffix = crypto.randomUUID().slice(0, 6);
  await sql.query(`INSERT INTO users (id, email, display_name, username) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`, [user.userId, user.email, user.displayName, `${base}-${suffix}`]);
  const created = await sql.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [user.userId]);
  return created[0] as Record<string, unknown>;
}
