import { and, eq } from 'drizzle-orm';
import { getChatGPTUser } from '../../../../chatgpt-auth';
import { getReadyDb } from '../../../../../db';
import { reactions } from '../../../../../db/schema';
import { ensureUser } from '../../../../../db/users';

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await ensureUser(user);
  const db = await getReadyDb();
  const existing = await db.select().from(reactions).where(and(eq(reactions.postId, id), eq(reactions.userId, user.userId))).limit(1);
  if (existing.length) await db.delete(reactions).where(eq(reactions.id, existing[0].id));
  else await db.insert(reactions).values({ id: crypto.randomUUID(), postId: id, userId: user.userId, createdAt: new Date() });
  return Response.json({ liked: !existing.length });
}
