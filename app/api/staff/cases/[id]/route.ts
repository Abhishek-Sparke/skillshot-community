import { requirePrincipal } from '../../../../../lib/authz';
import { getReadyDb } from '../../../../../lib/db';
import { caseActions, canViewCase, eligibleReviewer } from '../../../../../lib/report-case-policy';
import { caseContent, findCase } from '../../../../../lib/report-case-data';
import { mutateCase } from '../../../../../lib/report-case-actions';
import { rateLimit } from '../../../../../lib/rate-limit';

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
  const auth=await requirePrincipal('reports.view');if('error'in auth)return auth.error;
  if(!canViewCase(auth.principal,'PROFILE'))return Response.json({error:'Forbidden'},{status:403});
  try {
    const item=await findCase((await params).id);if(!item)return Response.json({error:'Case not found'},{status:404});
    if(!canViewCase(auth.principal,item.target_type))return Response.json({error:'Forbidden'},{status:403});
    const sql=await getReadyDb(),query=new URL(request.url).searchParams;
    const page=(key:string)=>Math.min(10000,Math.max(1,Math.floor(Number(query.get(key))||1)));
    const reports=await sql.query(`SELECT r.id,r.category,r.details,r.created_at,r.status,u.username reporter FROM reports r LEFT JOIN users u ON u.id=r.reporter_id WHERE r.case_id=$1 ORDER BY r.created_at,r.id LIMIT 21 OFFSET $2`,[item.id,(page('reportsPage')-1)*20]);
    const summary=await sql.query(`SELECT category,count(*)::int count FROM reports WHERE case_id=$1 GROUP BY category`,[item.id]);
    const events=await sql.query(`SELECT e.id,e.action,e.reason,e.metadata,e.created_at,u.username actor FROM report_case_events e LEFT JOIN users u ON u.id=e.actor_id WHERE case_id=$1 ORDER BY e.created_at DESC,e.id DESC LIMIT 31 OFFSET $2`,[item.id,(page('historyPage')-1)*30]);
    const flags=await sql.query(`SELECT category,severity,status,created_at FROM moderation_queue WHERE case_id=$1 AND source<>'REPORT' ORDER BY created_at DESC LIMIT 20`,[item.id]);
    const content=await caseContent(item.target_type,item.target_id);
    const actions=caseActions(auth.principal,item.target_type,content?.profile?.role,String(content?.profile?.id||''));
    const staff=actions.some(action=>['ASSIGN','ESCALATE'].includes(action))?await sql.query(`SELECT id,username,display_name,role,status,custom_permissions FROM users WHERE status='ACTIVE' AND role IN ('OWNER','ADMIN','HEAD_MODERATOR','MODERATOR') ORDER BY username LIMIT 500`):[];
    const reviewers=staff.filter(user=>eligibleReviewer(user as {id:string;role:unknown;status:unknown},item.target_type)).map(user=>({id:user.id,username:user.username,role:user.role,canEscalate:eligibleReviewer(user as {id:string;role:unknown;status:unknown},item.target_type,auth.principal)}));
    return Response.json({case:item,content,actions,reports:reports.slice(0,20),reportsMore:reports.length>20,summary,events:events.slice(0,30),historyMore:events.length>30,flags,reviewers},{headers:{'Cache-Control':'private, no-store'}});
  }catch{return Response.json({error:'Case details could not be loaded. Please try again.'},{status:503});}
}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
  const auth=await requirePrincipal('reports.resolve');if('error'in auth)return auth.error;
  if(!canViewCase(auth.principal,'PROFILE'))return Response.json({error:'Forbidden'},{status:403});
  if(!await rateLimit('case:'+auth.principal.id,60,300))return Response.json({error:'Please wait before making more case updates.'},{status:429});
  let body;try{body=await request.json();}catch{return Response.json({error:'Invalid request'},{status:400});}
  if(!body||typeof body!=='object')return Response.json({error:'Invalid request'},{status:400});
  try{return await mutateCase(auth.principal,(await params).id,body);}catch{return Response.json({error:'The case update could not be saved. Please reload and try again.'},{status:503});}
}
