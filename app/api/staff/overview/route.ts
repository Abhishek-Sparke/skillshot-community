import { requirePrincipal } from '../../../../lib/authz';
import { getReadyDb } from '../../../../lib/db';
export async function GET() {
  const auth = await requirePrincipal('reports.view'); if ('error' in auth) return auth.error;
  const sql = await getReadyDb();
  const [counts, queue, applications, appeals] = await Promise.all([
    sql.query(`SELECT (SELECT count(*) FROM reports WHERE status='PENDING') reports,(SELECT count(*) FROM moderation_queue WHERE status='PENDING') flagged,(SELECT count(*) FROM trusted_contributor_applications WHERE status='PENDING') applications,(SELECT count(*) FROM appeals WHERE status='PENDING') appeals,(SELECT count(*) FROM users) users,(SELECT count(*) FROM posts WHERE status='VISIBLE') skillshots`),
    sql.query(`SELECT q.*,u.username,u.display_name FROM moderation_queue q LEFT JOIN users u ON u.id=q.creator_id WHERE q.status='PENDING' ORDER BY q.created_at ASC LIMIT 50`),
    sql.query(`SELECT a.*,u.username,u.display_name FROM trusted_contributor_applications a JOIN users u ON u.id=a.user_id WHERE a.status='PENDING' ORDER BY a.created_at ASC LIMIT 30`),
    sql.query(`SELECT a.*,u.username,u.display_name FROM appeals a JOIN users u ON u.id=a.user_id WHERE a.status IN ('PENDING','UNDER_REVIEW') ORDER BY a.created_at ASC LIMIT 30`),
  ]);
  return Response.json({ counts:counts[0], queue, applications, appeals, role:auth.principal.role, permissions:auth.principal.permissions });
}

