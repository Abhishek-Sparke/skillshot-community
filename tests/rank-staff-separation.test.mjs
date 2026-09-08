import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getUsernameEffect } from '../lib/username-effect.ts';

const root = process.cwd();
const read = (file) => fs.readFile(path.join(root, file), 'utf8');

test('1. Creator Rank and Staff Role are completely separate systems', async () => {
  const usernameComp = await read('app/components/creator-username.tsx');
  const roleBadgeComp = await read('app/components/role-badge.tsx');
  const staffRoleBadgeComp = await read('app/components/staff-role-badge.tsx');

  // Verify separate badge components are used
  assert.match(usernameComp, /<CreatorRankBadge/);
  assert.match(usernameComp, /<RoleBadge/);
  assert.match(roleBadgeComp, /export \{ RoleBadge as StaffRoleBadge \}/);
  assert.match(staffRoleBadgeComp, /export default function StaffRoleBadge/);

  // Normal users do NOT show a staff role icon
  assert.match(usernameComp, /showRoleBadge && effectiveStaffRole/);
  assert.match(roleBadgeComp, /if \(!role \|\| role === 'USER'\) return null;/);
});

test('2. centralized resolver gives staff effects absolute visual priority', () => {
  const combinations = [
    ['NEWCOMER', 'USER', 'creator-rank-newcomer'],
    ['CREATOR', 'USER', 'creator-rank-creator'],
    ['RISING_CREATOR', 'USER', 'creator-rank-rising'],
    ['SKILLED_CREATOR', 'USER', 'creator-rank-skilled'],
    ['ELITE_CREATOR', 'USER', 'creator-rank-elite'],
    ['MASTER_CREATOR', 'USER', 'creator-rank-master'],
    ['LEGEND', 'USER', 'creator-rank-legend'],
    ['NEWCOMER', 'MODERATOR', 'staff-effect-moderator'],
    ['SKILLED_CREATOR', 'MODERATOR', 'staff-effect-moderator'],
    ['ELITE_CREATOR', 'MODERATOR', 'staff-effect-moderator'],
    ['LEGEND', 'MODERATOR', 'staff-effect-moderator'],
    ['SKILLED_CREATOR', 'HEAD_MODERATOR', 'staff-effect-head_moderator'],
    ['LEGEND', 'HEAD_MODERATOR', 'staff-effect-head_moderator'],
    ['SKILLED_CREATOR', 'ADMIN', 'staff-effect-admin'],
    ['LEGEND', 'ADMIN', 'staff-effect-admin'],
  ];

  for (const [creatorRank, staffRole, expected] of combinations) {
    const result = getUsernameEffect({ creatorRank, staffRole });
    assert.equal(result.className, expected, `${creatorRank} + ${staffRole}`);
    assert.equal(result.source, staffRole === 'USER' ? 'creator-rank' : 'staff');
    assert.equal(result.creatorRank, creatorRank);
  }

  const skilledModerator = getUsernameEffect({ creatorRank: 'SKILLED_CREATOR', staffRole: 'MODERATOR' });
  assert.equal(skilledModerator.className, 'staff-effect-moderator');
  assert.doesNotMatch(skilledModerator.className, /creator-rank-skilled/);
});

