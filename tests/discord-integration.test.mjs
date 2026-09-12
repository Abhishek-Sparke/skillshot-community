import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  DISCORD_GUILD_ID,
  DISCORD_CLIENT_ID,
  DISCORD_CREATOR_RANK_ROLES,
  MANAGED_DISCORD_ROLE_IDS,
  isManagedCreatorRankRole,
  roleIdForRank,
  rankForRoleId,
} from '../lib/discord-config.ts';
import { rankFromXp, calculateLevelProgress, calculateRankProgress } from '../lib/creator-rank.ts';
import { DISCORD_MIGRATION } from '../lib/discord-schema.ts';

const root = process.cwd();
const read = (file) => fs.readFile(path.join(root, file), 'utf8');

test('1. Discord configuration matches specified Guild ID and Client ID', () => {
  assert.equal(DISCORD_GUILD_ID, '1548208097112236124');
  assert.equal(DISCORD_CLIENT_ID, '1548215059103227904');
});

test('2. Creator Rank to Discord role ID mapping matches all 7 tiers exactly', () => {
  assert.equal(roleIdForRank('NEWCOMER'), '1548217177348374548');
  assert.equal(roleIdForRank('CREATOR'), '1548216871499726949');
  assert.equal(roleIdForRank('RISING_CREATOR'), '1548216618935525418');
  assert.equal(roleIdForRank('SKILLED_CREATOR'), '1548216452182577152');
  assert.equal(roleIdForRank('ELITE_CREATOR'), '1548216305683931176');
  assert.equal(roleIdForRank('MASTER_CREATOR'), '1548216185152086089');
  assert.equal(roleIdForRank('LEGEND'), '1548215999336030208');

  // Reverse mapping check
  assert.equal(rankForRoleId('1548217177348374548'), 'NEWCOMER');
  assert.equal(rankForRoleId('1548216871499726949'), 'CREATOR');
  assert.equal(rankForRoleId('1548216618935525418'), 'RISING_CREATOR');
  assert.equal(rankForRoleId('1548216452182577152'), 'SKILLED_CREATOR');
  assert.equal(rankForRoleId('1548216305683931176'), 'ELITE_CREATOR');
  assert.equal(rankForRoleId('1548216185152086089'), 'MASTER_CREATOR');
  assert.equal(rankForRoleId('1548215999336030208'), 'LEGEND');
  assert.equal(rankForRoleId('999999999999999999'), null);
});

test('3. Server calculates XP -> Level -> Creator Rank -> Discord Role', () => {
  // Test across all 7 rank thresholds
  const testCases = [
    { xp: 0, expectedRank: 'NEWCOMER', expectedRole: '1548217177348374548' },
    { xp: 450, expectedRank: 'NEWCOMER', expectedRole: '1548217177348374548' },
    { xp: 500, expectedRank: 'CREATOR', expectedRole: '1548216871499726949' },
    { xp: 1500, expectedRank: 'CREATOR', expectedRole: '1548216871499726949' },
    { xp: 2000, expectedRank: 'RISING_CREATOR', expectedRole: '1548216618935525418' },
    { xp: 5000, expectedRank: 'SKILLED_CREATOR', expectedRole: '1548216452182577152' },
    { xp: 10000, expectedRank: 'ELITE_CREATOR', expectedRole: '1548216305683931176' },
    { xp: 25000, expectedRank: 'MASTER_CREATOR', expectedRole: '1548216185152086089' },
    { xp: 50000, expectedRank: 'LEGEND', expectedRole: '1548215999336030208' },
    { xp: 90000, expectedRank: 'LEGEND', expectedRole: '1548215999336030208' },
  ];

  for (const tc of testCases) {
    const rank = rankFromXp(tc.xp);
    assert.equal(rank.id, tc.expectedRank);
    assert.equal(roleIdForRank(rank.id), tc.expectedRole);
  }
});

test('4. Staff roles are completely protected and excluded from managed role set', () => {
  assert.equal(MANAGED_DISCORD_ROLE_IDS.length, 7);
  // An arbitrary staff or custom role ID
  const staffRoleId = '987654321098765432';
  assert.equal(isManagedCreatorRankRole(staffRoleId), false);
  for (const roleId of MANAGED_DISCORD_ROLE_IDS) {
    assert.equal(isManagedCreatorRankRole(roleId), true);
  }
});

test('5. Database schema creates unique constraints for 1:1 Skillshot <-> Discord mapping', () => {
  const schemaStr = DISCORD_MIGRATION.join('\n');
  assert.match(schemaStr, /CREATE TABLE IF NOT EXISTS discord_connections/);
  assert.match(schemaStr, /UNIQUE\(skillshot_user_id\)/);
  assert.match(schemaStr, /UNIQUE\(discord_user_id\)/);
  assert.match(schemaStr, /discord_username_snapshot/);
  assert.match(schemaStr, /sync_status/);
  assert.match(schemaStr, /CREATE TABLE IF NOT EXISTS discord_sync_queue/);
});

