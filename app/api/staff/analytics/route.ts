import { requirePrincipal } from '../../../../lib/authz';
import { getReadyDb } from '../../../../lib/db';

export async function GET() {
  const auth=await requirePrincipal('analytics.view'); if('error'in auth)return auth.error;
  const sql=await getReadyDb();
  const [summary,growth,topTags]=await Promise.all([
    sql.query(`SELECT (SELECT count(*) FROM users WHERE status='ACTIVE') active_users,(SELECT count(*) FROM posts WHERE status='VISIBLE') visible_skillshots,(SELECT count(*) FROM comments WHERE status='VISIBLE') visible_comments,(SELECT count(*) FROM reactions) reactions,(SELECT count(*) FROM follows) follows`),
    sql.query(`SELECT date_trunc('day',created_at)::date day,count(*) value FROM posts WHERE created_at>now()-interval '14 days' GROUP BY 1 ORDER BY 1`),
    sql.query(`SELECT tag,count(*) uses FROM posts p CROSS JOIN LATERAL jsonb_array_elements_text(p.tags) tag WHERE p.status='VISIBLE' GROUP BY tag ORDER BY uses DESC LIMIT 12`),
  ]);
  return Response.json({summary:summary[0],growth,topTags});
}
