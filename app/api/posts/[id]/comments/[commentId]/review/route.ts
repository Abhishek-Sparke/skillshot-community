import { requirePrincipal } from '../../../../../../../lib/authz';
import { getReadyDb } from '../../../../../../../lib/db';
import { rateLimit } from '../../../../../../../lib/rate-limit';
import { canViewCase, caseActions } from '../../../../../../../lib/report-case-policy';
import { mutateCase } from '../../../../../../../lib/report-case-actions';
import { panelForRole } from '../../../../../../../lib/roles';

// Public-page entry point; all decisions still use the audited case workflow.
export async function POST(request:Request,{params}:{params:Promise<{id:string;commentId:string}>}) {
  const auth=await requirePrincipal('reports.view');if('error'in auth)return auth.error;
  const actor=auth.principal;
  if(!canViewCase(actor,'COMMENT'))return Response.json({error:'Forbidden'},{status:403});
  let body;try{body=await request.json();}catch{return Response.json({error:'Invalid request'},{status:400});}
  const action=body?.action;
  if(!['REVIEW','HIDE','DELETE'].includes(action))return Response.json({error:'Invalid action'},{status:400});
  if(action!=='REVIEW'&&!caseActions(actor,'COMMENT').includes(action))return Response.json({error:'Forbidden'},{status:403});
  const reason=typeof body.reason==='string'?body.reason.trim():'';
  if(action!=='REVIEW'&&(!reason||reason.length>2000))return Response.json({error:'Add a reason of up to 2,000 characters.'},{status:400});
  if(!await rateLimit('comment-review:'+actor.id,30,300))return Response.json({error:'Please wait before reviewing more comments.'},{status:429});
  try {
    const {id,commentId}=await params,sql=await getReadyDb();
    const target=await sql.query('SELECT id FROM comments WHERE id=$1 AND post_id=$2',[commentId,id]);
    if(!target.length)return Response.json({error:'Comment not found'},{status:404});
    await sql.query(`WITH created AS (
      INSERT INTO report_cases(target_type,target_id) VALUES('COMMENT',$1)
      ON CONFLICT(target_type,target_id) DO NOTHING RETURNING id
    ), event AS (
      INSERT INTO report_case_events(case_id,actor_id,action,reason)
      SELECT id,$2,'CASE_OPENED','Opened from the comment menu' FROM created
    ) INSERT INTO audit_logs(id,actor_id,action,target_type,target_id,metadata)
      SELECT gen_random_uuid()::text,$2,'CASE_OPENED','COMMENT',$1,jsonb_build_object('caseId',id) FROM created`,[commentId,actor.id]);
    const [item]=await sql.query("SELECT id,version FROM report_cases WHERE target_type='COMMENT' AND target_id=$1",[commentId]);
    const url=panelForRole(actor.role)+'/reports/'+item.id;
    if(action==='REVIEW')return Response.json({url});
    const response=await mutateCase(actor,String(item.id),{action,reason,version:item.version});
    const result=await response.json();
    return Response.json({...result,url},{status:response.status});
  }catch{return Response.json({error:'The review could not be saved. Please retry.'},{status:503});}
}
