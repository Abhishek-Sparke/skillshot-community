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
  if (status && table === 'posts' && status === 'DELETED') {
    const changed = await sql.query(`WITH changed AS (
      UPDATE posts SET status='DELETED',deleted_at=coalesce(deleted_at,now()) WHERE id=$1 AND status NOT IN ('PURGING','PURGED')
      RETURNING id,image_url,display_url,thumbnail_url
    ) INSERT INTO storage_cleanup_queue(id,post_id,pathname,reason,cleanup_after)
      SELECT gen_random_uuid()::text,c.id,path,'MODERATION_DELETED',now()+interval '30 days'
      FROM changed c CROSS JOIN LATERAL unnest(ARRAY[c.image_url,c.display_url,c.thumbnail_url]) path
      WHERE path IS NOT NULL AND NOT EXISTS(SELECT 1 FROM storage_cleanup_queue q WHERE q.post_id=c.id AND q.pathname=path AND q.deleted_at IS NULL)
      RETURNING post_id`, [item.target_id]);
    if (!changed.length) {
      const existing = await sql.query(`SELECT id FROM posts WHERE id=$1 AND status='DELETED'`, [item.target_id]);
      if (!existing.length) return Response.json({ error:'This content has already entered permanent cleanup.' }, { status:409 });
    }
  } else if (status) {
    const changed = await sql.query(`UPDATE ${table} SET status=$1 WHERE id=$2 AND status NOT IN ('PURGING','PURGED') RETURNING id`, [status,item.target_id]);
    if (!changed.length) return Response.json({ error:'This content cannot be restored after permanent cleanup.' }, { status:409 });
  }
  await sql.query(`UPDATE moderation_queue SET status=$1,reviewed_at=now(),reviewed_by=$2 WHERE id=$3`,[action==='DISMISS'?'DISMISSED':'RESOLVED',auth.principal.id,queueId]);
  await sql.query(`UPDATE reports SET status=$1,resolved_at=now(),resolved_by=$2 WHERE target_type=$3 AND target_id=$4 AND status='PENDING'`,[action==='DISMISS'?'DISMISSED':'RESOLVED',auth.principal.id,item.target_type,item.target_id]);
  await sql.query(`INSERT INTO audit_logs(id,actor_id,action,target_type,target_id,metadata) VALUES($1,$2,$3,$4,$5,$6::jsonb)`,[crypto.randomUUID(),auth.principal.id,`MODERATION_${action}`,item.target_type,item.target_id,JSON.stringify({queueId})]);
  return Response.json({ok:true});
}
