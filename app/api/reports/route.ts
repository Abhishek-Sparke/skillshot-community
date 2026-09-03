import { requirePrincipal } from '../../../lib/authz';
import { getReadyDb } from '../../../lib/db';
import { rateLimit } from '../../../lib/rate-limit';
const categories=new Set(['NSFW','HARASSMENT','HATE','VIOLENCE','SPAM','SCAM','COPYRIGHT','OTHER']);
export async function POST(request:Request) {
  const auth=await requirePrincipal();if('error'in auth)return auth.error;
  if(!await rateLimit(`report:${auth.principal.id}`,8,3600))return Response.json({error:'Too many reports.'},{status:429});
  let body;try{body=await request.json();}catch{return Response.json({error:'Invalid report'},{status:400});}
  if(!body||typeof body!=='object')return Response.json({error:'Invalid report'},{status:400});
  const type=String(body.targetType||'').toUpperCase(),target=String(body.targetId||''),category=String(body.category||'').toUpperCase();
  if(!['SKILLSHOT','COMMENT','PROFILE'].includes(type)||!target||target.length>200||!categories.has(category))return Response.json({error:'Invalid report'},{status:400});
  try {
    const sql=await getReadyDb();
    const found=type==='SKILLSHOT'?await sql.query(`SELECT user_id FROM posts WHERE id=$1 AND status='VISIBLE'`,[target])
      :type==='COMMENT'?await sql.query(`SELECT c.user_id FROM comments c JOIN posts p ON p.id=c.post_id WHERE c.id=$1 AND c.status='VISIBLE' AND p.status='VISIBLE'`,[target])
      :await sql.query(`SELECT id user_id FROM users WHERE lower(username)=lower($1) AND status='ACTIVE' AND profile_status='VISIBLE'`,[target]);
    if(!found.length)return Response.json({error:'Item not found'},{status:404});
    if(found[0].user_id===auth.principal.id)return Response.json({error:'You cannot report your own content.'},{status:400});
    const canonical=type==='PROFILE'?String(found[0].user_id):target,id=crypto.randomUUID();
    // Database triggers attach both records to one case and record submission events.
    await sql.transaction([
      sql.query(`INSERT INTO reports(id,reporter_id,target_type,target_id,category,details)VALUES($1,$2,$3,$4,$5,$6)`,[id,auth.principal.id,type,canonical,category,String(body.details||'').slice(0,500)]),
      sql.query(`INSERT INTO moderation_queue(id,source,target_type,target_id,creator_id,category,severity)VALUES($1,'REPORT',$2,$3,$4,$5,'BORDERLINE')`,[crypto.randomUUID(),type,canonical,found[0].user_id,category]),
      sql.query(`INSERT INTO notifications(id,audience,type,title,body)VALUES($1,'STAFF','NEW_REPORT','New report awaiting review',$2)`,[crypto.randomUUID(),`${type}: ${category}`]),
    ]);
    return Response.json({id},{status:201});
  } catch(error) {
    return error&&typeof error==='object'&&'code'in error&&error.code==='23505'
      ?Response.json({error:'You already reported this item.'},{status:409})
      :Response.json({error:'Your report could not be saved. Please try again.'},{status:503});
  }
}
