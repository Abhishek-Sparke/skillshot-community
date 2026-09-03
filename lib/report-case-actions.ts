import type { Principal } from './authz';
import { getReadyDb } from './db';
import { findCase, caseContent } from './report-case-data';
import { caseActions, canViewCase, eligibleReviewer, type CaseAction } from './report-case-policy';

const terminal=new Set(['KEEP','HIDE','DELETE','DISMISS','RESOLVE']);
const eventName:Record<CaseAction,string>={OPEN:'CASE_OPENED',NOTE:'MODERATOR_NOTE_ADDED',ASSIGN:'CASE_ASSIGNED',ESCALATE:'CASE_ESCALATED',KEEP:'CONTENT_APPROVED',HIDE:'CONTENT_HIDDEN',DELETE:'CONTENT_DELETED',DISMISS:'REPORT_DISMISSED',RESOLVE:'REPORT_RESOLVED'};
export async function mutateCase(actor:Principal,id:string,body:Record<string,unknown>) {
  const item=await findCase(id);
  if(!item)return Response.json({error:'Case not found'},{status:404});
  if(!canViewCase(actor,item.target_type))return Response.json({error:'Forbidden'},{status:403});
  const content=await caseContent(item.target_type,item.target_id);
  const action=String(body.action||'').toUpperCase() as CaseAction;
  if(!caseActions(actor,item.target_type,content?.profile?.role,String(content?.profile?.id||'')).includes(action))return Response.json({error:'This action is not permitted for your account.'},{status:403});
  if(action==='OPEN'&&item.status!=='PENDING')return Response.json({ok:true,unchanged:true});
  if(!Number.isInteger(body.version)||body.version!==item.version)return Response.json({error:'This case changed. Reload it before making a decision.'},{status:409});
  if(terminal.has(action)&&['RESOLVED','DISMISSED'].includes(item.status))return Response.json({error:'This case has already been decided.'},{status:409});
  const reason=typeof body.reason==='string'?body.reason.trim():'';
  if(reason.length>2000||(['NOTE','ESCALATE','DELETE','HIDE'].includes(action)&&!reason))return Response.json({error:'Add a reason or note of up to 2,000 characters.'},{status:400});
  const sql=await getReadyDb();let assigned:string|null=null;
  if(action==='ASSIGN'||action==='ESCALATE') {
    if(['RESOLVED','DISMISSED'].includes(item.status))return Response.json({error:'This case is closed.'},{status:409});
    const users=await sql.query(`SELECT id,role,status,custom_permissions FROM users WHERE id=$1 LIMIT 1`,[String(body.assignedTo||'')]);
    if(!users.length||!eligibleReviewer(users[0] as {id:string;role:unknown;status:unknown},item.target_type,action==='ESCALATE'?actor:undefined))return Response.json({error:action==='ESCALATE'?'Select an active higher-level reviewer.':'Select an active reviewer with access to this content.'},{status:400});
    assigned=String(users[0].id);
  }
  const status=action==='KEEP'?'VISIBLE':action==='HIDE'?'HIDDEN':action==='DELETE'?'DELETED':null;
  const next=action==='OPEN'?'IN_REVIEW':action==='ESCALATE'?'ESCALATED':action==='DISMISS'?'DISMISSED':terminal.has(action)?'RESOLVED':item.status;
  if(status&&!content)return Response.json({error:'Content unavailable. You can dismiss or resolve the case without restoring missing content.'},{status:409});
  // Identifiers below come only from this fixed allowlist, never request data.
  const table=item.target_type==='PROFILE'?'users':item.target_type==='COMMENT'?'comments':'posts';
  const field=table==='users'?'profile_status':'status';
  const update=status?`UPDATE ${table} SET ${field}=$6${table==='posts'&&action==='DELETE'?',deleted_at=coalesce(deleted_at,now())':''}
    WHERE id=$3 AND EXISTS(SELECT 1 FROM locked) ${table==='users'?"AND status='ACTIVE'":"AND status NOT IN ('PURGING','PURGED')"}
    RETURNING id${table==='posts'?',image_url,display_url,thumbnail_url':''}`:'SELECT $3::text AS id WHERE EXISTS(SELECT 1 FROM locked)';
  const cleanup=table==='posts'&&action==='DELETE'?`, cleanup AS (
    INSERT INTO storage_cleanup_queue(id,post_id,pathname,reason,cleanup_after)
    SELECT gen_random_uuid()::text,t.id,path,'MODERATION_DELETED',now()+interval '30 days' FROM target t
    CROSS JOIN LATERAL unnest(ARRAY[t.image_url,t.display_url,t.thumbnail_url]) path
    WHERE path IS NOT NULL AND EXISTS(SELECT 1 FROM changed) AND NOT EXISTS(SELECT 1 FROM storage_cleanup_queue q WHERE q.post_id=t.id AND q.pathname=path AND q.deleted_at IS NULL)
  )`:'';
  const result=await sql.query(`WITH input AS (SELECT $6::text content_status), locked AS (
      SELECT id FROM report_cases WHERE id=$1 AND version=$2 FOR UPDATE
    ), target AS (${update}), changed AS (
      UPDATE report_cases SET status=$7,updated_at=now(),version=version+1,
      assigned_to=CASE WHEN $8::text IS NOT NULL THEN $8 WHEN $5='OPEN' THEN coalesce(assigned_to,$4) ELSE assigned_to END,
      reviewer_id=CASE WHEN $5='OPEN' THEN $4 ELSE reviewer_id END,reviewed_at=CASE WHEN $5='OPEN' THEN now() ELSE reviewed_at END,
      decision=CASE WHEN $9 THEN $5 ELSE decision END,decision_reason=CASE WHEN $9 THEN $10 ELSE decision_reason END,
      resolved_by=CASE WHEN $9 THEN $4 ELSE resolved_by END,resolved_at=CASE WHEN $9 THEN now() ELSE resolved_at END
      WHERE id=$1 AND EXISTS(SELECT 1 FROM target) AND EXISTS(SELECT 1 FROM locked) RETURNING *
    ), reports_updated AS (
      UPDATE reports SET status=$7,resolved_at=CASE WHEN $9 THEN now() ELSE resolved_at END,resolved_by=CASE WHEN $9 THEN $4 ELSE resolved_by END
      WHERE case_id=$1 AND EXISTS(SELECT 1 FROM changed) AND $5<>'NOTE' AND $5<>'ASSIGN'
    ), queue_updated AS (
      UPDATE moderation_queue SET status=$7,reviewed_at=CASE WHEN $9 THEN now() ELSE reviewed_at END,reviewed_by=CASE WHEN $9 THEN $4 ELSE reviewed_by END
      WHERE case_id=$1 AND EXISTS(SELECT 1 FROM changed) AND $5<>'NOTE' AND $5<>'ASSIGN'
    ), event AS (
      INSERT INTO report_case_events(case_id,actor_id,action,reason,metadata)
      SELECT id,$4,$11,$10,jsonb_build_object('assignedTo',$8::text,'decision',$5::text) FROM changed
    ), audit AS (
      INSERT INTO audit_logs(id,actor_id,action,target_type,target_id,metadata)
      SELECT gen_random_uuid()::text,$4,$11,target_type,target_id,jsonb_build_object('caseId',id,'reason',$10::text,'assignedTo',$8::text) FROM changed
    ), reviewed AS (
      INSERT INTO report_case_events(case_id,actor_id,action,reason) SELECT id,$4,'CONTENT_REVIEWED',$10 FROM changed WHERE $5 IN ('KEEP','HIDE','DELETE')
    ), resolved AS (
      INSERT INTO report_case_events(case_id,actor_id,action,reason) SELECT id,$4,'REPORT_RESOLVED',$10 FROM changed WHERE $9 AND $5 NOT IN ('DISMISS','RESOLVE')
    ), notice AS (
      INSERT INTO notifications(id,user_id,type,title,body) SELECT gen_random_uuid()::text,$8,'CASE_ASSIGNED','A report case needs your review','Open Reports → My Cases to review it.' FROM changed WHERE $8::text IS NOT NULL
    ) ${cleanup} SELECT id,version,status FROM changed`,[item.id,body.version,item.target_id,actor.id,action,status,next,assigned,terminal.has(action),reason,eventName[action]]);
  return result.length?Response.json({ok:true,case:result[0]}):Response.json({error:'The case or content changed. Reload before trying again.'},{status:409});
}
