import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  rankFromXp,
  calculateLevelProgress,
  calculateRankProgress,
  calculateXpFromActivity,
  CREATOR_RANKS,
  creatorRankId,
} from '../lib/creator-rank.ts';
import { BANNER_MAX_BYTES, AVATAR_TYPES, BANNER_TYPES } from '../lib/upload-policy.ts';
import { COMMUNITY_MIGRATION } from '../lib/community-schema.ts';
import { COLLECTION_MIGRATION } from '../lib/collection-schema.ts';

const root = process.cwd();
const read = (file) => fs.readFile(path.join(root, file), 'utf8');

test('creator ranks match specifications across all 7 tiers', () => {
  assert.equal(rankFromXp(0).id, 'NEWCOMER');
  assert.equal(rankFromXp(499).id, 'NEWCOMER');
  assert.equal(rankFromXp(500).id, 'CREATOR');
  assert.equal(rankFromXp(1999).id, 'CREATOR');
  assert.equal(rankFromXp(2000).id, 'RISING_CREATOR');
  assert.equal(rankFromXp(4999).id, 'RISING_CREATOR');
  assert.equal(rankFromXp(5000).id, 'SKILLED_CREATOR');
  assert.equal(rankFromXp(9999).id, 'SKILLED_CREATOR');
  assert.equal(rankFromXp(10000).id, 'ELITE_CREATOR');
  assert.equal(rankFromXp(24999).id, 'ELITE_CREATOR');
  assert.equal(rankFromXp(25000).id, 'MASTER_CREATOR');
  assert.equal(rankFromXp(49999).id, 'MASTER_CREATOR');
  assert.equal(rankFromXp(50000).id, 'LEGEND');
  assert.equal(rankFromXp(100000).id, 'LEGEND');

  // Legend has no next rank and 100% progress
  const legendProgress = calculateRankProgress(75000);
  assert.equal(legendProgress.rank.id, 'LEGEND');
  assert.equal(legendProgress.progressPercent, 100);
  assert.equal(legendProgress.nextRankTitle, null);

  // Newcomer progress
  const newcomerProgress = calculateRankProgress(50);
  assert.equal(newcomerProgress.rank.id, 'NEWCOMER');
  assert.equal(newcomerProgress.progressPercent, 10);
  assert.equal(newcomerProgress.nextRankTitle, 'Creator');
});

test('creator level progress is derived from server XP and resets at each level', () => {
  assert.deepEqual(calculateLevelProgress(0), { level: 1, xp: 0, currentLevelXp: 0, nextLevelXp: 100, xpIntoLevel: 0, xpForLevel: 100, progressPercent: 0 });
  assert.equal(calculateLevelProgress(99).level, 1);
  assert.equal(calculateLevelProgress(100).level, 2);
  assert.equal(calculateLevelProgress(100).progressPercent, 0);
  assert.equal(calculateLevelProgress(399).progressPercent, 99);
  assert.equal(calculateLevelProgress(-500).xp, 0);
});

test('public identity surfaces delegate rank and staff indicators to one shared username component',async()=>{
  const shared=await read('app/components/creator-username.tsx');
  assert.equal((shared.match(/<CreatorRankBadge/g)||[]).length,1);
  assert.equal((shared.match(/<RoleBadge/g)||[]).length,1);
  for(const file of ['app/page.tsx','app/components/home-fresh.tsx','app/components/community-feed.tsx','app/components/comment-conversation.tsx','app/components/shot-detail.tsx','app/components/advanced-search.tsx','app/components/creator-profile.tsx','app/components/related-skillshots.tsx','app/chats/chat-client.tsx']){
    const source=await read(file);assert.match(source,/CreatorUsername/,file);assert.doesNotMatch(source,/<CreatorRankBadge|<RoleBadge/,file);
  }
});

