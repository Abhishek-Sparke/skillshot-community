import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('side icon rail component contains dual rails, rich SVG icons, and seamless repeat tracks', async () => {
  const tsx = await read('app/components/side-icon-rail.tsx');

  // Renders left and right rail sides
  assert.match(tsx, /sideIconRail--\${side}/);
  assert.match(tsx, /sideIconRail__track--\${side}/);

  // Duplicated identical segments for mathematical 0ms-jump loop
  assert.match(tsx, /className="sideIconRail__segment"/);
  assert.match(tsx, /aria-hidden="true"/);
  assert.match(tsx, /seg1-/);
  assert.match(tsx, /seg2-/);

  // Over 40 distinct icons across Photography, Creative, Tech, Video, Gaming, Community, Skillshot
  assert.match(tsx, /id:\s*'camera'/);
  assert.match(tsx, /id:\s*'aperture'/);
  assert.match(tsx, /id:\s*'shutter'/);
  assert.match(tsx, /id:\s*'lens'/);
  assert.match(tsx, /id:\s*'paintbrush'/);
  assert.match(tsx, /id:\s*'pencil'/);
  assert.match(tsx, /id:\s*'palette'/);
  assert.match(tsx, /id:\s*'layers'/);
  assert.match(tsx, /id:\s*'crop'/);
  assert.match(tsx, /id:\s*'film'/);
  assert.match(tsx, /id:\s*'controller'/);
  assert.match(tsx, /id:\s*'code'/);
  assert.match(tsx, /id:\s*'user'/);
  assert.match(tsx, /id:\s*'heart'/);
  assert.match(tsx, /id:\s*'chat'/);
  assert.match(tsx, /id:\s*'upload'/);
  assert.match(tsx, /id:\s*'verified'/);
  assert.match(tsx, /id:\s*'flash-strobe'/);
  assert.match(tsx, /id:\s*'magic-wand'/);
  assert.match(tsx, /id:\s*'browser-window'/);
  assert.match(tsx, /id:\s*'notification-bell'/);

  // No emojis used; pure SVG elements
  assert.doesNotMatch(tsx, /[\u{1F300}-\u{1F9FF}]/u);

  // Individual micro-motions present on wrapper (does not shift rail track position)
  assert.match(tsx, /sideIconWrapper \${animClass}/);
});

test('side icon rail CSS enforces infinite rolling, opposite directions, 20-35s speed, and masking', async () => {
  const css = await read('app/components/side-icon-rail.css');

  // Hidden below 1200px (Desktop only)
  assert.match(css, /\.sideIconRail\s*\{\s*display:\s*none\s*!important;\s*\}/);

  // Desktop widths between 60px and 90px
  assert.match(css, /width:\s*64px/);
  assert.match(css, /width:\s*76px/);
  assert.match(css, /width:\s*86px/);

  // Left rail: bottom -> top (scrolls upward)
  assert.match(css, /\.sideIconRail__track--left\s*\{\s*animation:\s*railScrollUp\s+28s\s+linear\s+infinite;\s*\}/);
  assert.match(css, /@keyframes\s+railScrollUp\s*\{\s*0%\s*\{\s*transform:\s*translate3d\(0,\s*0,\s*0\);?\s*\}\s*100%\s*\{\s*transform:\s*translate3d\(0,\s*-50%,\s*0\);?\s*\}\s*\}/);

  // Right rail: top -> bottom (scrolls downward)
  assert.match(css, /\.sideIconRail__track--right\s*\{\s*animation:\s*railScrollDown\s+28s\s+linear\s+infinite;\s*\}/);
  assert.match(css, /@keyframes\s+railScrollDown\s*\{\s*0%\s*\{\s*transform:\s*translate3d\(0,\s*-50%,\s*0\);?\s*\}\s*100%\s*\{\s*transform:\s*translate3d\(0,\s*0,\s*0\);?\s*\}\s*\}/);

  // Inner coral accent line on inner edges
  assert.match(css, /\.sideIconRail--left\s*\{[^}]*border-right:\s*1px\s+solid\s+rgba\(255,\s*80,\s*57/);
  assert.match(css, /\.sideIconRail--right\s*\{[^}]*border-left:\s*1px\s+solid\s+rgba\(255,\s*80,\s*57/);

  // Top & bottom edge masking to hide entering and exiting elements
  assert.match(css, /mask-image:\s*linear-gradient/);
  assert.match(css, /-webkit-mask-image:\s*linear-gradient/);
  assert.match(css, /\.sideIconRail::before/);
  assert.match(css, /\.sideIconRail::after/);

  // Reduced motion support stops continuous rolling
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[^}]*\.sideIconRail__track--left/);
});

test('homepage community cards restore green status indicator using database role', async () => {
  const homeFresh = await read('app/components/home-fresh.tsx');
  const roleBadge = await read('app/components/role-badge.tsx');
  const globals = await read('app/globals.css');

  // HomeFresh uses normalized DB role
  assert.match(homeFresh, /<CreatorUsername[^>]+staffRole={normalizeRole\(row\.role\)}/);
  assert.match(homeFresh, /className="authorName"/);

  // RoleBadge maps TRUSTED_CONTRIBUTOR with green indicator
  assert.match(roleBadge, /TRUSTED_CONTRIBUTOR:\s*'Trusted Contributor'/);
  assert.match(globals, /\.roleTRUSTED_CONTRIBUTOR\s*\{\s*color:\s*#278552;\s*background:\s*#e9f8ef;/);

  // Author name and compact badge are aligned
  assert.match(globals, /\.homeFreshMeta\s+\.authorName\s*\{[^}]*display:\s*flex;\s*align-items:\s*center;/);
  assert.match(globals, /\.homeFreshMeta\s+\.authorName\s+\.roleBadge\.compact\s*\{[^}]*width:\s*18px;\s*height:\s*18px;/);
});

test('community page renders dual rolling side rails', async () => {
  const page = await read('app/community/page.tsx');
  assert.match(page, /import SideIconRail from '\.\.\/components\/side-icon-rail'/);
  assert.match(page, /<SideIconRail side="left"\s*\/>/);
  assert.match(page, /<SideIconRail side="right"\s*\/>/);
});
