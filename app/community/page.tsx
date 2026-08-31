import CommunityFeed from '../components/community-feed';
import Link from 'next/link';
import AuthNavItems from '../components/auth-nav-items';

export const dynamic = 'force-dynamic';

export default function CommunityPage() {
  return <main>
    <nav className="nav shell">
      <Link className="brand" href="/"><span>S</span> Skillshot</Link>
      <div className="navlinks"><Link href="/search">Search</Link><AuthNavItems returnTo="/community"/></div>
    </nav>
    <section className="communityHero shell">
      <p className="eyebrow">EXPLORE SKILLSHOT</p>
      <h1>See what the community is making.</h1>
      <p>Browse real screenshots shared by designers, developers, artists, and makers. Open any shot to react, comment, or download it.</p>
    </section>
    <section className="feed communityFeed shell"><CommunityFeed /></section>
  </main>;
}
