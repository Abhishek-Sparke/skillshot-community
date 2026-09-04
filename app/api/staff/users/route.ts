import { requirePrincipal } from '../../../../lib/authz';
import { getReadyDb } from '../../../../lib/db';
import { canModerateUser, normalizeRole, type Permission } from '../../../../lib/roles';

export async function GET(request: Request) {
  const auth = await requirePrincipal('users.view');
  if ('error' in auth) return auth.error;
  const q = (new URL(request.url).searchParams.get('q') || '').trim().replace(/^@/, '').slice(0, 50);
  const users = await (await getReadyDb()).query(`SELECT id,display_name,username,role,status,created_at,avatar_url FROM users WHERE $1='' OR username ILIKE $2 OR display_name ILIKE $2 ORDER BY created_at DESC LIMIT 60`, [q, `%${q}%`]);
  return Response.json({ users });
}

export async function PATCH(request: Request) {
  const auth = await requirePrincipal();
  if ('error' in auth) return auth.error;
  const body = await request.json();
  const userId = String(body.userId || '');
  const action = String(body.action || '').toUpperCase();
  const permission = ({ SUSPEND:'users.suspend', UNSUSPEND:'users.unsuspend', BAN:'users.ban', UNBAN:'users.unban' } as Record<string, Permission>)[action];
  if (!permission || !userId) return Response.json({ error: 'Invalid action' }, { status: 400 });
  if (!auth.principal.permissions.includes(permission)) return Response.json({ error: 'Forbidden' }, { status: 403 });
  if (userId === auth.principal.id) return Response.json({ error: 'You cannot moderate your own account.' }, { status: 403 });
  const sql = await getReadyDb();
  const target = await sql.query(`SELECT role FROM users WHERE id=$1`, [userId]);
  if (!target.length) return Response.json({ error: 'User not found' }, { status: 404 });
  if (!canModerateUser(auth.principal.role, normalizeRole(target[0].role))) return Response.json({ error: 'You cannot moderate an equal or higher role.' }, { status: 403 });
  const status = action === 'SUSPEND' ? 'SUSPENDED' : action === 'BAN' ? 'BANNED' : 'ACTIVE';
  await sql.query(`UPDATE users SET status=$1 WHERE id=$2`, [status, userId]);
  await sql.query(`INSERT INTO audit_logs(id,actor_id,action,target_type,target_id,metadata) VALUES($1,$2,$3,'USER',$4,$5::jsonb)`, [crypto.randomUUID(), auth.principal.id, `USER_${action}`, userId, JSON.stringify({ status })]);
  await sql.query(`INSERT INTO notifications(id,user_id,type,title,body) VALUES($1,$2,'ACCOUNT','Account status updated',$3)`, [crypto.randomUUID(), userId, `Your account is now ${status.toLowerCase()}.`]);
  return Response.json({ ok: true, status });
}
