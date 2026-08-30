import Link from 'next/link';
import { requirePanel } from '../../../lib/authz';
import { getReadyDb } from '../../../lib/db';
import StorageManager from '../../components/storage-manager';

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
    (SELECT count(*) FROM posts WHERE status<>'PURGED') + (SELECT count(*) FROM users WHERE avatar_url IS NOT NULL) total_uploads,
    (SELECT coalesce(sum(coalesce(image_size,0)+coalesce(display_size,0)+coalesce(thumbnail_size,0)),0) FROM posts)
      + (SELECT coalesce(sum(coalesce(avatar_size,0)),0) FROM users) storage_used,
    (SELECT count(*) FROM upload_events WHERE outcome IN ('SUCCESS','HELD') AND created_at >= current_date) uploads_today,
    (SELECT count(*) FROM upload_events WHERE outcome IN ('SUCCESS','HELD') AND created_at >= date_trunc('month',now())) uploads_month,
    (SELECT count(*) FROM upload_events WHERE outcome='FAILED') failed_uploads,
    (SELECT count(*) FROM posts WHERE status='PENDING_MODERATION') moderation_held`);
  const scans = await sql.query(`SELECT total_bytes,created_at FROM storage_scans WHERE complete=true ORDER BY created_at DESC LIMIT 1`);
  const cleanupRows = await sql.query(`SELECT id,post_id,pathname,reason,cleanup_after,reviewed_at,(cleanup_after<=now()) due FROM storage_cleanup_queue WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 50`);
  const findingRows = await sql.query(`SELECT id,kind,pathname,details,status,last_seen_at FROM storage_orphan_reviews WHERE status='OPEN' ORDER BY last_seen_at DESC LIMIT 100`);
  const cards = [
    ['Stored uploads', Number(stats.total_uploads)], [scans.length ? 'Storage used · last complete scan' : 'Tracked image bytes · scan for total', bytes(Number(scans[0]?.total_bytes ?? stats.storage_used))],
    ['Uploads today', Number(stats.uploads_today)], ['This month', Number(stats.uploads_month)],
    ['Failed uploads', Number(stats.failed_uploads)], ['Moderation-held', Number(stats.moderation_held)],
  ];
  const cleanup = cleanupRows.map(row => ({ id:String(row.id), post_id:row.post_id ? String(row.post_id) : undefined, pathname:String(row.pathname), reason:String(row.reason), cleanup_after:new Date(row.cleanup_after as string).toISOString(), reviewed_at:row.reviewed_at ? new Date(row.reviewed_at as string).toISOString() : undefined, due:Boolean(row.due) }));
  const findings = findingRows.map(row => ({ id:String(row.id), kind:String(row.kind), pathname:String(row.pathname), details:String(row.details), status:String(row.status), last_seen_at:new Date(row.last_seen_at as string).toISOString() }));
  return <main className="staffPage shell"><nav className="staffNav"><Link className="brand" href="/"><span>S</span> Skillshot</Link><Link href="/admin">Overview</Link><Link href="/admin/analytics">Analytics</Link><Link href="/admin/storage">Storage</Link></nav><header><p className="eyebrow">PRIVATE ADMIN AREA</p><h1>Storage</h1><p>Live upload and retained-file totals from the Skillshot database.</p></header><section className="staffStats">{cards.map(([label,value])=><div key={String(label)}><strong>{value}</strong><span>{label}</span></div>)}</section><StorageManager cleanup={cleanup} findings={findings}/></main>;
}