test('all creator ranks use a static shared production effect class', async () => {
  assert.equal(creatorRankId('elite'), 'ELITE_CREATOR');
  assert.equal(creatorRankId('Rising Creator'), 'RISING_CREATOR');
  assert.equal(creatorRankId('master-creator'), 'MASTER_CREATOR');
  assert.deepEqual(Object.values(CREATOR_RANKS).map(rank => rank.animationClass), [
    'creator-rank-newcomer', 'creator-rank-creator', 'creator-rank-rising',
    'creator-rank-skilled', 'creator-rank-elite', 'creator-rank-master', 'creator-rank-legend',
  ]);
  for (const rank of Object.values(CREATOR_RANKS)) assert.equal(rank.badgeClass, rank.animationClass);
  const username = await read('app/components/creator-username.tsx');
  const badge = await read('app/components/creator-rank-badge.tsx');
  const css = await read('app/globals.css');
  assert.match(username, /nameEffectClass = rankInfo\.animationClass/);
  assert.match(badge, /info\.badgeClass/);
  assert.doesNotMatch(username, /managementClass \|\| rankInfo\.animationClass/);
  for (const rank of Object.values(CREATOR_RANKS)) assert.match(css, new RegExp(`\\.${rank.animationClass}\\b`));
  assert.match(css, /@keyframes creatorRankTextFlow/);
  assert.match(css, /@keyframes creatorRankLegend/);
  assert.match(css, /prefers-reduced-motion:reduce/);
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

test('discussion page uses a featured announcement, reusable cards, and staff controls', async () => {
  const commView = await read('app/components/community-page-view.tsx');
  assert.match(commView, /function AnnouncementCard/);
  assert.match(commView, /function DiscussionCard/);
  assert.match(commView, /featuredAnnouncementCard/);
  assert.match(commView, /Search discussions, topics, creators, or tags/);
  assert.match(commView, /No discussions yet/);
  assert.match(commView, /discussionsGrid/);
  assert.match(commView, /handleTogglePin/);
  assert.match(commView, /handleToggleReaction/);
  assert.match(commView, /discussionModalOverlay/);
  assert.match(commView, /<CreatorUsername/);
  assert.doesNotMatch(commView, /❤️|💬|📌|🗑️|🔒/);
});

test('discussion polish includes responsive filters and natural media sizing', async () => {
  const css = await read('app/globals.css');
  assert.match(css, /\.featuredAnnouncementCard/);
  assert.match(css, /\.communityCategoriesScroll[\s\S]*overflow-x:\s*auto/);
  assert.match(css, /@media\(max-width:430px\)/);
  assert.match(css, /\.discussionImagePreview img\{[^}]*height:auto/);
  assert.match(css, /\.featuredAnnouncementMedia img\{[^}]*height:auto/);
});

test('rank details does not expose XP history UI', async () => {
  const rankCard = await read('app/components/creator-rank-card.tsx');
  const css = await read('app/globals.css');
  assert.doesNotMatch(rankCard, /XP history|xp\/history|rankHistoryLink/i);
  assert.doesNotMatch(css, /rankHistoryLink/);
});

test('profile header keeps identity and XP together with stats directly below', async () => {
  const profile = await read('app/components/creator-profile.tsx');
  const css = await read('app/globals.css');
  const summaryStart = profile.indexOf('<div className="profileSummary">');
  const statsStart = profile.indexOf('<div className="profileStats"', summaryStart);
  const tabsStart = profile.indexOf('<div className="profileTabs"', statsStart);

  assert.ok(summaryStart >= 0 && statsStart > summaryStart && tabsStart > statsStart);
  assert.match(profile.slice(summaryStart, statsStart), /profileIdentityArea/);
  assert.match(profile.slice(summaryStart, statsStart), /profileHeaderAside[\s\S]*<CreatorProgress/);
  assert.doesNotMatch(profile.slice(statsStart, tabsStart), /profileHeaderAside/);
  assert.match(css, /\.profileIdentityArea\{[\s\S]*grid-template-columns:190px minmax\(0,1fr\)/);
  assert.match(css, /@media\(max-width:700px\)[\s\S]*\.profileHeaderAside\{display:grid;grid-template-columns:1fr/);
});

test('profile work uses a reusable card with readable metadata and SVG actions', async () => {
  const manager = await read('app/components/collections-manager.tsx');
  const card = await read('app/components/portfolio-skillshot-card.tsx');
  const css = await read('app/globals.css');

  assert.match(manager, /<PortfolioSkillshotCard/);
  assert.doesNotMatch(manager, /portfolioHoverActions/);
  assert.match(card, /portfolioCreatorRow/);
  assert.match(card, /portfolioCardTitle[\s\S]*portfolioTag[\s\S]*portfolioCardActions/);
  for (const icon of ['heart', 'comment', 'bookmark', 'share', 'arrow-up-right']) {
    assert.match(card, new RegExp(`name="${icon}"`));
  }
  assert.match(css, /\.profilePage \.portfolioCardTitle\{[\s\S]*font-size:16px/);
  assert.match(css, /@media\(max-width:700px\)[\s\S]*\.profilePage \.portfolioCardTitle\{font-size:15px/);
  assert.match(css, /-webkit-line-clamp:2/);
});

test('creator rank and staff role share compact circular icon badge geometry', async () => {
  const rankBadge = await read('app/components/creator-rank-badge.tsx');
  const roleBadge = await read('app/components/role-badge.tsx');
  const identity = await read('app/components/creator-username.tsx');
  const iconBadge = await read('app/components/icon-badge.tsx');
  const css = await read('app/globals.css');

  assert.match(rankBadge, /import IconBadge/);
  assert.match(roleBadge, /import IconBadge/);
  assert.match(rankBadge, /<IconBadge/);
  assert.match(roleBadge, /<IconBadge/);
  assert.match(iconBadge, /iconBadge-\$\{size\}/);
  assert.doesNotMatch(rankBadge, /rankLabelText/);
  assert.match(identity, /<RoleBadge[\s\S]*showLabel=\{false\}/);
  assert.match(css, /\.iconBadge-compact\{width:18px;height:18px/);
  assert.match(css, /\.iconBadge-profile\{width:20px;height:20px/);
  assert.match(css, /border-radius:50%/);
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
