import { requirePrincipal } from '../../../../lib/authz';
import { getReadyDb } from '../../../../lib/db';
export async function GET() {
  const auth = await requirePrincipal('reports.view'); if ('error' in auth) return auth.error;
  try {
    const sql = await getReadyDb();
    const permissions = auth.principal.permissions;
    const [rows, applications, appeals] = await Promise.all([
      sql.query(`SELECT (SELECT count(*) FROM reports WHERE status='PENDING') reports,
        (SELECT count(*) FROM moderation_queue WHERE status='PENDING' AND source<>'REPORT') flagged,
        (SELECT count(*) FROM appeals WHERE status IN ('PENDING','UNDER_REVIEW')) appeals`),
      permissions.includes('trusted_contributor.review') ? sql.query(`SELECT a.id,a.reason,a.contribution,a.created_at,u.username,u.display_name FROM trusted_contributor_applications a JOIN users u ON u.id=a.user_id WHERE a.status='PENDING' ORDER BY a.created_at LIMIT 30`) : [],
      sql.query(`SELECT a.id,a.target_type,a.target_id,a.reason,a.explanation,a.status,a.created_at,u.username FROM appeals a JOIN users u ON u.id=a.user_id WHERE a.status IN ('PENDING','UNDER_REVIEW') ORDER BY a.created_at LIMIT 30`),
    ]);
    const counts = Object.fromEntries(Object.entries(rows[0]).map(([key, value]) => [key, Number(value)]));
    if (permissions.includes('trusted_contributor.review')) counts.applications = Number((await sql.query(`SELECT count(*) n FROM trusted_contributor_applications WHERE status='PENDING'`))[0].n);
    if (permissions.includes('team.view')) counts.active_staff = Number((await sql.query(`SELECT count(*) n FROM users WHERE status='ACTIVE' AND role=ANY($1::text[])`, [auth.principal.role === 'HEAD_MODERATOR' ? ['HEAD_MODERATOR','MODERATOR'] : ['OWNER','ADMIN','HEAD_MODERATOR','MODERATOR']]))[0].n);
    if (permissions.includes('storage.view') && ['OWNER','ADMIN'].includes(auth.principal.role)) counts.storage_used = Number((await sql.query(`SELECT (SELECT coalesce(sum(image_size+coalesce(display_size,0)+coalesce(thumbnail_size,0)),0) FROM posts)+(SELECT coalesce(sum(avatar_size),0) FROM users) n`))[0].n);
    return Response.json({ counts, applications, appeals }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 503 }); }
}
