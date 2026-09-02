import { requirePrincipal } from '../../../../../../../lib/authz';
import { getReadyDb } from '../../../../../../../lib/db';
import { rateLimit } from '../../../../../../../lib/rate-limit';

export async function POST(_:Request,{params}:{params:Promise<{id:string;commentId:string}>}){
  const auth=await requirePrincipal();if('error'in auth)return auth.error;
  if(!await rateLimit(`comment-like:${auth.principal.id}`,60,300))return Response.json({error:'Please wait before liking more comments.'},{status:429});
  const {id,commentId}=await params;const sql=await getReadyDb();
  const found=await sql.query(`SELECT id FROM comments WHERE id=$1 AND post_id=$2 AND status='VISIBLE' LIMIT 1`,[commentId,id]);
  if(!found.length)return Response.json({error:'Comment not found'},{status:404});
  const removed=await sql.query(`DELETE FROM comment_reactions WHERE comment_id=$1 AND user_id=$2 RETURNING comment_id`,[commentId,auth.principal.id]);
  if(removed.length)return Response.json({liked:false});
  await sql.query(`INSERT INTO comment_reactions(comment_id,user_id)VALUES($1,$2) ON CONFLICT DO NOTHING`,[commentId,auth.principal.id]);
  return Response.json({liked:true});
}
