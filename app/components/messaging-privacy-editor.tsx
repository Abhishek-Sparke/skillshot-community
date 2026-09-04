'use client';

import { useEffect, useState } from 'react';

const OPTIONS = [
  { value: 'EVERYONE', label: 'Everyone', desc: 'Any authenticated creator can send you direct messages.' },
  { value: 'FOLLOWING', label: 'People I follow', desc: 'Only creators you follow can message you.' },
  { value: 'FOLLOWERS', label: 'My followers', desc: 'Only people who follow you can message you.' },
  { value: 'NOBODY', label: 'Nobody', desc: 'Disable new incoming direct messages.' },
] as const;

export default function MessagingPrivacyEditor() {
  const [selected, setSelected] = useState<string>('EVERYONE');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!active || !data) return;
        const val = data.preferences?.whoCanMessage;
        if (val) setSelected(val);
      })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function update(value: string) {
    setSelected(value);
    setSaving(true);
    setStatus('');
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whoCanMessage: value }),
      });
      if (!res.ok) {
        setStatus('Could not save preference.');
      } else {
        setStatus('✓ Preference saved');
        setTimeout(() => setStatus(''), 2000);
      }
    } catch {
      setStatus('Network error.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="settingsSection">
      <h2>Direct messaging</h2>
      <p>Control who can start direct chats with you.</p>
      <fieldset style={{ border: 'none', padding: 0, margin: '14px 0 6px', display: 'grid', gap: '10px' }} disabled={loading || saving}>
        <legend className="eyebrow" style={{ marginBottom: '8px' }}>WHO CAN MESSAGE ME?</legend>
        {OPTIONS.map(opt => (
          <label key={opt.value} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '14px' }}>
            <input
              type="radio"
              name="whoCanMessage"
              value={opt.value}
              checked={selected === opt.value}
              onChange={() => update(opt.value)}
              style={{ accentColor: 'var(--red)', marginTop: '3px' }}
            />
            <div>
              <b style={{ color: 'var(--ink)' }}>{opt.label}</b>
              <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: 'var(--muted)' }}>{opt.desc}</p>
            </div>
          </label>
        ))}
      </fieldset>
      {status && <p role="status" style={{ fontSize: '13px', color: status.startsWith('✓') ? '#16a34a' : 'var(--danger)', marginTop: '8px' }}>{status}</p>}
    </section>
  );
}
