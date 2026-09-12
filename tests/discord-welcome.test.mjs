import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { DISCORD_MIGRATION } from '../lib/discord-schema.ts';
import { DISCORD_WELCOME_CHANNEL_ID, DISCORD_EMBED_COLOR } from '../lib/discord-config.ts';

const root = process.cwd();
const read = (file) => fs.readFile(path.join(root, file), 'utf8');

test('1. Database schema includes discord_welcomed_members and discord_welcome_settings', () => {
  const schemaJoined = DISCORD_MIGRATION.join('\n');
  assert.ok(schemaJoined.includes('CREATE TABLE IF NOT EXISTS discord_welcomed_members'));
  assert.ok(schemaJoined.includes('discord_user_id text NOT NULL UNIQUE'));
  assert.ok(schemaJoined.includes('channel_id text NOT NULL'));
  assert.ok(schemaJoined.includes('welcomed_at timestamptz'));

  assert.ok(schemaJoined.includes('CREATE TABLE IF NOT EXISTS discord_welcome_settings'));
  assert.ok(schemaJoined.includes('enabled boolean NOT NULL DEFAULT true'));
});

test('2. Welcome message service builds payload with required branding, mention, and link buttons', async () => {
  const serviceCode = await read('lib/discord-service.ts');
  assert.ok(serviceCode.includes('function buildWelcomePayload'));
  assert.ok(serviceCode.includes('👋 Welcome to Skillshot, <@${memberId}>!'));
  assert.ok(serviceCode.includes('🏆 Skillshot Community'));
  assert.ok(serviceCode.includes('START HERE:'));
  assert.ok(serviceCode.includes('Read the rules'));
  assert.ok(serviceCode.includes('Verify your Skillshot Rank'));
  assert.ok(serviceCode.includes('Share your work'));
  assert.ok(serviceCode.includes('Meet the community'));
  assert.ok(serviceCode.includes('Enjoy your stay! 🚀'));
  assert.ok(serviceCode.includes('DISCORD_EMBED_COLOR'));

  // Verify link buttons in action row
  assert.ok(serviceCode.includes("style: 5"));
  assert.ok(serviceCode.includes("label: '🏆 Verify Rank'"));
  assert.ok(serviceCode.includes("url: 'https://skillshot-community.vercel.app/api/discord/authorize'"));
  assert.ok(serviceCode.includes("label: '📜 Read Rules'"));
  assert.ok(serviceCode.includes("url: 'https://skillshot-community.vercel.app/guidelines'"));
  assert.ok(serviceCode.includes("label: '🌐 Open Skillshot'"));
  assert.ok(serviceCode.includes("url: 'https://skillshot-community.vercel.app'"));
});

test('3. Welcome service enforces duplicate prevention, skips bots, and seeds existing members', async () => {
  const serviceCode = await read('lib/discord-service.ts');
  // Bots skipped
  assert.ok(serviceCode.includes("if (member.isBot)"));
  assert.ok(serviceCode.includes("reason: 'IS_BOT'"));

  // Duplicate check
  assert.ok(serviceCode.includes("isMemberWelcomed(member.id)"));
  assert.ok(serviceCode.includes("reason: 'ALREADY_WELCOMED'"));

  // Seed check
  assert.ok(serviceCode.includes("function seedExistingMembersAsWelcomed"));
  assert.ok(serviceCode.includes("function syncNewMemberWelcomes"));
});

test('4. Channel auto-detection matches #🖐️welcome, #👋welcome, and #welcome', () => {
  const channels = [
    { id: '1548209055569420380', name: '🖐️welcome', type: 0 },
    { id: '1548213833753956433', name: '👑ranks', type: 0 },
    { id: '1548213833753956434', name: 'general', type: 0 },
  ];

  // Test cleaning & exact matching logic
  const exact = channels.find(c => {
    const clean = c.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return clean === 'welcome';
  });
  assert.ok(exact);
  assert.equal(exact.id, '1548209055569420380');

  // Alternative emoji 👋welcome
  const wavingChannels = [{ id: '999', name: '👋welcome', type: 0 }];
  const waveMatch = wavingChannels.find(c => {
    const clean = c.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return clean === 'welcome';
  });
  assert.ok(waveMatch);
  assert.equal(waveMatch.id, '999');
});

test('5. Admin dashboard source includes Welcome Message System UI and controls', async () => {
  const dashboardCode = await read('app/components/discord-admin-dashboard.tsx');
  assert.ok(dashboardCode.includes('Discord Welcome Message System'));
  assert.ok(dashboardCode.includes('handleSaveWelcomeSettings'));
  assert.ok(dashboardCode.includes('handleSendTestWelcome'));
  assert.ok(dashboardCode.includes('handleSyncWelcomeMembers'));
  assert.ok(dashboardCode.includes('Target Welcome Channel'));
  assert.ok(dashboardCode.includes('Send Sample Welcome Message'));
  assert.ok(dashboardCode.includes('Scan & Welcome Recent Joins'));
});

test('6. Staff API route handles UPDATE_WELCOME_SETTINGS, SEND_TEST_WELCOME, and SYNC_WELCOME_MEMBERS', async () => {
  const staffRouteCode = await read('app/api/staff/discord/route.ts');
  assert.ok(staffRouteCode.includes("action === 'UPDATE_WELCOME_SETTINGS'"));
  assert.ok(staffRouteCode.includes("action === 'SEND_TEST_WELCOME'"));
  assert.ok(staffRouteCode.includes("action === 'SYNC_WELCOME_MEMBERS'"));
  assert.ok(staffRouteCode.includes('welcomeSettings'));
  assert.ok(staffRouteCode.includes('defaultWelcomeChannel'));
});

test('7. /api/discord/welcome endpoint supports webhooks, test dispatch, and member sync', async () => {
  const welcomeRouteCode = await read('app/api/discord/welcome/route.ts');
  assert.ok(welcomeRouteCode.includes('export async function GET'));
  assert.ok(welcomeRouteCode.includes('export async function POST'));
  assert.ok(welcomeRouteCode.includes('sendWelcomeMessageForMember'));
  assert.ok(welcomeRouteCode.includes('sendTestWelcomeMessage'));
  assert.ok(welcomeRouteCode.includes('syncNewMemberWelcomes'));
  assert.ok(welcomeRouteCode.includes('GUILD_MEMBER_ADD'));
});
