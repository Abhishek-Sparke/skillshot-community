'use client';

import { useState } from 'react';

type Cleanup = { id: string; post_id?: string; pathname: string; reason: string; cleanup_after: string; reviewed_at?: string; due: boolean };
type Finding = { id: string; kind: string; pathname: string; details: string; status: string; last_seen_at: string };

export default function StorageManager({ cleanup, findings }: { cleanup: Cleanup[]; findings: Finding[] }) {
  const [cleanupItems, setCleanupItems] = useState(cleanup);
  const [orphanItems, setOrphanItems] = useState(findings);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  async function act(action: string, id = '') {
    if (action === 'DELETE_CLEANUP' && !window.confirm('Permanently delete the reviewed files for this item from storage? A deleted Skillshot is cleaned up as a group. This cannot be undone.')) return;
    setBusy(`${action}:${id}`);
    setMessage(action === 'SCAN' ? 'Scanning referenced Skillshot and avatar files…' : 'Saving storage review…');
    try {
      const response = await fetch('/api/staff/storage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Storage action failed.');
      if (action === 'SCAN') {
        setOrphanItems(data.findings || []);
        setMessage(`Scan complete: ${data.scanned} files checked, ${data.blobOrphans} unreferenced files, ${data.missingFiles} missing files.${data.complete ? '' : ' Scan limit reached; no automatic conclusions were made.'}`);
      } else if (action === 'REVIEW_CLEANUP') {
        setCleanupItems(current => current.map(item => item.id === id ? { ...item, reviewed_at: new Date().toISOString() } : item));
        setMessage('Cleanup item reviewed. It can only be deleted after retention ends.');
      } else if (action === 'DELETE_CLEANUP') {
        setCleanupItems(current => current.filter(item => !(data.deletedIds || [id]).includes(item.id)));
        setMessage('Reviewed storage file permanently deleted.');
      } else {
        setOrphanItems(current => current.filter(item => item.id !== id));
        setMessage('Finding reviewed. Unreferenced files enter a 7-day cleanup queue; no file was deleted. Refresh to see the updated queue.');
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Storage action failed.'); }
    finally { setBusy(''); }
  }

  return <>
    <section className="staffSection">
      <div className="sectionHeading"><div><h2>Orphan review</h2><p>Compare private Blob files with database references. Scans never delete files.</p></div><button type="button" onClick={() => act('SCAN')} disabled={Boolean(busy)}>{busy === 'SCAN:' ? 'Scanning…' : 'Scan storage'}</button></div>
      {orphanItems.length ? <div className="staffTable">{orphanItems.map(item => <article key={item.id}><div><b>{item.kind === 'BLOB_WITHOUT_REFERENCE' ? 'File without database reference' : 'Database reference without file'}</b><span>{item.pathname}</span><small>{item.details} · last seen {new Date(item.last_seen_at).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'}</small></div><div><button type="button" onClick={() => act('REVIEW_ORPHAN', item.id)} disabled={Boolean(busy)}>reviewed</button></div></article>)}</div> : <p>No open orphan findings. Run a scan to check the current store.</p>}
    </section>
    <section className="staffSection"><h2>Safe cleanup queue</h2><p>Deleted or replaced content remains private during its retention period and requires review before permanent deletion.</p>{cleanupItems.length ? <div className="staffTable">{cleanupItems.map(item => <article key={item.id}><div><b>{item.post_id ? `Skillshot ${item.post_id}` : item.reason === 'AVATAR_REPLACED' ? 'Replaced profile image' : 'Retained upload file'}</b><span>{item.reason} · {item.pathname}</span><small>Eligible after {new Date(item.cleanup_after).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'}</small></div><div>{!item.reviewed_at ? <button type="button" onClick={() => act('REVIEW_CLEANUP', item.id)} disabled={Boolean(busy)}>review</button> : <button className="dangerAction" type="button" onClick={() => act('DELETE_CLEANUP', item.id)} disabled={Boolean(busy) || !item.due}>{item.due ? 'delete permanently' : 'retention active'}</button>}</div></article>)}</div> : <p>No files are awaiting cleanup.</p>}</section>
    <p role="status">{message}</p>
  </>;
}
