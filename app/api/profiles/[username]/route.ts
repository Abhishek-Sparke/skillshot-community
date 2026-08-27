import { getChatGPTUser } from '../../../chatgpt-auth';
import { getReadyDb } from '../../../../lib/db';
import { normalizeRole, roleForEmail } from '../../../../lib/roles';

export async function GET(_: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const viewer = await getChatGPTUser();
  const rows = await (await getReadyDb()).query(`
    SELECT u.id, u.email, u.display_name, u.username, u.bio, u.website, u.location,
      u.skills, u.social_links, u.avatar_url, u.role, u.created_at,
      (SELECT COUNT(*) FROM posts p WHERE p.user_id=u.id) AS post_count,
      (SELECT COUNT(*) FROM reactions r JOIN posts p ON p.id=r.post_id WHERE p.user_id=u.id) AS likes_received,
      (SELECT COUNT(*) FROM follows f WHERE f.followed_id=u.id) AS follower_count,
      (SELECT COUNT(*) FROM follows f WHERE f.follower_id=u.id) AS following_count,
      EXISTS(SELECT 1 FROM follows f WHERE f.follower_id=$1 AND f.followed_id=u.id) AS viewer_follows
    FROM users u WHERE lower(u.username)=lower($2) LIMIT 1
  `, [viewer?.userId ?? '', username]);

  if (!rows.length) return Response.json({ error: 'Creator not found' }, { status: 404 });
  const row = rows[0];
  const featuredRows = await (await getReadyDb()).query(`
    SELECT p.id, p.title, p.description, p.created_at,
      (SELECT COUNT(*) FROM reactions r WHERE r.post_id=p.id) AS reaction_count,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id) AS comment_count
    FROM featured_posts fp JOIN posts p ON p.id=fp.post_id
    WHERE fp.user_id=$1 ORDER BY fp.position ASC LIMIT 3
  `, [row.id]);
  const storedWebsite = String(row.website || '');
  let website = '';
  if (storedWebsite) {
    try {
      const parsed = new URL(storedWebsite);
      if (['http:', 'https:'].includes(parsed.protocol)) website = parsed.toString();
    } catch { /* Ignore legacy invalid website values. */ }
  }
  return Response.json({ profile: {
    displayName: String(row.display_name),
    username: String(row.username),
    bio: String(row.bio || ''),
    website,
    location: String(row.location || ''),
    skills: Array.isArray(row.skills) ? row.skills.map(String) : [],
    socialLinks: row.social_links && typeof row.social_links === 'object' ? row.social_links : {},
    avatarUrl: row.avatar_url ? `/api/avatars/${encodeURIComponent(String(row.username))}?v=${encodeURIComponent(String(row.avatar_url))}` : '',
    role: roleForEmail(String(row.email)) === 'admin' ? 'admin' : normalizeRole(row.role),
    joinedAt: new Date(row.created_at as string).getTime(),
    postCount: Number(row.post_count),
    likesReceived: Number(row.likes_received),
    followerCount: Number(row.follower_count),
    followingCount: Number(row.following_count),
    isFollowing: Boolean(row.viewer_follows),
    isSelf: viewer?.userId === row.id,
    signedIn: Boolean(viewer),
    featuredPosts: featuredRows.map(post => ({
      id: String(post.id), title: String(post.title), description: String(post.description || ''),
      createdAt: new Date(post.created_at as string).getTime(), reactionCount: Number(post.reaction_count),
      commentCount: Number(post.comment_count), imageUrl: `/api/images/${post.id}`,
    })),
  } });
}
