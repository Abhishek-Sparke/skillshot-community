import { getReadyDb } from '../../../../../lib/db';
import { requirePrincipal } from '../../../../../lib/authz';
import { normalizeRole } from '../../../../../lib/roles';
import { moderateText } from '../../../../../lib/moderation';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sql = await getReadyDb();
  const auth = await requirePrincipal();
  const viewerId = 'principal' in auth && auth.principal ? auth.principal.id : null;

  const rows = await sql.query(`
    SELECT dr.id, dr.body, dr.created_at, dr.user_id,
      u.display_name, u.username, u.role, u.avatar_url, u.creator_rank
    FROM discussion_replies dr
    JOIN users u ON u.id = dr.user_id
    WHERE dr.discussion_id = $1 AND dr.status = 'VISIBLE'
    ORDER BY dr.created_at ASC
  `, [id]);

  return Response.json({
    replies: rows.map((rep: Record<string, unknown>) => ({
      id: String(rep.id),
      body: String(rep.body),
      createdAt: new Date(rep.created_at as string).getTime(),
      author: {
        displayName: String(rep.display_name),
        username: String(rep.username),
        role: normalizeRole(rep.role),
        avatarUrl: rep.avatar_url ? `/api/avatars/${encodeURIComponent(String(rep.username))}?v=${encodeURIComponent(String(rep.avatar_url))}` : '',
        creatorRank: String(rep.creator_rank || 'NEWCOMER'),
      },
      isOwner: viewerId === rep.user_id,
    })),
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requirePrincipal();
  if ('error' in auth) return auth.error;
  const user = auth.principal;

  try {
    const body = await request.json();
    const replyBody = String(body.body || '').trim().slice(0, 2000);

    if (!replyBody) {
      return Response.json({ error: 'Reply text cannot be empty' }, { status: 400 });
    }

    const mod = await moderateText(replyBody);
    if (mod.level !== 'SAFE') {
      return Response.json({ error: 'Reply violates community guidelines' }, { status: 422 });
    }

    const sql = await getReadyDb();
    const disc = await sql.query(`SELECT id, is_locked, status FROM discussions WHERE id = $1 LIMIT 1`, [id]);
    if (!disc.length || disc[0].status !== 'VISIBLE') {
      return Response.json({ error: 'Discussion not found' }, { status: 404 });
    }

    if (disc[0].is_locked) {
      return Response.json({ error: 'This discussion is locked' }, { status: 403 });
    }

    const res = await sql.query(`
      INSERT INTO discussion_replies (discussion_id, user_id, body)
      VALUES ($1, $2, $3)
      RETURNING id, created_at
    `, [id, user.id, replyBody]);

    const replyId = res[0].id;
    const createdAt = res[0].created_at;

    await sql.query(`
      UPDATE discussions
      SET reply_count = reply_count + 1, updated_at = now()
      WHERE id = $1
    `, [id]);

    return Response.json({
      reply: {
        id: String(replyId),
        body: replyBody,
        createdAt: new Date(createdAt as string).getTime(),
        author: {
          displayName: String(user.profile.display_name || user.profile.username || 'Creator'),
          username: String(user.profile.username || ''),
          role: normalizeRole(user.role),
          avatarUrl: user.profile.avatar_url ? `/api/avatars/${encodeURIComponent(String(user.profile.username))}?v=${encodeURIComponent(String(user.profile.avatar_url))}` : '',
          creatorRank: String(user.profile.creator_rank || 'NEWCOMER'),
        },
        isOwner: true,
      },
    }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to post reply';
    return Response.json({ error: msg }, { status: 500 });
  }
}
