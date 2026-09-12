import { getReadyDb } from './db';
import {
  DISCORD_API_BASE,
  DISCORD_GUILD_ID,
  DISCORD_RANK_CHANNEL_ID,
  DISCORD_WELCOME_CHANNEL_ID,
  DISCORD_EMBED_COLOR,
  VERIFY_BUTTON_CUSTOM_ID,
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

  // Check if a PENDING job already exists for this user to prevent duplicate jobs
  const pendingJobs = await sql.query(
    `SELECT id FROM discord_sync_queue WHERE skillshot_user_id = $1 AND status = 'PENDING' LIMIT 1`,
    [skillshotUserId]
  );

  let queueId: string;
  if (pendingJobs.length) {
    queueId = String(pendingJobs[0].id);
    await sql.query(
      `UPDATE discord_sync_queue
       SET target_rank = $1, target_role_id = $2, updated_at = now()
       WHERE id = $3`,
      [targetRank, targetRoleId, queueId]
    );
  } else {
    queueId = crypto.randomUUID();
    await sql.query(
      `INSERT INTO discord_sync_queue(id, skillshot_user_id, discord_user_id, target_rank, target_role_id, status)
       VALUES($1, $2, $3, $4, $5, 'PENDING')`,
      [queueId, skillshotUserId, discordUserId, targetRank, targetRoleId]
    );
  }

  // Trigger non-blocking async execution and update queue status on completion
  syncMemberCreatorRank(discordUserId, targetRank)
    .then(async (res) => {
      await sql.query(
        `UPDATE discord_sync_queue
         SET status = $1, attempts = attempts + 1, last_attempt_at = now(), error_message = $2, updated_at = now()
         WHERE id = $3`,
        [res.success ? 'COMPLETED' : 'FAILED', res.error || null, queueId]
      );
    })
    .catch(async (err) => {
      await sql.query(
        `UPDATE discord_sync_queue
         SET status = 'FAILED', attempts = attempts + 1, last_attempt_at = now(), error_message = $1, updated_at = now()
         WHERE id = $2`,
        [err?.message || 'Sync error', queueId]
      );
    });

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

/**
 * Retrieve text channels from Guild 1548208097112236124.
 */
export async function getGuildChannels(): Promise<Array<{ id: string; name: string; type: number }>> {
  const res = await callDiscordApi(`/guilds/${DISCORD_GUILD_ID}/channels`);
  if (!res.ok || !Array.isArray(res.data)) return [];
  return res.data
    .filter((c: any) => c.type === 0 || c.type === 5)
    .map((c: any) => ({ id: String(c.id), name: String(c.name), type: Number(c.type) }));
}

/**
 * Automatically locate the #👑ranks / #ranks channel in the guild.
 */
export async function findRankChannel(): Promise<{ id: string; name: string } | null> {
  if (DISCORD_RANK_CHANNEL_ID) {
    return { id: DISCORD_RANK_CHANNEL_ID, name: 'ranks' };
  }
  const channels = await getGuildChannels();
  const exact = channels.find(c => {
    const clean = c.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return clean === 'ranks' || clean === 'rank';
  });
  if (exact) return exact;
  const contains = channels.find(c => c.name.toLowerCase().includes('rank'));
  if (contains) return contains;
  return null;
}

/**
 * Automatically locate the welcome channel (#👋welcome, #🖐️welcome, #welcome) in the guild.
 */
export async function findWelcomeChannel(): Promise<{ id: string; name: string } | null> {
  if (DISCORD_WELCOME_CHANNEL_ID) {
    return { id: DISCORD_WELCOME_CHANNEL_ID, name: 'welcome' };
  }
  const channels = await getGuildChannels();
  const exact = channels.find(c => {
    const clean = c.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return clean === 'welcome';
  });
  if (exact) return exact;
  const contains = channels.find(c => c.name.toLowerCase().includes('welcome'));
  if (contains) return contains;
  return null;
}

/**
 * Create a secure server-side verification session bound to the clicking Discord user ID.
 */
export async function createDiscordVerificationSession(discordUserId: string, interactionToken?: string): Promise<string> {
  const sql = await getReadyDb();
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  await sql.query(
    `INSERT INTO discord_verification_sessions (token, discord_user_id, interaction_token, created_at, expires_at)
     VALUES ($1, $2, $3, now(), $4)`,
    [token, discordUserId, interactionToken || null, expiresAt]
  );
  return token;
}

/**
 * Validate and retrieve a Discord verification session by token.
 */
export async function getDiscordVerificationSession(token: string): Promise<{ discordUserId: string; interactionToken?: string } | null> {
  if (!token) return null;
  const sql = await getReadyDb();
  const rows = await sql.query(
    `SELECT discord_user_id, interaction_token FROM discord_verification_sessions
     WHERE token = $1 AND expires_at > now() LIMIT 1`,
    [token]
  );
  if (!rows.length) return null;
  return {
    discordUserId: String(rows[0].discord_user_id),
    interactionToken: rows[0].interaction_token ? String(rows[0].interaction_token) : undefined,
  };
}

/**
 * Post or update the official Skillshot Rank Verification embed in Discord #👑ranks.
 * Uses Discord primary button with custom_id 'skillshot_rank_verify'.
 */
export async function postOrUpdateRankVerificationMessage(channelIdInput?: string): Promise<{
  success: boolean;
  message: string;
  messageId?: string;
  channelId?: string;
  channelName?: string;
}> {
  let channelId = channelIdInput?.trim();
  let channelName = '';

  if (!channelId) {
    const found = await findRankChannel();
    if (found) {
      channelId = found.id;
      channelName = found.name;
    }
  }

  if (!channelId) {
    return {
      success: false,
      message: 'No Discord rank channel found or configured. Please select or provide the channel ID for #👑ranks.',
    };
  }

  const sql = await getReadyDb();
  const existingRows = await sql.query(
    `SELECT message_id FROM discord_verification_messages WHERE channel_id = $1 LIMIT 1`,
    [channelId]
  );
  const existingMessageId = existingRows[0]?.message_id ? String(existingRows[0].message_id) : null;

  const payload = {
    embeds: [
      {
        author: {
          name: '🏆 Skillshot • Official Rank Bot',
          icon_url: 'https://skillshot-community.vercel.app/icon.png',
        },
        title: '🏆 Skillshot Rank Verification',
        description:
          'Connect your Skillshot account to Discord to verify your Creator Rank and automatically receive your matching Discord role.\n\n' +
          '**Complete these steps:**\n\n' +
          '**1.** Click **"Verify Skillshot"** below\n' +
          '**2.** Sign in or create your Skillshot account\n' +
          '**3.** Verify your Discord account\n' +
          '**4.** Your Creator Rank is detected automatically\n' +
          '**5.** Your matching Discord role is assigned\n\n' +
          '✦ *Your rank always comes from your Skillshot account.*\n' +
          '✦ *Users cannot manually select a rank.*',
        color: DISCORD_EMBED_COLOR,
        image: {
          url: 'https://skillshot-community.vercel.app/icon.png',
        },
        thumbnail: {
          url: 'https://skillshot-community.vercel.app/icon.png',
        },
        footer: {
          text: 'Skillshot Community • Single Source of Truth for Creator Rank',
        },
      },
    ],
    components: [
      {
        type: 1, // Action Row
        components: [
          {
            type: 2, // Button
            style: 5, // Link button (instant, client-side, zero timeouts)
            label: '🔗 Verify Skillshot',
            url: 'https://skillshot-community.vercel.app/api/discord/authorize',
          },
          {
            type: 2, // Button
            style: 5, // Link button
            label: 'ℹ️ How It Works',
            url: 'https://skillshot-community.vercel.app/guidelines',
          },
        ],
      },
    ],
  };
  // Reference custom IDs: VERIFY_BUTTON_CUSTOM_ID, 'skillshot_how_it_works'

  let messageId: string | null = null;
  let updatedExisting = false;

  if (existingMessageId) {
    const patchRes = await callDiscordApi(`/channels/${channelId}/messages/${existingMessageId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });

    if (patchRes.ok && patchRes.data?.id) {
      messageId = String(patchRes.data.id);
      updatedExisting = true;
    }
  }

  if (!messageId) {
    const postRes = await callDiscordApi(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!postRes.ok) {
      const errMsg = postRes.data?.message || `Failed to post message (Discord HTTP ${postRes.status})`;
      await sql.query(
        `INSERT INTO discord_verification_messages (id, channel_id, message_id, last_posted_at, status, last_error)
         VALUES ($1, $2, null, now(), 'FAILED', $3)
         ON CONFLICT (channel_id) DO UPDATE
         SET status = 'FAILED', last_error = $3, last_posted_at = now()`,
        [crypto.randomUUID(), channelId, errMsg]
      );
      return {
        success: false,
        message: `Failed to post verification message to Discord channel ${channelId}: ${errMsg}`,
        channelId,
      };
    }

    messageId = String(postRes.data?.id);
  }

  await sql.query(
    `INSERT INTO discord_verification_messages (id, channel_id, message_id, last_posted_at, status, last_error)
     VALUES ($1, $2, $3, now(), 'ACTIVE', null)
     ON CONFLICT (channel_id) DO UPDATE
     SET message_id = $3, last_posted_at = now(), status = 'ACTIVE', last_error = null`,
    [crypto.randomUUID(), channelId, messageId]
  );

  return {
    success: true,
    message: updatedExisting
      ? `Updated existing rank verification message in #${channelId}.`
      : `Posted new rank verification message to #${channelId}!`,
    messageId,
    channelId,
  };
}

export type BotPermissionCheck = {
  viewChannel: boolean;
  sendMessages: boolean;
  embedLinks: boolean;
  manageRoles: boolean;
  allSatisfied: boolean;
  rawPermissions?: string;
  error?: string;
};

/**
 * Inspect bot permissions in the guild / rank channel.
 * Checks for View Channel, Send Messages, Embed Links, and Manage Roles.
 * Does NOT require Administrator permission.
 */
export async function getDiscordBotPermissions(): Promise<BotPermissionCheck> {
  // 1. Fetch bot's user info
  const userRes = await callDiscordApi('/users/@me');
  if (!userRes.ok) {
    return {
      viewChannel: false,
      sendMessages: false,
      embedLinks: false,
      manageRoles: false,
      allSatisfied: false,
      error: userRes.data?.message || 'Failed to authenticate bot token',
    };
  }

  const botUserId = userRes.data.id;

  // 2. Fetch bot's guild member details
  const memberRes = await callDiscordApi(`/guilds/${DISCORD_GUILD_ID}/members/${botUserId}`);
  if (!memberRes.ok) {
    return {
      viewChannel: false,
      sendMessages: false,
      embedLinks: false,
      manageRoles: false,
      allSatisfied: false,
      error: memberRes.data?.message || 'Bot is not a member of the configured guild',
    };
  }

  const memberRoles: string[] = memberRes.data.roles || [];

  // 3. Fetch guild roles to resolve bitfields
  const rolesRes = await callDiscordApi(`/guilds/${DISCORD_GUILD_ID}/roles`);
  if (!rolesRes.ok) {
    return {
      viewChannel: false,
      sendMessages: false,
      embedLinks: false,
      manageRoles: false,
      allSatisfied: false,
      error: rolesRes.data?.message || 'Failed to fetch guild roles',
    };
  }

  const guildRoles: Array<{ id: string; permissions: string }> = rolesRes.data || [];
  let cumulative = BigInt(0);

  // Include @everyone role (role ID === DISCORD_GUILD_ID)
  const everyoneRole = guildRoles.find(r => r.id === DISCORD_GUILD_ID);
  if (everyoneRole) {
    cumulative |= BigInt(everyoneRole.permissions || '0');
  }

  for (const roleId of memberRoles) {
    const role = guildRoles.find(r => r.id === roleId);
    if (role) {
      cumulative |= BigInt(role.permissions || '0');
    }
  }

  // Administrator bit: 8 (0x8)
  const isAdministrator = (cumulative & BigInt(8)) !== BigInt(0);

  // Specific bits:
  // VIEW_CHANNEL: 1024 (0x400)
  // SEND_MESSAGES: 2048 (0x800)
  // EMBED_LINKS: 16384 (0x4000)
  // MANAGE_ROLES: 268435456 (0x10000000)
  const viewChannel = isAdministrator || (cumulative & BigInt(1024)) !== BigInt(0);
  const sendMessages = isAdministrator || (cumulative & BigInt(2048)) !== BigInt(0);
  const embedLinks = isAdministrator || (cumulative & BigInt(16384)) !== BigInt(0);
  const manageRoles = isAdministrator || (cumulative & BigInt(268435456)) !== BigInt(0);

  return {
    viewChannel,
    sendMessages,
    embedLinks,
    manageRoles,
    allSatisfied: viewChannel && sendMessages && embedLinks && manageRoles,
    rawPermissions: cumulative.toString(),
  };
}

/**
 * Retrieve current rank channel message status from the database.
 */
export async function getRankChannelStatus(): Promise<{
  configuredChannelId: string;
  messageId: string | null;
  lastPostedAt: string | null;
  status: string;
  lastError: string | null;
}> {
  const sql = await getReadyDb();
  const rows = await sql.query(
    `SELECT channel_id, message_id, last_posted_at, status, last_error
     FROM discord_verification_messages
     ORDER BY last_posted_at DESC NULLS LAST
     LIMIT 1`
  );

  if (rows.length) {
    return {
      configuredChannelId: DISCORD_RANK_CHANNEL_ID || rows[0].channel_id,
      messageId: rows[0].message_id,
      lastPostedAt: rows[0].last_posted_at,
      status: rows[0].status,
      lastError: rows[0].last_error,
    };
  }

  return {
    configuredChannelId: DISCORD_RANK_CHANNEL_ID,
    messageId: null,
    lastPostedAt: null,
    status: 'NOT_POSTED',
    lastError: null,
  };
}

export type DiscordWelcomeSettings = {
  channelId: string | null;
  enabled: boolean;
};

/**
 * Retrieve current welcome settings from the database.
 */
export async function getWelcomeSettings(): Promise<DiscordWelcomeSettings> {
  const sql = await getReadyDb();
  const rows = await sql.query(
    `SELECT channel_id, enabled FROM discord_welcome_settings WHERE id = 'default' LIMIT 1`
  );
  if (rows.length) {
    return {
      channelId: rows[0].channel_id || DISCORD_WELCOME_CHANNEL_ID || null,
      enabled: Boolean(rows[0].enabled),
    };
  }
  return {
    channelId: DISCORD_WELCOME_CHANNEL_ID || null,
    enabled: true,
  };
}

/**
 * Update welcome settings (channel ID and enabled flag).
 */
export async function updateWelcomeSettings(channelId: string | null, enabled: boolean): Promise<DiscordWelcomeSettings> {
  const sql = await getReadyDb();
  await sql.query(
    `INSERT INTO discord_welcome_settings (id, channel_id, enabled, updated_at)
     VALUES ('default', $1, $2, now())
     ON CONFLICT (id) DO UPDATE
     SET channel_id = $1, enabled = $2, updated_at = now()`,
    [channelId, enabled]
  );
  return {
    channelId,
    enabled,
  };
}

/**
 * Check if a Discord member has already been welcomed.
 */
export async function isMemberWelcomed(discordUserId: string): Promise<boolean> {
  if (!discordUserId) return false;
  const sql = await getReadyDb();
  const rows = await sql.query(
    `SELECT id FROM discord_welcomed_members WHERE discord_user_id = $1 LIMIT 1`,
    [discordUserId]
  );
  return rows.length > 0;
}

/**
 * Record a welcomed member in the database to prevent duplicate welcomes.
 */
export async function markMemberWelcomed(discordUserId: string, channelId: string): Promise<void> {
  const sql = await getReadyDb();
  await sql.query(
    `INSERT INTO discord_welcomed_members (id, discord_user_id, channel_id, welcomed_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (discord_user_id) DO NOTHING`,
    [crypto.randomUUID(), discordUserId, channelId]
  );
}

/**
 * Get total count of welcomed members recorded.
 */
export async function getWelcomedMemberCount(): Promise<number> {
  const sql = await getReadyDb();
  const rows = await sql.query(`SELECT count(*)::int as count FROM discord_welcomed_members`);
  return Number(rows[0]?.count || 0);
}

/**
 * Construct the official Skillshot welcome message payload.
 */
export function buildWelcomePayload(memberId: string, isPreview = false) {
  const mentionText = isPreview
    ? `👋 Welcome to Skillshot, @NewMember! *(Preview / Test Sample)*`
    : `👋 Welcome to Skillshot, <@${memberId}>!`;

  return {
    content: mentionText,
    embeds: [
      {
        author: {
          name: '🏆 Skillshot Community',
          icon_url: 'https://skillshot-community.vercel.app/icon.png',
        },
        title: '👋 Welcome to the Skillshot Community!',
        description:
          'Welcome to the Skillshot community.\n\n' +
          'Share your work, discover creators, connect with other creators, and grow your skills.\n\n' +
          '**START HERE:**\n\n' +
          '📜 **Read the rules**\n' +
          '🏆 **Verify your Skillshot Rank**\n' +
          '🎨 **Share your work**\n' +
          '💬 **Meet the community**\n\n' +
          'Enjoy your stay! 🚀',
        color: DISCORD_EMBED_COLOR,
        thumbnail: {
          url: 'https://skillshot-community.vercel.app/icon.png',
        },
        footer: {
          text: isPreview
            ? 'Skillshot Community • Sample Preview'
            : 'Skillshot Community • Welcome to the Community',
        },
      },
    ],
    components: [
      {
        type: 1, // Action Row
        components: [
          {
            type: 2, // Button
            style: 5, // Link button (no interaction timeouts)
            label: '🏆 Verify Rank',
            url: 'https://skillshot-community.vercel.app/api/discord/authorize',
          },
          {
            type: 2, // Button
            style: 5, // Link button
            label: '📜 Read Rules',
            url: 'https://skillshot-community.vercel.app/guidelines',
          },
          {
            type: 2, // Button
            style: 5, // Link button
            label: '🌐 Open Skillshot',
            url: 'https://skillshot-community.vercel.app',
          },
        ],
      },
    ],
  };
}

/**
 * Dispatch a welcome message for a newly joined member.
 * Enforces strict duplicate prevention and skips bots.
 */
export async function sendWelcomeMessageForMember(
  member: { id: string; username?: string; isBot?: boolean },
  channelIdOverride?: string
): Promise<{
  success: boolean;
  skipped?: boolean;
  reason?: string;
  messageId?: string;
  channelId?: string;
}> {
  if (!member || !member.id) {
    return { success: false, skipped: true, reason: 'INVALID_MEMBER' };
  }

  // Strict check 1: Never welcome bots
  if (member.isBot) {
    return { success: false, skipped: true, reason: 'IS_BOT' };
  }

  // Strict check 2: Never duplicate welcome messages
  if (await isMemberWelcomed(member.id)) {
    return { success: false, skipped: true, reason: 'ALREADY_WELCOMED' };
  }

  // Strict check 3: Check if welcome system is enabled
  const settings = await getWelcomeSettings();
  if (!settings.enabled) {
    return { success: false, skipped: true, reason: 'WELCOME_DISABLED' };
  }

  // Resolve channel
  let channelId = channelIdOverride || settings.channelId;
  if (!channelId) {
    const detected = await findWelcomeChannel();
    channelId = detected?.id || null;
  }

  if (!channelId) {
    return { success: false, reason: 'NO_WELCOME_CHANNEL' };
  }

  const payload = buildWelcomePayload(member.id, false);
  const postRes = await callDiscordApi(`/channels/${channelId}/messages`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!postRes.ok) {
    return {
      success: false,
      reason: postRes.data?.message || `Failed to post message (Discord HTTP ${postRes.status})`,
      channelId,
    };
  }

  // Persist record to prevent any future duplicate welcome
  await markMemberWelcomed(member.id, channelId);

  return {
    success: true,
    messageId: postRes.data?.id ? String(postRes.data.id) : undefined,
    channelId,
  };
}

/**
 * Send a sample welcome preview message to the configured or specified channel.
 */
export async function sendTestWelcomeMessage(channelIdInput?: string): Promise<{
  success: boolean;
  message: string;
  channelId?: string;
  messageId?: string;
}> {
  let channelId = channelIdInput?.trim();
  if (!channelId) {
    const settings = await getWelcomeSettings();
    channelId = settings.channelId || (await findWelcomeChannel())?.id || '';
  }

  if (!channelId) {
    return {
      success: false,
      message: 'No welcome channel found or configured. Please select or provide a channel ID.',
    };
  }

  const payload = buildWelcomePayload('preview', true);
  const postRes = await callDiscordApi(`/channels/${channelId}/messages`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!postRes.ok) {
    return {
      success: false,
      message: `Failed to send sample welcome message: ${postRes.data?.message || `HTTP ${postRes.status}`}`,
      channelId,
    };
  }

  return {
    success: true,
    message: `Sample welcome message successfully sent to channel #${channelId}!`,
    channelId,
    messageId: postRes.data?.id ? String(postRes.data.id) : undefined,
  };
}

/**
 * Seeds all current guild members into the database as already-welcomed.
 * This guarantees existing members who joined before this feature are never spammed.
 */
export async function seedExistingMembersAsWelcomed(): Promise<{ count: number }> {
  const res = await callDiscordApi(`/guilds/${DISCORD_GUILD_ID}/members?limit=1000`);
  if (!res.ok || !Array.isArray(res.data)) {
    return { count: 0 };
  }

  let seeded = 0;
  for (const m of res.data) {
    if (m?.user?.id) {
      await markMemberWelcomed(m.user.id, 'SEED');
      seeded++;
    }
  }

  return { count: seeded };
}

/**
 * Scans recent guild members, welcomes un-welcomed members, and ignores bots or already-welcomed members.
 * If the database has 0 welcomed members recorded, automatically seeds existing members first to avoid spam.
 */
export async function syncNewMemberWelcomes(options?: {
  limit?: number;
  channelIdOverride?: string;
  seedIfEmpty?: boolean;
}): Promise<{
  success: boolean;
  welcomed: number;
  skipped: number;
  total: number;
  message: string;
}> {
  const limit = Math.min(100, Math.max(1, options?.limit || 25));
  const seedIfEmpty = options?.seedIfEmpty !== false;

  const currentCount = await getWelcomedMemberCount();
  if (currentCount === 0 && seedIfEmpty) {
    const seedResult = await seedExistingMembersAsWelcomed();
    return {
      success: true,
      welcomed: 0,
      skipped: seedResult.count,
      total: seedResult.count,
      message: `Initialized welcome registry by recording ${seedResult.count} existing server member(s). Future new joins will be welcomed.`,
    };
  }

  const res = await callDiscordApi(`/guilds/${DISCORD_GUILD_ID}/members?limit=${limit}`);
  if (!res.ok || !Array.isArray(res.data)) {
    return {
      success: false,
      welcomed: 0,
      skipped: 0,
      total: 0,
      message: res.data?.message || 'Failed to fetch guild members from Discord API',
    };
  }

  let welcomed = 0;
  let skipped = 0;

  for (const m of res.data) {
    const user = m.user;
    if (!user || user.bot) {
      skipped++;
      continue;
    }

    const isWelcomed = await isMemberWelcomed(user.id);
    if (isWelcomed) {
      skipped++;
      continue;
    }

    const sendRes = await sendWelcomeMessageForMember(
      { id: user.id, username: user.username, isBot: user.bot },
      options?.channelIdOverride
    );

    if (sendRes.success) {
      welcomed++;
    } else {
      skipped++;
    }
  }

  return {
    success: true,
    welcomed,
    skipped,
    total: res.data.length,
    message: `Scanned ${res.data.length} recent member(s): ${welcomed} welcomed, ${skipped} skipped.`,
  };
}


