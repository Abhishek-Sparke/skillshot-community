import { del, list, type ListBlobResultBlob } from '@vercel/blob';
import { requirePrincipal } from '../../../../lib/authz';
import { getReadyDb } from '../../../../lib/db';
import { rateLimit } from '../../../../lib/rate-limit';
import { managedStoragePath } from '../../../../lib/storage-policy';

export const maxDuration = 60;

async function listPrefix(prefix: string, maximum = 5000) {
  const blobs: ListBlobResultBlob[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor, limit: Math.min(1000, maximum - blobs.length) });
    blobs.push(...page.blobs);
    if (!page.hasMore) return { blobs, complete: true };
    cursor = page.cursor;
    if (!cursor || blobs.length >= maximum) return { blobs, complete: false };
  } while (cursor);
  return { blobs, complete: true };
}

export async function POST(request: Request) {
  const auth = await requirePrincipal('storage.manage');
  if ('error' in auth) return auth.error;
  if (!['OWNER', 'ADMIN'].includes(auth.principal.role)) return Response.json({ error: 'Forbidden' }, { status: 403 });
  const data = await request.json().catch(() => ({})) as { action?: string; id?: string };
  try {
    const sql = await getReadyDb();
    if (data.action === 'SCAN') {
      if (!await rateLimit(`storage-scan:${auth.principal.id}`, 3, 3600)) return Response.json({ error: 'Please wait before starting another storage scan.' }, { status: 429 });
      const started = new Date();
      const [shots, avatars, staging, references] = await Promise.all([
        listPrefix('shots/'), listPrefix('avatars/'), listPrefix('staging/'),
        sql.query(`SELECT image_url pathname FROM posts WHERE status<>'PURGED'
          UNION SELECT display_url FROM posts WHERE display_url IS NOT NULL AND status<>'PURGED'
          UNION SELECT thumbnail_url FROM posts WHERE thumbnail_url IS NOT NULL AND status<>'PURGED'
          UNION SELECT avatar_url FROM users WHERE avatar_url IS NOT NULL
          UNION SELECT pathname FROM storage_cleanup_queue WHERE deleted_at IS NULL
          UNION SELECT pathname FROM upload_sessions WHERE expires_at>now() AND state IN ('PENDING','PROCESSING')`),
      ]);
      const blobs = [...shots.blobs, ...avatars.blobs, ...staging.blobs];
      const complete = shots.complete && avatars.complete && staging.complete;
      const paths = new Set(blobs.map(blob => blob.pathname));
      const referenced = new Set(references.map(row => String(row.pathname)).filter(managedStoragePath));
      const findings: { kind: string; pathname: string; details: string }[] = [];
      for (const blob of blobs) {
        // Do not flag a concurrent/in-flight upload as an orphan.
        if (referenced.has(blob.pathname) || blob.uploadedAt.getTime() > started.getTime() - 3600_000) continue;
        findings.push({ kind: 'BLOB_WITHOUT_REFERENCE', pathname: blob.pathname, details: `${blob.size} bytes · uploaded ${blob.uploadedAt.toISOString()}` });
      }
      if (complete) for (const pathname of referenced) {
        // A pending token does not imply that its staging blob already exists.
        if (!paths.has(pathname) && !pathname.startsWith('staging/')) findings.push({ kind: 'DATABASE_PATH_MISSING', pathname, details: 'Referenced by the database but missing from Blob storage' });
      }
      if (findings.length) await sql.query(`INSERT INTO storage_orphan_reviews(id,kind,pathname,details,last_seen_at)
        SELECT gen_random_uuid()::text,f.kind,f.pathname,f.details,$2::timestamptz FROM jsonb_to_recordset($1::jsonb) f(kind text,pathname text,details text)
        ON CONFLICT(kind,pathname) DO UPDATE SET details=excluded.details,status='OPEN',last_seen_at=excluded.last_seen_at`, [JSON.stringify(findings), started.toISOString()]);
      if (complete) await sql.query(`UPDATE storage_orphan_reviews SET status='RESOLVED' WHERE status='OPEN' AND last_seen_at<$1`, [started.toISOString()]);
      await sql.query(`INSERT INTO storage_scans(id,file_count,total_bytes,complete) VALUES($1,$2,$3,$4)`, [crypto.randomUUID(), blobs.length, blobs.reduce((sum, blob) => sum + blob.size, 0), complete]);
      const open = await sql.query(`SELECT id,kind,pathname,details,status,last_seen_at FROM storage_orphan_reviews WHERE status='OPEN' ORDER BY last_seen_at DESC LIMIT 100`);
      await sql.query(`INSERT INTO audit_logs(id,actor_id,action,target_type,target_id) VALUES($1,$2,'STORAGE_SCAN','STORAGE','blob-store')`, [crypto.randomUUID(), auth.principal.id]);
      return Response.json({ scanned: blobs.length, blobOrphans: findings.filter(f => f.kind === 'BLOB_WITHOUT_REFERENCE').length, missingFiles: findings.filter(f => f.kind === 'DATABASE_PATH_MISSING').length, complete, findings: open });
    }

    if (!data.id || typeof data.id !== 'string') return Response.json({ error: 'Missing storage item.' }, { status: 400 });
    if (data.action === 'REVIEW_CLEANUP') {
      const rows = await sql.query(`UPDATE storage_cleanup_queue SET reviewed_at=now() WHERE id=$1 AND deleted_at IS NULL RETURNING pathname`, [data.id]);
      if (!rows.length) return Response.json({ error: 'Cleanup item not found.' }, { status: 404 });
      await sql.query(`INSERT INTO audit_logs(id,actor_id,action,target_type,target_id) VALUES($1,$2,'STORAGE_CLEANUP_REVIEWED','STORAGE',$3)`, [crypto.randomUUID(), auth.principal.id, data.id]);
      return Response.json({ ok: true });
    }
    if (data.action === 'DELETE_CLEANUP') {
      const selected = await sql.query(`SELECT id,post_id,pathname FROM storage_cleanup_queue WHERE id=$1 AND reviewed_at IS NOT NULL AND deleted_at IS NULL AND cleanup_after<=now()`, [data.id]);
      if (!selected.length) return Response.json({ error: 'Review this item and wait until its retention period ends.' }, { status: 409 });
      const item = selected[0];
      let queue = selected;
      if (item.post_id) {
        // Reserve the deleted post before touching Blob. Restore/appeal routes
        // cannot cross PURGING; failed storage deletion can safely be retried.
        const claimed = await sql.query(`UPDATE posts SET status='PURGING' WHERE id=$1 AND status IN ('DELETED','PURGING') AND NOT legal_hold AND NOT appeal_hold
          AND NOT EXISTS(SELECT 1 FROM storage_cleanup_queue q WHERE q.post_id=posts.id AND q.deleted_at IS NULL AND (q.reviewed_at IS NULL OR q.cleanup_after>now()))
          AND NOT EXISTS(SELECT 1 FROM appeals a WHERE a.target_type='SKILLSHOT' AND a.target_id=posts.id AND a.status IN ('PENDING','UNDER_REVIEW'))
          AND NOT EXISTS(SELECT 1 FROM moderation_queue m WHERE m.target_type='SKILLSHOT' AND m.target_id=posts.id AND m.status='PENDING')
          RETURNING id`, [item.post_id]);
        if (!claimed.length) return Response.json({ error: 'Cleanup blocked: review all files, wait for retention, and resolve appeals or holds. Restored posts cannot be purged.' }, { status: 409 });
        queue = await sql.query(`SELECT id,post_id,pathname FROM storage_cleanup_queue WHERE post_id=$1 AND deleted_at IS NULL`, [item.post_id]);
      }
      for (const row of queue) {
        const pathname = String(row.pathname);
        if (!managedStoragePath(pathname)) return Response.json({ error: 'This legacy path requires manual storage review.' }, { status: 409 });
        const active = await sql.query(`SELECT 1 FROM users WHERE avatar_url=$1
          UNION SELECT 1 FROM posts WHERE (image_url=$1 OR display_url=$1 OR thumbnail_url=$1) AND (id<>$2 OR status<>'PURGING')
          UNION SELECT 1 FROM upload_sessions WHERE pathname=$1 AND expires_at>now() AND state IN ('PENDING','PROCESSING') LIMIT 1`, [pathname, item.post_id || '']);
        if (active.length) return Response.json({ error: 'This file is still referenced and cannot be deleted.' }, { status: 409 });
      }
      await del(queue.map(row => String(row.pathname)));
      const ids = queue.map(row => String(row.id));
      const writes = [sql.query(`UPDATE storage_cleanup_queue SET deleted_at=now() WHERE id=ANY($1::text[])`, [ids])];
      if (item.post_id) writes.push(sql.query(`UPDATE posts SET status='PURGED',image_size=0,display_size=0,thumbnail_size=0 WHERE id=$1 AND status='PURGING'`, [item.post_id]));
      writes.push(sql.query(`INSERT INTO audit_logs(id,actor_id,action,target_type,target_id,metadata) VALUES($1,$2,'STORAGE_FILE_DELETED','STORAGE',$3,$4::jsonb)`, [crypto.randomUUID(), auth.principal.id, data.id, JSON.stringify({ paths: queue.map(row => row.pathname) })]));
      await sql.transaction(writes);
      return Response.json({ ok: true, deletedIds: ids });
    }
    if (data.action === 'REVIEW_ORPHAN') {
      const rows = await sql.query(`UPDATE storage_orphan_reviews SET reviewed_at=now(),reviewed_by=$2,status='REVIEWED' WHERE id=$1 RETURNING kind,pathname`, [data.id, auth.principal.id]);
      if (!rows.length) return Response.json({ error: 'Finding not found.' }, { status: 404 });
      if (rows[0].kind === 'BLOB_WITHOUT_REFERENCE' && managedStoragePath(String(rows[0].pathname))) {
        await sql.query(`INSERT INTO storage_cleanup_queue(id,pathname,reason,cleanup_after,reviewed_at)
          SELECT $1,$2,'ORPHAN_REVIEWED',now()+interval '7 days',now()
          WHERE NOT EXISTS(SELECT 1 FROM storage_cleanup_queue WHERE pathname=$2 AND deleted_at IS NULL)`, [crypto.randomUUID(), rows[0].pathname]);
      }
      await sql.query(`INSERT INTO audit_logs(id,actor_id,action,target_type,target_id) VALUES($1,$2,'STORAGE_ORPHAN_REVIEWED','STORAGE',$3)`, [crypto.randomUUID(), auth.principal.id, data.id]);
      return Response.json({ ok: true });
    }
    return Response.json({ error: 'Unsupported storage action.' }, { status: 400 });
  } catch {
    return Response.json({ error: 'Storage is temporarily unavailable. No unreviewed files were deleted. Please retry the action.' }, { status: 503 });
  }
}
