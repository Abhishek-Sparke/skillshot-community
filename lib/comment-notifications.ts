import { getReadyDb } from './db';
export function mentionedNames(body:string){return [...new Set(Array.from(body.matchAll(/(?:^|\s)@([a-z0-9][a-z0-9_-]{1,29})\b/gi),match=>match[1].toLowerCase()))].slice(0,10);}
export async function notifyComment(postId:string,commentId:string,authorId:string,authorName:string,body:string,parentAuthor?:string){
  const sql=await getReadyDb();
  // Resolve names in the database; never accept client-provided recipient IDs.
  await sql.query(`WITH recipients AS(
    SELECT id,
      CASE
        WHEN id=$4 THEN 'COMMENT_REPLY'
        WHEN lower(username)=ANY($5::text[]) THEN 'MENTION'
        ELSE 'COMMENT'
      END type,
      CASE
        WHEN id=$4 THEN $6 || ' replied to your comment'
        WHEN lower(username)=ANY($5::text[]) THEN $6 || ' mentioned you on a Skillshot'
        ELSE $6 || ' commented on your Skillshot'
      END notif_title
    FROM users WHERE status='ACTIVE' AND id<>$1 AND (id=$4 OR lower(username)=ANY($5::text[]) OR id=(SELECT user_id FROM posts WHERE id=$2))
  ) INSERT INTO notifications(id,user_id,actor_id,category,type,title,body,event_key,target_url,target_id,thumbnail_url)
    SELECT gen_random_uuid()::text,r.id,$1,'post',r.type,r.notif_title,$7,$3||':'||r.id,'/shots/'||$2||'#comment-'||$3,$2,(SELECT thumbnail_url FROM posts WHERE id=$2)
    FROM recipients r ON CONFLICT DO NOTHING`,[authorId,postId,commentId,parentAuthor||'',mentionedNames(body),authorName,body.slice(0,160)]);
}
