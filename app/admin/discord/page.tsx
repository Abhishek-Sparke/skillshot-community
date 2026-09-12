import { requirePanel } from '../../../lib/authz';
import { getReadyDb } from '../../../lib/db';
import { getRankChannelStatus, getDiscordBotPermissions, getGuildChannels, findRankChannel } from '../../../lib/discord-service';
import DiscordAdminDashboard from '../../components/discord-admin-dashboard';

export default async function DiscordAdminPage() {
  const principal = await requirePanel('admin');
  if (!principal.permissions.includes('settings.manage')) {
    return <p>Discord management unavailable.</p>;
  }

  const sql = await getReadyDb();

  const [countRows, lastSyncRows, userRows, rankChannel, botPermissions, guildChannels, defaultRankChannel] = await Promise.all([
    sql.query(`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE sync_status = 'SYNCED')::int AS synced,
        count(*) FILTER (WHERE sync_status = 'PENDING')::int AS pending,
        count(*) FILTER (WHERE sync_status IN ('FAILED', 'NOT_IN_GUILD'))::int AS failed
      FROM discord_connections
    `),
    sql.query(`SELECT max(last_sync_at) AS last_sync FROM discord_connections`),
    sql.query(`
      SELECT
        dc.id,
        dc.skillshot_user_id,
        dc.discord_user_id,
        dc.discord_username_snapshot,
        dc.connected_at,
        dc.last_sync_at,
        dc.sync_status,
        dc.last_error,
        u.username,
        u.display_name,
        u.creator_rank,
        u.creator_xp
      FROM discord_connections dc
      JOIN users u ON u.id = dc.skillshot_user_id
      ORDER BY dc.updated_at DESC
      LIMIT 100
    `),
    getRankChannelStatus().catch(() => ({
      configuredChannelId: '',
      messageId: null,
      lastPostedAt: null,
      status: 'NOT_POSTED',
      lastError: null,
    })),
    getDiscordBotPermissions().catch(err => ({
      viewChannel: false,
      sendMessages: false,
      embedLinks: false,
      manageRoles: false,
      allSatisfied: false,
      error: err?.message || 'Permission check failed',
    })),
    getGuildChannels().catch(() => []),
    findRankChannel().catch(() => null),
  ]);

  const counts = countRows[0] || {};
  const initialStats = {
    connectedUsers: Number(counts.total || 0),
    synced: Number(counts.synced || 0),
    pending: Number(counts.pending || 0),
    failed: Number(counts.failed || 0),
    lastSync: lastSyncRows[0]?.last_sync || null,
  };

  const initialConnections = userRows.map(row => ({
    id: String(row.id),
    skillshotUserId: String(row.skillshot_user_id),
    username: String(row.username),
    displayName: String(row.display_name || row.username),
    discordUserId: String(row.discord_user_id),
    discordUsername: String(row.discord_username_snapshot || ''),
    creatorRank: String(row.creator_rank || 'NEWCOMER'),
    creatorXp: Number(row.creator_xp || 0),
    connectedAt: new Date(row.connected_at as string).toISOString(),
    lastSyncAt: row.last_sync_at ? new Date(row.last_sync_at as string).toISOString() : null,
    syncStatus: String(row.sync_status || 'PENDING'),
    lastError: row.last_error ? String(row.last_error) : null,
  }));

  return (
    <DiscordAdminDashboard
      initialStats={initialStats}
      initialConnections={initialConnections}
      initialRankChannel={rankChannel}
      initialBotPermissions={botPermissions}
      initialGuildChannels={guildChannels}
      initialDefaultRankChannel={defaultRankChannel}
    />
  );
}
