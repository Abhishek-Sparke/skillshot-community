import { requirePrincipal } from '../../../../lib/authz';
import { getReadyDb } from '../../../../lib/db';

export async function PATCH(request: Request) {
  const auth = await requirePrincipal();
  if ('error' in auth) return auth.error;
  const body = await request.json();
  const action = String(body.action||'').toUpperCase();
  const required = action==='APPROVE'?'trusted_contributor.approve':action==='REJECT'?'trusted_contributor.reject':action==='REVOKE'?'trusted_contributor.revoke':null;
  if (!required) return Response.json({error:'Invalid action'},{status:400});
  if (!auth.principal.permissions.includes(required)) return Response.json({error:'Forbidden'},{status:403});
  const sql=await getReadyDb();
  let userId=String(body.userId||''); const applicationId=String(body.applicationId||'');
  if (applicationId) { const rows=await sql.query(`SELECT user_id,status FROM trusted_contributor_applications WHERE id=$1 LIMIT 1`,[applicationId]); if(!rows.length)return Response.json({error:'Application not found'},{status:404}); if(rows[0].status!=='PENDING')return Response.json({error:'Application was already reviewed'},{status:409}); userId=String(rows[0].user_id); }
  if (!userId) return Response.json({error:'User is required'},{status:400});
  if (action==='APPROVE') await sql.query(`UPDATE users SET role='TRUSTED_CONTRIBUTOR' WHERE id=$1 AND role='USER'`,[userId]);
  if (action==='REVOKE') await sql.query(`UPDATE users SET role='USER' WHERE id=$1 AND role='TRUSTED_CONTRIBUTOR'`,[userId]);
  if (applicationId) await sql.query(`UPDATE trusted_contributor_applications SET status=$1,reviewed_at=now(),reviewed_by=$2,review_note=$3 WHERE id=$4`,[action==='APPROVE'?'APPROVED':'REJECTED',auth.principal.id,String(body.note||'').slice(0,500),applicationId]);
  await sql.query(`INSERT INTO audit_logs(id,actor_id,action,target_type,target_id,metadata)VALUES($1,$2,$3,'USER',$4,$5::jsonb)`,[crypto.randomUUID(),auth.principal.id,`TRUSTED_CONTRIBUTOR_${action}`,userId,JSON.stringify({applicationId,note:String(body.note||'').slice(0,500)})]);
  const title=action==='APPROVE'?'You are now a Trusted Contributor':action==='REJECT'?'Trusted Contributor application update':'Trusted Contributor role updated';
  await sql.query(`INSERT INTO notifications(id,user_id,type,title,body)VALUES($1,$2,'TRUSTED_CONTRIBUTOR',$3,$4)`,[crypto.randomUUID(),userId,title,String(body.note||'The Skillshot team has completed its review.').slice(0,500)]);
  return Response.json({ok:true});
}
