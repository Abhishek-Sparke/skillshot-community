import CommunityFeed from '../components/community-feed';
import PublicNavbar from '../components/public-navbar';
import SideIconRail from '../components/side-icon-rail';

export const dynamic = 'force-dynamic';

export default function CommunityPage() {
  return <main style={{ position: 'relative', overflowX: 'clip' }}>
    <PublicNavbar returnTo="/community"/>
    {/* Infinite Side Visual Animation Rails */}
    <SideIconRail side="left" />
    <SideIconRail side="right" />
    <section className="communityHero shell">
      <h1>Community</h1>
      <p>Discover work from the Skillshot community.</p>
    </section>
    <section className="feed communityFeed shell"><CommunityFeed /></section>
  </main>;
}
