import { requirePrincipal } from '../../../lib/authz';
import { getReadyDb } from '../../../lib/db';
import { rateLimit } from '../../../lib/rate-limit';
export async function POST(request:Request){
  const auth=await requirePrincipal();if('error'in auth)return auth.error;
  if(!await rateLimit(`support:${auth.principal.id}`,4,86400))return Response.json({error:'You have reached today’s support request limit. Please try again tomorrow.'},{status:429});
  let body;try{body=await request.json();}catch{return Response.json({error:'Invalid request.'},{status:400});}
  if(!body||typeof body!=='object'||Array.isArray(body))return Response.json({error:'Invalid request.'},{status:400});
  const category=String(body.category||''),subject=String(body.subject||'').trim(),message=String(body.message||'').trim();
  if(!['Bug','Upload problem','Profile problem','Comment problem','Login/account problem','Report/moderation problem','Other','Account deletion'].includes(category)||subject.length<4||subject.length>100||message.length<20||message.length>1500)return Response.json({error:'Choose a category and add a subject and a message of 20–1,500 characters.'},{status:400});
  if(category==='Account deletion'&&body.confirmation!=='DELETE MY ACCOUNT')return Response.json({error:'Type DELETE MY ACCOUNT to confirm your request.'},{status:400});
  try{
    const sql=await getReadyDb(),id=crypto.randomUUID();
    // Reuse the staff review inbox. A support ticket never targets or mutates content.
    await sql.transaction([
      sql.query(`INSERT INTO appeals(id,user_id,target_type,target_id,reason,explanation)VALUES($1,$2,'SUPPORT',$1,$3,$4)`,[id,auth.principal.id,`${category}: ${subject}`,message]),
      sql.query(`INSERT INTO audit_logs(id,actor_id,action,target_type,target_id)VALUES($1,$2,'SUPPORT_SUBMITTED','SUPPORT',$3)`,[crypto.randomUUID(),auth.principal.id,id]),
      sql.query(`INSERT INTO notifications(id,audience,type,title,body)VALUES($1,'STAFF','SUPPORT','New support request',$2)`,[crypto.randomUUID(),category]),
    ]);
    return Response.json({id,message:'Thanks — your report has been submitted.'},{status:201});
  }catch{return Response.json({error:'Support is temporarily unavailable. Please try again.'},{status:503});}
}
