import CommunityFeed from '../components/community-feed';
import PublicNavbar from '../components/public-navbar';

export const dynamic = 'force-dynamic';

export default function CommunityPage() {
  return <main>
    <PublicNavbar returnTo="/community"/>
    <section className="communityHero shell">
      <p className="eyebrow">EXPLORE SKILLSHOT</p>
      <h1>See what the community is making.</h1>
      <p>Browse real screenshots shared by designers, developers, artists, and makers. Open any shot to react, comment, or download it.</p>
    </section>
    <section className="feed communityFeed shell"><CommunityFeed /></section>
  </main>;
}
