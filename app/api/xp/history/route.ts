import { requirePrincipal } from '../../../../lib/authz';
import { getReadyDb } from '../../../../lib/db';
import { calculateRankProgress } from '../../../../lib/creator-rank';

export async function GET(request: Request) {
  const auth=await requirePrincipal();if('error'in auth)return auth.error;
  const url=new URL(request.url),limit=Math.max(1,Math.min(50,Number(url.searchParams.get('limit'))||20));
  const sql=await getReadyDb();
  const [user]=await sql.query(`SELECT creator_xp FROM users WHERE id=$1`,[auth.principal.id]);
  const events=await sql.query(`SELECT id,amount,event_type,reason,related_type,related_id,created_at FROM xp_events WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2`,[auth.principal.id,limit]);
  return Response.json({progress:calculateRankProgress(Number(user?.creator_xp||0)),events:events.map(row=>({id:String(row.id),amount:Number(row.amount),type:String(row.event_type),reason:String(row.reason),relatedType:row.related_type,relatedId:row.related_id,createdAt:new Date(row.created_at as string).getTime()}))},{headers:{'Cache-Control':'private, no-store'}});
}
