import Link from 'next/link';
import { getReadyDb } from '../../lib/db';
import RoleBadge from '../components/role-badge';
import { normalizeRole } from '../../lib/roles';
import PublicNavbar from '../components/public-navbar';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; tag?: string }> }) {
  const params = await searchParams;
  const q = (params.q || '').trim().slice(0, 80);
  const tag = (params.tag || '').trim().slice(0, 40);
  const sql = await getReadyDb();
  const [posts, users] = await Promise.all([
    sql.query(`SELECT p.id,p.title,p.description,p.tags,p.created_at,p.image_width,p.image_height,u.display_name,u.username,u.role FROM posts p JOIN users u ON u.id=p.user_id WHERE p.status='VISIBLE' AND u.status='ACTIVE' AND ($1='' OR p.title ILIKE $2 OR p.description ILIKE $2 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p.tags) t WHERE t ILIKE $2)) AND ($3='' OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p.tags) t WHERE lower(t)=lower($3))) ORDER BY p.created_at DESC LIMIT 30`, [q, `%${q}%`, tag]),
    q ? sql.query(`SELECT display_name,username,bio,role,avatar_url FROM users WHERE status='ACTIVE' AND (display_name ILIKE $1 OR username ILIKE $1 OR bio ILIKE $1) ORDER BY created_at DESC LIMIT 12`, [`%${q}%`]) : Promise.resolve([]),
  ]);
  const returnTo = q ? `/search?q=${encodeURIComponent(q)}` : tag ? `/search?tag=${encodeURIComponent(tag)}` : '/search';
  return <main>
    <PublicNavbar returnTo={returnTo}/>
    <section className="searchPage shell"><header><p className="eyebrow">DISCOVER</p><h1>Search Skillshot</h1><form><input name="q" defaultValue={q} placeholder="Search creators, titles, descriptions, or tags"/><button className="primary">Search</button></form></header>
      {users.length > 0 && <section><h2>Creators</h2><div className="creatorResults">{users.map(user => <Link href={`/users/${user.username}`} key={user.username}><span>{String(user.display_name).slice(0, 1).toUpperCase()}</span><div><b>{user.display_name} <RoleBadge role={normalizeRole(user.role)}/></b><small>@{user.username}</small></div></Link>)}</div></section>}
      <section><h2>{tag ? `#${tag}` : q ? 'Skillshots' : 'Newest Skillshots'}</h2><div className="searchResults masonryGrid">{posts.map(post => <article key={post.id}><Link className="searchImage" style={{aspectRatio:`${Number(post.image_width)||4}/${Number(post.image_height)||3}`}} href={`/shots/${post.id}`}><img src={`/api/images/${post.id}?variant=thumbnail`} loading="lazy" decoding="async" width={Number(post.image_width)||640} height={Number(post.image_height)||480} sizes="(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 33vw" alt={post.title}/></Link><div><h3><Link href={`/shots/${post.id}`}>{post.title}</Link></h3><p><Link href={`/users/${post.username}`}>{post.display_name}</Link> <RoleBadge role={normalizeRole(post.role)}/></p><div className="detailTags">{(Array.isArray(post.tags) ? post.tags : []).map((value: string) => <Link key={value} href={`/search?tag=${encodeURIComponent(value)}`}>#{value}</Link>)}</div></div></article>)}</div>{posts.length === 0 && <div className="profileEmpty"><h3>No matching Skillshots.</h3><p>Try a broader word or browse the full community.</p><Link className="primary" href="/community">Browse community</Link></div>}</section>
    </section>
  </main>;
}
