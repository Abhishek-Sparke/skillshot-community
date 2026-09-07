import { getChatGPTUser } from '../../../../chatgpt-auth';
import { ensureUser, getReadyDb } from '../../../../../lib/db';
import { normalizeRole } from '../../../../../lib/roles';
import { rateLimit } from '../../../../../lib/rate-limit';
import { moderateText, commentModerationError } from '../../../../../lib/moderation';
import { requirePrincipal } from '../../../../../lib/authz';
import { notifyComment } from '../../../../../lib/comment-notifications';
import { awardCommentXp, isMeaningfulComment, reverseCommentXp } from '../../../../../lib/xp';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const {id}=await params,user=await getChatGPTUser(),url=new URL(request.url),sql=await getReadyDb();
  const parent=url.searchParams.get('parent')||null,page=Math.max(1,Math.min(500,Number(url.searchParams.get('page'))||1));
  const sort=['newest','oldest'].includes(url.searchParams.get('sort')||'')?url.searchParams.get('sort'):'relevant';
  const rows=await sql.query(`SELECT c.id,c.user_id,c.parent_id,CASE WHEN c.status='DELETED' THEN 'This comment was deleted.' ELSE c.body END body,c.status,c.created_at,c.edited_at,u.display_name,u.username,u.role,u.avatar_url,u.creator_rank,p.user_id creator_id,p.pinned_comment_id,
    (SELECT count(*) FROM comment_reactions cr WHERE cr.comment_id=c.id) reaction_count,
    (SELECT count(*) FROM comments r JOIN users ru ON ru.id=r.user_id WHERE r.parent_id=c.id AND r.status='VISIBLE' AND ru.status='ACTIVE') reply_count,
    EXISTS(SELECT 1 FROM comment_reactions cr WHERE cr.comment_id=c.id AND cr.user_id=$2) viewer_liked
    FROM comments c JOIN users u ON u.id=c.user_id JOIN posts p ON p.id=c.post_id JOIN users owner ON owner.id=p.user_id
    WHERE c.post_id=$1 AND p.status='VISIBLE' AND owner.status='ACTIVE' AND u.status='ACTIVE'
      AND (c.status='VISIBLE' OR (c.status='DELETED' AND c.parent_id IS NULL AND EXISTS(SELECT 1 FROM comments reply WHERE reply.parent_id=c.id AND reply.status='VISIBLE')))
      AND (($3::text IS NULL AND c.parent_id IS NULL) OR c.parent_id=$3)
      AND ($3::text IS NULL OR EXISTS(SELECT 1 FROM comments root WHERE root.id=$3 AND root.post_id=$1 AND root.status IN ('VISIBLE','DELETED')))
    ORDER BY (c.id=p.pinned_comment_id) DESC NULLS LAST,
      CASE WHEN $4='relevant' THEN (SELECT count(*) FROM comment_reactions cr WHERE cr.comment_id=c.id)+(SELECT count(*) FROM comments r WHERE r.parent_id=c.id AND r.status='VISIBLE') END DESC,
      CASE WHEN $4='oldest' OR $3::text IS NOT NULL THEN c.created_at END ASC,c.created_at DESC,c.id DESC LIMIT 21 OFFSET $5`,[id,user?.userId||'',parent,sort,(page-1)*20]);
  return Response.json({hasMore:rows.length>20,comments:rows.slice(0,20).map(row=>({
    id:row.id,body:row.body,author:row.display_name,username:row.username,authorRole:normalizeRole(row.role),creatorRank:String(row.creator_rank||'NEWCOMER'),
    avatarUrl:row.avatar_url?`/api/avatars/${encodeURIComponent(String(row.username))}`:'',parentId:row.parent_id||null,
    reactionCount:Number(row.reaction_count),replyCount:Number(row.reply_count),viewerLiked:Boolean(row.viewer_liked),createdAt:new Date(row.created_at).getTime(),
    edited:!!row.edited_at,deleted:row.status==='DELETED',pinned:row.pinned_comment_id===row.id,isCreator:row.user_id===row.creator_id,canDelete:user?.userId===row.user_id
  }))},{headers:{'Cache-Control':'private, no-store'}});
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth=await requirePrincipal();if('error'in auth)return auth.error;const user={userId:auth.principal.id,email:auth.principal.email,displayName:String(auth.principal.profile.display_name||auth.principal.email.split('@')[0])};
  if (!await rateLimit(`comment:${user.userId}`, 12, 300)) return Response.json({ error: 'Please wait before posting more comments.' }, { status: 429 });
  const { id: postId } = await params;
  const payload=await request.json();
  const body = String(payload.body || '').trim().slice(0, 1000);
  let parentId=typeof payload.parentId==='string'&&payload.parentId?payload.parentId:null;
  if (!body) return Response.json({ error: 'Comment required' }, { status: 400 });
  const decision = await moderateText(body);
  const moderationError = commentModerationError(decision);
  if (moderationError) return Response.json({ error: moderationError.error }, { status: moderationError.status });
  const profile = await ensureUser(user);
  const id = crypto.randomUUID();
  const sql = await getReadyDb();
  const post = await sql.query(`SELECT id FROM posts WHERE id=$1 AND status='VISIBLE' LIMIT 1`,[postId]);
  if(!post.length)return Response.json({error:'Post not found'},{status:404});
  const parent=parentId?await sql.query(`SELECT c.id,c.user_id,u.username FROM comments c JOIN users u ON u.id=c.user_id WHERE c.id=$1 AND c.post_id=$2 AND c.status='VISIBLE' LIMIT 1`,[parentId,postId]):[];
  if(parentId&&!parent.length)return Response.json({error:'The comment you are replying to is unavailable.'},{status:404});
  if(parentId){const roots=await sql.query(`WITH RECURSIVE thread AS(SELECT id,parent_id,0 depth FROM comments WHERE id=$1 AND post_id=$2 UNION ALL SELECT c.id,c.parent_id,t.depth+1 FROM comments c JOIN thread t ON c.id=t.parent_id WHERE c.post_id=$2 AND t.depth<20)SELECT id FROM thread WHERE parent_id IS NULL LIMIT 1`,[parentId,postId]);if(!roots.length)return Response.json({error:'This reply thread is unavailable.'},{status:409});parentId=String(roots[0].id);}
  const commentStatus = 'VISIBLE';
  await sql.query(`INSERT INTO comments (id,post_id,user_id,parent_id,body,status) VALUES ($1,$2,$3,$4,$5,$6)`, [id, postId, user.userId, parentId, body, commentStatus]);
  await awardCommentXp(id);
  await notifyComment(postId,id,user.userId,String(profile.display_name??user.displayName),body,parent[0]?.user_id).catch(()=>undefined);
  const username=String(profile.username??user.email.split('@')[0]);
  return Response.json({ id, parentId, body, author: profile.display_name ?? user.displayName, username, authorRole: normalizeRole(profile.role),creatorRank:String(profile.creator_rank||'NEWCOMER'), avatarUrl:profile.avatar_url?`/api/avatars/${encodeURIComponent(username)}?v=${encodeURIComponent(String(profile.avatar_url))}`:'',createdAt: Date.now(), canDelete: true,reactionCount:0,viewerLiked:false }, { status: 201 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth=await requirePrincipal();if('error'in auth)return auth.error;const userId=auth.principal.id;
  if (!await rateLimit(`comment-edit:${userId}`, 12, 300)) return Response.json({ error: 'Please wait before editing more comments.' }, { status: 429 });
  const { id: postId } = await params;
  const commentId = new URL(request.url).searchParams.get('commentId');
  const body = String((await request.json()).body || '').trim().slice(0, 1000);
  if (!commentId || !body) return Response.json({ error: 'Comment required' }, { status: 400 });
  const decision=await moderateText(body);
  const moderationError = commentModerationError(decision);
  if (moderationError) return Response.json({ error: moderationError.error }, { status: moderationError.status });
  const status='VISIBLE';
  const updated = await (await getReadyDb()).query(
    `UPDATE comments SET body=$1,status=$2,edited_at=now() WHERE id=$3 AND post_id=$4 AND user_id=$5 AND status='VISIBLE' RETURNING id,body`,
    [body,status,commentId,postId,userId],
  );
  if (!updated.length) return Response.json({ error: 'Comment not found' }, { status: 404 });
  if(isMeaningfulComment(body))await awardCommentXp(commentId);else await reverseCommentXp(commentId,'Comment edited and no longer eligible');
  return Response.json({ id: updated[0].id, body: updated[0].body });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth=await requirePrincipal();if('error'in auth)return auth.error;const userId=auth.principal.id;
  const { id: postId } = await params;
  const commentId = new URL(request.url).searchParams.get('commentId');
  if (!commentId) return Response.json({ error: 'Missing id' }, { status: 400 });
  const changed=await (await getReadyDb()).query(`UPDATE comments SET status='DELETED' WHERE id=$1 AND post_id=$2 AND user_id=$3 AND status='VISIBLE' RETURNING id`, [commentId, postId, userId]);
  if(changed.length)await reverseCommentXp(commentId);
  return new Response(null, { status: 204 });
}
