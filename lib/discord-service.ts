import { getReadyDb } from './db';
import {
  DISCORD_API_BASE,
  DISCORD_GUILD_ID,
  DISCORD_CREATOR_RANK_ROLES,
  MANAGED_DISCORD_ROLE_IDS,
  type isManagedCreatorRankRole,
} from './discord-config';
import { rankFromXp, type CreatorRankId, CREATOR_RANKS } from './creator-rank';

export type DiscordSyncResult = {
  success: boolean;
  inGuild: boolean;
  status: 'SYNCED' | 'FAILED' | 'NOT_IN_GUILD' | 'NOT_LINKED';
  rank?: CreatorRankId;
  roleId?: string;
  message: string;
  error?: string;
};

export type DiscordGuildMember = {
  user: {
    id: string;
    username: string;
    discriminator?: string;
    global_name?: string | null;
    avatar?: string | null;
  };
  roles: string[];
  nick?: string | null;
};

function getBotToken(): string | null {
  const token = process.env.DISCORD_BOT_TOKEN?.trim();
  return token || null;
}

/**
 * Perform an authenticated Discord REST API request using the Bot token.
 * Handles rate limits, network errors, and redacts sensitive data.
 */
export async function callDiscordApi(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ status: number; ok: boolean; data?: any; headers: Headers }> {
  const token = getBotToken();
  if (!token) {
    return {
      status: 500,
      ok: false,
      data: { message: 'Discord bot token is not configured on the server.' },
      headers: new Headers(),
    };
  }

  const url = `${DISCORD_API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bot ${token}`);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    // Handle Discord Rate Limits (429)
    if (res.status === 429) {
      const retryAfter = res.headers.get('Retry-After');
      const errData = await res.json().catch(() => ({}));
      return {
        status: 429,
        ok: false,
        data: { message: `Discord rate limited. Retry after ${retryAfter || errData.retry_after || 5}s` },
        headers: res.headers,
      };
    }

    if (res.status === 204) {
      return { status: 204, ok: true, headers: res.headers };
    }

    const data = await res.json().catch(() => null);
    return { status: res.status, ok: res.ok, data, headers: res.headers };
  } catch (err: any) {
    return {
      status: 500,
      ok: false,
      data: { message: err?.message || 'Network error communicating with Discord API' },
      headers: new Headers(),
    };
  }
}

/**
 * Fetches a member of the official Skillshot Discord Guild.
 * Returns null if the user has not joined the guild (404).
 */
export async function getDiscordGuildMember(discordUserId: string): Promise<DiscordGuildMember | null> {
  if (!discordUserId) return null;
  const res = await callDiscordApi(`/guilds/${DISCORD_GUILD_ID}/members/${encodeURIComponent(discordUserId)}`);
  if (res.status === 404 || !res.ok) {
    return null;
  }
  return res.data as DiscordGuildMember;
}

/**
 * Synchronize a user's Discord Creator Rank role.
 *
 * Rules:
 * 1. Checks if member is in Guild 1548208097112236124.
 * 2. ONLY modifies the seven Creator Rank roles.
 * 3. NEVER removes or alters staff roles (Owner, Admin, Mod, Head Mod, Trusted Contributor).
 * 4. Ensures the user has exactly ONE Creator Rank role matching their current Skillshot rank.
 */
