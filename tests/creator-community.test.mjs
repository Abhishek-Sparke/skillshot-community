import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  rankFromXp,
  calculateRankProgress,
  calculateXpFromActivity,
} from '../lib/creator-rank.ts';
import { BANNER_MAX_BYTES, AVATAR_TYPES, BANNER_TYPES } from '../lib/upload-policy.ts';
import { COMMUNITY_MIGRATION } from '../lib/community-schema.ts';
import { COLLECTION_MIGRATION } from '../lib/collection-schema.ts';

const root = process.cwd();
const read = (file) => fs.readFile(path.join(root, file), 'utf8');

test('creator ranks match specifications across all 7 tiers', () => {
  assert.equal(rankFromXp(0).id, 'NEWCOMER');
  assert.equal(rankFromXp(99).id, 'NEWCOMER');
  assert.equal(rankFromXp(100).id, 'CREATOR');
  assert.equal(rankFromXp(299).id, 'CREATOR');
  assert.equal(rankFromXp(300).id, 'RISING_CREATOR');
  assert.equal(rankFromXp(699).id, 'RISING_CREATOR');
  assert.equal(rankFromXp(700).id, 'SKILLED_CREATOR');
  assert.equal(rankFromXp(1499).id, 'SKILLED_CREATOR');
  assert.equal(rankFromXp(1500).id, 'ELITE_CREATOR');
  assert.equal(rankFromXp(2999).id, 'ELITE_CREATOR');
  assert.equal(rankFromXp(3000).id, 'MASTER_CREATOR');
  assert.equal(rankFromXp(5999).id, 'MASTER_CREATOR');
  assert.equal(rankFromXp(6000).id, 'LEGEND');
  assert.equal(rankFromXp(100000).id, 'LEGEND');

  // Legend has no next rank and 100% progress
  const legendProgress = calculateRankProgress(7500);
  assert.equal(legendProgress.rank.id, 'LEGEND');
  assert.equal(legendProgress.progressPercent, 100);
  assert.equal(legendProgress.nextRankTitle, null);

  // Newcomer progress
  const newcomerProgress = calculateRankProgress(50);
  assert.equal(newcomerProgress.rank.id, 'NEWCOMER');
  assert.equal(newcomerProgress.progressPercent, 50);
  assert.equal(newcomerProgress.nextRankTitle, 'Creator');
});

test('server-side XP calculation balances activity and deters spam', () => {
  const xp = calculateXpFromActivity({
    visiblePostCount: 10,
    reactionCount: 50,
    commentCount: 20,
    saveCount: 15,
    followerCount: 10,
  });
  // 10*35 + 50*3 + 20*2 + 15*4 + 10*5 = 350 + 150 + 40 + 60 + 50 = 650
  assert.equal(xp, 650);

  // Penalizes severe moderation violations
  const xpWithViolations = calculateXpFromActivity({
    visiblePostCount: 10,
    reactionCount: 50,
    commentCount: 20,
    saveCount: 15,
    followerCount: 10,
    moderationViolations: 2,
  });
  assert.equal(xpWithViolations, 250);
});

test('upload policy enforces limits and formats for avatars and banners', () => {
  assert.equal(BANNER_MAX_BYTES, 5 * 1024 * 1024);
  assert.ok(AVATAR_TYPES.has('image/gif'));
  assert.ok(AVATAR_TYPES.has('image/png'));
  assert.ok(AVATAR_TYPES.has('image/jpeg'));
  assert.ok(AVATAR_TYPES.has('image/webp'));
  assert.ok(BANNER_TYPES.has('image/gif'));
  assert.ok(BANNER_TYPES.has('image/png'));
  assert.ok(BANNER_TYPES.has('image/jpeg'));
  assert.ok(BANNER_TYPES.has('image/webp'));
});

test('community and collection database migrations define required tables', () => {
  const communitySql = COMMUNITY_MIGRATION.join('\n');
  assert.match(communitySql, /CREATE TABLE IF NOT EXISTS discussions/);
  assert.match(communitySql, /CREATE TABLE IF NOT EXISTS discussion_replies/);
  assert.match(communitySql, /CREATE TABLE IF NOT EXISTS discussion_reactions/);
  assert.match(communitySql, /CREATE TABLE IF NOT EXISTS saved_discussions/);

  const collectionSql = COLLECTION_MIGRATION.join('\n');
  assert.match(collectionSql, /CREATE TABLE IF NOT EXISTS collections/);
  assert.match(collectionSql, /CREATE TABLE IF NOT EXISTS collection_posts/);
});

