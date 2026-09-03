import { requirePrincipal } from '../../../../lib/authz';
import { getReadyDb } from '../../../../lib/db';
import { caseFilters, canViewCase } from '../../../../lib/report-case-policy';

export async function GET(request:Request) {
  const auth=await requirePrincipal('reports.view');if('error'in auth)return auth.error;
  const actor=auth.principal;
  if(!canViewCase(actor,'PROFILE'))return Response.json({error:'Forbidden'},{status:403});
  const filter=caseFilters(new URL(request.url).searchParams);
  try {
    const sql=await getReadyDb();
    const items=await sql.query(`SELECT c.*,u.username,u.display_name,u.bio,(u.avatar_url IS NOT NULL) has_avatar,
      p.title,p.status content_status,coalesce(p.status,m.status,u.profile_status) current_status,
      m.body comment_body,m.parent_id,m.post_id,parent.title context_title,
      a.username assigned_username,
      (SELECT count(*) FROM reports r WHERE r.case_id=c.id) report_count,
      (SELECT coalesce(jsonb_agg(x),'[]'::jsonb) FROM (SELECT category,count(*) count FROM reports WHERE case_id=c.id GROUP BY category) x) reasons,
      (SELECT username FROM users WHERE id=(SELECT reporter_id FROM reports WHERE case_id=c.id ORDER BY created_at LIMIT 1)) reporter,
      EXISTS(SELECT 1 FROM moderation_queue q WHERE q.case_id=c.id AND q.source<>'REPORT') automatic,
      CASE WHEN EXISTS(SELECT 1 FROM moderation_queue q WHERE q.case_id=c.id AND q.severity='HIGH') OR EXISTS(SELECT 1 FROM reports r WHERE r.case_id=c.id AND r.category IN ('NSFW','HATE','VIOLENCE')) THEN 'HIGH' ELSE 'NORMAL' END priority
      FROM report_cases c LEFT JOIN posts p ON c.target_type='SKILLSHOT' AND p.id=c.target_id
      LEFT JOIN comments m ON c.target_type='COMMENT' AND m.id=c.target_id LEFT JOIN posts parent ON parent.id=m.post_id
      LEFT JOIN users u ON u.id=CASE WHEN c.target_type='PROFILE' THEN c.target_id ELSE coalesce(p.user_id,m.user_id) END
      LEFT JOIN users a ON a.id=c.assigned_to
      WHERE ($1='ALL' OR c.status=$1) AND (NOT $2 OR c.assigned_to=$3)
      AND ($4='ALL' OR ($4='REPORT' AND EXISTS(SELECT 1 FROM reports r WHERE r.case_id=c.id)) OR ($4='AUTO' AND EXISTS(SELECT 1 FROM moderation_queue q WHERE q.case_id=c.id AND q.source<>'REPORT')))
      AND ($5='ALL' OR c.target_type=$5 OR ($5='IMAGE' AND c.target_type='SKILLSHOT') OR ($5='REPLY' AND m.parent_id IS NOT NULL))
      AND (NOT $6 OR EXISTS(SELECT 1 FROM moderation_queue q WHERE q.case_id=c.id AND q.severity='HIGH') OR EXISTS(SELECT 1 FROM reports r WHERE r.case_id=c.id AND r.category IN ('NSFW','HATE','VIOLENCE')))
      AND (c.target_type<>'SKILLSHOT' OR $7) AND (c.target_type<>'COMMENT' OR $8)
      ORDER BY c.updated_at DESC,c.id DESC LIMIT 21 OFFSET $9`,[filter.status,filter.mine,actor.id,filter.source,filter.type,filter.high,canViewCase(actor,'SKILLSHOT'),canViewCase(actor,'COMMENT'),(filter.page-1)*20]);
    const counts=await sql.query(`SELECT status,count(*)::int count FROM report_cases WHERE assigned_to=$1 AND status IN ('PENDING','IN_REVIEW','ESCALATED') AND (target_type<>'SKILLSHOT' OR $2) AND (target_type<>'COMMENT' OR $3) GROUP BY status`,[actor.id,canViewCase(actor,'SKILLSHOT'),canViewCase(actor,'COMMENT')]);
    return Response.json({items:items.slice(0,20),hasMore:items.length>20,myCases:counts},{headers:{'Cache-Control':'private, no-store'}});
  } catch {return Response.json({error:'Cases could not be loaded. Please try again.'},{status:503});}
}
