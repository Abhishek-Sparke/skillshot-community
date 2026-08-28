import { requirePrincipal } from '../../../../lib/authz';
import { getReadyDb } from '../../../../lib/db';
import type { Permission } from '../../../../lib/roles';
const actions = new Set(['APPROVE','HIDE','RESTORE','DELETE','DISMISS']);
export async function PATCH(request: Request) {
  const auth = await requirePrincipal('reports.resolve'); if ('error' in auth) return auth.error;
  const body = await request.json(); const action=String(body.action||'').toUpperCase(); const queueId=String(body.queueId||'');
  if (!actions.has(action) || !queueId) return Response.json({error:'Invalid action'},{status:400});
  const sql=await getReadyDb(); const rows=await sql.query(`SELECT * FROM moderation_queue WHERE id=$1 LIMIT 1`,[queueId]);
  if (!rows.length) return Response.json({error:'Queue item not found'},{status:404});
  const item=rows[0];
  if (!['SKILLSHOT','COMMENT'].includes(item.target_type)) return Response.json({error:'Use user management for profile reports.'},{status:400});
  const required: Permission | null = item.target_type==='COMMENT'
    ? action==='DELETE' ? 'comments.delete' : null
    : action==='DELETE' ? 'skillshots.delete' : action==='HIDE' ? 'skillshots.hide' : action==='RESTORE'||action==='APPROVE' ? 'skillshots.restore' : null;
  if (required && !auth.principal.permissions.includes(required)) return Response.json({error:'Forbidden'},{status:403});
  const table=item.target_type==='COMMENT'?'comments':'posts';
  const status=action==='APPROVE'||action==='RESTORE'?'VISIBLE':action==='HIDE'?'HIDDEN':action==='DELETE'?'DELETED':null;
  if (status) await sql.query(`UPDATE ${table} SET status=$1 WHERE id=$2`,[status,item.target_id]);
  await sql.query(`UPDATE moderation_queue SET status=$1,reviewed_at=now(),reviewed_by=$2 WHERE id=$3`,[action==='DISMISS'?'DISMISSED':'RESOLVED',auth.principal.id,queueId]);
  await sql.query(`UPDATE reports SET status=$1,resolved_at=now(),resolved_by=$2 WHERE target_type=$3 AND target_id=$4 AND status='PENDING'`,[action==='DISMISS'?'DISMISSED':'RESOLVED',auth.principal.id,item.target_type,item.target_id]);
  await sql.query(`INSERT INTO audit_logs(id,actor_id,action,target_type,target_id,metadata) VALUES($1,$2,$3,$4,$5,$6::jsonb)`,[crypto.randomUUID(),auth.principal.id,`MODERATION_${action}`,item.target_type,item.target_id,JSON.stringify({queueId})]);
  return Response.json({ok:true});
}
