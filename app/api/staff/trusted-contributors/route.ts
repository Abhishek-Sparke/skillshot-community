import { requirePrincipal } from '../../../../lib/authz';
import { getReadyDb } from '../../../../lib/db';
import { rateLimit } from '../../../../lib/rate-limit';
import { ACTIVE_APPLICATIONS,trustedConfig } from '../../../../lib/trusted-policy';
export async function GET(request:Request){
  const auth=await requirePrincipal('trusted_contributor.review');if('error'in auth)return auth.error;
  const page=Math.max(1,Math.min(500,Number(new URL(request.url).searchParams.get('page'))||1));
  const sql=await getReadyDb();
  const applications=await sql.query(`SELECT a.*,u.username,u.display_name,u.role,u.status account_status,
    FLOOR(EXTRACT(EPOCH FROM(now()-u.created_at))/86400)::int account_days,
    (SELECT count(*)::int FROM posts WHERE user_id=u.id AND status='VISIBLE') published_posts,
    EXISTS(SELECT 1 FROM audit_logs WHERE target_id=u.id AND action='TRUSTED_CONTRIBUTOR_REVOKE') previously_removed
    FROM trusted_contributor_applications a JOIN users u ON u.id=a.user_id ORDER BY CASE WHEN a.status IN ('PENDING','UNDER_REVIEW','MORE_INFO','SUSPENDED') THEN 0 ELSE 1 END,a.created_at DESC LIMIT 21 OFFSET $1`,[(page-1)*20]);
  const config=['OWNER','ADMIN'].includes(auth.principal.role)?(await sql.query(`SELECT value FROM community_config WHERE key='trusted'`))[0].value:null;
  return Response.json({applications:applications.slice(0,20),hasMore:applications.length>20,config},{headers:{'Cache-Control':'private, no-store'}});
}
export async function PATCH(request:Request){
  const auth=await requirePrincipal('trusted_contributor.review');if('error'in auth)return auth.error;
  if(!await rateLimit(`trusted-review:${auth.principal.id}`,60,300))return Response.json({error:'Please wait before reviewing more requests.'},{status:429});
  let body;try{body=await request.json();}catch{return Response.json({error:'Invalid review.'},{status:400});}
  if(!body||typeof body!=='object'||Array.isArray(body))return Response.json({error:'Invalid review.'},{status:400});
  const action=String(body.action||''),sql=await getReadyDb();
  if(action==='CONFIGURE'){
    if(!['OWNER','ADMIN'].includes(auth.principal.role))return Response.json({error:'Forbidden'},{status:403});
    let config;try{config=trustedConfig(body.config);}catch{return Response.json({error:'Use whole numbers from 0 to 3650.'},{status:400});}
    await sql.transaction([sql.query(`UPDATE community_config SET value=$1::jsonb,updated_by=$2,updated_at=now() WHERE key='trusted'`,[JSON.stringify(config),auth.principal.id]),sql.query(`INSERT INTO audit_logs(id,actor_id,action,target_type,target_id,metadata)VALUES($1,$2,'TRUSTED_CONFIGURED','CONFIG','trusted',$3::jsonb)`,[crypto.randomUUID(),auth.principal.id,JSON.stringify(config)])]);
    return Response.json({ok:true});
  }
  const permission=action==='APPROVE'?'trusted_contributor.approve':action==='REVOKE'?'trusted_contributor.revoke':['REJECT','DISMISS','SUSPEND'].includes(action)?'trusted_contributor.reject':['REVIEW','MORE_INFO'].includes(action)?'trusted_contributor.review':null;
  if(!permission)return Response.json({error:'Invalid action.'},{status:400});
  if(!auth.principal.permissions.includes(permission))return Response.json({error:'Forbidden'},{status:403});
  const note=String(body.note||'').trim(),publicNote=String(body.publicNote||'').trim();
  if(note.length>2000||publicNote.length>1000||(['REJECT','REVOKE','SUSPEND','MORE_INFO'].includes(action)&&note.length<5))return Response.json({error:'Add a review reason (5–2,000 characters). Public notes are optional.'},{status:400});
  if(action==='REVOKE'){
    if(String(body.userId)===auth.principal.id)return Response.json({error:'You cannot review your own role.'},{status:403});
    const rows=await sql.query(`WITH changed AS(UPDATE users SET role='USER' WHERE id=$1 AND role='TRUSTED_CONTRIBUTOR' RETURNING id),
      audit AS(INSERT INTO audit_logs(id,actor_id,action,target_type,target_id,metadata)SELECT $2,$3,'TRUSTED_CONTRIBUTOR_REVOKE','USER',id,$4::jsonb FROM changed),
      notice AS(INSERT INTO notifications(id,user_id,type,title,body)SELECT $5,id,'ROLE_CHANGED','Trusted Contributor status removed',$6 FROM changed)SELECT id FROM changed`,[String(body.userId||''),crypto.randomUUID(),auth.principal.id,JSON.stringify({note,publicNote}),crypto.randomUUID(),publicNote||'View Trusted Contributor settings for appeal options.']);
    return rows.length?Response.json({ok:true}):Response.json({error:'This user is not a Trusted Contributor.'},{status:409});
  }
  const id=String(body.applicationId||''),version=Number.isInteger(body.version)?body.version:-1;
  const status=({APPROVE:'APPROVED',REJECT:'REJECTED',DISMISS:'DISMISSED',SUSPEND:'SUSPENDED',REVIEW:'UNDER_REVIEW',MORE_INFO:'MORE_INFO'} as Record<string,string>)[action];
  // Lock the request and conditionally update both role and decision in one statement.
  // Failed/stale/unauthorized state changes cannot produce a success audit or notification.
  const rows=await sql.query(`WITH locked AS(SELECT a.* FROM trusted_contributor_applications a JOIN users u ON u.id=a.user_id
    WHERE a.id=$1 AND a.version=$2 AND a.status=ANY($3::text[]) AND a.user_id<>$4 AND u.role='USER' AND u.status='ACTIVE' FOR UPDATE OF a,u),
    granted AS(UPDATE users u SET role='TRUSTED_CONTRIBUTOR' FROM locked l WHERE u.id=l.user_id AND $5='APPROVE' AND u.role='USER' RETURNING u.id),
    changed AS(UPDATE trusted_contributor_applications a SET status=$6,version=a.version+1,reviewed_at=now(),reviewed_by=$4,review_note=$7,public_note=$8 FROM locked l WHERE a.id=l.id AND ($5<>'APPROVE' OR EXISTS(SELECT 1 FROM granted)) RETURNING a.*),
    audit AS(INSERT INTO audit_logs(id,actor_id,action,target_type,target_id,metadata)SELECT $9,$4,CASE WHEN kind='APPEAL' THEN 'TRUSTED_APPEAL_' ELSE 'TRUSTED_APPLICATION_' END||$5,'TRUSTED_APPLICATION',id,jsonb_build_object('note',$7::text,'publicNote',$8::text,'userId',user_id) FROM changed),
    role_audit AS(INSERT INTO audit_logs(id,actor_id,action,target_type,target_id)SELECT $10,$4,'TRUSTED_ROLE_GRANTED','USER',id FROM granted),
    notice AS(INSERT INTO notifications(id,user_id,type,title,body)SELECT $11,user_id,'TRUSTED_CONTRIBUTOR','Trusted Contributor application updated',$12 FROM changed)SELECT id FROM changed`,[id,version,ACTIVE_APPLICATIONS,auth.principal.id,action,status,note,publicNote,crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID(),publicNote||`Your request is now ${status.toLowerCase().replaceAll('_',' ')}.`]);
  return rows.length?Response.json({ok:true}):Response.json({error:'This request changed, is closed, or cannot be reviewed by this account. Refresh and try again.'},{status:409});
}
