import { requirePrincipal } from '../../../../../../../lib/authz';
import { getReadyDb } from '../../../../../../../lib/db';
import { rateLimit } from '../../../../../../../lib/rate-limit';

export async function POST(_:Request,{params}:{params:Promise<{id:string;commentId:string}>}){
  const auth=await requirePrincipal();if('error'in auth)return auth.error;
  if(!await rateLimit(`comment-like:${auth.principal.id}`,60,300))return Response.json({error:'Please wait before liking more comments.'},{status:429});
  const {id,commentId}=await params;const sql=await getReadyDb();
  const found=await sql.query(`SELECT c.id,c.user_id FROM comments c JOIN posts p ON p.id=c.post_id JOIN users u ON u.id=p.user_id WHERE c.id=$1 AND c.post_id=$2 AND c.status='VISIBLE' AND p.status='VISIBLE' AND u.status='ACTIVE' LIMIT 1`,[commentId,id]);
  if(!found.length)return Response.json({error:'Comment not found'},{status:404});
  const removed=await sql.query(`DELETE FROM comment_reactions WHERE comment_id=$1 AND user_id=$2 RETURNING comment_id`,[commentId,auth.principal.id]);
  if(removed.length)return Response.json({liked:false});
  await sql.query(`INSERT INTO comment_reactions(comment_id,user_id)VALUES($1,$2) ON CONFLICT DO NOTHING`,[commentId,auth.principal.id]);
  if(found[0].user_id!==auth.principal.id) {
    const actorName = String(auth.principal.profile?.display_name || auth.principal.profile?.username || 'Someone');
    await sql.query(
      `INSERT INTO notifications(id,user_id,actor_id,category,type,title,body,event_key,target_url,target_id,thumbnail_url)
       VALUES($1,$2,$3,'post','LIKE',$4,'Your contribution was appreciated.',$5,$6,$7,(SELECT thumbnail_url FROM posts WHERE id=$7))
       ON CONFLICT (event_key) WHERE event_key IS NOT NULL DO NOTHING`,
      [crypto.randomUUID(),found[0].user_id,auth.principal.id,`${actorName} liked your comment`,`comment-like:${commentId}:${auth.principal.id}`,`/shots/${id}#comment-${commentId}`,id]
    );
  }
  return Response.json({liked:true});
}