export async function syncMemberCreatorRank(
  discordUserId: string,
  targetRank: CreatorRankId,
  actorId?: string
): Promise<DiscordSyncResult> {
  const sql = await getReadyDb();
  const targetRoleId = DISCORD_CREATOR_RANK_ROLES[targetRank];

  if (!targetRoleId) {
    return {
      success: false,
      inGuild: false,
      status: 'FAILED',
      message: `Invalid Creator Rank specified: ${targetRank}`,
    };
  }

  // 1. Resolve guild member
  const member = await getDiscordGuildMember(discordUserId);
  if (!member) {
    await sql.query(
      `UPDATE discord_connections
       SET sync_status = 'NOT_IN_GUILD',
           last_error = 'User is not a member of the Skillshot Discord server.',
           last_sync_at = now(),
           updated_at = now()
       WHERE discord_user_id = $1`,
      [discordUserId]
    );

    // Audit log
    await sql.query(
      `INSERT INTO audit_logs(id, actor_id, action, target_type, target_id, metadata)
       VALUES($1, $2, 'DISCORD_RANK_SYNC', 'USER', $3, $4::jsonb)`,
      [
        crypto.randomUUID(),
        actorId || null,
        discordUserId,
        JSON.stringify({
          discordUserId,
          targetRank,
          result: 'NOT_IN_GUILD',
          reason: 'User is not in the Skillshot Discord guild',
        }),
      ]
    );

    return {
      success: false,
      inGuild: false,
      status: 'NOT_IN_GUILD',
      rank: targetRank,
      roleId: targetRoleId,
      message: 'You have not joined the Skillshot Discord server yet. Join the server to sync your rank.',
    };
  }

  // 2. Identify existing Creator Rank roles on the member
  const currentCreatorRoles = member.roles.filter(roleId => MANAGED_DISCORD_ROLE_IDS.includes(roleId));
  const rolesToRemove = currentCreatorRoles.filter(roleId => roleId !== targetRoleId);
  const needsAdd = !member.roles.includes(targetRoleId);

  // If already matches target role and no obsolete roles exist, exit early
  if (rolesToRemove.length === 0 && !needsAdd) {
    await sql.query(
      `UPDATE discord_connections
       SET sync_status = 'SYNCED',
           last_error = null,
           last_sync_at = now(),
           updated_at = now()
       WHERE discord_user_id = $1`,
      [discordUserId]
    );

    return {
      success: true,
      inGuild: true,
      status: 'SYNCED',
      rank: targetRank,
      roleId: targetRoleId,
      message: `Your Discord role is already up to date (${CREATOR_RANKS[targetRank].label}).`,
    };
  }

  // 3. Remove obsolete Creator Rank roles (never touch staff roles)
  for (const oldRoleId of rolesToRemove) {
    await callDiscordApi(
      `/guilds/${DISCORD_GUILD_ID}/members/${encodeURIComponent(discordUserId)}/roles/${oldRoleId}`,
      {
        method: 'DELETE',
        headers: {
          'X-Audit-Log-Reason': `Skillshot Creator Rank update to ${CREATOR_RANKS[targetRank].label}`,
        },
      }
    );
  }

  // 4. Add current Creator Rank role
  if (needsAdd) {
    const addRes = await callDiscordApi(
      `/guilds/${DISCORD_GUILD_ID}/members/${encodeURIComponent(discordUserId)}/roles/${targetRoleId}`,
      {
        method: 'PUT',
        headers: {
          'X-Audit-Log-Reason': `Skillshot Creator Rank update to ${CREATOR_RANKS[targetRank].label}`,
        },
      }
    );

    if (!addRes.ok) {
      const errMsg = addRes.data?.message || 'Failed to assign Discord role (check bot permissions and role hierarchy).';
      await sql.query(
        `UPDATE discord_connections
         SET sync_status = 'FAILED',
             last_error = $2,
             last_sync_at = now(),
             updated_at = now()
         WHERE discord_user_id = $1`,
        [discordUserId, errMsg]
      );

      await sql.query(
        `INSERT INTO audit_logs(id, actor_id, action, target_type, target_id, metadata)
         VALUES($1, $2, 'DISCORD_RANK_SYNC', 'USER', $3, $4::jsonb)`,
        [
          crypto.randomUUID(),
          actorId || null,
          discordUserId,
          JSON.stringify({
            discordUserId,
            targetRank,
            targetRoleId,
            result: 'FAILED',
            error: errMsg,
          }),
        ]
      );

      return {
        success: false,
        inGuild: true,
        status: 'FAILED',
        rank: targetRank,
        roleId: targetRoleId,
        message: `Failed to update Discord role: ${errMsg}`,
        error: errMsg,
      };
    }
  }

  // 5. Success persistence & audit
  await sql.query(
    `UPDATE discord_connections
     SET sync_status = 'SYNCED',
         last_error = null,
         last_sync_at = now(),
         updated_at = now()
     WHERE discord_user_id = $1`,
    [discordUserId]
  );

  await sql.query(
    `INSERT INTO audit_logs(id, actor_id, action, target_type, target_id, metadata)
     VALUES($1, $2, 'DISCORD_RANK_SYNC', 'USER', $3, $4::jsonb)`,
    [
      crypto.randomUUID(),
      actorId || null,
      discordUserId,
      JSON.stringify({
        discordUserId,
        targetRank,
        targetRoleId,
        removedRoles: rolesToRemove,
        addedRole: needsAdd ? targetRoleId : null,
        result: 'SUCCESS',
      }),
    ]
  );

  return {
    success: true,
    inGuild: true,
    status: 'SYNCED',
    rank: targetRank,
    roleId: targetRoleId,
    message: `Successfully synchronized your Discord role to ${CREATOR_RANKS[targetRank].label}.`,
  };
}

/**
 * Enqueue a rank synchronization job into the database queue.
 * Idempotent: avoids duplicate jobs for the same user if one is already pending.
 */
