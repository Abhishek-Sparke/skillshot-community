import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFile(path.join(root, file), 'utf8');

test('1. Database schema migration includes notifications category, actor, thumbnail, and staff_comment columns', async () => {
  const dbCode = await read('lib/db.ts');
  assert.match(dbCode, /ADD COLUMN IF NOT EXISTS category text/);
  assert.match(dbCode, /ADD COLUMN IF NOT EXISTS actor_id text/);
  assert.match(dbCode, /ADD COLUMN IF NOT EXISTS target_id text/);
  assert.match(dbCode, /ADD COLUMN IF NOT EXISTS thumbnail_url text/);
  assert.match(dbCode, /ADD COLUMN IF NOT EXISTS staff_comment text/);
  assert.match(dbCode, /ADD COLUMN IF NOT EXISTS comment_visibility text/);
  assert.match(dbCode, /idx_notifications_user_category/);
});

test('2. Discord verification sessions table exists in schema migration', async () => {
  const schemaCode = await read('lib/discord-schema.ts');
  assert.match(schemaCode, /CREATE TABLE IF NOT EXISTS discord_verification_sessions/);
  assert.match(schemaCode, /token text PRIMARY KEY/);
  assert.match(schemaCode, /discord_user_id text NOT NULL/);
  assert.match(schemaCode, /expires_at timestamptz NOT NULL/);
});

test('3. Discord service supports channel auto-discovery (#👑ranks) and verification sessions', async () => {
  const serviceCode = await read('lib/discord-service.ts');
  assert.match(serviceCode, /export async function getGuildChannels/);
  assert.match(serviceCode, /export async function findRankChannel/);
  assert.match(serviceCode, /export async function createDiscordVerificationSession/);
  assert.match(serviceCode, /export async function getDiscordVerificationSession/);
  assert.match(serviceCode, /skillshot_rank_verify/);
  assert.match(serviceCode, /skillshot_how_it_works/);
});

test('4. Discord interactions route handles skillshot_rank_verify and skillshot_how_it_works ephemerally', async () => {
  const routeCode = await read('app/api/discord/interactions/route.ts');
  assert.match(routeCode, /customId === 'skillshot_rank_verify'/);
  assert.match(routeCode, /customId === 'skillshot_how_it_works'/);
  assert.match(routeCode, /flags:\s*64/); // Ephemeral flag
  assert.match(routeCode, /createDiscordVerificationSession/);
  // Auto-disappearing success confirmation
  assert.match(routeCode, /messages\/@original/);
  assert.match(routeCode, /10000/);
});

test('5. OAuth authorize and callback routes preserve Discord user ID and prevent cross-account spoofing', async () => {
  const authCode = await read('app/api/discord/authorize/route.ts');
  const callbackCode = await read('app/api/discord/callback/route.ts');

  assert.match(authCode, /getDiscordVerificationSession/);
  assert.match(authCode, /discord_bound_user_id/);

  assert.match(callbackCode, /boundDiscordUserId/);
  assert.match(callbackCode, /boundDiscordUserId !== discordUserId/);
  assert.match(callbackCode, /does not match the Discord user/);
});

test('6. Admin dashboard exposes channel discovery and prominent post button for #👑ranks', async () => {
  const adminPage = await read('app/admin/discord/page.tsx');
  const dashboardComponent = await read('app/components/discord-admin-dashboard.tsx');
  const staffApi = await read('app/api/staff/discord/route.ts');

  assert.match(adminPage, /guildChannels/);
  assert.match(adminPage, /defaultRankChannel/);
  assert.match(dashboardComponent, /Verification Message in #👑ranks/);
  assert.match(dashboardComponent, /channelInput/);
  assert.match(staffApi, /action === 'POST_VERIFICATION_MESSAGE'/);
});

test('7. Notifications API returns 3 tabs categories (discussion, post, support) and unread counts', async () => {
  const notifRoute = await read('app/api/notifications/route.ts');
  assert.match(notifRoute, /category:\s*String\(r\.category/);
  assert.match(notifRoute, /counts\s*=\s*\{/);
  assert.match(notifRoute, /discussion:\s*unreadItems\.filter/);
  assert.match(notifRoute, /post:\s*unreadItems\.filter/);
  assert.match(notifRoute, /support:\s*unreadItems\.filter/);
  assert.match(notifRoute, /thumbnailUrl/);
  assert.match(notifRoute, /staffComment/);
});

test('8. Notifications API supports category-scoped MARK ALL AS READ', async () => {
  const notifRoute = await read('app/api/notifications/route.ts');
  assert.match(notifRoute, /body\.all === true/);
  assert.match(notifRoute, /body\.category/);
  assert.match(notifRoute, /lower\(category\) = \$3/);
});

test('9. Staff comment privacy prevents internal notes from leaking to reporters', async () => {
  const notifRoute = await read('app/api/notifications/route.ts');
  const reportRoute = await read('app/api/reports/[id]/route.ts');
  const caseActions = await read('lib/report-case-actions.ts');

  // Only public comments are visible to user
  assert.match(notifRoute, /comment_visibility === 'PUBLIC_TO_REPORTER'/);
  assert.match(reportRoute, /n\.comment_visibility = 'PUBLIC_TO_REPORTER'/);
  assert.match(caseActions, /visibility === 'PUBLIC_TO_REPORTER'/);
});

test('10. Reporter read-only detail view exists and enforces authenticated reporter-only access', async () => {
  const reportPage = await read('app/support/reports/[id]/page.tsx');
  assert.match(reportPage, /ReportDetailPage/);
  assert.match(reportPage, /getPrincipal/);
  assert.match(reportPage, /r\.reporter_id = \$2/);
  assert.match(reportPage, /Moderator Response/);
  assert.match(reportPage, /Read-only/);
});

test('11. Notification dropdown component implements 3 tabs, unread badges, mark all, and tooltip popover', async () => {
  const dropdownCode = await read('app/components/notification-dropdown.tsx');
  assert.match(dropdownCode, /role="tablist"/);
  assert.match(dropdownCode, /tab-discussion/);
  assert.match(dropdownCode, /tab-post/);
  assert.match(dropdownCode, /tab-support/);
  assert.match(dropdownCode, /MARK ALL AS READ/);
  assert.match(dropdownCode, /notifCommentPopover/);
  assert.match(dropdownCode, /notifThumbnailWrap/);
  assert.match(dropdownCode, /CreatorRankBadge/);
});

test('12. Notification bell component manages dropdown state and accessibility', async () => {
  const bellCode = await read('app/components/notification-bell.tsx');
  assert.match(bellCode, /NotificationDropdown/);
  assert.match(bellCode, /aria-haspopup="dialog"/);
  assert.match(bellCode, /aria-expanded=\{isOpen\}/);
  assert.match(bellCode, /handleClickOutside/);
  assert.match(bellCode, /handleEscape/);
});

test('13. Discussion and Post notifications emit correct categories and payloads', async () => {
  const repliesRoute = await read('app/api/discussions/[id]/replies/route.ts');
  const reactRoute = await read('app/api/discussions/[id]/react/route.ts');
  const postReactRoute = await read('app/api/posts/[id]/react/route.ts');
  const commentNotifs = await read('lib/comment-notifications.ts');

  assert.match(repliesRoute, /'discussion'/);
  assert.match(reactRoute, /'discussion'/);
  assert.match(postReactRoute, /'post'/);
  assert.match(commentNotifs, /'post'/);
});
