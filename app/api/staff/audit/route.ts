import { requirePrincipal } from '../../../../lib/authz';
import { getReadyDb } from '../../../../lib/db';

export async function GET(request:Request){const auth=await requirePrincipal('audit.view');if('error'in auth)return auth.error;const limit=Math.min(100,Math.max(1,Number(new URL(request.url).searchParams.get('limit'))||50));const logs=await(await getReadyDb()).query(`SELECT l.id,l.action,l.target_type,l.target_id,l.metadata,l.created_at,u.display_name,u.username FROM audit_logs l LEFT JOIN users u ON u.id=l.actor_id ORDER BY l.created_at DESC LIMIT $1`,[limit]);return Response.json({logs});}
