import { NextResponse } from 'next/server';
import { requirePrincipal } from '../../../../lib/authz';
import { getReadyDb } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requirePrincipal();
  if ('error' in auth) return auth.error;

  const sql = await getReadyDb();
  const rows = await sql.query(
    `SELECT r.id, r.category, r.details, r.status, r.created_at, r.resolved_at,
       (SELECT n.staff_comment FROM notifications n
        WHERE n.user_id = $2 AND n.target_id = r.id AND n.comment_visibility = 'PUBLIC_TO_REPORTER'
        ORDER BY n.created_at DESC LIMIT 1) AS staff_comment
     FROM reports r
     WHERE r.id = $1 AND r.reporter_id = $2
     LIMIT 1`,
    [id, auth.principal.id]
  );

  if (!rows.length) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  const report = rows[0];
  return NextResponse.json({
    report: {
      id: String(report.id),
      category: String(report.category),
      details: String(report.details || ''),
      status: String(report.status),
      createdAt: report.created_at ? new Date(report.created_at).toISOString() : null,
      resolvedAt: report.resolved_at ? new Date(report.resolved_at).toISOString() : null,
      staffComment: report.staff_comment ? String(report.staff_comment) : null,
    },
  });
}
