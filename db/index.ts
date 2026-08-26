import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

let initialization: Promise<unknown> | null = null;

export function getDb() {
  if (!env.DB) throw new Error('Cloudflare D1 binding `DB` is unavailable.');
  return drizzle(env.DB, { schema });
}

export async function getReadyDb() {
  if (!env.DB) throw new Error('Cloudflare D1 binding `DB` is unavailable.');
  initialization ??= env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS users (id text PRIMARY KEY NOT NULL, email text NOT NULL UNIQUE, display_name text NOT NULL, username text NOT NULL UNIQUE, bio text DEFAULT '' NOT NULL, website text DEFAULT '' NOT NULL, avatar_key text, email_verified_at integer, created_at integer NOT NULL)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS posts (id text PRIMARY KEY NOT NULL, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, title text NOT NULL, description text DEFAULT '' NOT NULL, tags text DEFAULT '[]' NOT NULL, image_key text NOT NULL, image_type text NOT NULL, image_size integer NOT NULL, created_at integer NOT NULL, updated_at integer NOT NULL)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS reactions (id text PRIMARY KEY NOT NULL, post_id text NOT NULL REFERENCES posts(id) ON DELETE CASCADE, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at integer NOT NULL)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS comments (id text PRIMARY KEY NOT NULL, post_id text NOT NULL REFERENCES posts(id) ON DELETE CASCADE, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, body text NOT NULL, created_at integer NOT NULL)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS verification_tokens (id text PRIMARY KEY NOT NULL, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash text NOT NULL UNIQUE, expires_at integer NOT NULL, used_at integer)`),
    env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_reactions_post_user ON reactions(post_id, user_id)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_comments_post_created ON comments(post_id, created_at)`),
  ]);
  await initialization;
  return drizzle(env.DB, { schema });
}
