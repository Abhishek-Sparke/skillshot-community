import { NextResponse } from 'next/server';
import {
  sendWelcomeMessageForMember,
  sendTestWelcomeMessage,
  syncNewMemberWelcomes,
  getWelcomeSettings,
  findWelcomeChannel,
  getWelcomedMemberCount,
} from '../../../../lib/discord-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/discord/welcome
 * Runs reconciliation or returns current welcome system configuration & status.
 * Query params:
 *   ?action=sync - Scans recent guild joins and welcomes un-welcomed members.
 *   ?action=test - Sends a sample preview welcome message.
 *   ?limit=25    - Member scan limit for sync.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action')?.toLowerCase();
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 25));
  const channelId = url.searchParams.get('channelId')?.trim();

  if (action === 'test') {
    const testRes = await sendTestWelcomeMessage(channelId || undefined);
    return NextResponse.json(testRes, { status: testRes.success ? 200 : 400 });
  }

  if (action === 'sync') {
    const syncRes = await syncNewMemberWelcomes({
      limit,
      channelIdOverride: channelId || undefined,
    });
    return NextResponse.json(syncRes, { status: syncRes.success ? 200 : 400 });
  }

  // Default: return status and welcome settings
  const [settings, detectedChannel, welcomedCount] = await Promise.all([
    getWelcomeSettings(),
    findWelcomeChannel(),
    getWelcomedMemberCount(),
  ]);

  return NextResponse.json({
    status: 'ONLINE',
    settings,
    detectedWelcomeChannel: detectedChannel,
    totalWelcomedRecorded: welcomedCount,
    instructions: {
      syncRecentMembers: '/api/discord/welcome?action=sync',
      sendTestMessage: '/api/discord/welcome?action=test',
      memberAddWebhook: 'POST /api/discord/welcome with GUILD_MEMBER_ADD payload',
    },
  });
}

/**
 * POST /api/discord/welcome
 * Handles Discord member join webhook events (GUILD_MEMBER_ADD) or direct member welcome dispatch.
 */
export async function POST(request: Request) {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // 1. Support admin/test triggers via POST
  if (body.action === 'test' || body.action === 'SEND_TEST_WELCOME') {
    const result = await sendTestWelcomeMessage(body.channelId);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  }

  if (body.action === 'sync' || body.action === 'SYNC_WELCOME_MEMBERS') {
    const result = await syncNewMemberWelcomes({
      limit: Number(body.limit) || 25,
      channelIdOverride: body.channelId,
    });
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  }

  // 2. Extract member details from various payload formats
  // Discord standard event payload: { t: 'GUILD_MEMBER_ADD', d: { user: { id, username, bot } } }
  // Alternative: { event: 'GUILD_MEMBER_ADD', member: { id, username, isBot } }
  // Direct: { user: { id, username, bot } } or { discordUserId: '...' }
  let memberId = '';
  let username = '';
  let isBot = false;

  const discordData = body.d || body.data || body.member || body;
  const userObj = discordData.user || discordData;

  if (userObj.id) {
    memberId = String(userObj.id);
    username = String(userObj.username || '');
    isBot = Boolean(userObj.bot ?? userObj.isBot);
  } else if (body.discordUserId) {
    memberId = String(body.discordUserId);
    username = String(body.username || '');
    isBot = Boolean(body.isBot);
  }

  if (!memberId) {
    return NextResponse.json(
      { error: 'Missing member user ID in request payload' },
      { status: 400 }
    );
  }

  const result = await sendWelcomeMessageForMember(
    { id: memberId, username, isBot },
    body.channelId
  );

  return NextResponse.json(result, { status: result.success || result.skipped ? 200 : 400 });
}
