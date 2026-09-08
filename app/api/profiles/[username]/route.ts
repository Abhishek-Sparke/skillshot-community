import { getChatGPTUser } from '../../../chatgpt-auth';
import { getReadyDb } from '../../../../lib/db';
import { normalizeRole } from '../../../../lib/roles';
import { safeStoredSocialLinks } from '../../../../lib/social-links';
import { canUserMessage, isBlockBetween } from '../../../../lib/chat';
import { calculateLevelProgress, calculateRankProgress } from '../../../../lib/creator-rank';
import { calculateAchievements } from '../../../../lib/achievements';

export async function GET(_: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const viewer = await getChatGPTUser();
  const rows = await (await getReadyDb()).query(`
    SELECT u.id, u.email, u.display_name, u.username, u.bio, u.website, u.location,
      u.skills, u.social_links, u.avatar_url, u.banner_url, u.banner_type, u.role, u.creator_xp, u.created_at,
      (SELECT COUNT(*) FROM posts p WHERE p.user_id=u.id AND p.status='VISIBLE') AS post_count,
      (SELECT COUNT(*) FROM reactions r JOIN posts p ON p.id=r.post_id WHERE p.user_id=u.id) AS likes_received,
      (SELECT COUNT(*) FROM follows f WHERE f.followed_id=u.id) AS follower_count,
      (SELECT COUNT(*) FROM follows f WHERE f.follower_id=u.id) AS following_count,
      (SELECT COUNT(*) FROM comments c WHERE c.user_id=u.id AND c.status='VISIBLE') AS comment_count,
      EXISTS(SELECT 1 FROM follows f WHERE f.follower_id=$1 AND f.followed_id=u.id) AS viewer_follows
    FROM users u WHERE lower(u.username)=lower($2) AND ((u.status='ACTIVE' AND u.profile_status='VISIBLE') OR u.id=$1) LIMIT 1
  `, [viewer?.userId ?? '', username]);

  if (!rows.length) return Response.json({ error: 'Creator not found' }, { status: 404 });
  const row = rows[0];
  const featuredRows = await (await getReadyDb()).query(`
    SELECT p.id, p.title, p.description, p.created_at,
      (SELECT COUNT(*) FROM reactions r WHERE r.post_id=p.id) AS reaction_count,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id) AS comment_count
    FROM featured_posts fp JOIN posts p ON p.id=fp.post_id
    WHERE fp.user_id=$1 AND p.status='VISIBLE' ORDER BY fp.position ASC LIMIT 3
  `, [row.id]);
  const collectionRows = await (await getReadyDb()).query(`
    SELECT c.id, c.name, c.description, c.cover_url, c.is_private,
      (SELECT COUNT(*) FROM collection_posts cp JOIN posts p ON p.id=cp.post_id
       WHERE cp.collection_id=c.id AND p.status='VISIBLE') AS post_count
    FROM collections c
    WHERE c.user_id=$1 ${viewer?.userId === row.id ? '' : 'AND c.is_private=false'}
    ORDER BY c.is_featured DESC, c.position ASC, c.created_at DESC
    LIMIT 4
  `, [row.id]);
  const storedWebsite = String(row.website || '');
  let website = '';
  if (storedWebsite) {
    try {
      const parsed = new URL(storedWebsite);
      if (['http:', 'https:'].includes(parsed.protocol)) website = parsed.toString();
    } catch { /* Ignore legacy invalid website values. */ }
  }
  const postCount = Number(row.post_count);
  const likesReceived = Number(row.likes_received);
  const followerCount = Number(row.follower_count);
  const followingCount = Number(row.following_count);
  const commentCount = Number(row.comment_count);
  const skillsList = Array.isArray(row.skills) ? row.skills.map(String) : [];

  const xp = Math.max(0, Number(row.creator_xp || 0));
  const rankProgress = calculateRankProgress(xp);
  const levelProgress = calculateLevelProgress(xp);

  const reputation = Math.min(9999, likesReceived * 3 + followerCount * 5 + postCount * 10 + commentCount * 2);
  const achievements = calculateAchievements({
    postCount,
    likesReceived,
    skillsCount: skillsList.length,
    commentCount,
    isFeatured: featuredRows.length > 0,
  });
  let canMessage = true;
  let canMessageReason = '';
  let isBlocked = false;
  let isBlockedByThem = false;

  if (viewer && viewer.userId !== row.id) {
    const blocks = await isBlockBetween(viewer.userId, row.id);
    isBlocked = blocks.isBlockedByYou;
    isBlockedByThem = blocks.isBlockedByThem;
    const msgCheck = await canUserMessage(viewer.userId, row.id);
    canMessage = msgCheck.allowed;
    canMessageReason = msgCheck.reason || '';
  }

  return Response.json({ profile: {
    displayName: String(row.display_name),
    username: String(row.username),
    bio: String(row.bio || ''),
    website,
    location: String(row.location || ''),
    skills: skillsList,
    socialLinks: safeStoredSocialLinks(row.social_links),
    avatarUrl: row.avatar_url ? `/api/avatars/${encodeURIComponent(String(row.username))}?v=${encodeURIComponent(String(row.avatar_url))}` : '',
    bannerUrl: row.banner_url ? `/api/banners/${encodeURIComponent(String(row.username))}?v=${encodeURIComponent(String(row.banner_url))}` : '',
    bannerType: String(row.banner_type || ''),
    creatorRank: rankProgress.rank.id,
    creatorRankInfo: rankProgress.rank,
    rankProgress,
    levelProgress,
    role: normalizeRole(row.role),
    joinedAt: new Date(row.created_at as string).getTime(),
    postCount,
    likesReceived,
    reputation,
    achievements,
    followerCount,
    followingCount,
    isFollowing: Boolean(row.viewer_follows),
    isSelf: viewer?.userId === row.id,
    signedIn: Boolean(viewer),
    canMessage,
    canMessageReason,
    isBlocked,
    isBlockedByThem,
    featuredPosts: featuredRows.map(post => ({
      id: String(post.id), title: String(post.title), description: String(post.description || ''),
      createdAt: new Date(post.created_at as string).getTime(), reactionCount: Number(post.reaction_count),
      commentCount: Number(post.comment_count), imageUrl: `/api/images/${post.id}?variant=thumbnail`,
    })),
    collections: collectionRows.map(collection => ({
      id: String(collection.id), name: String(collection.name), description: String(collection.description || ''),
      coverUrl: collection.cover_url ? String(collection.cover_url) : null, isPrivate: Boolean(collection.is_private),
      postCount: Number(collection.post_count),
    })),
  } });
}
