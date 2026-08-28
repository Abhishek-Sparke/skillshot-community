import CommunityFeed from '../components/community-feed';
import { requireChatGPTUser } from '../chatgpt-auth';
import RoleBadge from '../components/role-badge';
import { normalizeRole } from '../../lib/roles';
import { ensureUser } from '../../lib/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function MyPostsPage() {
  const user = await requireChatGPTUser('/my-posts');
  const profile = await ensureUser(user);
  return <main>
    <nav className="nav shell">
      <Link className="brand" href="/"><span>S</span> Skillshot</Link>
      <div className="navlinks"><Link href="/community">Community</Link><Link href="/profile">Profile</Link><Link className="upload" href="/upload">＋ Share a shot</Link></div>
    </nav>
    <section className="communityHero shell">
      <p className="eyebrow">YOUR SKILLSHOT LIBRARY</p>
      <h1 className="profileWelcome">{user.displayName}&apos;s posts <RoleBadge role={normalizeRole(profile.role)} /></h1>
      <p>Every screenshot you publish is collected here, ready to view, share, or download.</p>
    </section>
    <section className="feed communityFeed shell"><CommunityFeed mine /></section>
  </main>;
}
