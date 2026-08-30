import { requirePrincipal } from '../../../../lib/authz';
import { getReadyDb } from '../../../../lib/db';

export async function PATCH(request: Request) {
  const auth=await requirePrincipal('reports.resolve'); if('error'in auth)return auth.error;
  const body=await request.json(), id=String(body.id||''), action=String(body.action||'').toUpperCase();
  if(!id||!['ACCEPT','REJECT','REVIEW'].includes(action))return Response.json({error:'Invalid appeal action'},{status:400});
  const sql=await getReadyDb(); const rows=await sql.query(`SELECT * FROM appeals WHERE id=$1 LIMIT 1`,[id]);
  if(!rows.length)return Response.json({error:'Appeal not found'},{status:404}); const appeal=rows[0];
  const status=action==='ACCEPT'?'ACCEPTED':action==='REJECT'?'REJECTED':'UNDER_REVIEW';
  if(action==='ACCEPT'&&appeal.target_type==='SKILLSHOT') {
    if (!auth.principal.permissions.includes('skillshots.restore')) return Response.json({error:'Forbidden'},{status:403});
    const restored=await sql.query(`UPDATE posts SET status='VISIBLE' WHERE id=$1 AND status NOT IN ('PURGING','PURGED') RETURNING id`,[appeal.target_id]);
    if(!restored.length)return Response.json({error:'This content is no longer recoverable.'},{status:409});
  }
  if(action==='ACCEPT'&&appeal.target_type==='COMMENT'&&auth.principal.permissions.includes('comments.delete'))await sql.query(`UPDATE comments SET status='VISIBLE' WHERE id=$1`,[appeal.target_id]);
  await sql.query(`UPDATE appeals SET status=$1,reviewed_at=CASE WHEN $1='UNDER_REVIEW' THEN reviewed_at ELSE now() END,reviewed_by=$2 WHERE id=$3`,[status,auth.principal.id,id]);
  if (appeal.target_type==='SKILLSHOT' && action!=='REVIEW') await sql.query(`UPDATE posts SET appeal_hold=false WHERE id=$1 AND NOT EXISTS(SELECT 1 FROM appeals WHERE target_type='SKILLSHOT' AND target_id=$1 AND status IN ('PENDING','UNDER_REVIEW'))`,[appeal.target_id]);
  await sql.query(`INSERT INTO audit_logs(id,actor_id,action,target_type,target_id,metadata)VALUES($1,$2,$3,$4,$5,$6::jsonb)`,[crypto.randomUUID(),auth.principal.id,`APPEAL_${action}`,appeal.target_type,appeal.target_id,JSON.stringify({appealId:id})]);
  await sql.query(`INSERT INTO notifications(id,user_id,type,title,body)VALUES($1,$2,'APPEAL','Appeal status updated',$3)`,[crypto.randomUUID(),appeal.user_id,`Your appeal is now ${status.toLowerCase().replaceAll('_',' ')}.`]);
  return Response.json({ok:true});
}
