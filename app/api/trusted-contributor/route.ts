import { requirePrincipal } from '../../../lib/authz';
import { getReadyDb } from '../../../lib/db';
import { rateLimit } from '../../../lib/rate-limit';
import { trustedProgress } from '../../../lib/trusted-data';
export async function GET(){const auth=await requirePrincipal();if('error'in auth)return auth.error;return Response.json(await trustedProgress(auth.principal.id),{headers:{'Cache-Control':'private, no-store'}});}
export async function POST(request:Request){
  const auth=await requirePrincipal();if('error'in auth)return auth.error;
  if(!await rateLimit(`trusted:${auth.principal.id}`,4,86400))return Response.json({error:'Please wait before submitting another request.'},{status:429});
  let body;try{body=await request.json();}catch{return Response.json({error:'Invalid application.'},{status:400});}
  if(!body||typeof body!=='object'||Array.isArray(body))return Response.json({error:'Invalid application.'},{status:400});
  if(['role','status','eligible','approvalStatus'].some(key=>key in body))return Response.json({error:'Role and review fields cannot be submitted.'},{status:400});
  const progress=await trustedProgress(auth.principal.id),appeal=body.kind==='APPEAL';
  if(!(appeal?progress.appealEligible:progress.eligible))return Response.json({error:'Your account is not currently eligible, or a request is already open.'},{status:409});
  const reason=String(body.reason||'').trim(),contribution=String(body.contribution||'').trim(),contentTypes=String(body.contentTypes||'').trim(),portfolio=String(body.portfolioUrl||'').trim();
  if(reason.length<30||reason.length>1500||contribution.length<30||contribution.length>1500||(!appeal&&(contentTypes.length<3||contentTypes.length>500||body.confirmed!==true)))return Response.json({error:'Complete the answers and confirm the Community Guidelines.'},{status:400});
  if(portfolio){try{const url=new URL(portfolio);if(portfolio.length>300||!['http:','https:'].includes(url.protocol))throw Error();}catch{return Response.json({error:'Enter a valid website URL.'},{status:400});}}
  try{
    const sql=await getReadyDb(),id=crypto.randomUUID();
    const rows=await sql.query(`WITH inserted AS (
      INSERT INTO trusted_contributor_applications(id,user_id,reason,contribution,content_types,portfolio_url,kind,parent_id,workflow_v2)
      SELECT $1,u.id,$3,$4,$5,$6,$7,$8,true FROM users u WHERE u.id=$2 AND u.role='USER' AND u.status='ACTIVE'
      AND NOT EXISTS(SELECT 1 FROM trusted_contributor_applications a WHERE a.user_id=u.id AND a.status IN ('PENDING','UNDER_REVIEW','MORE_INFO','SUSPENDED')) RETURNING id
    ), audit AS(INSERT INTO audit_logs(id,actor_id,action,target_type,target_id)SELECT $9,$2,$10,'TRUSTED_APPLICATION',id FROM inserted),
    notice AS(INSERT INTO notifications(id,audience,type,title,body)SELECT $11,'STAFF','TRUSTED_APPLICATION','Trusted Contributor request','A new request is ready for review.' FROM inserted)
    SELECT id FROM inserted`,[id,auth.principal.id,reason,contribution,contentTypes,portfolio,appeal?'APPEAL':'APPLICATION',appeal?progress.application?.id||null:null,crypto.randomUUID(),appeal?'TRUSTED_APPEAL_SUBMITTED':'TRUSTED_APPLICATION_SUBMITTED',crypto.randomUUID()]);
    if(!rows.length)return Response.json({error:'Your application is already under review.'},{status:409});
    return Response.json({id},{status:201});
  }catch(error){return Response.json({error:'Could not submit. You may already have an open application.'},{status:(error as {code?:string}).code==='23505'?409:503});}
}
export async function PATCH(request:Request){
  const auth=await requirePrincipal();if('error'in auth)return auth.error;
  let body;try{body=await request.json();}catch{return Response.json({error:'Invalid request.'},{status:400});}
  if(!body||typeof body!=='object'||Array.isArray(body))return Response.json({error:'Invalid request.'},{status:400});
  const response=String(body.response||'').trim(),withdraw=body.action==='WITHDRAW';
  if(!withdraw&&(body.action!=='RESPOND'||response.length<30||response.length>1500))return Response.json({error:'Add 30–1,500 characters of additional information.'},{status:400});
  const sql=await getReadyDb();const rows=await sql.query(`WITH changed AS(UPDATE trusted_contributor_applications SET status=$4,contribution=CASE WHEN $5::text='' THEN contribution ELSE $5 END,version=version+1 WHERE id=$1 AND user_id=$2 AND version=$3 AND status=ANY($6::text[]) RETURNING id),audit AS(INSERT INTO audit_logs(id,actor_id,action,target_type,target_id)SELECT $7,$2,$8,'TRUSTED_APPLICATION',id FROM changed) SELECT id FROM changed`,[String(body.id||''),auth.principal.id,Number.isInteger(body.version)?body.version:-1,withdraw?'WITHDRAWN':'PENDING',withdraw?'':response,withdraw?['PENDING','UNDER_REVIEW','MORE_INFO','SUSPENDED']:['MORE_INFO'],crypto.randomUUID(),withdraw?'TRUSTED_APPLICATION_WITHDRAWN':'TRUSTED_INFORMATION_ADDED']);
  return rows.length?Response.json({ok:true}):Response.json({error:'The application has changed. Refresh and try again.'},{status:409});
}
