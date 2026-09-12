import { NextResponse } from 'next/server';
import {
  sendWelcomeMessageForMember,
  sendTestWelcomeMessage,
  syncNewMemberWelcomes,
  getWelcomeSettings,
  findWelcomeChannel,
  getWelcomedMemberCount,
  resetWelcomedMembers,
  getGuildMembersStatus,
} from '../../../../lib/discord-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/discord/welcome
 * Runs reconciliation or returns current welcome system configuration & status.
 * Query params:
 *   ?action=sync     - Scans guild joins and welcomes un-welcomed members.
 *   ?action=test     - Sends a sample preview welcome message.
 *   ?action=reset    - Clears the welcome registry so test members can be re-welcomed.
 *   ?action=members  - Lists all server members with join dates and welcomed status.
 *   ?action=welcome&userId=... - Force welcomes a specific user ID directly.
 *   ?limit=100       - Member scan limit for sync.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action')?.toLowerCase();
  const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get('limit')) || 100));
  const channelId = url.searchParams.get('channelId')?.trim();
  const userId = url.searchParams.get('userId')?.trim();

  if (action === 'test') {
    const testRes = await sendTestWelcomeMessage(channelId || undefined);
    return NextResponse.json(testRes, { status: testRes.success ? 200 : 400 });
  }

  if (action === 'reset') {
    const resetRes = await resetWelcomedMembers();
    return NextResponse.json({
      success: true,
      message: `Cleared ${resetRes.deleted} record(s) from the welcome registry. All members can now receive welcome messages on join/sync.`,
      ...resetRes,
    });
  }

  if (action === 'members') {
    const members = await getGuildMembersStatus();
    return NextResponse.json({
      success: true,
      total: members.length,
      members,
    });
  }

  if (action === 'welcome' && userId) {
    const welcomeRes = await syncNewMemberWelcomes({
      forceWelcomeMemberId: userId,
      channelIdOverride: channelId || undefined,
    });
    return NextResponse.json(welcomeRes, { status: welcomeRes.success ? 200 : 400 });
  }

  if (action === 'sync') {
    const bypass = url.searchParams.get('force') === 'true';
    const syncRes = await syncNewMemberWelcomes({
      limit,
      channelIdOverride: channelId || undefined,
      bypassDuplicateCheck: bypass,
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
    endpoints: {
      sync: '/api/discord/welcome?action=sync',
      syncForce: '/api/discord/welcome?action=sync&force=true',
      members: '/api/discord/welcome?action=members',
      reset: '/api/discord/welcome?action=reset',
      welcomeUser: '/api/discord/welcome?action=welcome&userId={ID}',
      test: '/api/discord/welcome?action=test',
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

  if (body.action === 'reset' || body.action === 'RESET_REGISTRY') {
    const result = await resetWelcomedMembers();
    return NextResponse.json({
      success: true,
      message: `Reset welcome registry: ${result.deleted} records cleared.`,
      ...result,
    });
  }

  if (body.action === 'welcome_user' || body.action === 'WELCOME_USER') {
    const targetUserId = body.userId || body.discordUserId;
    if (!targetUserId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    const result = await syncNewMemberWelcomes({
      forceWelcomeMemberId: String(targetUserId),
      channelIdOverride: body.channelId,
    });
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  }

  if (body.action === 'sync' || body.action === 'SYNC_WELCOME_MEMBERS') {
    const result = await syncNewMemberWelcomes({
      limit: Number(body.limit) || 100,
      channelIdOverride: body.channelId,
      bypassDuplicateCheck: Boolean(body.force || body.bypassDuplicateCheck),
    });
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  }

  // 2. Extract member details from various payload formats
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
    body.channelId,
    Boolean(body.bypassDuplicateCheck)
  );

  return NextResponse.json(result, { status: result.success || result.skipped ? 200 : 400 });
}
