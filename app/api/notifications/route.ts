import { requirePrincipal } from '../../../lib/authz';
import { getReadyDb } from '../../../lib/db';

export async function GET() {
  const auth = await requirePrincipal();
  if ('error' in auth) return auth.error;
  const rows = await (await getReadyDb()).query(
    `SELECT n.id, n.type, n.title, n.body, n.read_at, n.created_at,
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
      ) AS target_url
    FROM notifications n
    LEFT JOIN comments c1 ON (c1.id = split_part(n.event_key, ':', 1))
    LEFT JOIN comments c2 ON (n.type = 'LIKE' AND c2.id = split_part(n.event_key, ':', 2))
    WHERE n.user_id=$1 OR (n.audience='STAFF' AND $2=ANY(ARRAY['OWNER','ADMIN','HEAD_MODERATOR','MODERATOR']))
    ORDER BY n.created_at DESC LIMIT 80`,
    [auth.principal.id, auth.principal.role]
  );
  return Response.json({ notifications: rows, unread: rows.filter(row => !row.read_at).length });
}

export async function PATCH(request: Request) {
  const auth = await requirePrincipal();
  if ('error' in auth) return auth.error;
  const body = await request.json();
  const sql = await getReadyDb();
  if (body.all === true) await sql.query(`UPDATE notifications SET read_at=COALESCE(read_at,now()) WHERE user_id=$1 OR (audience='STAFF' AND $2=ANY(ARRAY['OWNER','ADMIN','HEAD_MODERATOR','MODERATOR']))`, [auth.principal.id, auth.principal.role]);
  else if (body.id) await sql.query(`UPDATE notifications SET read_at=COALESCE(read_at,now()) WHERE id=$1 AND (user_id=$2 OR (audience='STAFF' AND $3=ANY(ARRAY['OWNER','ADMIN','HEAD_MODERATOR','MODERATOR'])))`, [String(body.id), auth.principal.id, auth.principal.role]);
  else return Response.json({ error: 'Invalid notification update' }, { status: 400 });
  return Response.json({ ok: true });
}
