import { getChatGPTUser } from '../../../../chatgpt-auth';
import { ensureUser, getReadyDb } from '../../../../../lib/db';

async function targetFor(username: string) {
  const rows = await (await getReadyDb()).query(`SELECT id FROM users WHERE lower(username)=lower($1) LIMIT 1`, [username]);
  return rows[0]?.id ? String(rows[0].id) : null;
}

async function responseState(followerId: string, followedId: string) {
  const rows = await (await getReadyDb()).query(`
    SELECT
      (SELECT COUNT(*) FROM follows WHERE followed_id=$1) AS follower_count,
      EXISTS(SELECT 1 FROM follows WHERE follower_id=$2 AND followed_id=$1) AS following
  `, [followedId, followerId]);
  return Response.json({ followerCount: Number(rows[0].follower_count), following: Boolean(rows[0].following) });
}

export async function POST(_: Request, { params }: { params: Promise<{ username: string }> }) {
  const viewer = await getChatGPTUser();
  if (!viewer) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureUser(viewer);
  const { username } = await params;
  const followedId = await targetFor(username);
  if (!followedId) return Response.json({ error: 'Creator not found' }, { status: 404 });
  if (followedId === viewer.userId) return Response.json({ error: 'You cannot follow yourself' }, { status: 400 });
  await (await getReadyDb()).query(`INSERT INTO follows (follower_id, followed_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [viewer.userId, followedId]);
  return responseState(viewer.userId, followedId);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ username: string }> }) {
  const viewer = await getChatGPTUser();
  if (!viewer) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureUser(viewer);
  const { username } = await params;
  const followedId = await targetFor(username);
  if (!followedId) return Response.json({ error: 'Creator not found' }, { status: 404 });
  await (await getReadyDb()).query(`DELETE FROM follows WHERE follower_id=$1 AND followed_id=$2`, [viewer.userId, followedId]);
  return responseState(viewer.userId, followedId);
}
