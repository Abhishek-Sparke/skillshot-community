'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export interface DiscordStatusData {
  connected: boolean;
  discordUserId?: string;
  discordUsername?: string;
  connectedAt?: string;
  lastSyncAt?: string;
  syncStatus?: 'SYNCED' | 'PENDING' | 'FAILED' | 'NOT_IN_GUILD';
  lastError?: string | null;
  creatorRank: {
    id: string;
    label: string;
    symbol: string;
  };
  targetRoleId: string;
}

export default function DiscordConnectionCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<DiscordStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/discord/status');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    // Check URL parameters for OAuth return states
    const err = searchParams.get('error');
    const conn = searchParams.get('connected');
    const warning = searchParams.get('warning');

    if (err) {
      setMessage({ text: err, type: 'error' });
    } else if (conn) {
      if (warning === 'not_in_guild') {
        setMessage({
          text: 'Connected to Discord, but you have not joined the Skillshot Discord server yet. Join the server to sync your role.',
          type: 'warning',
        });
      } else {
        setMessage({
          text: 'Successfully connected your Discord account! Your Creator Rank role is being synchronized.',
          type: 'success',
        });
      }
    }
  }, [searchParams]);

  const handleSync = async () => {
    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch('/api/discord/sync', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setMessage({ text: json.message || 'Rank synchronized successfully!', type: 'success' });
      } else if (json.status === 'NOT_IN_GUILD') {
        setMessage({
          text: json.message || 'You must join the Skillshot Discord server to sync your role.',
          type: 'warning',
        });
      } else {
        setMessage({ text: json.message || json.error || 'Failed to sync rank.', type: 'error' });
      }
      await fetchStatus();
    } catch {
      setMessage({ text: 'Network error while synchronizing Discord rank.', type: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your Discord account? Your Skillshot Creator Rank will not be affected.')) {
      return;
    }
    setDisconnecting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/discord/disconnect', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setMessage({ text: 'Discord account disconnected.', type: 'success' });
        await fetchStatus();
      } else {
        setMessage({ text: json.message || 'Failed to disconnect.', type: 'error' });
      }
    } catch {
      setMessage({ text: 'Network error while disconnecting Discord account.', type: 'error' });
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <section className="settingsSection" aria-busy="true">
        <h2>Discord</h2>
        <p className="settingsHint">Loading connection status…</p>
      </section>
    );
  }

  const isConnected = Boolean(data?.connected);

  return (
    <section className="settingsSection discordConnectionCard" aria-label="Discord Connection">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }} aria-hidden="true">💬</span>
          <h2 style={{ margin: 0, fontSize: 18 }}>Discord</h2>
        </div>
        {isConnected && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: '3px 8px',
              borderRadius: 12,
              background: 'rgba(34, 197, 94, 0.15)',
              color: 'var(--success, #22c55e)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            Connected ✓
          </span>
        )}
      </div>

      {message && (
        <div
          role="alert"
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            marginBottom: 14,
            fontSize: 13,
            background:
              message.type === 'success'
                ? 'rgba(34, 197, 94, 0.12)'
                : message.type === 'warning'
                ? 'rgba(234, 179, 8, 0.12)'
                : 'rgba(239, 68, 68, 0.12)',
            color:
              message.type === 'success'
                ? 'var(--success, #22c55e)'
                : message.type === 'warning'
                ? 'var(--warning, #eab308)'
                : 'var(--danger, #ef4444)',
            border: `1px solid ${
              message.type === 'success'
                ? 'rgba(34, 197, 94, 0.25)'
                : message.type === 'warning'
                ? 'rgba(234, 179, 8, 0.25)'
                : 'rgba(239, 68, 68, 0.25)'
            }`,
          }}
        >
          {message.text}
        </div>
      )}

      {!isConnected ? (
        <>
          <p className="settingsHint" style={{ marginBottom: 16 }}>
            Connect your Discord account to verify your Creator Rank and receive your matching Discord role.
          </p>
          <div className="settingsActions">
            <a
              href="/api/discord/authorize"
              className="button primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
            >
              <span>🔗 Verify Skillshot with Discord</span>
            </a>
          </div>
        </>
      ) : (
        <>
          {/* VERIFICATION STATUS HEADER */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 10,
              marginBottom: 16,
              background: 'rgba(34, 197, 94, 0.08)',
              border: '1px solid rgba(34, 197, 94, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 18 }} aria-hidden="true">✅</span>
              <strong style={{ fontSize: 15, color: 'var(--success, #22c55e)' }}>Discord Verified</strong>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--foreground)' }}>
              {searchParams.get('already_linked') === '1'
                ? 'Your Discord account is already connected to Skillshot.'
                : 'Your Skillshot account is successfully connected.'}
            </p>
          </div>

          {/* ROLE & RANK DETAILS GRID */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 12,
              padding: '14px 16px',
              borderRadius: 10,
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--line)',
              marginBottom: 16,
            }}
          >
            <div>
              <small style={{ display: 'block', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase' }}>
                Discord Account
              </small>
              <strong style={{ fontSize: 14 }}>@{data?.discordUsername}</strong>
            </div>

            <div>
              <small style={{ display: 'block', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase' }}>
                Creator Rank
              </small>
              <strong style={{ fontSize: 14 }}>
                {data?.creatorRank.symbol} {data?.creatorRank.label}
              </strong>
            </div>

            <div>
              <small style={{ display: 'block', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase' }}>
                Discord Role
              </small>
              <strong style={{ fontSize: 14, color: data?.syncStatus === 'SYNCED' ? 'var(--success, #22c55e)' : undefined }}>
                {data?.syncStatus === 'SYNCED'
                  ? `${data.creatorRank.label} ✓`
                  : data?.syncStatus === 'NOT_IN_GUILD'
                  ? 'Not in server ⚠️'
                  : 'Pending sync ◌'}
              </strong>
            </div>
          </div>

          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
            Your role will automatically update whenever your Skillshot rank changes.
          </p>

          <div className="settingsActions" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="button secondary"
              onClick={handleSync}
              disabled={syncing || disconnecting}
            >
              {syncing ? 'Syncing Rank…' : 'Sync Rank'}
            </button>

            <a
              href="/api/discord/authorize"
              className="button"
              style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
            >
              Reconnect
            </a>

            <button
              type="button"
              className="button"
              style={{ color: 'var(--danger, #ef4444)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
              onClick={handleDisconnect}
              disabled={syncing || disconnecting}
            >
              {disconnecting ? 'Disconnecting…' : 'Disconnect'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
