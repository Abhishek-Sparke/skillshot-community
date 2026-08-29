import { getChatGPTUser } from '../../../chatgpt-auth';
import { getReadyDb } from '../../../../lib/db';
import { normalizeRole } from '../../../../lib/roles';
import { requirePrincipal } from '../../../../lib/authz';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getChatGPTUser();
  const sql = await getReadyDb();
  const rows = await sql.query(`
    SELECT p.id, p.user_id, p.title, p.description, p.tags, p.skills, p.category, p.created_at,
      u.display_name, u.username, u.email, u.role,
      (SELECT COUNT(*) FROM reactions r WHERE r.post_id=p.id) AS reaction_count,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id) AS comment_count,
      (SELECT COUNT(*) FROM reactions vr WHERE vr.post_id=p.id AND vr.user_id=$1) AS viewer_liked
    FROM posts p JOIN users u ON u.id=p.user_id WHERE p.id=$2 AND (p.status='VISIBLE' OR p.user_id=$1) LIMIT 1
  `, [user?.userId ?? '', id]);
  if (!rows.length) return Response.json({ error: 'Post not found' }, { status: 404 });
  const row = rows[0];
  return Response.json({ post: {
    id: row.id, title: row.title, description: row.description,
    tags: Array.isArray(row.tags) ? row.tags : [], skills: Array.isArray(row.skills) ? row.skills : [], category: row.category || 'Other', author: row.display_name,
    username: row.username,
    authorRole: normalizeRole(row.role),
    createdAt: new Date(row.created_at as string).getTime(),
    reactionCount: Number(row.reaction_count), commentCount: Number(row.comment_count),
    viewerLiked: Boolean(Number(row.viewer_liked)), signedIn: Boolean(user),
    isOwner: user?.userId === row.user_id, imageUrl: `/api/images/${row.id}?variant=display`,
    downloadUrl: `/api/images/${row.id}?download=1`,
  } });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePrincipal();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const sql = await getReadyDb();
  const rows = await sql.query(`SELECT user_id,image_url,display_url,thumbnail_url,status FROM posts WHERE id=$1 LIMIT 1`, [id]);
  if (!rows.length) return Response.json({ error: 'Post not found' }, { status: 404 });
  if (rows[0].user_id !== auth.principal.id && !auth.principal.permissions.includes('skillshots.delete')) return Response.json({ error: 'Forbidden' }, { status: 403 });
  if (rows[0].status === 'DELETED') return Response.json({ ok: true });
  await sql.query(`UPDATE posts SET status='DELETED',deleted_at=now() WHERE id=$1`, [id]);
  const paths = [...new Set([rows[0].image_url, rows[0].display_url, rows[0].thumbnail_url].filter(Boolean).map(String))];
  for (const pathname of paths) await sql.query(`INSERT INTO storage_cleanup_queue(id,post_id,pathname,reason,cleanup_after) VALUES($1,$2,$3,'POST_DELETED',now()+interval '30 days')`, [crypto.randomUUID(), id, pathname]);
  return Response.json({ ok: true });
}
