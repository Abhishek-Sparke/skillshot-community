import PublicNavbar from '../components/public-navbar';
import SideIconRail from '../components/side-icon-rail';
import CommunityFeed from '../components/community-feed';

export const dynamic = 'force-dynamic';

export default function CommunityPage() {
  return (
    <main style={{ position: 'relative', overflowX: 'clip' }}>
      <PublicNavbar returnTo="/community" />
      {/* Infinite Side Visual Animation Rails */}
      <SideIconRail side="left" />
      <SideIconRail side="right" />

      <header className="communityDiscoveryHeader shell">
        <p className="eyebrow">COMMUNITY</p>
        <h1>Discover what creators are making.</h1>
        <p>Explore Skillshots from gaming, development, design, photography, art and more.</p>
      </header>
      <section className="feed communityFeed shell" aria-label="Community Skillshots"><CommunityFeed /></section>
    </main>
  );
}