test('mobile preview UI supports popstate back button and scroll restoration', async () => {
  const viewer = await read('app/components/image-viewer.tsx');
  assert.match(viewer, /window\.addEventListener\('popstate'/);
  assert.match(viewer, /window\.history\.pushState/);
  assert.match(viewer, /document\.body\.style\.position\s*=\s*'fixed'/);
  assert.match(viewer, /window\.scrollTo\(0,\s*scrollY\)/);
});

test('mobile pull-to-refresh component exists and is mounted in root layout', async () => {
  const layout = await read('app/layout.tsx');
  assert.match(layout, /<PullToRefresh\s*\/>/);
  const ptr = await read('app/components/pull-to-refresh.tsx');
  assert.match(ptr, /mobileTopRefreshWrap/);
  assert.match(ptr, /touchstart/);
  assert.match(ptr, /touchmove/);
});

test('mobile profile layout and 2-column portfolio gallery styles are in globals.css', async () => {
  const css = await read('app/globals.css');
  assert.match(css, /\.rank-legend\s*\{/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /@media\s*\(max-width:\s*768px\)[\s\S]*\.portfolioGalleryGrid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /@media\s*\(max-width:\s*768px\)[\s\S]*\.profileBannerContainer\s*\{[^}]*height:\s*115px/);
});

test('community page features pinned carousel, discussions grid, and staff pin control', async () => {
  const commView = await read('app/components/community-page-view.tsx');
  assert.match(commView, /pinnedCarousel/);
  assert.match(commView, /discussionsGrid/);
  assert.match(commView, /handleTogglePin/);
  assert.match(commView, /handleToggleReaction/);
  assert.match(commView, /discussionModalOverlay/);
});

test('favicon and touch icon assets exist and are properly configured in app metadata', async () => {
  // Verify files exist in public/ and app/
  await fs.access(path.join(root, 'public/favicon.ico'));
  await fs.access(path.join(root, 'public/favicon.svg'));
  await fs.access(path.join(root, 'public/favicon-32x32.png'));
  await fs.access(path.join(root, 'public/favicon-16x16.png'));
  await fs.access(path.join(root, 'public/apple-touch-icon.png'));
  await fs.access(path.join(root, 'app/favicon.ico'));
  await fs.access(path.join(root, 'app/icon.png'));
  await fs.access(path.join(root, 'app/apple-icon.png'));

  // SVG contains the official Skillshot "S" mark
  const svg = await read('public/favicon.svg');
  assert.match(svg, /<rect[^>]+fill="url\(#skillshotGrad\)"/);
  assert.match(svg, />S<\/text>/);

  // Layout metadata configures the tab title and icons
  const layout = await read('app/layout.tsx');
  assert.match(layout, /title:\s*'Skillshot — Show your skills\.'/);
  assert.match(layout, /icons:\s*\{/);
  assert.match(layout, /url:\s*'\/favicon\.ico'/);
  assert.match(layout, /url:\s*'\/favicon\.svg'/);
  assert.match(layout, /url:\s*'\/apple-touch-icon\.png'/);
});

test('redesigned homepage increases visual density and implements all required sections', async () => {
  const page = await read('app/page.tsx');
  // 1. Hero
  assert.match(page, /Show your skills\.<br\s*\/>In one shot\./);
  assert.match(page, /Share a Skillshot/);
  assert.match(page, /Explore Community/);

  // 2. Fresh from the community with See all link
  assert.match(page, /FRESH FROM THE COMMUNITY/);
  assert.match(page, /See all →/);

  // 3. Featured creator
  assert.match(page, /FEATURED CREATOR/);
  assert.match(page, /homeFeaturedCreatorSection/);

  // 4. Skillshot of the Week
  assert.match(page, /SKILLSHOT OF THE WEEK/);
  assert.match(page, /homeStandoutSection/);

  // 5. Explore by skill
  assert.match(page, /EXPLORE BY SKILL/);
  assert.match(page, /Photography/);
  assert.match(page, /Design/);
  assert.match(page, /Coding/);
  assert.match(page, /Art/);
  assert.match(page, /Animation/);
  assert.match(page, /Gaming/);
  assert.match(page, /Writing/);

  // 6. Community CTA
  assert.match(page, /Share what you(?:'|&apos;)re proud of\./);
  assert.match(page, /Create a Skillshot/);
});

