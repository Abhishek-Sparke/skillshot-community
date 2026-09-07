import { getReadyDb } from './db';
export async function relatedPosts(id:string){
  return(await getReadyDb()).query(`WITH current AS(SELECT p.* FROM posts p JOIN users u ON u.id=p.user_id WHERE p.id=$1 AND p.status='VISIBLE' AND u.status='ACTIVE'),
    ranked AS(SELECT p.id,p.title,p.image_width,p.image_height,p.created_at,u.username,u.display_name,u.role,u.creator_rank,u.avatar_url,
      (SELECT count(*) FROM jsonb_array_elements_text(p.skills||p.tags) candidate WHERE lower(candidate)=ANY(SELECT lower(value) FROM jsonb_array_elements_text(c.skills||c.tags) value)) shared,
      (p.category=c.category)::int category_match,(p.image_type=c.image_type)::int type_match,(p.user_id=c.user_id)::int creator_match,
      (SELECT count(*) FROM reactions r WHERE r.post_id=p.id) likes
    FROM current c JOIN posts p ON p.id<>c.id JOIN users u ON u.id=p.user_id WHERE p.status='VISIBLE' AND u.status='ACTIVE' AND u.profile_status='VISIBLE')
    SELECT * FROM ranked ORDER BY shared DESC,category_match DESC,type_match DESC,creator_match DESC,created_at DESC,likes DESC,id DESC LIMIT 6`,[id]);
}
