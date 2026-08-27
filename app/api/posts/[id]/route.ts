import { getChatGPTUser } from '../../../chatgpt-auth';
import { getReadyDb } from '../../../../lib/db';
import { normalizeRole, roleForEmail } from '../../../../lib/roles';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getChatGPTUser();
  const sql = await getReadyDb();
  const rows = await sql.query(`
    SELECT p.id, p.user_id, p.title, p.description, p.tags, p.created_at,
      u.display_name, u.username, u.email, u.role,
      (SELECT COUNT(*) FROM reactions r WHERE r.post_id=p.id) AS reaction_count,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id) AS comment_count,
      (SELECT COUNT(*) FROM reactions vr WHERE vr.post_id=p.id AND vr.user_id=$1) AS viewer_liked
    FROM posts p JOIN users u ON u.id=p.user_id WHERE p.id=$2 LIMIT 1
  `, [user?.userId ?? '', id]);
  if (!rows.length) return Response.json({ error: 'Post not found' }, { status: 404 });
  const row = rows[0];
  return Response.json({ post: {
    id: row.id, title: row.title, description: row.description,
    tags: Array.isArray(row.tags) ? row.tags : [], author: row.display_name,
    username: row.username,
    authorRole: roleForEmail(String(row.email)) === 'admin' ? 'admin' : normalizeRole(row.role),
    createdAt: new Date(row.created_at as string).getTime(),
    reactionCount: Number(row.reaction_count), commentCount: Number(row.comment_count),
    viewerLiked: Boolean(Number(row.viewer_liked)), signedIn: Boolean(user),
    isOwner: user?.userId === row.user_id, imageUrl: `/api/images/${row.id}`,
    downloadUrl: `/api/images/${row.id}?download=1`,
  } });
}
