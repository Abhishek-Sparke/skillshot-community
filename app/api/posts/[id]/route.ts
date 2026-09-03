import { getChatGPTUser } from '../../../chatgpt-auth';
import { getReadyDb } from '../../../../lib/db';
import { normalizeRole } from '../../../../lib/roles';
import { requirePrincipal } from '../../../../lib/authz';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getChatGPTUser();
  const sql = await getReadyDb();
  const rows = await sql.query(`
    SELECT p.id, p.user_id, p.title, p.description, p.tags, p.skills, p.category, p.created_at,p.image_width,p.image_height,
      u.display_name, u.username, u.email, u.role,u.avatar_url,
      (SELECT COUNT(*) FROM reactions r WHERE r.post_id=p.id) AS reaction_count,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id AND c.status='VISIBLE') AS comment_count,
      (SELECT COUNT(*) FROM reactions vr WHERE vr.post_id=p.id AND vr.user_id=$1) AS viewer_liked
    FROM posts p JOIN users u ON u.id=p.user_id WHERE p.id=$2 AND p.status NOT IN ('PURGING','PURGED') AND ((p.status='VISIBLE' AND u.status='ACTIVE') OR p.user_id=$1) LIMIT 1
  `, [user?.userId ?? '', id]);
  if (!rows.length) return Response.json({ error: 'Post not found' }, { status: 404 });
  const row = rows[0];
  const viewer=user?await requirePrincipal():null;
  const viewerPrincipal=viewer&&'principal'in viewer?viewer.principal:null;
  return Response.json({ post: {
    id: row.id, title: row.title, description: row.description,
    tags: Array.isArray(row.tags) ? row.tags : [], skills: Array.isArray(row.skills) ? row.skills : [], category: row.category || 'Other', author: row.display_name,
    username: row.username,
    authorRole: normalizeRole(row.role),
    createdAt: new Date(row.created_at as string).getTime(),
    reactionCount: Number(row.reaction_count), commentCount: Number(row.comment_count),
    viewerLiked: Boolean(Number(row.viewer_liked)), signedIn: Boolean(user),
    canPin: user?.userId===row.user_id || Boolean(viewerPrincipal?.permissions.includes('moderation.approve')),
    commentReview: viewerPrincipal?.permissions.includes('reports.view')
      ? { hide:viewerPrincipal.permissions.includes('moderation.hide'), delete:viewerPrincipal.permissions.includes('comments.delete') }
      : null,
    isOwner: user?.userId === row.user_id, imageUrl: `/api/images/${row.id}?variant=display`,
    previewUrl: `/api/images/${row.id}?variant=display`, imageWidth:Number(row.image_width)||4,imageHeight:Number(row.image_height)||3,
    avatarUrl: row.avatar_url ? `/api/avatars/${encodeURIComponent(String(row.username))}?v=${encodeURIComponent(String(row.avatar_url))}` : '',
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
  if (['DELETED','PURGING','PURGED'].includes(rows[0].status)) return Response.json({ ok: true });
  await sql.query(`WITH changed AS (
    UPDATE posts SET status='DELETED',deleted_at=now() WHERE id=$1 AND status NOT IN ('DELETED','PURGING','PURGED')
    RETURNING id,image_url,display_url,thumbnail_url
  ) INSERT INTO storage_cleanup_queue(id,post_id,pathname,reason,cleanup_after)
    SELECT gen_random_uuid()::text,c.id,path,'POST_DELETED',now()+interval '30 days'
    FROM changed c CROSS JOIN LATERAL unnest(ARRAY[c.image_url,c.display_url,c.thumbnail_url]) path
    WHERE path IS NOT NULL AND NOT EXISTS(SELECT 1 FROM storage_cleanup_queue q WHERE q.post_id=c.id AND q.pathname=path AND q.deleted_at IS NULL)`, [id]);
  return Response.json({ ok: true });
}
