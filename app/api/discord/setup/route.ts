import { NextResponse } from 'next/server';
import {
  callDiscordApi,
  getGuildChannels,
  findRankChannel,
  postOrUpdateRankVerificationMessage,
  getDiscordBotPermissions,
} from '../../../../lib/discord-service';
import { DISCORD_CLIENT_ID, DISCORD_GUILD_ID } from '../../../../lib/discord-config';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const targetChannelId = url.searchParams.get('channelId')?.trim();

  // 1. Check Bot identity
  const botRes = await callDiscordApi('/users/@me');
  const bot = botRes.ok && botRes.data ? { id: String(botRes.data.id), username: String(botRes.data.username) } : null;

  // 2. Fetch Guild Channels
  const channels = await getGuildChannels();

  // 3. Find Rank Channel
  const rankChannel = targetChannelId
    ? channels.find(c => c.id === targetChannelId) || { id: targetChannelId, name: 'custom' }
    : await findRankChannel();

  // 4. Post or Update Verification Message
  let postResult: any = null;
  if (rankChannel?.id) {
    postResult = await postOrUpdateRankVerificationMessage(rankChannel.id);
  } else {
    postResult = {
      success: false,
      message: `Could not identify rank channel among ${channels.length} guild channels.`,
    };
  }

  // 5. Register Guild Slash Commands (/rank, /verify, /link, /sync)
  const commands = [
    { name: 'rank', description: 'Display your current Skillshot Creator Rank, level, and XP progress', type: 1 },
    { name: 'verify', description: 'Verify your Skillshot account and receive your Creator Rank role', type: 1 },
    { name: 'link', description: 'Get the official link to connect your Discord account to Skillshot', type: 1 },
    { name: 'sync', description: 'Synchronize your Discord Creator Rank role with your Skillshot account', type: 1 },
  ];
  const cmdRes = await callDiscordApi(`/applications/${DISCORD_CLIENT_ID}/guilds/${DISCORD_GUILD_ID}/commands`, {
    method: 'PUT',
    body: JSON.stringify(commands),
  });

  // 6. Bot Permissions Check
  const permissions = await getDiscordBotPermissions();

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    bot: bot || { error: botRes.data?.message || 'Failed to authenticate with Discord API' },
    guildId: DISCORD_GUILD_ID,
    clientId: DISCORD_CLIENT_ID,
    channelsFound: channels,
    targetChannel: rankChannel,
    postResult,
    permissions,
  });
}
