import { getChatGPTUser } from '../../../../chatgpt-auth';
import { ensureUser, getReadyDb } from '../../../../../lib/db';
import { normalizeRole } from '../../../../../lib/roles';
import { rateLimit } from '../../../../../lib/rate-limit';
import { moderateText } from '../../../../../lib/moderation';
import { requirePrincipal } from '../../../../../lib/authz';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getChatGPTUser();
  const sql = await getReadyDb();
  const rows = await sql.query(`SELECT c.id,c.user_id,c.parent_id,c.body,c.created_at,u.display_name,u.username,u.email,u.role,u.avatar_url,
    (SELECT count(*) FROM comment_reactions cr WHERE cr.comment_id=c.id) reaction_count,
    EXISTS(SELECT 1 FROM comment_reactions cr WHERE cr.comment_id=c.id AND cr.user_id=$2) viewer_liked
    FROM comments c JOIN users u ON u.id=c.user_id WHERE c.post_id=$1 AND c.status='VISIBLE' AND u.status='ACTIVE' ORDER BY c.created_at ASC`, [id,user?.userId??'']);
  return Response.json({ comments: rows.map(row => ({
    id: row.id, body: row.body, author: row.display_name, username: row.username,
    authorRole: normalizeRole(row.role),
    avatarUrl: row.avatar_url ? `/api/avatars/${encodeURIComponent(String(row.username))}?v=${encodeURIComponent(String(row.avatar_url))}` : '',
    parentId: row.parent_id || null, reactionCount:Number(row.reaction_count),viewerLiked:Boolean(row.viewer_liked),
    createdAt: new Date(row.created_at as string).getTime(), canDelete: user?.userId === row.user_id,
  })) });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth=await requirePrincipal();if('error'in auth)return auth.error;const user={userId:auth.principal.id,email:auth.principal.email,displayName:String(auth.principal.profile.display_name||auth.principal.email.split('@')[0])};
  if (!await rateLimit(`comment:${user.userId}`, 12, 300)) return Response.json({ error: 'Please wait before posting more comments.' }, { status: 429 });
  const { id: postId } = await params;
  const payload=await request.json();
  const body = String(payload.body || '').trim().slice(0, 1000);
  const parentId=typeof payload.parentId==='string'&&payload.parentId?payload.parentId:null;
  if (!body) return Response.json({ error: 'Comment required' }, { status: 400 });
  const decision = await moderateText(body);
  if (decision.level === 'HIGH') return Response.json({ error: "This comment couldn't be posted because it doesn't meet Skillshot's community guidelines." }, { status: 422 });
  const profile = await ensureUser(user);
  const id = crypto.randomUUID();
  const sql = await getReadyDb();
  const post = await sql.query(`SELECT id FROM posts WHERE id=$1 AND status='VISIBLE' LIMIT 1`,[postId]);
  if(!post.length)return Response.json({error:'Post not found'},{status:404});
  const parent=parentId?await sql.query(`SELECT c.id,c.user_id,u.username FROM comments c JOIN users u ON u.id=c.user_id WHERE c.id=$1 AND c.post_id=$2 AND c.status='VISIBLE' LIMIT 1`,[parentId,postId]):[];
  if(parentId&&!parent.length)return Response.json({error:'The comment you are replying to is unavailable.'},{status:404});
  const commentStatus = decision.level === 'SAFE' ? 'VISIBLE' : 'FLAGGED';
  await sql.query(`INSERT INTO comments (id,post_id,user_id,parent_id,body,status) VALUES ($1,$2,$3,$4,$5,$6)`, [id, postId, user.userId, parentId, body, commentStatus]);
  if (commentStatus !== 'VISIBLE') await sql.query(`INSERT INTO moderation_queue(id,source,target_type,target_id,creator_id,category,severity) VALUES($1,'AUTOMATIC','COMMENT',$2,$3,$4,'BORDERLINE')`, [crypto.randomUUID(),id,user.userId,decision.category ?? 'REVIEW']);
  if (commentStatus !== 'VISIBLE') return Response.json({ held: true, message: 'Your comment is awaiting review.' }, { status: 202 });
  if(parent.length&&parent[0].user_id!==user.userId)await sql.query(`INSERT INTO notifications(id,user_id,type,title,body) VALUES($1,$2,'COMMENT_REPLY',$3,$4)`,[crypto.randomUUID(),parent[0].user_id,`@${profile.username??user.email.split('@')[0]} replied to your comment.`,body.slice(0,160)]);
  const username=String(profile.username??user.email.split('@')[0]);
  return Response.json({ id, parentId, body, author: profile.display_name ?? user.displayName, username, authorRole: normalizeRole(profile.role), avatarUrl:profile.avatar_url?`/api/avatars/${encodeURIComponent(username)}?v=${encodeURIComponent(String(profile.avatar_url))}`:'',createdAt: Date.now(), canDelete: true,reactionCount:0,viewerLiked:false }, { status: 201 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth=await requirePrincipal();if('error'in auth)return auth.error;const userId=auth.principal.id;
  const { id: postId } = await params;
  const commentId = new URL(request.url).searchParams.get('commentId');
  const body = String((await request.json()).body || '').trim().slice(0, 1000);
  if (!commentId || !body) return Response.json({ error: 'Comment required' }, { status: 400 });
  const decision=await moderateText(body);
  if(decision.level==='HIGH')return Response.json({error:"This comment couldn't be saved because it doesn't meet Skillshot's community guidelines."},{status:422});
  const status=decision.level==='SAFE'?'VISIBLE':'FLAGGED';
  const updated = await (await getReadyDb()).query(
    `UPDATE comments SET body=$1,status=$2 WHERE id=$3 AND post_id=$4 AND user_id=$5 RETURNING id,body`,
    [body,status,commentId,postId,userId],
  );
  if (!updated.length) return Response.json({ error: 'Comment not found' }, { status: 404 });
  if(status!=='VISIBLE')await (await getReadyDb()).query(`INSERT INTO moderation_queue(id,source,target_type,target_id,creator_id,category,severity) VALUES($1,'AUTOMATIC','COMMENT',$2,$3,$4,'BORDERLINE')`,[crypto.randomUUID(),commentId,userId,decision.category??'REVIEW']);
  return Response.json({ id: updated[0].id, body: updated[0].body });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth=await requirePrincipal();if('error'in auth)return auth.error;const userId=auth.principal.id;
  const { id: postId } = await params;
  const commentId = new URL(request.url).searchParams.get('commentId');
  if (!commentId) return Response.json({ error: 'Missing id' }, { status: 400 });
  await (await getReadyDb()).query(`DELETE FROM comments WHERE id=$1 AND post_id=$2 AND user_id=$3`, [commentId, postId, userId]);
  return new Response(null, { status: 204 });
}