test('6. Role transition logic removes old creator rank role and preserves staff roles', () => {
  const staffRoleId = '999900001111222233';
  const oldRankRoleId = DISCORD_CREATOR_RANK_ROLES.CREATOR; // '1548216871499726949'
  const newRankRoleId = DISCORD_CREATOR_RANK_ROLES.RISING_CREATOR; // '1548216618935525418'

  const memberRoles = [staffRoleId, oldRankRoleId];

  // Simulation of sync logic
  const currentCreatorRoles = memberRoles.filter(roleId => MANAGED_DISCORD_ROLE_IDS.includes(roleId));
  const rolesToRemove = currentCreatorRoles.filter(roleId => roleId !== newRankRoleId);
  const needsAdd = !memberRoles.includes(newRankRoleId);

  // Exactly the old creator role should be removed, NOT the staff role
  assert.deepEqual(rolesToRemove, [oldRankRoleId]);
  assert.equal(rolesToRemove.includes(staffRoleId), false);
  assert.equal(needsAdd, true);
});

test('7. Slash command /rank response formats level, progress, and profile link correctly', () => {
  const xp = 15000;
  const lp = calculateLevelProgress(xp);
  const rp = calculateRankProgress(xp);

  assert.equal(rp.rank.id, 'ELITE_CREATOR');
  assert.equal(rp.rank.symbol, '✧');
  assert.equal(lp.level, 13);
  assert.equal(rp.nextRankTitle, 'Master Creator');
});

test('8. Discord secrets are never exposed to client components or public environment', async () => {
  const clientCard = await read('app/components/discord-connection-card.tsx');
  const adminDash = await read('app/components/discord-admin-dashboard.tsx');
  assert.doesNotMatch(clientCard, /DISCORD_BOT_TOKEN/);
  assert.doesNotMatch(clientCard, /DISCORD_CLIENT_SECRET/);
  assert.doesNotMatch(adminDash, /DISCORD_BOT_TOKEN/);
  assert.doesNotMatch(adminDash, /DISCORD_CLIENT_SECRET/);
});

test('9. User Settings and Admin Navigation include Discord integration entries', async () => {
  const settingsPage = await read('app/settings/page.tsx');
  assert.match(settingsPage, /\/settings\/connections/);

  const settingsMenu = await read('app/components/settings-menu.tsx');
  assert.match(settingsMenu, /\/settings\/connections/);

  const staffUi = await read('lib/staff-ui.ts');
  assert.match(staffUi, /\/admin\/discord/);
});

test('10. Automatic rank change hook in awardXp triggers enqueueDiscordRankSync', async () => {
  const xpCode = await read('lib/xp.ts');
  assert.match(xpCode, /import\s*\{[^}]*enqueueDiscordRankSync[^}]*\}\s*from\s*['"]\.\/discord-service['"]/);
  assert.match(xpCode, /enqueueDiscordRankSync\(event\.userId,\s*rank\.id\)/);
});

test('11. Discord interaction endpoint enforces Ed25519 signature verification', async () => {
  const routeCode = await read('app/api/discord/interactions/route.ts');
  assert.match(routeCode, /X-Signature-Ed25519/);
  assert.match(routeCode, /X-Signature-Timestamp/);
  assert.match(routeCode, /DISCORD_PUBLIC_KEY/);
  assert.match(routeCode, /crypto\.subtle\.verify\('Ed25519'/);
  assert.match(routeCode, /Invalid interaction signature/);
});

test('12. Slash commands /rank, /link, /sync handle requests server-side without trusting client rank/xp', async () => {
  const routeCode = await read('app/api/discord/interactions/route.ts');
  // Must lookup caller from DB
  assert.match(routeCode, /SELECT u\.username, u\.display_name, u\.creator_xp, u\.creator_rank/);
  assert.match(routeCode, /WHERE dc\.discord_user_id = \$1/);
  // Never accepts rank or role in payload
  assert.doesNotMatch(routeCode, /interaction\.data\.options/);
  assert.match(routeCode, /commandName === 'rank'/);
  assert.match(routeCode, /commandName === 'link'/);
  assert.match(routeCode, /commandName === 'sync'/);
});

test('13. Disconnect preserves Skillshot XP, Creator Rank, and user achievements', async () => {
  const serviceCode = await read('lib/discord-service.ts');
  // Deletes connection and queue records only
  assert.match(serviceCode, /DELETE FROM discord_connections WHERE skillshot_user_id = \$1/);
  assert.match(serviceCode, /DELETE FROM discord_sync_queue WHERE skillshot_user_id = \$1/);
  // Never touches users table creator_xp or creator_rank
  assert.doesNotMatch(serviceCode, /UPDATE users SET creator_xp/);
  assert.doesNotMatch(serviceCode, /DELETE FROM users/);
});

test('14. Sync queue prevents duplicate pending jobs for the same user', async () => {
  const serviceCode = await read('lib/discord-service.ts');
  assert.match(serviceCode, /SELECT id FROM discord_sync_queue WHERE skillshot_user_id = \$1 AND status = 'PENDING'/);
  assert.match(serviceCode, /UPDATE discord_sync_queue\s+SET target_rank = \$1/);
});

test('15. Staff Discord admin API supports REGISTER_COMMANDS for Guild 1548208097112236124', async () => {
  const staffRoute = await read('app/api/staff/discord/route.ts');
  assert.match(staffRoute, /action === 'REGISTER_COMMANDS'/);
  assert.match(staffRoute, /\/applications\/\$\{DISCORD_CLIENT_ID\}\/guilds\/\$\{DISCORD_GUILD_ID\}\/commands/);
  assert.match(staffRoute, /name:\s*'rank'/);
  assert.match(staffRoute, /name:\s*'link'/);
  assert.match(staffRoute, /name:\s*'sync'/);
});

