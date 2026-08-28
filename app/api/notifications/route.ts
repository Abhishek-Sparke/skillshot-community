import { requirePrincipal } from '../../../lib/authz';
import { getReadyDb } from '../../../lib/db';

export async function GET() {
  const auth = await requirePrincipal();
  if ('error' in auth) return auth.error;
  const rows = await (await getReadyDb()).query(`SELECT id,type,title,body,read_at,created_at FROM notifications WHERE user_id=$1 OR (audience='STAFF' AND $2=ANY(ARRAY['OWNER','ADMIN','HEAD_MODERATOR','MODERATOR'])) ORDER BY created_at DESC LIMIT 80`, [auth.principal.id, auth.principal.role]);
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
