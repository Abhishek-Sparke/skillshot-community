import { requirePrincipal } from '../../../../lib/authz';
import { getReadyDb } from '../../../../lib/db';

export async function GET(request: Request) {
  const auth = await requirePrincipal();
  if ('error' in auth) return auth.error;
  const currentUserId = auth.principal.id;

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();

  if (!q || q.length < 1) {
    return Response.json({ users: [] });
  }

  const sql = await getReadyDb();
  const searchPattern = `%${q}%`;

  const rows = await sql.query(
    `SELECT 
       u.id, 
       u.username, 
       u.display_name, 
       u.avatar_url, 
       u.role,
       u.last_seen_at
     FROM users u
     WHERE u.id <> $1
       AND u.status = 'ACTIVE'
       AND (u.username ILIKE $2 OR u.display_name ILIKE $2)
       AND NOT EXISTS (
         SELECT 1 FROM user_blocks 
         WHERE (blocker_id = $1 AND blocked_id = u.id) 
            OR (blocker_id = u.id AND blocked_id = $1)
       )
     LIMIT 20`,
    [currentUserId, searchPattern]
  );

  return Response.json({
    users: rows.map(r => ({
      id: r.id,
      username: r.username,
      displayName: r.display_name,
      avatarUrl: r.avatar_url,
      role: r.role,
      lastSeenAt: r.last_seen_at,
    })),
  });
}
