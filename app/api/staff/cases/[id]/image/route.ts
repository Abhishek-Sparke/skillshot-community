import { get } from '@vercel/blob';
import { requirePrincipal } from '../../../../../../lib/authz';
import { getReadyDb } from '../../../../../../lib/db';
import { findCase } from '../../../../../../lib/report-case-data';
import { canViewCase } from '../../../../../../lib/report-case-policy';
import { imageDelivery } from '../../../../../../lib/image-delivery';

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
  const auth=await requirePrincipal('reports.view');if('error'in auth)return auth.error;
  if(!canViewCase(auth.principal,'PROFILE'))return new Response('Forbidden',{status:403});
  try {
    const item=await findCase((await params).id);if(!item)return new Response('Not found',{status:404});
    if(!canViewCase(auth.principal,item.target_type))return new Response('Forbidden',{status:403});
    const sql=await getReadyDb();let pathname:string,type:string;
    if(item.target_type==='PROFILE') {
      const rows=await sql.query(`SELECT avatar_url,avatar_type FROM users WHERE id=$1`,[item.target_id]);
      if(!rows[0]?.avatar_url)return new Response('Current profile image unavailable',{status:404});
      pathname=String(rows[0].avatar_url);type=String(rows[0].avatar_type||'image/webp');
    } else {
      const rows=await sql.query(`SELECT p.image_url,p.image_type,p.display_url,p.thumbnail_url FROM posts p
        WHERE p.id=CASE WHEN $2='COMMENT' THEN (SELECT post_id FROM comments WHERE id=$1) ELSE $1 END AND p.status NOT IN ('PURGING','PURGED')`,[item.target_id,item.target_type]);
      if(!rows.length)return new Response('Image no longer retained',{status:404});
      const original=new URL(request.url).searchParams.get('variant')==='original';
      const selected=imageDelivery(rows[0] as {image_url:unknown;image_type:unknown;display_url?:unknown;thumbnail_url?:unknown},original?null:'display',original);
      pathname=String(selected.pathname);type=selected.type;
    }
    const result=await get(pathname,{access:'private'});
    if(result?.statusCode!==200)return new Response('Image unavailable',{status:404});
    return new Response(result.stream,{headers:{'Content-Type':['image/png','image/jpeg','image/webp','image/gif'].includes(type)?type:'application/octet-stream','Content-Length':String(result.blob.size),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':'inline'}});
  }catch{return new Response('Image temporarily unavailable',{status:503});}
}
