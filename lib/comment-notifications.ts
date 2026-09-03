import { getReadyDb } from './db';
export function mentionedNames(body:string){return [...new Set(Array.from(body.matchAll(/(?:^|\s)@([a-z0-9][a-z0-9_-]{1,29})\b/gi),match=>match[1].toLowerCase()))].slice(0,10);}
export async function notifyComment(postId:string,commentId:string,authorId:string,authorName:string,body:string,parentAuthor?:string){
  const sql=await getReadyDb();
  // Resolve names in the database; never accept client-provided recipient IDs.
  await sql.query(`WITH recipients AS(
    SELECT id,CASE WHEN id=$4 THEN 'COMMENT_REPLY' WHEN lower(username)=ANY($5::text[]) THEN 'MENTION' ELSE 'COMMENT' END type
    FROM users WHERE status='ACTIVE' AND id<>$1 AND (id=$4 OR lower(username)=ANY($5::text[]) OR id=(SELECT user_id FROM posts WHERE id=$2))
  ) INSERT INTO notifications(id,user_id,type,title,body,event_key)
    SELECT gen_random_uuid()::text,id,type,$6,$7,$3||':'||id FROM recipients ON CONFLICT DO NOTHING`,[authorId,postId,commentId,parentAuthor||'',mentionedNames(body),`${authorName} joined the conversation.`,body.slice(0,160)]);
}
