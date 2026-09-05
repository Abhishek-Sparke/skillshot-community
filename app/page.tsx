import { Suspense } from 'react';
import HomeFresh, { HomeFreshSkeleton } from './components/home-fresh';
import Link from 'next/link';
import PublicNavbar from './components/public-navbar';
import DesktopSideAnimations, { type SideShotItem } from './components/desktop-side-animations';
import { getChatGPTUser } from './chatgpt-auth';
import { signInPath } from '../lib/auth-path';
import { getReadyDb } from '../lib/db';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const signedIn = Boolean(await getChatGPTUser());
  let sideShots: SideShotItem[] = [];
  try {
    if (process.env.DATABASE_URL) {
      const sql = await getReadyDb();
      const rows = await sql.query(`
        SELECT p.id, p.title, p.category, p.image_width, p.image_height, u.display_name, u.username
        FROM posts p
        JOIN users u ON u.id = p.user_id
        WHERE p.status = 'VISIBLE' AND u.status = 'ACTIVE'
        ORDER BY p.created_at DESC
        LIMIT 6
      `);
      sideShots = rows.map((r: Record<string, unknown>) => ({
        id: String(r.id),
        title: String(r.title || 'Untitled Skillshot'),
        category: String(r.category || 'Creative'),
        displayName: String(r.display_name || 'Creator'),
        imageWidth: Number(r.image_width) || 640,
        imageHeight: Number(r.image_height) || 480,
      }));
    }
  } catch {
    sideShots = [];
  }
  return <main style={{ position: 'relative', overflowX: 'clip' }}>
    <PublicNavbar returnTo="/"/>
    <DesktopSideAnimations initialShots={sideShots}/>

    <section className="hero shell">
      <div className="heroEditorial">
        <p className="eyebrow">THE PLACE FOR WORK YOU&apos;RE PROUD OF</p>
        <h1>Show your skills.<br/>In one shot.</h1>
        <p className="lede">Share the work you&apos;re proud of.</p>
        <div className="heroActions">
          <Link className="primary" href={signedIn ? '/upload' : signInPath('/upload', 'Sign in to share a Skillshot')}>Share a Skillshot</Link>
          <Link className="secondary" href="/community">Explore Community</Link>
        </div>
      </div>
    </section>

    <section className="feed shell" id="explore">
      <div className="sectionHead">
        <div>
          <p className="eyebrow">FRESH FROM THE COMMUNITY</p>
          <h2>Real work, shared by creators.</h2>
        </div>
        <Link className="textLink" href="/community">See what the community is creating →</Link>
      </div>
      <Suspense fallback={<HomeFreshSkeleton/>}><HomeFresh/></Suspense>
      
      <div className="communityExploreBanner">
        <div>
          <p className="eyebrow">SEE WHAT THE COMMUNITY IS CREATING</p>
          <h3>Discover inspiring creative work, animations, games and designs.</h3>
        </div>
        <Link className="primary" href="/community">Explore Community →</Link>
      </div>
    </section>

    <footer className="shell siteFooter">
      <div className="footerTop">
        <div>
          <Link className="brand" href="/"><span>S</span> Skillshot</Link>
          <p className="footerDescription">An elegant creative community for people who make things.</p>
        </div>
        <nav className="footerNav" aria-label="Footer navigation">
          <Link href="/community">Community</Link>
          <Link href="/search">Search</Link>
          <Link href="/guidelines">Guidelines</Link>
          <Link href="/help">Help</Link>
          <Link href="/about">About</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href={signedIn ? '/profile' : signInPath('/')}>{signedIn ? 'Profile' : 'Sign in'}</Link>
        </nav>
      </div>
      <div className="footerBottom">
        <small>© {new Date().getFullYear()} Skillshot. All rights reserved.</small>
      </div>
    </footer>
  </main>;
}
