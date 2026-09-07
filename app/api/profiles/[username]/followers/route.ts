import { getReadyDb } from '../../../../../lib/db';
import { getPrincipal, requirePrincipal } from '../../../../../lib/authz';

async function targetFor(username: string) {
  const rows = await (await getReadyDb()).query(`SELECT id, username, display_name FROM users WHERE lower(username)=lower($1) LIMIT 1`, [username]);
  return rows[0] || null;
}

export async function GET(request: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const target = await targetFor(username);
  if (!target) return Response.json({ error: 'User not found' }, { status: 404 });

  const principal = await getPrincipal();
  const viewerId = principal?.id || null;
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim().toLowerCase();

  const db = await getReadyDb();
  let query = `
    SELECT 
      u.id, 
      u.username, 
      u.display_name, 
      u.avatar_url, 
      u.role,
      u.creator_rank,
      u.status,
      f.created_at as followed_at,
      ${viewerId ? `EXISTS(SELECT 1 FROM follows f2 WHERE f2.follower_id = $2 AND f2.followed_id = u.id) as is_following` : `false as is_following`}
    FROM follows f
    JOIN users u ON u.id = f.follower_id
    WHERE f.followed_id = $1
      AND u.status = 'ACTIVE'
  `;
  const queryParams: unknown[] = [target.id];
  if (viewerId) queryParams.push(viewerId);

  if (q) {
    queryParams.push(`%${q}%`);
    query += ` AND (lower(u.username) LIKE $${queryParams.length} OR lower(u.display_name) LIKE $${queryParams.length})`;
  }

  query += ` ORDER BY f.created_at DESC LIMIT 100`;

  const rows = await db.query(query, queryParams);

  return Response.json({
    followers: rows.map(r => ({
      id: r.id,
      username: r.username,
      displayName: r.display_name,
      avatarUrl: r.avatar_url ? `/api/avatars/${encodeURIComponent(String(r.username))}?v=${encodeURIComponent(String(r.avatar_url))}` : '',
      role: r.role,
      creatorRank: r.creator_rank || 'NEWCOMER',
      isFollowing: Boolean(r.is_following),
      followedAt: r.followed_at,
    })),
  });
}

// Remove follower (only allowed if the viewer is the followed user)
export async function DELETE(request: Request, { params }: { params: Promise<{ username: string }> }) {
  const auth = await requirePrincipal();
  if ('error' in auth) return auth.error;
  const viewerId = auth.principal.id;

  const { username } = await params;
  const target = await targetFor(username);
  if (!target) return Response.json({ error: 'User not found' }, { status: 404 });

  if (target.id !== viewerId) {
    return Response.json({ error: 'You can only remove followers from your own profile.' }, { status: 403 });
  }

  const url = new URL(request.url);
  let followerId = url.searchParams.get('userId');
  if (!followerId) {
    try {
      const body = await request.json();
      followerId = body.userId;
    } catch {
      // ignore
    }
  }

  if (!followerId) {
    return Response.json({ error: 'userId is required to remove follower' }, { status: 400 });
  }

  const db = await getReadyDb();
  await db.query(`DELETE FROM follows WHERE follower_id = $1 AND followed_id = $2`, [followerId, viewerId]);

  const countRes = await db.query(`SELECT COUNT(*)::int as count FROM follows WHERE followed_id = $1`, [viewerId]);
  return Response.json({
    success: true,
    followerCount: Number(countRes[0]?.count || 0),
  });
}
