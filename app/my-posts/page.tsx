import CommunityFeed from '../components/community-feed';
import { requireChatGPTUser } from '../chatgpt-auth';
import CreatorUsername from '../components/creator-username';
import { normalizeRole } from '../../lib/roles';
import { ensureUser } from '../../lib/db';
import PublicNavbar from '../components/public-navbar';

export const dynamic = 'force-dynamic';

export default async function MyPostsPage() {
  const user = await requireChatGPTUser('/my-posts');
  const profile = await ensureUser(user);
  return <main>
    <PublicNavbar returnTo="/my-posts"/>
    <section className="communityHero shell">
      <p className="eyebrow">YOUR SKILLSHOT LIBRARY</p>
      <h1 className="profileWelcome"><CreatorUsername asSpan name={user.displayName} username={String(profile.username)} creatorRank={String(profile.creator_rank||'NEWCOMER')} staffRole={normalizeRole(profile.role)}/>&apos;s posts</h1>
      <p>Every screenshot you publish is collected here, ready to view, share, or download.</p>
    </section>
    <section className="feed communityFeed shell"><CommunityFeed mine /></section>
  </main>;
}
