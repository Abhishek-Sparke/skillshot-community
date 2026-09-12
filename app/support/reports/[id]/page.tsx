import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import PublicNavbar from '../../../components/public-navbar';
import { getPrincipal } from '../../../../lib/authz';
import { getReadyDb } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const principal = await getPrincipal();
  if (!principal || principal.status !== 'ACTIVE') {
    redirect(`/signin?callbackUrl=/support/reports/${id}`);
  }

  const sql = await getReadyDb();
  const rows = await sql.query(
    `SELECT r.id, r.category, r.details, r.status, r.created_at, r.resolved_at,
       (SELECT n.staff_comment FROM notifications n
        WHERE n.user_id = $2 AND n.target_id = r.id AND n.comment_visibility = 'PUBLIC_TO_REPORTER'
        ORDER BY n.created_at DESC LIMIT 1) AS staff_comment
     FROM reports r
     WHERE r.id = $1 AND r.reporter_id = $2
     LIMIT 1`,
    [id, principal.id]
  );

  if (!rows.length) {
    notFound();
  }

  const report = rows[0];
  const statusColors: Record<string, string> = {
    PENDING: 'var(--color-warning, #f59e0b)',
    RESOLVED: 'var(--color-success, #10b981)',
    DISMISSED: 'var(--color-muted, #6b7280)',
    UNDER_REVIEW: 'var(--color-accent, #3b82f6)',
  };
  const statusColor = statusColors[String(report.status)] || 'var(--color-accent, #3b82f6)';

  return (
    <>
      <PublicNavbar returnTo={`/support/reports/${id}`} />
      <main className="supportReportDetail shell" style={{ maxWidth: 720, margin: '40px auto', padding: '0 20px' }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/notifications" className="backLink" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.9rem', color: 'var(--text-secondary, #94a3b8)', textDecoration: 'none' }}>
            ← Back to notifications
          </Link>
        </div>

        <div className="card" style={{ background: 'var(--surface-primary, #1e293b)', borderRadius: 12, border: '1px solid var(--border-color, #334155)', padding: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <h1 style={{ fontSize: '1.4rem', margin: 0, fontWeight: 700 }}>
              Report #{report.id.slice(0, 8)}
            </h1>
            <span
              style={{
                display: 'inline-block',
                padding: '4px 12px',
                borderRadius: 999,
                fontSize: '0.8rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                background: 'rgba(255,255,255,0.06)',
                color: statusColor,
                border: `1px solid ${statusColor}`,
              }}
            >
              {report.status}
            </span>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              Category
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 500 }}>
              {report.category}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              Submitted Details
            </div>
            <div style={{ background: 'var(--surface-secondary, rgba(0,0,0,0.2))', padding: 14, borderRadius: 8, fontSize: '0.95rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
              {report.details || 'No additional details provided.'}
            </div>
          </div>

          {report.staff_comment && (
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border-color, #334155)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--accent, #6366f1)' }}>
                  🛡️ Moderator Response
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary, #64748b)', padding: '2px 8px', background: 'rgba(255,255,255,0.05)', borderRadius: 4 }}>
                  Read-only
                </span>
              </div>
              <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.25)', padding: 14, borderRadius: 8, fontSize: '0.95rem', lineHeight: 1.5 }}>
                {report.staff_comment}
              </div>
              <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: 'var(--text-tertiary, #64748b)' }}>
                This is an official moderation notice. Direct replies and messaging are not available for support resolutions.
              </p>
            </div>
          )}

          <div style={{ marginTop: 24, fontSize: '0.8rem', color: 'var(--text-tertiary, #64748b)', display: 'flex', gap: 16 }}>
            <span>Filed: {new Date(report.created_at).toLocaleDateString()}</span>
            {report.resolved_at && (
              <span>Resolved: {new Date(report.resolved_at).toLocaleDateString()}</span>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