test('3. Badges use compact icon geometry and floating tooltips without layout shift', async () => {
  const css = await read('app/globals.css');
  const iconBadge = await read('app/components/icon-badge.tsx');
  const roleTooltip = await read('app/components/role-tooltip.tsx');

  // Same compact badge geometry (18px compact on cards, 20px profile)
  assert.match(css, /\.iconBadge-compact\{width:18px;height:18px/);
  assert.match(css, /\.iconBadge-profile\{width:20px;height:20px/);

  // Tooltip is floating, high z-index, absolutely positioned
  assert.match(css, /\.iconBadgeTooltip,\s*\n?\.roleTooltipPopover/);
  assert.match(css, /z-index:\s*120;/);
  assert.match(css, /position:\s*absolute;/);
  assert.match(css, /bottom:\s*calc\(100% \+ 8px\);/);

  // Username tooltips open away from the avatar/name instead of covering them.
  assert.match(css, /\.creatorUsernameWrapper \.iconBadgeTooltip\{[^}]*left:calc\(100% \+ 7px\);[^}]*top:auto;[^}]*bottom:calc\(100% \+ 7px\);/);
  assert.match(css, /\.creatorUsernameWrapper \.iconBadge:hover \.iconBadgeTooltip,[\s\S]*?translate:0 0;/);

  // Multi-line structure
  assert.match(css, /\.roleTooltipTitle/);
  assert.match(css, /\.roleTooltipSubtitle/);
  assert.match(css, /\.roleTooltipLevel/);

  // Mobile tap and outside-click support
  assert.match(iconBadge, /pointerdown/);
  assert.match(iconBadge, /roleTooltipVisible/);
  assert.match(roleTooltip, /pointerdown/);
});

test('4. Profile identity row displays compact icons without inline label text', async () => {
  const usernameComp = await read('app/components/creator-username.tsx');
  // Profile layout shows nameElement and handle, with rankBadge and roleBadge
  assert.match(usernameComp, /layout === 'profile'/);
  assert.match(usernameComp, /showRankBadge \?\? layout === 'profile'/);
  assert.match(usernameComp, /<span className="creatorProfileHandle">@\{username\}<\/span>/);
  assert.match(usernameComp, /showLabel=\{false\}/);

  // Does not render inline text like "Newcomer — Creator Rank"
  assert.doesNotMatch(usernameComp, /rankLabelText/);
});

test('5. public identity shows only staff icons while profile identity also shows rank', async () => {
  const usernameComp = await read('app/components/creator-username.tsx');
  assert.match(usernameComp, /const shouldShowRankBadge = showRankBadge \?\? layout === 'profile'/);
  assert.match(usernameComp, /const rankBadge = shouldShowRankBadge/);
  assert.match(usernameComp, /showRoleBadge && effectiveStaffRole/);
  assert.doesNotMatch(usernameComp, /showRankBadge = true/);
});

test('6. Homepage top spacing provides comfortable breathing room', async () => {
  const css = await read('app/globals.css');

  // Desktop: 48-64px padding-top
  assert.match(css, /\.hero\s*\{[^}]*padding-top:\s*clamp\(48px,\s*5\.5vw,\s*64px\)/);
  assert.doesNotMatch(css, /\.hero\s*\{[^}]*padding:\s*clamp\(48px,\s*5\.5vw,\s*64px\)\s+0/);

  // Mobile: 24-32px padding-top
  assert.match(css, /@media\s*\(max-width:\s*768px\)\s*\{\s*\n?\s*\.hero\s*\{\s*\n?\s*padding-top:\s*clamp\(24px,\s*4vw,\s*32px\);/);
});

test('7. Profile PFP and Banner edit controls are directly accessible', async () => {
  const profileEditPage = await read('app/profile/edit/page.tsx');
  const profileEditor = await read('app/components/profile-editor.tsx');
  const creatorProfile = await read('app/components/creator-profile.tsx');

  // /profile/edit supports tab query param
  assert.match(profileEditPage, /tab === 'appearance'\s*\?\s*'appearance'\s*:\s*'info'/);

  // Profile page avatar has edit button overlay linking to appearance tab
  assert.match(creatorProfile, /profileAvatarEditBtn/);
  assert.match(creatorProfile, /href="\/profile\/edit\?tab=appearance"/);

  // Profile editor provides quick shortcut to edit PFP & banner
  assert.match(profileEditor, /editorMediaShortcutCard/);
  assert.match(profileEditor, /Edit PFP & Banner →/);

  // Appearance tab has change banner and change pfp controls
  assert.match(profileEditor, /Change Banner/);
  assert.match(profileEditor, /Change PFP/);
});
