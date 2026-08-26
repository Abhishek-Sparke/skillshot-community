import CommunityFeed from '../components/community-feed';

export const dynamic = 'force-dynamic';

export default function CommunityPage() {
  return <main>
    <nav className="nav shell">
      <a className="brand" href="/"><span>S</span> Skillshot</a>
      <div className="navlinks"><a href="/my-posts">My posts</a><a href="/profile">Profile</a><a className="upload" href="/upload">＋ Share a shot</a></div>
    </nav>
    <section className="communityHero shell">
      <p className="eyebrow">EXPLORE SKILLSHOT</p>
      <h1>See what the community is making.</h1>
      <p>Browse real screenshots shared by designers, developers, artists, and makers. Open any shot to react, comment, or download it.</p>
    </section>
    <section className="feed communityFeed shell"><CommunityFeed /></section>
  </main>;
}

