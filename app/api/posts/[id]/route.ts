import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { getReadyDb } from '../../../../db';

type PostRow = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  tags: string;
  created_at: number;
  display_name: string;
  username: string;
  reaction_count: number;
  comment_count: number;
  viewer_liked: number;
};

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getChatGPTUser();
  await getReadyDb();
  const result = await env.DB.prepare(`
    SELECT p.id, p.user_id, p.title, p.description, p.tags, p.created_at,
      u.display_name, u.username,
      (SELECT COUNT(*) FROM reactions r WHERE r.post_id = p.id) AS reaction_count,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count,
      (SELECT COUNT(*) FROM reactions vr WHERE vr.post_id = p.id AND vr.user_id = ?) AS viewer_liked
    FROM posts p JOIN users u ON u.id = p.user_id WHERE p.id = ? LIMIT 1
  `).bind(user?.userId ?? '', id).first<PostRow>();
  if (!result) return Response.json({ error: 'Post not found' }, { status: 404 });

  let tags: string[] = [];
  try { tags = JSON.parse(result.tags); } catch { tags = []; }
  return Response.json({ post: {
    id: result.id,
    title: result.title,
    description: result.description,
    tags,
    author: result.display_name,
    username: result.username,
    createdAt: Number(result.created_at),
    reactionCount: Number(result.reaction_count),
    commentCount: Number(result.comment_count),
    viewerLiked: Boolean(result.viewer_liked),
    signedIn: Boolean(user),
    isOwner: user?.userId === result.user_id,
    imageUrl: `/api/images/${result.id}`,
    downloadUrl: `/api/images/${result.id}?download=1`,
  } });
}
