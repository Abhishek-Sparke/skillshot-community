import CommunityFeed from '../components/community-feed';
import PublicNavbar from '../components/public-navbar';

export const dynamic = 'force-dynamic';

export default function CommunityPage() {
  return <main>
    <PublicNavbar returnTo="/community"/>
    <section className="communityHero shell">
      <h1>Community</h1>
      <p>Discover work from the Skillshot community.</p>
    </section>
    <section className="feed communityFeed shell"><CommunityFeed /></section>
  </main>;
}
