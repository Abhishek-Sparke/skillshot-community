import { requirePrincipal } from '../../../lib/authz';
import { getReadyDb } from '../../../lib/db';
import { normalizeRole } from '../../../lib/roles';

export async function GET() {
  const auth = await requirePrincipal();
  if ('error' in auth) return auth.error;
  const sql = await getReadyDb();

  const rows = await sql.query(
    `SELECT n.id, n.type, n.title, n.body, n.read_at, n.created_at,
      COALESCE(
        n.category,
        CASE
          WHEN n.type LIKE 'DISCUSSION%' OR n.target_url LIKE '/discussion/%' OR n.target_url LIKE '/announcements/%' THEN 'discussion'
          WHEN n.type IN ('NEW_REPORT', 'NEW_APPEAL', 'SUPPORT', 'CASE_ASSIGNED', 'SUPPORT_ACCEPTED', 'SUPPORT_DISMISSED', 'SUPPORT_STAFF_COMMENT')
            OR n.target_url LIKE '/support/%' OR n.target_url LIKE '/admin/reports%' THEN 'support'
          ELSE 'post'
        END
      ) AS category,
      COALESCE(
        n.target_url,
        CASE
          WHEN n.type IN ('COMMENT', 'COMMENT_REPLY', 'MENTION') AND c1.post_id IS NOT NULL THEN '/shots/' || c1.post_id || '#comment-' || c1.id
          WHEN n.type = 'LIKE' AND c2.post_id IS NOT NULL THEN '/shots/' || c2.post_id || '#comment-' || c2.id
          WHEN n.type IN ('NEW_REPORT', 'NEW_APPEAL', 'SUPPORT') THEN '/admin/reports'
          WHEN n.type = 'TRUSTED_APPLICATION' THEN '/admin/trusted-contributors'
          WHEN n.type = 'APPEAL' THEN '/settings/security'
          WHEN n.type IN ('ROLE_CHANGED', 'ACCOUNT') THEN '/profile'
          ELSE NULL
        END
      ) AS target_url,
      n.thumbnail_url,
      n.staff_comment,
      n.comment_visibility,
      n.target_id,
      u.display_name AS actor_name,
      u.username AS actor_username,
      u.avatar_url AS actor_avatar,
      u.role AS actor_role,
      u.creator_rank AS actor_creator_rank
    FROM notifications n
    LEFT JOIN users u ON u.id = n.actor_id
    LEFT JOIN comments c1 ON (c1.id = split_part(n.event_key, ':', 1))
    LEFT JOIN comments c2 ON (n.type = 'LIKE' AND c2.id = split_part(n.event_key, ':', 2))
    WHERE n.user_id = $1 OR (n.audience = 'STAFF' AND $2 = ANY(ARRAY['OWNER','ADMIN','HEAD_MODERATOR','MODERATOR']))
    ORDER BY n.created_at DESC LIMIT 100`,
    [auth.principal.id, auth.principal.role]
  );

  const notifications = rows.map((r: any) => ({
    id: String(r.id),
    type: String(r.type),
    category: String(r.category || 'post').toLowerCase() as 'discussion' | 'post' | 'support',
    title: String(r.title),
    body: String(r.body || ''),
    targetUrl: r.target_url ? String(r.target_url) : null,
    target_url: r.target_url ? String(r.target_url) : null,
    targetId: r.target_id ? String(r.target_id) : null,
    thumbnailUrl: r.thumbnail_url ? String(r.thumbnail_url) : null,
    staffComment: r.comment_visibility === 'PUBLIC_TO_REPORTER' || !r.comment_visibility ? (r.staff_comment ? String(r.staff_comment) : null) : null,
    commentVisibility: String(r.comment_visibility || 'INTERNAL'),
    readAt: r.read_at ? new Date(r.read_at).toISOString() : null,
    read_at: r.read_at ? new Date(r.read_at).toISOString() : null,
    createdAt: new Date(r.created_at).getTime(),
    created_at: new Date(r.created_at).toISOString(),
    actor: r.actor_username
      ? {
          displayName: String(r.actor_name || r.actor_username),
          username: String(r.actor_username),
          role: normalizeRole(r.actor_role),
          creatorRank: String(r.actor_creator_rank || 'NEWCOMER'),
          avatarUrl: r.actor_avatar
            ? `/api/avatars/${encodeURIComponent(String(r.actor_username))}?v=${encodeURIComponent(String(r.actor_avatar))}`
            : '',
        }
      : null,
  }));

  const unreadItems = notifications.filter(n => !n.readAt);
  const counts = {
    total: unreadItems.length,
    discussion: unreadItems.filter(n => n.category === 'discussion').length,
    post: unreadItems.filter(n => n.category === 'post').length,
    support: unreadItems.filter(n => n.category === 'support').length,
  };

  return Response.json({
    notifications,
    unread: counts.total,
    counts,
  });
}

export async function PATCH(request: Request) {
  const auth = await requirePrincipal();
  if ('error' in auth) return auth.error;
  const body = await request.json();
  const sql = await getReadyDb();

  if (body.all === true) {
    if (body.category && ['discussion', 'post', 'support'].includes(String(body.category).toLowerCase())) {
      await sql.query(
        `UPDATE notifications SET read_at = COALESCE(read_at, now())
         WHERE (user_id = $1 OR (audience = 'STAFF' AND $2 = ANY(ARRAY['OWNER','ADMIN','HEAD_MODERATOR','MODERATOR'])))
           AND (lower(category) = $3 OR (category IS NULL AND $3 = 'post'))`,
        [auth.principal.id, auth.principal.role, String(body.category).toLowerCase()]
      );
    } else {
      await sql.query(
        `UPDATE notifications SET read_at = COALESCE(read_at, now())
         WHERE user_id = $1 OR (audience = 'STAFF' AND $2 = ANY(ARRAY['OWNER','ADMIN','HEAD_MODERATOR','MODERATOR']))`,
        [auth.principal.id, auth.principal.role]
      );
    }
  } else if (body.id) {
    await sql.query(
      `UPDATE notifications SET read_at = COALESCE(read_at, now())
       WHERE id = $1 AND (user_id = $2 OR (audience = 'STAFF' AND $3 = ANY(ARRAY['OWNER','ADMIN','HEAD_MODERATOR','MODERATOR'])))`,
      [String(body.id), auth.principal.id, auth.principal.role]
    );
  } else {
    return Response.json({ error: 'Invalid notification update' }, { status: 400 });
  }

  return Response.json({ ok: true });
}
