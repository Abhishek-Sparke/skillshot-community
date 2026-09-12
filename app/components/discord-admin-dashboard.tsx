'use client';

import { useState } from 'react';
import Link from 'next/link';

export interface DiscordAdminConnection {
  id: string;
  skillshotUserId: string;
  username: string;
  displayName: string;
  discordUserId: string;
  discordUsername: string;
  creatorRank: string;
  creatorXp: number;
  connectedAt: string;
  lastSyncAt: string | null;
  syncStatus: string;
  lastError: string | null;
}

export interface DiscordAdminStats {
  connectedUsers: number;
  synced: number;
  pending: number;
  failed: number;
  lastSync: string | null;
}

export default function DiscordAdminDashboard({
  initialStats,
  initialConnections,
}: {
  initialStats: DiscordAdminStats;
  initialConnections: DiscordAdminConnection[];
}) {
  const [stats, setStats] = useState<DiscordAdminStats>(initialStats);
  const [connections, setConnections] = useState<DiscordAdminConnection[]>(initialConnections);
  const [busyUser, setBusyUser] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [registerBusy, setRegisterBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleRegisterCommands = async () => {
    setRegisterBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/staff/discord', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REGISTER_COMMANDS' }),
      });
      const data = await res.json();
      setMessage({
        text: data.message || (data.success ? 'Slash commands registered.' : data.error || 'Failed to register commands.'),
        type: data.success ? 'success' : 'error',
      });
    } catch {
      setMessage({ text: 'Network error registering Discord commands.', type: 'error' });
    } finally {
      setRegisterBusy(false);
    }
  };

  const refreshData = async () => {
    try {
      const res = await fetch('/api/staff/discord');
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setConnections(data.connections);
      }
    } catch {
      // Graceful fallback
    }
  };

  const syncSpecificUser = async (userId: string) => {
    setBusyUser(userId);
    setMessage(null);
    try {
      const res = await fetch('/api/staff/discord', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SYNC_USER', userId }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ text: data.message || 'User synchronized successfully.', type: 'success' });
      } else {
        setMessage({ text: data.message || data.error || 'Failed to sync user.', type: 'error' });
      }
      await refreshData();
    } catch {
      setMessage({ text: 'Network error communicating with server.', type: 'error' });
    } finally {
      setBusyUser(null);
    }
  };

  const handleRetryFailed = async () => {
    setBulkBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/staff/discord', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RETRY_FAILED' }),
      });
      const data = await res.json();
      setMessage({ text: data.message || 'Retry completed.', type: data.success ? 'success' : 'error' });
      await refreshData();
    } catch {
      setMessage({ text: 'Network error executing retry.', type: 'error' });
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkSync = async () => {
    setBulkBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/staff/discord', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'BULK_SYNC', limit: 50 }),
      });
      const data = await res.json();
      setMessage({ text: data.message || 'Bulk sync completed.', type: data.success ? 'success' : 'error' });
      await refreshData();
    } catch {
      setMessage({ text: 'Network error executing bulk sync.', type: 'error' });
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* STAT CARDS */}
      <section className="staffStats">
        <div>
          <span>Connected Users</span>
          <strong>{stats.connectedUsers}</strong>
        </div>
        <div>
          <span>Synced</span>
          <strong style={{ color: 'var(--success, #22c55e)' }}>{stats.synced}</strong>
        </div>
        <div>
          <span>Pending</span>
          <strong style={{ color: 'var(--accent, #ff5039)' }}>{stats.pending}</strong>
        </div>
        <div>
          <span>Failed / Missing</span>
          <strong style={{ color: 'var(--danger, #ef4444)' }}>{stats.failed}</strong>
        </div>
        <div>
          <span>Last Sync</span>
          <strong style={{ fontSize: 13 }}>
            {stats.lastSync ? new Date(stats.lastSync).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : 'Never'}
          </strong>
        </div>
      </section>

      {/* ACTION BAR */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          className="button primary"
          onClick={handleBulkSync}
          disabled={bulkBusy}
        >
          {bulkBusy ? 'Reconciling…' : 'Controlled Bulk Sync'}
        </button>

        <button
          type="button"
          className="button secondary"
          onClick={handleRetryFailed}
          disabled={bulkBusy}
        >
          Retry Failed Syncs
        </button>

        <button
          type="button"
          className="button"
          onClick={handleRegisterCommands}
          disabled={bulkBusy || registerBusy}
        >
          {registerBusy ? 'Registering…' : 'Register Slash Commands'}
        </button>

        <button
          type="button"
          className="button"
          onClick={refreshData}
          disabled={bulkBusy || registerBusy}
        >
          Refresh Status
        </button>
      </div>

      {message && (
        <div
          role="alert"
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            fontSize: 13,
            background: message.type === 'success' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            color: message.type === 'success' ? 'var(--success, #22c55e)' : 'var(--danger, #ef4444)',
            border: `1px solid ${message.type === 'success' ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
          }}
        >
          {message.text}
        </div>
      )}

      {/* CONNECTIONS TABLE */}
      <section className="staffSection">
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>Connected Accounts</h2>
        {connections.length === 0 ? (
          <p className="staffEmpty">No Discord accounts have been connected yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="staffDataTable" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 8px' }}>Creator</th>
                  <th style={{ padding: '10px 8px' }}>Creator Rank</th>
                  <th style={{ padding: '10px 8px' }}>Discord Account</th>
                  <th style={{ padding: '10px 8px' }}>Discord ID</th>
                  <th style={{ padding: '10px 8px' }}>Status</th>
                  <th style={{ padding: '10px 8px' }}>Last Sync</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {connections.map(conn => {
                  const isBusy = busyUser === conn.skillshotUserId;
                  return (
                    <tr key={conn.id} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td style={{ padding: '10px 8px' }}>
                        <Link href={`/users/${encodeURIComponent(conn.username)}`} style={{ fontWeight: 600 }}>
                          {conn.displayName}
                        </Link>
                        <span style={{ display: 'block', color: 'var(--muted)', fontSize: 11 }}>
                          @{conn.username}
                        </span>
                      </td>

                      <td style={{ padding: '10px 8px' }}>
                        <strong>{conn.creatorRank}</strong>
                        <span style={{ display: 'block', color: 'var(--muted)', fontSize: 11 }}>
                          {conn.creatorXp.toLocaleString()} XP
                        </span>
                      </td>

                      <td style={{ padding: '10px 8px' }}>
                        <span>@{conn.discordUsername}</span>
                      </td>

                      <td style={{ padding: '10px 8px', fontFamily: 'monospace', fontSize: 12, color: 'var(--muted)' }}>
                        {conn.discordUserId}
                      </td>

                      <td style={{ padding: '10px 8px' }}>
                        <span
                          style={{
                            padding: '3px 7px',
                            borderRadius: 10,
                            fontSize: 11,
                            fontWeight: 600,
                            background:
                              conn.syncStatus === 'SYNCED'
                                ? 'rgba(34, 197, 94, 0.15)'
                                : conn.syncStatus === 'NOT_IN_GUILD'
                                ? 'rgba(234, 179, 8, 0.15)'
                                : 'rgba(239, 68, 68, 0.15)',
                            color:
                              conn.syncStatus === 'SYNCED'
                                ? 'var(--success, #22c55e)'
                                : conn.syncStatus === 'NOT_IN_GUILD'
                                ? 'var(--warning, #eab308)'
                                : 'var(--danger, #ef4444)',
                          }}
                        >
                          {conn.syncStatus}
                        </span>
                        {conn.lastError && (
                          <small style={{ display: 'block', color: 'var(--danger, #ef4444)', fontSize: 10, marginTop: 4 }}>
                            {conn.lastError}
                          </small>
                        )}
                      </td>

                      <td style={{ padding: '10px 8px', color: 'var(--muted)', fontSize: 12 }}>
                        {conn.lastSyncAt ? new Date(conn.lastSyncAt).toISOString().slice(0, 16).replace('T', ' ') : 'Pending'}
                      </td>

                      <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                        <button
                          type="button"
                          className="button secondary"
                          style={{ padding: '4px 10px', fontSize: 12 }}
                          onClick={() => syncSpecificUser(conn.skillshotUserId)}
                          disabled={isBusy || bulkBusy}
                        >
                          {isBusy ? 'Syncing…' : 'Sync'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
