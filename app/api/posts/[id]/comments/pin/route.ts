import { requirePrincipal } from '../../../../../../lib/authz';
import { getReadyDb } from '../../../../../../lib/db';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const auth=await requirePrincipal();if('error'in auth)return auth.error;const {id}=await params;
  const body=await request.json().catch(()=>null);if(!body||!('commentId'in body))return Response.json({error:'Choose a comment.'},{status:400});
  const sql=await getReadyDb(),staff=auth.principal.permissions.includes('moderation.approve');
  const rows=await sql.query(`WITH changed AS(UPDATE posts SET pinned_comment_id=$3 WHERE id=$1 AND status='VISIBLE' AND (user_id=$2 OR $4::boolean) AND ($3::text IS NULL OR EXISTS(SELECT 1 FROM comments c WHERE c.id=$3 AND c.post_id=$1 AND c.status='VISIBLE' AND c.parent_id IS NULL)) RETURNING id),audit AS(INSERT INTO audit_logs(id,actor_id,action,target_type,target_id)SELECT $5,$2,'COMMENT_PIN_UPDATED','SKILLSHOT',id FROM changed) SELECT id FROM changed`,[id,auth.principal.id,body.commentId===null?null:String(body.commentId),staff,crypto.randomUUID()]);
  return rows.length?Response.json({ok:true}):Response.json({error:'You cannot pin this comment.'},{status:403});
}
