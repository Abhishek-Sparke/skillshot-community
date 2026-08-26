import { eq } from 'drizzle-orm';
import type { ChatGPTUser } from '../app/chatgpt-auth';
import { users } from './schema';
import { getReadyDb } from '.';

export async function ensureUser(user: ChatGPTUser) {
  const db = await getReadyDb();
  const [existing] = await db.select().from(users).where(eq(users.id, user.userId)).limit(1);
  if (existing) return existing;

  const base = user.email.split('@')[0].replace(/[^a-z0-9_]/gi, '').toLowerCase().slice(0, 20) || 'creator';
  const suffix = user.userId.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(-6) || crypto.randomUUID().slice(0, 6);
  const username = `${base}-${suffix}`;
  const now = new Date();
  await db.insert(users).values({
    id: user.userId,
    email: user.email,
    displayName: user.displayName,
    username,
    emailVerifiedAt: now,
    createdAt: now,
  }).onConflictDoNothing();

  const [created] = await db.select().from(users).where(eq(users.id, user.userId)).limit(1);
  return created;
}
