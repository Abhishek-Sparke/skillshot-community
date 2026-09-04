import { getReadyDb } from '../../../../../lib/db';
import { requirePrincipal, getPrincipal } from '../../../../../lib/authz';
import { isBlockBetween } from '../../../../../lib/chat';

async function targetFor(username: string) {
  const rows = await (await getReadyDb()).query(`SELECT id, username, display_name FROM users WHERE lower(username)=lower($1) LIMIT 1`, [username]);
  return rows[0] || null;
}

export async function GET(_: Request, { params }: { params: Promise<{ username: string }> }) {
  const principal = await getPrincipal();
  if (!principal) return Response.json({ isBlockedByYou: false, isBlockedByThem: false });

  const { username } = await params;
  const target = await targetFor(username);
  if (!target) return Response.json({ error: 'User not found' }, { status: 404 });

  const blocks = await isBlockBetween(principal.id, target.id);
  return Response.json(blocks);
}

export async function POST(_: Request, { params }: { params: Promise<{ username: string }> }) {
  const auth = await requirePrincipal();
  if ('error' in auth) return auth.error;
  const viewerId = auth.principal.id;

  const { username } = await params;
  const target = await targetFor(username);
  if (!target) return Response.json({ error: 'User not found' }, { status: 404 });
  if (target.id === viewerId) return Response.json({ error: 'You cannot block yourself' }, { status: 400 });

  const db = await getReadyDb();
  const existing = await db.query(
    `SELECT 1 FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2`,
    [viewerId, target.id]
  );

  if (existing.length > 0) {
    // Unblock
    await db.query(`DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2`, [viewerId, target.id]);
    return Response.json({ blocked: false });
  } else {
    // Block
    await db.query(`INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [viewerId, target.id]);
    // Also sever any mutual follows between them
    await db.query(
      `DELETE FROM follows WHERE (follower_id = $1 AND followed_id = $2) OR (follower_id = $2 AND followed_id = $1)`,
      [viewerId, target.id]
    );
    return Response.json({ blocked: true });
  }
}
