import { requirePrincipal } from '../../../../lib/authz';
import { getReadyDb } from '../../../../lib/db';
import { assignableRoles, canChangeRole, normalizeRole, PERMISSIONS } from '../../../../lib/roles';

export async function GET(request: Request) {
  const auth = await requirePrincipal('team.view');
  if ('error' in auth) return auth.error;
  const q = new URL(request.url).searchParams.get('q')?.trim() || '';
  const rows = await (await getReadyDb()).query(
    `SELECT id,display_name,username,role,status,custom_permissions,created_at,avatar_url
     FROM users
     WHERE role IN ('OWNER','ADMIN','HEAD_MODERATOR','MODERATOR')
       OR ($1<>'' AND (username ILIKE $2 OR display_name ILIKE $2))
     ORDER BY CASE role WHEN 'OWNER' THEN 1 WHEN 'ADMIN' THEN 2 WHEN 'HEAD_MODERATOR' THEN 3 WHEN 'MODERATOR' THEN 4 ELSE 5 END,created_at
     LIMIT 80`,
    [q, `%${q.slice(0, 50)}%`],
  );
  return Response.json({ members: rows, selfId: auth.principal.id, role: auth.principal.role, permissions: auth.principal.permissions, assignableRoles: assignableRoles(auth.principal.role) });
}

export async function PATCH(request: Request) {
  const auth = await requirePrincipal('team.view');
  if ('error' in auth) return auth.error;
  const body = await request.json();
  const userId = String(body.userId || '');
  const nextRole = normalizeRole(body.role);
  if (!userId || userId === auth.principal.id) return Response.json({ error: userId ? 'You cannot change your own role.' : 'User is required.' }, { status: userId ? 403 : 400 });

  const sql = await getReadyDb();
  const rows = await sql.query(`SELECT role,username FROM users WHERE id=$1 LIMIT 1`, [userId]);
  if (!rows.length) return Response.json({ error: 'User not found' }, { status: 404 });
  const targetRole = normalizeRole(rows[0].role);
  if (!canChangeRole(auth.principal.role, targetRole, nextRole)) return Response.json({ error: 'This role change is not allowed.' }, { status: 403 });
  const involvedRoles = new Set([targetRole, nextRole]);
  const required = involvedRoles.has('ADMIN') ? 'admins.manage' : involvedRoles.has('HEAD_MODERATOR') ? 'head_moderators.manage' : 'moderators.manage';
  if (!auth.principal.permissions.includes(required)) return Response.json({ error: 'You do not have permission for this role change.' }, { status: 403 });

  const requested = Array.isArray(body.permissions) ? body.permissions : [];
  const canEditPermissions = auth.principal.role === 'OWNER' || (auth.principal.role === 'ADMIN' && nextRole !== 'ADMIN');
  const custom = canEditPermissions
    ? requested.filter((permission: unknown) => PERMISSIONS.includes(permission as never) && auth.principal.permissions.includes(permission as never))
    : [];
  await sql.query(`UPDATE users SET role=$1,custom_permissions=$2::jsonb WHERE id=$3`, [nextRole, JSON.stringify(custom), userId]);
  await sql.query(`INSERT INTO audit_logs(id,actor_id,action,target_type,target_id,metadata) VALUES($1,$2,'ROLE_CHANGED','USER',$3,$4::jsonb)`, [crypto.randomUUID(), auth.principal.id, userId, JSON.stringify({ from: targetRole, to: nextRole, permissions: custom })]);
  await sql.query(`INSERT INTO notifications(id,user_id,type,title,body) VALUES($1,$2,'ROLE_CHANGED','Your Skillshot role changed',$3)`, [crypto.randomUUID(), userId, `Your account role is now ${nextRole.replaceAll('_', ' ')}.`]);
  return Response.json({ ok: true, role: nextRole });
}
