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

export interface DiscordRankChannelStatus {
  configuredChannelId: string;
  messageId: string | null;
  lastPostedAt: string | null;
  status: string;
  lastError: string | null;
}

export interface DiscordBotPermissions {
  viewChannel: boolean;
  sendMessages: boolean;
  embedLinks: boolean;
  manageRoles: boolean;
  allSatisfied: boolean;
  error?: string;
}

export default function DiscordAdminDashboard({
  initialStats,
  initialConnections,
  initialRankChannel,
  initialBotPermissions,
  initialGuildChannels = [],
  initialDefaultRankChannel,
}: {
  initialStats: DiscordAdminStats;
  initialConnections: DiscordAdminConnection[];
  initialRankChannel?: DiscordRankChannelStatus;
  initialBotPermissions?: DiscordBotPermissions;
  initialGuildChannels?: Array<{ id: string; name: string }>;
  initialDefaultRankChannel?: { id: string; name: string } | null;
}) {
  const [stats, setStats] = useState<DiscordAdminStats>(initialStats);
  const [connections, setConnections] = useState<DiscordAdminConnection[]>(initialConnections);
  const [rankChannel, setRankChannel] = useState<DiscordRankChannelStatus | undefined>(initialRankChannel);
  const [botPermissions, setBotPermissions] = useState<DiscordBotPermissions | undefined>(initialBotPermissions);
  const [guildChannels, setGuildChannels] = useState<Array<{ id: string; name: string }>>(initialGuildChannels);
  const [channelInput, setChannelInput] = useState(
    initialRankChannel?.configuredChannelId || initialDefaultRankChannel?.id || ''
  );
  const [busyUser, setBusyUser] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [registerBusy, setRegisterBusy] = useState(false);
  const [postBusy, setPostBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handlePostVerificationMessage = async () => {
    setPostBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/staff/discord', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'POST_VERIFICATION_MESSAGE',
          channelId: channelInput.trim() || undefined,
        }),
      });
      const data = await res.json();
      setMessage({
        text: data.message || (data.success ? 'Verification message posted to Discord!' : data.error || 'Failed to post message.'),
        type: data.success ? 'success' : 'error',
      });
      await refreshData();
    } catch {
      setMessage({ text: 'Network error posting verification message.', type: 'error' });
    } finally {
      setPostBusy(false);
    }
  };

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
        if (data.rankChannel) setRankChannel(data.rankChannel);
        if (data.botPermissions) setBotPermissions(data.botPermissions);
        if (data.guildChannels) setGuildChannels(data.guildChannels);
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

      {/* RANK CHANNEL & VERIFICATION MESSAGE */}
      <section
        className="staffSection"
        style={{
          background: 'rgba(255, 80, 57, 0.03)',
          border: '1px solid rgba(255, 80, 57, 0.2)',
          borderRadius: 12,
          padding: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🏆</span>
            <h2 style={{ fontSize: 16, margin: 0 }}>Discord #rank Verification Message</h2>
          </div>
          <span
            style={{
              fontSize: 12,
              padding: '3px 8px',
              borderRadius: 6,
              background: rankChannel?.status === 'ACTIVE' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              color: rankChannel?.status === 'ACTIVE' ? 'var(--success, #22c55e)' : 'var(--muted)',
            }}
          >
            {rankChannel?.status === 'ACTIVE' ? `Message Active (${rankChannel.messageId})` : 'Not Posted Yet'}
          </span>
        </div>

        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
          Post the official Skillshot verification embed in your server&apos;s rank channel. Members click &quot;Verify Skillshot&quot; to authenticate, verify their Creator Rank, and automatically receive their Discord role.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
            marginBottom: 16,
            background: 'rgba(0, 0, 0, 0.2)',
            padding: 12,
            borderRadius: 8,
          }}
        >
          <div>
            <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>Target Channel (#👑ranks)</span>
            {guildChannels.length > 0 ? (
              <select
                value={channelInput}
                onChange={e => setChannelInput(e.target.value)}
                className="input"
                style={{ width: '100%', marginTop: 4, fontSize: 13, background: 'var(--card-bg, #161822)', color: 'inherit' }}
              >
                <option value="">Auto-detect (#👑ranks)</option>
                {guildChannels.map(c => (
                  <option key={c.id} value={c.id}>
                    #{c.name} ({c.id})
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={channelInput}
                onChange={e => setChannelInput(e.target.value)}
                placeholder="Leave blank for auto-detect or enter channel ID"
                className="input"
                style={{ width: '100%', marginTop: 4, fontSize: 13 }}
              />
            )}
          </div>

          <div>
            <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>Last Posted / Updated</span>
            <strong style={{ fontSize: 13, display: 'block', marginTop: 8 }}>
              {rankChannel?.lastPostedAt ? new Date(rankChannel.lastPostedAt).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : 'Never'}
            </strong>
          </div>

          <div>
            <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>Bot Permissions</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, fontSize: 12 }}>
              <span style={{ color: botPermissions?.viewChannel ? 'var(--success, #22c55e)' : 'var(--danger, #ef4444)' }}>
                View {botPermissions?.viewChannel ? '✓' : '✕'}
              </span>
              <span>•</span>
              <span style={{ color: botPermissions?.sendMessages ? 'var(--success, #22c55e)' : 'var(--danger, #ef4444)' }}>
                Send {botPermissions?.sendMessages ? '✓' : '✕'}
              </span>
              <span>•</span>
              <span style={{ color: botPermissions?.embedLinks ? 'var(--success, #22c55e)' : 'var(--danger, #ef4444)' }}>
                Embed {botPermissions?.embedLinks ? '✓' : '✕'}
              </span>
              <span>•</span>
              <span style={{ color: botPermissions?.manageRoles ? 'var(--success, #22c55e)' : 'var(--danger, #ef4444)' }}>
                Roles {botPermissions?.manageRoles ? '✓' : '✕'}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="button primary"
            onClick={handlePostVerificationMessage}
            disabled={postBusy || bulkBusy}
            style={{
              padding: '10px 18px',
              fontSize: 14,
              fontWeight: 700,
              background: 'linear-gradient(135deg, #ff5039, #ff7a59)',
              boxShadow: '0 4px 14px rgba(255, 80, 57, 0.35)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {postBusy ? 'Posting to Discord…' : rankChannel?.messageId ? '🚀 Update Verification Message in #👑ranks' : '🚀 Post Verification Message in #👑ranks'}
          </button>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            Posts exactly one permanent embed message with the &quot;🔗 Verify Skillshot&quot; button. If one exists, it updates it.
          </span>
        </div>
      </section>

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
