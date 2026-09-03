import { requirePrincipal } from '../../../lib/authz';
import { getReadyDb } from '../../../lib/db';
import { rateLimit } from '../../../lib/rate-limit';
import { settingsPatch } from '../../../lib/settings-policy';
export async function GET(){
  const auth=await requirePrincipal();if('error'in auth)return auth.error;
  return Response.json({preferences:auth.principal.profile.preferences||{}},{headers:{'Cache-Control':'private, no-store'}});
}
export async function PATCH(request:Request){
  const auth=await requirePrincipal();if('error'in auth)return auth.error;
  if(!await rateLimit(`settings:${auth.principal.id}`,90,300))return Response.json({error:'Please wait a moment before saving again.'},{status:429});
  let patch;try{patch=settingsPatch(await request.json());}catch{return Response.json({error:'Choose a valid setting. Security emails cannot be disabled.'},{status:400});}
  try{
    const rows=await(await getReadyDb()).query(`UPDATE users SET preferences=preferences || jsonb_build_object('notifications',COALESCE(preferences->'notifications','{}'::jsonb)||$2::jsonb) || $3::jsonb WHERE id=$1 AND status='ACTIVE' RETURNING preferences`,[auth.principal.id,JSON.stringify(patch.notifications),JSON.stringify(patch.theme?{theme:patch.theme}:{})]);
    if(!rows.length)return Response.json({error:'Account unavailable.'},{status:403});
    return Response.json({preferences:rows[0].preferences},{headers:{'Cache-Control':'private, no-store'}});
  }catch{return Response.json({error:'Could not save your settings. Please try again.'},{status:503});}
}
