import { getReadyDb } from '../../lib/db';
import { normalizeRole } from '../../lib/roles';
import RoleBadge from './role-badge';

export function HomeFreshSkeleton() {
  return <div className="feedSkeleton" aria-label="Loading newest Skillshots" aria-live="polite">{[0,1,2].map(item => <span key={item} className="skeletonCard"><i/><b/><small/></span>)}</div>;
}
export default async function HomeFresh() {
  const sql = await getReadyDb();
  const rows = await sql.query(`SELECT p.id,p.title,p.tags,u.display_name,u.username,u.role,u.avatar_url,(SELECT count(*) FROM reactions r WHERE r.post_id=p.id) reaction_count FROM posts p JOIN users u ON u.id=p.user_id WHERE p.status='VISIBLE' AND u.status='ACTIVE' ORDER BY p.created_at DESC LIMIT 3`);
  if (!rows.length) return <div className="emptyFeed"><span>✦</span><h3>Have something you’re proud of?</h3><p>Share it with the Skillshot community.</p><a className="primary" href="/upload">Create your first Skillshot →</a></div>;
  return <div className="grid homeFreshGrid">{rows.map(row => <article className="post" key={String(row.id)}><div className="shot uploadedShot"><a className="shotMediaLink" href={`/shots/${row.id}`}><img src={`/api/images/${row.id}?variant=thumbnail`} alt={String(row.title)} loading="lazy" width="640" height="420"/></a></div><div className="meta"><div className="postIdentity"><a className="postTitle" href={`/shots/${row.id}`}>{String(row.title)}</a><small className="authorBlock"><span className="authorName"><a href={`/users/${encodeURIComponent(String(row.username))}`}>{String(row.display_name)}</a><RoleBadge role={normalizeRole(row.role)}/></span><a className="authorHandle" href={`/users/${encodeURIComponent(String(row.username))}`}>@{String(row.username)}</a></small></div><div className="tags">{(Array.isArray(row.tags)?row.tags:[]).slice(0,2).map(String).map(tag=><span key={tag}>{tag}</span>)}<span className="postStat">♥ {Number(row.reaction_count)}</span></div></div></article>)}</div>;
}
