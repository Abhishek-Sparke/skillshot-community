import {get} from '@vercel/blob';
import {getReadyDb} from '../../../../../lib/db';

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;const rows=await (await getReadyDb()).query(`SELECT image_url,image_type FROM discussions WHERE id=$1 AND status='VISIBLE' AND image_url IS NOT NULL LIMIT 1`,[id]);
 if(!rows.length)return new Response('Image not found',{status:404});
 const result=await get(String(rows[0].image_url),{access:'private'});if(result?.statusCode!==200)return new Response('Image not found',{status:404});
 return new Response(result.stream,{headers:{'Content-Type':String(rows[0].image_type||'application/octet-stream'),'Content-Length':String(result.blob.size),'Cache-Control':'private, max-age=300','X-Content-Type-Options':'nosniff'}});
}
