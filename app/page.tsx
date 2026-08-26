import CommunityFeed from './components/community-feed';

export default function Home() {
  return <main>
    <nav className="nav shell">
      <a className="brand" href="/"><span>S</span> Skillshot</a>
      <div className="navlinks">
        <a href="/community">Community</a>
        <a href="/my-posts">My posts</a>
        <a href="/profile">Profile</a>
        <a className="upload" href="/upload">＋ Share a shot</a>
      </div>
    </nav>

    <section className="hero shell">
      <div>
        <p className="eyebrow">THE PLACE FOR WORK YOU’RE PROUD OF</p>
        <h1>Show your skills.<br/><em>In one shot.</em></h1>
        <p className="lede">Share the screenshots behind your best work, discover how others create, and cheer on the details that deserve attention.</p>
        <div className="heroActions">
          <a className="primary" href="/upload">Share your first shot →</a>
          <a href="/community">Explore the community</a>
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
        <a className="textLink" href="/community">See the full community →</a>
      </div>
      <CommunityFeed limit={6} compact />
    </section>

    <section className="cta"><div>
      <span className="spark">✦</span>
      <p className="eyebrow">YOUR WORK BELONGS HERE</p>
      <h2>Made something good lately?</h2>
      <p>Share the process, the polish, or the tiny detail you finally got right.</p>
      <a className="primary" href="/upload">Upload a screenshot →</a>
    </div></section>

    <footer className="shell">
      <a className="brand" href="/"><span>S</span> Skillshot</a>
      <p>A community for people who make things.</p>
      <div><a href="/community">Community</a> · <a href="/my-posts">My posts</a> · <a href="/profile">Profile</a></div>
    </footer>
  </main>;
}
