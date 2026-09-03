import { getReadyDb } from '../../../lib/db';
import { searchFilters } from '../../../lib/search-query';
import { normalizeRole } from '../../../lib/roles';

export async function GET(request:Request) {
  const filter=searchFilters(new URL(request.url).searchParams),limit=filter.suggest?5:12,offset=filter.suggest?0:(filter.page-1)*12;
  try {
    const sql=await getReadyDb();
    const values=[filter.q.toLowerCase(),filter.prefix,filter.tsquery,filter.role,filter.category,filter.skill,filter.tag,filter.sort,limit+1,offset];
    const [people,shots,categories,skills]=await Promise.all([
      filter.type==='shots'?Promise.resolve([]):sql.query(`SELECT u.username,u.display_name,u.skills,u.role,(u.avatar_url IS NOT NULL) has_avatar,
        CASE WHEN lower(u.username)=$1 THEN 100 WHEN lower(u.display_name)=$1 THEN 90 WHEN lower(u.username) LIKE $2 THEN 80 WHEN lower(u.display_name) LIKE $2 THEN 70 ELSE 40 END relevance
        FROM users u WHERE u.status='ACTIVE' AND u.profile_status='VISIBLE'
        AND ($1='' OR lower(u.username) LIKE $2 OR lower(u.display_name) LIKE $2 OR ($3<>'' AND u.search_vector@@to_tsquery('simple',$3)))
        AND (cardinality($4::text[])=0 OR u.role=ANY($4::text[]))
        AND ($6='' OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(u.skills) s WHERE lower(s)=lower($6)))
        AND ($5='' OR EXISTS(SELECT 1 FROM posts p WHERE p.user_id=u.id AND p.status='VISIBLE' AND lower(p.category)=lower($5)))
        AND ($7='' OR EXISTS(SELECT 1 FROM posts p WHERE p.user_id=u.id AND p.status='VISIBLE' AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(p.tags) t WHERE lower(t)=lower($7))))
        ORDER BY CASE WHEN $8='relevance' THEN CASE WHEN lower(u.username)=$1 THEN 100 WHEN lower(u.display_name)=$1 THEN 90 WHEN lower(u.username) LIKE $2 THEN 80 WHEN lower(u.display_name) LIKE $2 THEN 70 ELSE 40 END END DESC,u.created_at DESC,u.id DESC LIMIT $9 OFFSET $10`,values),
      filter.type==='people'?Promise.resolve([]):sql.query(`SELECT p.id,p.title,p.skills,p.category,p.image_width,p.image_height,u.display_name,u.username,u.role,
        (SELECT count(*) FROM reactions r WHERE r.post_id=p.id) likes,
        (SELECT count(*) FROM comments c WHERE c.post_id=p.id AND c.status='VISIBLE') comments,
        CASE WHEN lower(p.title)=$1 THEN 60 WHEN lower(p.title) LIKE $2 THEN 50 WHEN EXISTS(SELECT 1 FROM jsonb_array_elements_text(p.skills) s WHERE lower(s) LIKE $2) THEN 40 WHEN EXISTS(SELECT 1 FROM jsonb_array_elements_text(p.tags) t WHERE lower(t) LIKE $2) THEN 30 ELSE 10 END relevance
        FROM posts p JOIN users u ON u.id=p.user_id WHERE p.status='VISIBLE' AND u.status='ACTIVE' AND u.profile_status='VISIBLE'
        AND ($1='' OR lower(p.title) LIKE $2 OR ($3<>'' AND p.search_vector@@to_tsquery('simple',$3)))
        AND (cardinality($4::text[])=0 OR u.role=ANY($4::text[])) AND ($5='' OR lower(p.category)=lower($5))
        AND ($6='' OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p.skills) s WHERE lower(s)=lower($6)))
        AND ($7='' OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p.tags) t WHERE lower(t)=lower($7)))
        ORDER BY CASE WHEN $8='liked' THEN (SELECT count(*) FROM reactions r WHERE r.post_id=p.id) END DESC,
        CASE WHEN $8='commented' THEN (SELECT count(*) FROM comments c WHERE c.post_id=p.id AND c.status='VISIBLE') END DESC,
        CASE WHEN $8='relevance' THEN CASE WHEN lower(p.title)=$1 THEN 60 WHEN lower(p.title) LIKE $2 THEN 50 WHEN EXISTS(SELECT 1 FROM jsonb_array_elements_text(p.skills) s WHERE lower(s) LIKE $2) THEN 40 WHEN EXISTS(SELECT 1 FROM jsonb_array_elements_text(p.tags) t WHERE lower(t) LIKE $2) THEN 30 ELSE 10 END END DESC,p.created_at DESC,p.id DESC LIMIT $9 OFFSET $10`,values),
      sql.query(`SELECT DISTINCT p.category FROM posts p JOIN users u ON u.id=p.user_id WHERE p.status='VISIBLE' AND u.status='ACTIVE' AND u.profile_status='VISIBLE' AND p.category<>'' ORDER BY p.category LIMIT 60`),
      sql.query(`WITH candidates AS (
        (SELECT p.skills FROM posts p JOIN users u ON u.id=p.user_id WHERE p.status='VISIBLE' AND u.status='ACTIVE' AND u.profile_status='VISIBLE' AND ($1='' OR ($2<>'' AND p.search_vector@@to_tsquery('simple',$2))) ORDER BY p.created_at DESC LIMIT 200)
        UNION ALL (SELECT skills FROM users WHERE status='ACTIVE' AND profile_status='VISIBLE' AND ($1='' OR ($2<>'' AND search_vector@@to_tsquery('simple',$2))) ORDER BY created_at DESC LIMIT 100)
      ) SELECT skill,count(*) count FROM candidates CROSS JOIN LATERAL jsonb_array_elements_text(skills) skill WHERE length(skill)>0 AND ($1='' OR lower(skill) LIKE $3) GROUP BY skill ORDER BY count(*) DESC,skill LIMIT $4`,[filter.q,filter.tsquery,filter.prefix,filter.suggest?5:30]),
    ]);
    return Response.json({people:people.slice(0,limit).map(p=>({...p,role:normalizeRole(p.role),avatarUrl:p.has_avatar?'/api/avatars/'+encodeURIComponent(p.username):''})),shots:shots.slice(0,limit).map(p=>({...p,role:normalizeRole(p.role),imageUrl:'/api/images/'+p.id+'?variant=thumbnail'})),peopleMore:people.length>limit,shotsMore:shots.length>limit,categories:categories.map(c=>c.category),skills:skills.map(s=>s.skill)},{headers:{'Cache-Control':'private, no-cache'}});
  }catch{return Response.json({error:'Search is temporarily unavailable.'},{status:503});}
}