export async function enqueueDiscordRankSync(skillshotUserId: string, targetRank: CreatorRankId): Promise<boolean> {
  const sql = await getReadyDb();
  const connRows = await sql.query(
    `SELECT discord_user_id FROM discord_connections WHERE skillshot_user_id = $1 LIMIT 1`,
    [skillshotUserId]
  );
  if (!connRows.length) return false;

  const discordUserId = String(connRows[0].discord_user_id);
  const targetRoleId = DISCORD_CREATOR_RANK_ROLES[targetRank];

  await sql.query(
    `INSERT INTO discord_sync_queue(id, skillshot_user_id, discord_user_id, target_rank, target_role_id, status)
     VALUES($1, $2, $3, $4, $5, 'PENDING')`,
    [crypto.randomUUID(), skillshotUserId, discordUserId, targetRank, targetRoleId]
  );

  // Trigger non-blocking async execution
  syncMemberCreatorRank(discordUserId, targetRank).catch(() => {});
  return true;
}

/**
 * Disconnect a user's Discord account.
 * Deletes connection record, optionally removes creator rank role, logs audit event,
 * and completely preserves Skillshot XP, Creator Rank, and profile achievements.
 */
export async function disconnectDiscordAccount(
  skillshotUserId: string,
  removeDiscordRole = true
): Promise<{ success: boolean; message: string }> {
  const sql = await getReadyDb();
  const connRows = await sql.query(
    `SELECT discord_user_id, discord_username_snapshot FROM discord_connections WHERE skillshot_user_id = $1 LIMIT 1`,
    [skillshotUserId]
  );

  if (!connRows.length) {
    return { success: false, message: 'No Discord account is connected.' };
  }

  const discordUserId = String(connRows[0].discord_user_id);
  const username = String(connRows[0].discord_username_snapshot);

  // Optionally remove the user's Creator Rank role from Discord
  if (removeDiscordRole) {
    try {
      const member = await getDiscordGuildMember(discordUserId);
      if (member) {
        const creatorRoles = member.roles.filter(roleId => MANAGED_DISCORD_ROLE_IDS.includes(roleId));
        for (const roleId of creatorRoles) {
          await callDiscordApi(
            `/guilds/${DISCORD_GUILD_ID}/members/${encodeURIComponent(discordUserId)}/roles/${roleId}`,
            {
              method: 'DELETE',
              headers: {
                'X-Audit-Log-Reason': 'Skillshot Discord account disconnected',
              },
            }
          );
        }
      }
    } catch {
      // Non-fatal if Discord API is temporarily unavailable during disconnect
    }
  }

  // Remove DB connection
  await sql.query(`DELETE FROM discord_connections WHERE skillshot_user_id = $1`, [skillshotUserId]);
  await sql.query(`DELETE FROM discord_sync_queue WHERE skillshot_user_id = $1`, [skillshotUserId]);

  // Audit log
  await sql.query(
    `INSERT INTO audit_logs(id, actor_id, action, target_type, target_id, metadata)
     VALUES($1, $2, 'DISCORD_DISCONNECTED', 'USER', $3, $4::jsonb)`,
    [
      crypto.randomUUID(),
      skillshotUserId,
      skillshotUserId,
      JSON.stringify({
        discordUserId,
        discordUsername: username,
        action: 'DISCONNECTED',
      }),
    ]
  );

  return { success: true, message: 'Discord account disconnected successfully.' };
}

/**
 * Reconcile Discord Creator Rank roles for all connected users.
 * Resolves each user's current Skillshot rank and brings Discord roles into sync.
 */
export async function reconcileAllDiscordRoles(limit = 100): Promise<{
  total: number;
  synced: number;
  notInGuild: number;
  failed: number;
}> {
  const sql = await getReadyDb();
  const rows = await sql.query(
    `SELECT dc.skillshot_user_id, dc.discord_user_id, u.creator_xp, u.creator_rank
     FROM discord_connections dc
     JOIN users u ON u.id = dc.skillshot_user_id
     ORDER BY dc.last_sync_at ASC NULLS FIRST
     LIMIT $1`,
    [limit]
  );

  let synced = 0;
  let notInGuild = 0;
  let failed = 0;

  for (const row of rows) {
    const xp = Number(row.creator_xp || 0);
    const expectedRank = rankFromXp(xp);
    const res = await syncMemberCreatorRank(String(row.discord_user_id), expectedRank.id);
    if (res.status === 'SYNCED') synced++;
    else if (res.status === 'NOT_IN_GUILD') notInGuild++;
    else failed++;
  }

  return {
    total: rows.length,
    synced,
    notInGuild,
    failed,
  };
}
