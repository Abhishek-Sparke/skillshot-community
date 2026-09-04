import { getReadyDb } from '../../../../../lib/db';
import { rateLimit } from '../../../../../lib/rate-limit';
import { requirePrincipal } from '../../../../../lib/authz';
import { isBlockBetween } from '../../../../../lib/chat';

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
  const auth=await requirePrincipal();if('error'in auth)return auth.error;const viewerId=auth.principal.id;
  if (!await rateLimit(`follow:${viewerId}`, 40, 600)) return Response.json({ error: 'Too many follow actions.' }, { status: 429 });
  const { username } = await params;
  const followedId = await targetFor(username);
  if (!followedId) return Response.json({ error: 'Creator not found' }, { status: 404 });
  if (followedId === viewerId) return Response.json({ error: 'You cannot follow yourself' }, { status: 400 });

  const blocks = await isBlockBetween(viewerId, followedId);
  if (blocks.isBlockedByYou || blocks.isBlockedByThem) {
    return Response.json({ error: 'Cannot follow this user due to block status' }, { status: 403 });
  }

  const db = await getReadyDb();
  const insertRes = await db.query(
    `INSERT INTO follows (follower_id, followed_id) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING 1`,
    [viewerId, followedId]
  );

  if (insertRes.length > 0) {
    const followerUsername = String(auth.principal.profile.username || 'someone');
    const followerName = String(auth.principal.profile.display_name || followerUsername);
    await db.query(
      `INSERT INTO notifications (id, user_id, type, title, body, event_key, target_url)
       VALUES ($1, $2, 'FOLLOW', $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [
        crypto.randomUUID(),
        followedId,
        `@${followerUsername} started following you`,
        `${followerName} (@${followerUsername}) started following you.`,
        `follow:${viewerId}:${followedId}`,
        `/users/${encodeURIComponent(followerUsername)}`
      ]
    );
  }

  return responseState(viewerId, followedId);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ username: string }> }) {
  const auth=await requirePrincipal();if('error'in auth)return auth.error;const viewerId=auth.principal.id;
  const { username } = await params;
  const followedId = await targetFor(username);
  if (!followedId) return Response.json({ error: 'Creator not found' }, { status: 404 });
  await (await getReadyDb()).query(`DELETE FROM follows WHERE follower_id=$1 AND followed_id=$2`, [viewerId, followedId]);
  return responseState(viewerId, followedId);
}
