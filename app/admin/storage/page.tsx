import Link from 'next/link';
import { requirePanel } from '../../../lib/authz';
import { getReadyDb } from '../../../lib/db';

function bytes(value: number) {
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const unit = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** unit).toFixed(unit > 1 ? 1 : 0)} ${units[unit]}`;
}

export default async function StoragePage() {
  await requirePanel('admin');
  const sql = await getReadyDb();
  const [stats] = await sql.query(`SELECT
    count(*) FILTER (WHERE image_url IS NOT NULL) total_uploads,
    coalesce(sum(coalesce(image_size,0)+coalesce(display_size,0)+coalesce(thumbnail_size,0)),0) storage_used,
    count(*) FILTER (WHERE created_at >= current_date) uploads_today,
    count(*) FILTER (WHERE created_at >= date_trunc('month',now())) uploads_month,
    count(*) FILTER (WHERE status='PENDING_MODERATION') moderation_held
    FROM posts`);
  const [failed] = await sql.query(`SELECT count(*) failed_uploads FROM upload_events WHERE outcome='FAILED'`);
  const cleanup = await sql.query(`SELECT id,post_id,reason,cleanup_after,reviewed_at FROM storage_cleanup_queue ORDER BY created_at DESC LIMIT 50`);
  const cards = [
    ['Total uploads', Number(stats.total_uploads)], ['Storage used', bytes(Number(stats.storage_used))],
    ['Uploads today', Number(stats.uploads_today)], ['This month', Number(stats.uploads_month)],
    ['Failed uploads', Number(failed.failed_uploads)], ['Moderation-held', Number(stats.moderation_held)],
  ];
  return <main className="staffPage shell"><nav className="staffNav"><Link className="brand" href="/"><span>S</span> Skillshot</Link><Link href="/admin">Overview</Link><Link href="/admin/analytics">Analytics</Link><Link href="/admin/storage">Storage</Link></nav><header><p className="eyebrow">PRIVATE ADMIN AREA</p><h1>Storage</h1><p>Live upload and retained-file totals from the Skillshot database.</p></header><section className="staffStats">{cards.map(([label,value])=><div key={String(label)}><strong>{value}</strong><span>{label}</span></div>)}</section><section className="staffSection"><h2>Safe cleanup queue</h2><p>Deleted content is retained for review before its files are permanently removed.</p>{cleanup.length ? <div className="staffTable">{cleanup.map(item=><article key={String(item.id)}><div><b>Skillshot {String(item.post_id)}</b><span>{String(item.reason)}</span><small>Eligible after {new Date(item.cleanup_after as string).toLocaleString()}</small></div><div><span>{item.reviewed_at ? 'Reviewed' : 'Awaiting review'}</span></div></article>)}</div> : <p>No files are awaiting cleanup.</p>}</section></main>;
}
