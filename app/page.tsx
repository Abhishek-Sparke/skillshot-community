import { Suspense } from 'react';
import HomeFresh, { HomeFreshSkeleton } from './components/home-fresh';
import Link from 'next/link';
import PublicNavbar from './components/public-navbar';
import { getChatGPTUser } from './chatgpt-auth';
import { signInPath } from '../lib/auth-path';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const signedIn = Boolean(await getChatGPTUser());
  return <main>
    <PublicNavbar returnTo="/"/>

    <section className="hero shell">
      <div>
        <p className="eyebrow">SKILLSHOT</p>
        <h1>Show your skills.<br/><em>In one shot.</em></h1>
        <p className="lede">Share the work you&apos;re proud of.</p>
        <div className="heroActions">
          <Link className="primary" href={signedIn ? '/upload' : signInPath('/upload', 'Sign in to share a Skillshot')}>Share a Skillshot</Link>
          <Link href="/community">Explore Community</Link>
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

    <footer className="shell">
      <Link className="brand" href="/"><span>S</span> Skillshot</Link>
      <p>A community for people who make things.</p>
      <div><Link href="/community">Community</Link> · <Link href="/search">Search</Link> · <Link href="/guidelines">Guidelines</Link> · <Link href="/help">Help</Link> · <Link href="/about">About</Link> · <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link> · <Link href={signedIn ? '/profile' : signInPath('/')}>{signedIn ? 'Profile' : 'Sign in'}</Link></div>
    </footer>
  </main>;
}
