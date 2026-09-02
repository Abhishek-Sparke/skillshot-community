import { requirePrincipal } from '../../../../lib/authz';
import { getReadyDb } from '../../../../lib/db';
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const history = params.get('scope') === 'moderation';
  const auth = await requirePrincipal(history ? 'moderation.view' : 'audit.view'); if ('error' in auth) return auth.error;
  if (history && auth.principal.role !== 'HEAD_MODERATOR' && !auth.principal.permissions.includes('audit.view')) return Response.json({ error:'Forbidden' }, { status:403 });
  const page = Math.min(10000, Math.max(1, Math.floor(Number(params.get('page')) || 1)));
  const date = params.get('date') || '';
  if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)))) return Response.json({ error:'Invalid date' }, { status:400 });
  try {
    const filters: unknown[] = ['action','actor','target'].map(key => { const value = (params.get(key)||'').trim().slice(0,100); return value ? `%${value}%` : ''; });
    filters.push(date, history, auth.principal.permissions.includes('audit.view') ? '' : auth.principal.id, (page-1)*30);
    const logs = await (await getReadyDb()).query(`SELECT l.id,l.action,l.target_type,l.target_id,l.created_at,u.username,
      l.metadata->>'from' previous,l.metadata->>'to' next,l.metadata->>'reason' reason,target.username target_username
      FROM audit_logs l LEFT JOIN users u ON u.id=l.actor_id LEFT JOIN users target ON l.target_type='USER' AND target.id=l.target_id
      WHERE ($1='' OR l.action ILIKE $1) AND ($2='' OR u.username ILIKE $2)
        AND ($3='' OR l.target_id ILIKE $3 OR target.username ILIKE $3) AND ($4='' OR l.created_at::date=NULLIF($4,'')::date)
        AND (NOT $5 OR l.action LIKE 'MODERATION_%') AND ($6='' OR l.actor_id=$6)
      ORDER BY l.created_at DESC,l.id DESC LIMIT 31 OFFSET $7`, filters);
    return Response.json({ logs: logs.slice(0,30), hasMore: logs.length > 30, ownOnly: !auth.principal.permissions.includes('audit.view') }, { headers:{'Cache-Control':'private, no-store'} });
  } catch { return Response.json({ error:'Something went wrong. Please try again.' }, { status:503 }); }
}
