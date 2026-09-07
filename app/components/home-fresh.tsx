import Link from 'next/link';
import { getReadyDb } from '../../lib/db';
import { normalizeRole } from '../../lib/roles';
import CreatorUsername from './creator-username';

export function HomeFreshSkeleton() {
  return <div className="feedSkeleton" aria-label="Loading newest Skillshots" aria-live="polite">{[0,1,2].map(item => <span key={item} className="skeletonCard"><i/><b/><small/></span>)}</div>;
}
export default async function HomeFresh() {
  const sql = await getReadyDb();
  const rows = await sql.query(`SELECT p.id,p.title,p.category,p.image_width,p.image_height,u.display_name,u.username,u.role,u.creator_rank,u.avatar_url,(SELECT count(*) FROM reactions r WHERE r.post_id=p.id) reaction_count,(SELECT count(*) FROM comments c WHERE c.post_id=p.id AND c.status='VISIBLE') comment_count FROM posts p JOIN users u ON u.id=p.user_id WHERE p.status='VISIBLE' AND u.status='ACTIVE' ORDER BY p.created_at DESC LIMIT 3`);
  if (!rows.length) return <div className="emptyFeed"><span>✦</span><h3>Be the first to share something you’re proud of.</h3><Link className="primary" href="/upload">Create a Skillshot</Link></div>;
  return <div className="homeFreshGrid">{rows.map((row, index) => {
    const id = String(row.id), name = String(row.display_name);
    const profile = '/users/' + encodeURIComponent(String(row.username));
    return <article className="homeFreshCard" key={id} style={{ animationDelay: `${index * 40}ms` }}>
      <div className="homeFreshMedia" style={{ aspectRatio: row.image_width && row.image_height ? `${row.image_width} / ${row.image_height}` : undefined }}>
        <Link className="homeFreshImage" href={'/shots/'+id} aria-label={'View '+String(row.title)}>
          <img src={'/api/images/'+id+'?variant=thumbnail'} alt={String(row.title)} loading="lazy" decoding="async" width={Number(row.image_width)||640} height={Number(row.image_height)||480} sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 33vw"/>
        </Link>
        <Link className="postAvatar" href={profile} aria-label={"View "+name+"'s profile"}><span>{name.slice(0,1).toUpperCase()}</span>{row.avatar_url&&<img src={'/api/avatars/'+encodeURIComponent(String(row.username))+'?v='+encodeURIComponent(String(row.avatar_url))} alt="" loading="lazy"/>}</Link>
      </div>
      <div className="homeFreshMeta">
        <div className="authorName"><CreatorUsername name={name} username={String(row.username)} creatorRank={String(row.creator_rank||'NEWCOMER')} staffRole={normalizeRole(row.role)}/></div>
        <h3><Link href={'/shots/'+id}>{String(row.title)}</Link></h3>
        <div className="homeFreshFooter"><span>{String(row.category||'')}</span><div>
          <Link href={'/shots/'+id} aria-label={String(row.reaction_count)+' likes on '+String(row.title)}>♡ {Number(row.reaction_count)}</Link>
          <Link href={'/shots/'+id+'#comments'} aria-label={String(row.comment_count)+' comments on '+String(row.title)}>◌ {Number(row.comment_count)}</Link>
        </div></div>
      </div>
    </article>;
  })}</div>;
}
