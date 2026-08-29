import { Suspense } from 'react';
import HomeFresh, { HomeFreshSkeleton } from './components/home-fresh';
import Link from 'next/link';
import StaffDashboardLink from './components/staff-dashboard-link';

export const dynamic = 'force-dynamic';

export default function Home() {
  return <main>
    <nav className="nav shell">
      <Link className="brand" href="/"><span>S</span> Skillshot</Link>
      <div className="navlinks">
        <Link href="/community">Community</Link>
        <Link href="/search">Search</Link>
        <Link href="/my-posts">My posts</Link>
        <Link href="/profile">Profile</Link>
        <StaffDashboardLink/>
        <Link className="upload" href="/upload">＋ Share a shot</Link>
      </div>
    </nav>

    <section className="hero shell">
      <div>
        <p className="eyebrow">THE PLACE FOR WORK YOU’RE PROUD OF</p>
        <h1>Show your skills.<br/><em>In one shot.</em></h1>
        <p className="lede">Share the screenshots behind your best work, discover how others create, and cheer on the details that deserve attention.</p>
        <div className="heroActions">
          <Link className="primary" href="/upload">Share your first shot →</Link>
          <Link href="/community">Explore the community</Link>
        </div>
      </div>
      <div className="heroCard">
        <div className="miniTop"><span>● ● ●</span><small>STUDIO NOTES</small></div>
        <div className="miniCanvas"><b>Make it useful.</b><span>Then make it beautiful.</span><i>↗</i></div>
        <div className="floating">✦ Made to be shared</div>
      </div>
    </section>

    <section className="feed shell" id="explore">
      <div className="sectionHead">
        <div><p className="eyebrow">FRESH FROM THE COMMUNITY</p><h2>Real work, shared by creators.</h2></div>
        <Link className="textLink" href="/community">See the full community →</Link>
      </div>
      <Suspense fallback={<HomeFreshSkeleton/>}><HomeFresh/></Suspense>
    </section>

    <section className="cta"><div>
      <span className="spark">✦</span>
      <p className="eyebrow">YOUR WORK BELONGS HERE</p>
      <h2>Made something good lately?</h2>
      <p>Share the process, the polish, or the tiny detail you finally got right.</p>
      <Link className="primary" href="/upload">Upload a screenshot →</Link>
    </div></section>

    <footer className="shell">
      <Link className="brand" href="/"><span>S</span> Skillshot</Link>
      <p>A community for people who make things.</p>
      <div><Link href="/community">Community</Link> · <Link href="/search">Search</Link> · <Link href="/guidelines">Guidelines</Link> · <Link href="/my-posts">My posts</Link> · <Link href="/profile">Profile</Link></div>
    </footer>
  </main>;
}
