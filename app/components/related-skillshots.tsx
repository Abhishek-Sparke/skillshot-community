import Link from 'next/link';
import { relatedPosts } from '../../lib/related-posts';
import { normalizeRole } from '../../lib/roles';
import CreatorUsername from './creator-username';
export default async function RelatedSkillshots({id}:{id:string}){
  let rows;try{rows=await relatedPosts(id);}catch{return null;}
  if(!rows.length)return null;
  return <section className="relatedSkillshots shell" aria-labelledby="related-title"><div className="sectionHead"><div><p className="eyebrow">MORE FROM THE COMMUNITY</p><h2 id="related-title">Keep discovering.</h2></div><Link className="textLink" href="/community">See more →</Link></div><div className="masonryGrid">{rows.map(row=><article className="post discoveryCard relatedCard" key={String(row.id)}><Link className="relatedImage" href={`/shots/${row.id}`} aria-label={`View ${row.title}`}><img src={`/api/images/${row.id}?variant=thumbnail`} alt={String(row.title)} width={Number(row.image_width)||640} height={Number(row.image_height)||480} loading="lazy" decoding="async"/></Link><div className="relatedMeta"><Link className="relatedCreator" href={`/users/${encodeURIComponent(String(row.username))}`}>{row.avatar_url?<img src={`/api/avatars/${encodeURIComponent(String(row.username))}`} alt="" width={28} height={28} loading="lazy"/>:<span aria-hidden="true">{String(row.display_name).slice(0,1)}</span>}</Link><CreatorUsername name={String(row.display_name)} username={String(row.username)} creatorRank={String(row.creator_rank||'NEWCOMER')} staffRole={normalizeRole(row.role)}/><h3><Link href={`/shots/${row.id}`}>{String(row.title)}</Link></h3></div></article>)}</div><p>Continue discovering Skillshot.</p></section>;
}
