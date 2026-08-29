import { Suspense } from 'react';
import HomeFresh, { HomeFreshSkeleton } from './components/home-fresh';
import Link from 'next/link';
import AuthNavItems from './components/auth-nav-items';
import { getChatGPTUser } from './chatgpt-auth';
import { signInPath } from '../lib/auth-path';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const signedIn = Boolean(await getChatGPTUser());
  return <main>
    <nav className="nav shell">
      <Link className="brand" href="/"><span>S</span> Skillshot</Link>
      <div className="navlinks">
        <Link href="/community">Community</Link>
        <Link href="/search">Search</Link>
        <AuthNavItems returnTo="/" notifications={false}/>
      </div>
    </nav>

    <section className="hero shell">
      <div>
        <p className="eyebrow">THE PLACE FOR WORK YOU’RE PROUD OF</p>
        <h1>Show your skills.<br/><em>In one shot.</em></h1>
        <p className="lede">Share the screenshots behind your best work, discover how others create, and cheer on the details that deserve attention.</p>
        <div className="heroActions">
          <Link className="primary" href={signedIn ? '/upload' : signInPath('/upload', 'Sign in to share your first Skillshot')}>Share your first shot →</Link>
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
      <Link className="primary" href={signedIn ? '/upload' : signInPath('/upload', 'Sign in to create a Skillshot')}>Create a Skillshot →</Link>
    </div></section>

    <footer className="shell">
      <Link className="brand" href="/"><span>S</span> Skillshot</Link>
      <p>A community for people who make things.</p>
      <div><Link href="/community">Community</Link> · <Link href="/search">Search</Link> · <Link href="/guidelines">Guidelines</Link> · <Link href={signedIn ? '/profile' : signInPath('/')}>{signedIn ? 'Profile' : 'Sign in'}</Link></div>
    </footer>
  </main>;
}
