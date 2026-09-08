import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getStaffEffectClass } from '../lib/roles.ts';
import { creatorRankId, CREATOR_RANKS } from '../lib/creator-rank.ts';

const root = process.cwd();
const read = (file) => fs.readFile(path.join(root, file), 'utf8');

test('1. Creator Rank and Staff Role are completely separate systems', async () => {
  const usernameComp = await read('app/components/creator-username.tsx');
  const rankBadgeComp = await read('app/components/creator-rank-badge.tsx');
  const roleBadgeComp = await read('app/components/role-badge.tsx');
  const staffRoleBadgeComp = await read('app/components/staff-role-badge.tsx');

  // Verify separate badge components are used
  assert.match(usernameComp, /<CreatorRankBadge/);
  assert.match(usernameComp, /<RoleBadge/);
  assert.match(roleBadgeComp, /export \{ RoleBadge as StaffRoleBadge \}/);
  assert.match(staffRoleBadgeComp, /export default function StaffRoleBadge/);

  // Normal users do NOT show a staff role icon
  assert.match(usernameComp, /effectiveStaffRole && effectiveStaffRole !== 'USER'/);
  assert.match(roleBadgeComp, /if \(!role \|\| role === 'USER'\) return null;/);
});

test('2. Staff visual effect is determined strictly by staffRole and never creatorRank', () => {
  // Combinations specified in prompt Section 20 & 21:
  // 1. Newcomer + User
  assert.equal(getStaffEffectClass('USER'), '');
  assert.equal(getStaffEffectClass(null), '');
  assert.equal(getStaffEffectClass(undefined), '');

  // 2. Newcomer + Admin
  assert.equal(getStaffEffectClass('ADMIN'), 'staff-effect-admin');

  // 3. Creator + User
  assert.equal(getStaffEffectClass('USER'), '');

  // 4. Creator + Moderator
  assert.equal(getStaffEffectClass('MODERATOR'), 'staff-effect-moderator');

  // 5. Elite + User (High rank, normal user -> NO staff effect)
  assert.equal(getStaffEffectClass('USER'), '');

  // 6. Elite + Admin (High rank, admin -> Admin staff effect)
  assert.equal(getStaffEffectClass('ADMIN'), 'staff-effect-admin');

  // 7. Legend + User (Max rank, normal user -> NO staff effect)
  assert.equal(getStaffEffectClass('USER'), '');

  // 8. Legend + Owner (Max rank, owner -> Owner staff effect)
  assert.equal(getStaffEffectClass('OWNER'), 'staff-effect-owner');

  // Trusted Contributor and Head Moderator
  assert.equal(getStaffEffectClass('HEAD_MODERATOR'), 'staff-effect-head_moderator');
  assert.equal(getStaffEffectClass('TRUSTED_CONTRIBUTOR'), 'staff-effect-trusted_contributor');
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
  const profileComp = await read('app/components/creator-profile.tsx');

  // Profile layout shows nameElement and handle, with rankBadge and roleBadge
  assert.match(usernameComp, /layout === 'profile'/);
  assert.match(usernameComp, /<span className="creatorProfileHandle">@\{username\}<\/span>/);
  assert.match(usernameComp, /showLabel=\{false\}/);

  // Does not render inline text like "Newcomer — Creator Rank"
  assert.doesNotMatch(usernameComp, /rankLabelText/);
});

test('5. Homepage top spacing provides comfortable breathing room', async () => {
  const css = await read('app/globals.css');

  // Desktop: 48-64px padding-top
  assert.match(css, /\.hero\s*\{[^}]*padding:\s*clamp\(48px,\s*5\.5vw,\s*64px\)/);

  // Mobile: 24-32px padding-top
  assert.match(css, /@media\s*\(max-width:\s*768px\)\s*\{\s*\n?\s*\.hero\s*\{\s*\n?\s*padding-top:\s*clamp\(24px,\s*4vw,\s*32px\);/);
});

test('6. Profile PFP and Banner edit controls are directly accessible', async () => {
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
