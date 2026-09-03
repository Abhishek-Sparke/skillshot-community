import { requirePrincipal } from '../../../../lib/authz';
import { getReadyDb } from '../../../../lib/db';
import type { Permission } from '../../../../lib/roles';
import { queueFilters } from '../../../../lib/staff-query';

export async function GET(request: Request) {
  const auth = await requirePrincipal('moderation.view'); if ('error' in auth) return auth.error;
  const filter = queueFilters(new URL(request.url).searchParams);
  if (filter.source === 'REPORT' && !auth.principal.permissions.includes('reports.view')) return Response.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const sql = await getReadyDb();
    const items = await sql.query(`SELECT q.id,q.source,q.target_type,q.target_id,q.category,q.severity,q.status,q.created_at,q.reviewed_at,
      u.username,u.display_name,left(u.bio,500) bio,(u.avatar_url IS NOT NULL AND u.status='ACTIVE') has_avatar,
      p.title,left(p.description,1000) description,p.status content_status,
      left(c.body,2000) comment_body,c.post_id,c.parent_id,context.title context_title,
      (SELECT count(*) FROM reports r WHERE r.target_type=q.target_type AND r.target_id=q.target_id) report_count,
      (SELECT coalesce(jsonb_agg(x),'[]'::jsonb) FROM (SELECT r.category,r.details,r.created_at,r.status,reporter.username reporter
        FROM reports r LEFT JOIN users reporter ON reporter.id=r.reporter_id WHERE r.target_type=q.target_type AND r.target_id=q.target_id ORDER BY r.created_at DESC LIMIT 10) x) reports,
      (SELECT coalesce(jsonb_agg(x),'[]'::jsonb) FROM (SELECT l.action,l.created_at,actor.username FROM audit_logs l LEFT JOIN users actor ON actor.id=l.actor_id
        WHERE l.target_type=q.target_type AND l.target_id=q.target_id AND l.action LIKE 'MODERATION_%' ORDER BY l.created_at DESC LIMIT 10) x) history,
      coalesce(p.created_at,c.created_at,u.created_at) original_created_at,coalesce(p.status,c.status,u.status) current_status
      FROM moderation_queue q LEFT JOIN users u ON u.id=q.creator_id
      LEFT JOIN posts p ON q.target_type='SKILLSHOT' AND p.id=q.target_id
      LEFT JOIN comments c ON q.target_type='COMMENT' AND c.id=q.target_id LEFT JOIN posts context ON context.id=c.post_id
      WHERE ($1='ALL' OR q.target_type=$1 OR ($1='IMAGE' AND q.target_type='SKILLSHOT') OR ($1='REPLY' AND q.target_type='COMMENT' AND c.parent_id IS NOT NULL))
        AND ($2='ALL' OR ($2='REPORT' AND q.source='REPORT') OR ($2='AUTO' AND q.source<>'REPORT'))
        AND ($3='ALL' OR q.status=$3) AND ($4='ALL' OR q.severity=$4) AND ($5='' OR q.category ILIKE $5)
        AND (q.source<>'REPORT' OR $7) AND (q.target_type<>'SKILLSHOT' OR $8) AND (q.target_type<>'COMMENT' OR $9)
      ORDER BY q.created_at DESC,q.id DESC LIMIT 21 OFFSET $6`,
    [filter.type,filter.source,filter.status,filter.severity,filter.reason?`%${filter.reason}%`:'',(filter.page-1)*20,auth.principal.permissions.includes('reports.view'),auth.principal.permissions.includes('skillshots.view'),auth.principal.permissions.includes('comments.view')]);
    if (!auth.principal.permissions.includes('reports.view')) for (const item of items) { item.reports = []; item.report_count = null; }
    return Response.json({ items: items.slice(0,20), hasMore: items.length > 20 }, { headers: { 'Cache-Control':'private, no-store' } });
  } catch { return Response.json({ error: 'Something went wrong. Please try again.' }, { status:503 }); }
}
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
  // Content decisions now require the versioned case workflow. Legacy clients
  // cannot bypass grouped decisions, confirmations, notes or case auditing.
  return Response.json({error:'Open Review Case to make this decision.',caseId:item.case_id||null},{status:409});
}
