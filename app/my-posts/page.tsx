import CommunityFeed from '../components/community-feed';
import { requireChatGPTUser } from '../chatgpt-auth';

export const dynamic = 'force-dynamic';

export default async function MyPostsPage() {
  const user = await requireChatGPTUser('/my-posts');
  return <main>
    <nav className="nav shell">
      <a className="brand" href="/"><span>S</span> Skillshot</a>
      <div className="navlinks"><a href="/community">Community</a><a href="/profile">Profile</a><a className="upload" href="/upload">＋ Share a shot</a></div>
    </nav>
    <section className="communityHero shell">
      <p className="eyebrow">YOUR SKILLSHOT LIBRARY</p>
      <h1>{user.displayName}&apos;s posts</h1>
      <p>Every screenshot you publish is collected here, ready to view, share, or download.</p>
    </section>
    <section className="feed communityFeed shell"><CommunityFeed mine /></section>
  </main>;
}
