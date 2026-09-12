import { NextResponse } from 'next/server';
import { requirePrincipal } from '../../../../lib/authz';
import { getReadyDb } from '../../../../lib/db';
import { rankFromXp } from '../../../../lib/creator-rank';
import {
  syncMemberCreatorRank,
  reconcileAllDiscordRoles,
  callDiscordApi,
  postOrUpdateRankVerificationMessage,
  getDiscordBotPermissions,
  getRankChannelStatus,
  getGuildChannels,
  findRankChannel,
  findWelcomeChannel,
  getWelcomeSettings,
  updateWelcomeSettings,
  sendTestWelcomeMessage,
  syncNewMemberWelcomes,
} from '../../../../lib/discord-service';
import { DISCORD_CLIENT_ID, DISCORD_GUILD_ID } from '../../../../lib/discord-config';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requirePrincipal('settings.manage');
  if ('error' in auth) {
    return auth.error;
  }

  const sql = await getReadyDb();

  const [countRows, lastSyncRows, userRows, rankChannel, botPermissions, guildChannels, defaultRankChannel, welcomeSettings, defaultWelcomeChannel] = await Promise.all([
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
      status: 'ERROR',
      lastError: 'Failed to read rank channel status',
    })),
    getDiscordBotPermissions().catch(err => ({
      viewChannel: false,
      sendMessages: false,
      embedLinks: false,
      manageRoles: false,
      allSatisfied: false,
      error: err?.message || 'Error checking bot permissions',
    })),
    getGuildChannels().catch(() => []),
    findRankChannel().catch(() => null),
    getWelcomeSettings().catch(() => ({ channelId: null, enabled: true })),
    findWelcomeChannel().catch(() => null),
  ]);

  const counts = countRows[0] || {};
  const stats = {
    connectedUsers: Number(counts.total || 0),
    synced: Number(counts.synced || 0),
    pending: Number(counts.pending || 0),
    failed: Number(counts.failed || 0),
    lastSync: lastSyncRows[0]?.last_sync || null,
  };

  const connections = userRows.map(row => ({
    id: String(row.id),
    skillshotUserId: String(row.skillshot_user_id),
    username: String(row.username),
    displayName: String(row.display_name || row.username),
    discordUserId: String(row.discord_user_id),
    discordUsername: String(row.discord_username_snapshot || ''),
    creatorRank: String(row.creator_rank || 'NEWCOMER'),
    creatorXp: Number(row.creator_xp || 0),
    connectedAt: row.connected_at,
    lastSyncAt: row.last_sync_at,
    syncStatus: String(row.sync_status || 'PENDING'),
    lastError: row.last_error ? String(row.last_error) : null,
  }));

  return NextResponse.json({
    stats,
    connections,
    rankChannel,
    botPermissions,
    guildChannels,
    defaultRankChannel,
    welcomeSettings,
    defaultWelcomeChannel,
  });
}

export async function POST(request: Request) {
  const auth = await requirePrincipal('settings.manage');
  if ('error' in auth) {
    return auth.error;
  }
  const principal = auth.principal;

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const action = String(body.action || '').toUpperCase();
  const sql = await getReadyDb();

  if (action === 'SYNC_USER') {
    const userId = String(body.userId || '');
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const rows = await sql.query(
      `SELECT dc.discord_user_id, u.creator_xp
       FROM discord_connections dc
       JOIN users u ON u.id = dc.skillshot_user_id
       WHERE dc.skillshot_user_id = $1
       LIMIT 1`,
      [userId]
    );

    if (!rows.length) {
      return NextResponse.json({ error: 'User does not have a connected Discord account' }, { status: 404 });
    }

    const discordUserId = String(rows[0].discord_user_id);
    const xp = Number(rows[0].creator_xp || 0);
    const currentRank = rankFromXp(xp);

    const result = await syncMemberCreatorRank(discordUserId, currentRank.id, principal.id);
    return NextResponse.json(result);
  }

  if (action === 'RETRY_FAILED') {
    const failedRows = await sql.query(
      `SELECT dc.discord_user_id, u.creator_xp
       FROM discord_connections dc
       JOIN users u ON u.id = dc.skillshot_user_id
       WHERE dc.sync_status IN ('FAILED', 'NOT_IN_GUILD')
       LIMIT 25`
    );

    let retried = 0;
    let succeeded = 0;

    for (const row of failedRows) {
      retried++;
      const xp = Number(row.creator_xp || 0);
      const currentRank = rankFromXp(xp);
      const res = await syncMemberCreatorRank(String(row.discord_user_id), currentRank.id, principal.id);
      if (res.success) succeeded++;
    }

    return NextResponse.json({
      success: true,
      message: `Retried ${retried} failed sync(s): ${succeeded} succeeded.`,
      retried,
      succeeded,
    });
  }

  if (action === 'BULK_SYNC' || action === 'RECONCILE') {
    const limit = Math.min(100, Math.max(1, Number(body.limit) || 25));
    const result = await reconcileAllDiscordRoles(limit);
    return NextResponse.json({
      success: true,
      message: `Reconciled ${result.total} connection(s): ${result.synced} in sync, ${result.notInGuild} not in server, ${result.failed} failed.`,
      ...result,
    });
  }

  if (action === 'REGISTER_COMMANDS') {
    const commands = [
      {
        name: 'rank',
        description: 'Display your current Skillshot Creator Rank, level, and XP progress',
        type: 1,
      },
      {
        name: 'verify',
        description: 'Verify your Skillshot account and receive your Creator Rank role',
        type: 1,
      },
      {
        name: 'link',
        description: 'Get the official link to connect your Discord account to Skillshot',
        type: 1,
      },
      {
        name: 'sync',
        description: 'Synchronize your Discord Creator Rank role with your Skillshot account',
        type: 1,
      },
    ];

    const endpoint = `/applications/${DISCORD_CLIENT_ID}/guilds/${DISCORD_GUILD_ID}/commands`;
    const res = await callDiscordApi(endpoint, {
      method: 'PUT',
      body: JSON.stringify(commands),
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          success: false,
          message: `Failed to register Discord commands (${res.status}): ${res.data?.message || 'Check bot permissions'}`,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully registered ${res.data?.length || 4} slash commands (/rank, /verify, /link, /sync) in Guild ${DISCORD_GUILD_ID}!`,
      commands: res.data,
    });
  }

  if (action === 'POST_VERIFICATION_MESSAGE') {
    const channelId = body.channelId ? String(body.channelId) : undefined;
    const result = await postOrUpdateRankVerificationMessage(channelId);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  }

  if (action === 'UPDATE_WELCOME_SETTINGS') {
    const channelId = body.channelId !== undefined ? (body.channelId ? String(body.channelId).trim() : null) : null;
    const enabled = body.enabled !== false;
    const updated = await updateWelcomeSettings(channelId, enabled);
    return NextResponse.json({
      success: true,
      message: 'Welcome settings saved successfully.',
      welcomeSettings: updated,
    });
  }

  if (action === 'SEND_TEST_WELCOME') {
    const channelId = body.channelId ? String(body.channelId).trim() : undefined;
    const result = await sendTestWelcomeMessage(channelId);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  }

  if (action === 'SYNC_WELCOME_MEMBERS') {
    const limit = Math.min(100, Math.max(1, Number(body.limit) || 25));
    const channelId = body.channelId ? String(body.channelId).trim() : undefined;
    const result = await syncNewMemberWelcomes({ limit, channelIdOverride: channelId });
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
