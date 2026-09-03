import { getReadyDb } from './db';
import { safeStoredSocialLinks } from './social-links';
type Row = Record<string, unknown>;
export type ReviewContent = {kind:string;profile?:Row;post?:Row;comment?:Row;recent?:Row[];context?:Row[];contextTruncated?:boolean};

export async function findCase(id:string) {
  const rows=await(await getReadyDb()).query(`SELECT c.*,u.username assigned_username FROM report_cases c LEFT JOIN users u ON u.id=c.assigned_to WHERE c.id=$1 OR EXISTS(SELECT 1 FROM reports r WHERE r.id=$1 AND r.case_id=c.id) OR EXISTS(SELECT 1 FROM moderation_queue q WHERE q.id=$1 AND q.case_id=c.id) LIMIT 1`,[id]);
  return rows[0];
}
export async function caseContent(type:string,id:string):Promise<ReviewContent|null> {
  const sql=await getReadyDb();
  if(type==='PROFILE') {
    const rows=await sql.query(`SELECT id,username,display_name,bio,location,skills,website,social_links,role,status,profile_status,created_at,(avatar_url IS NOT NULL) has_avatar FROM users WHERE id=$1`,[id]);
    if(!rows.length)return null;
    const profile=rows[0];
    profile.social_links=safeStoredSocialLinks(profile.social_links);
    try { const url=new URL(String(profile.website));profile.website=['https:','http:'].includes(url.protocol)?url.toString():'';}catch{profile.website='';}
    const recent=await sql.query(`SELECT id,title,status FROM posts WHERE user_id=$1 AND status='VISIBLE' ORDER BY created_at DESC LIMIT 6`,[id]);
    return {kind:type,profile,recent};
  }
  if(type==='SKILLSHOT') {
    const rows=await sql.query(`SELECT p.id,p.title,p.description,p.category,p.skills,p.status,p.created_at,p.image_width,p.image_height,u.id creator_id,u.username,u.display_name,u.role,u.status author_status FROM posts p JOIN users u ON u.id=p.user_id WHERE p.id=$1`,[id]);
    return rows.length?{kind:type,post:rows[0]}:null;
  }
  const rows=await sql.query(`SELECT c.id,c.body,c.status,c.created_at,c.parent_id,c.post_id,u.id creator_id,u.username,u.display_name,u.role FROM comments c JOIN users u ON u.id=c.user_id WHERE c.id=$1`,[id]);
  if(!rows.length)return null;
  const comment=rows[0];
  const post=await sql.query(`SELECT p.id,p.title,p.status,u.username,u.status author_status FROM posts p JOIN users u ON u.id=p.user_id WHERE p.id=$1`,[comment.post_id]);
  const context=await sql.query(`SELECT c.id,c.body,c.status,c.parent_id,c.created_at,u.username FROM comments c JOIN users u ON u.id=c.user_id WHERE c.post_id=$1 AND (c.id=$2 OR c.parent_id=$3) ORDER BY (c.id=$2) DESC,c.created_at LIMIT 21`,[comment.post_id,comment.parent_id||'',id]);
  return {kind:comment.parent_id?'REPLY':'COMMENT',comment,post:post[0]||null,context:context.slice(0,20),contextTruncated:context.length>20};
}
