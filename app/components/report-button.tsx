'use client';

import { useState } from 'react';
import { currentBrowserPath, requireClientAuth } from '../../lib/auth-path';

export default function ReportButton({ targetType, targetId, label = 'Report' }: { targetType: 'SKILLSHOT'|'COMMENT'|'PROFILE'; targetId: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(formData: FormData) {
    const response = await fetch('/api/reports', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ targetType, targetId, category: formData.get('category'), details: formData.get('details') }) });
    const data = await response.json();
    if (response.status === 401) { requireClientAuth(false, currentBrowserPath(), 'Sign in to submit a report'); return; }
    setMessage(response.ok ? 'Report sent. Thank you for helping the community.' : data.error || 'Could not send report.');
    if (response.ok) window.setTimeout(() => setOpen(false), 1200);
  }

  return <div className="reportControl"><button className="reportButton" type="button" onClick={() => setOpen(true)}>⚑ {label}</button>{open && <div className="reportDialog" role="dialog" aria-modal="true" aria-label={`Report ${targetType.toLowerCase()}`} onClick={() => setOpen(false)}><form action={submit} onClick={event => event.stopPropagation()}><div className="reportTitle"><b>Report {targetType.toLowerCase()}</b><button type="button" onClick={() => setOpen(false)} aria-label="Close">×</button></div><p>Reports are private and reviewed by the Skillshot team.</p><label>Reason<select name="category" required><option value="SPAM">Spam</option><option value="SCAM">Scam</option><option value="HARASSMENT">Harassment</option><option value="HATE">Hateful content</option><option value="NSFW">Adult content</option><option value="VIOLENCE">Violence</option><option value="COPYRIGHT">Copyright</option><option value="OTHER">Other</option></select></label><label>Details <small>Optional</small><textarea name="details" maxLength={500}/></label><button className="primary">Send report</button><p role="status">{message}</p></form></div>}</div>;
}
