import Link from 'next/link';

const rules = [
  {
    title: 'Respect others',
    summary: 'Be constructive and welcoming. Harassment, hate speech, and personal attacks are prohibited.',
    details: 'Comments should encourage or ask genuine questions. Repeated unwanted contact and targeted abuse result in immediate moderation action.',
  },
  {
    title: 'Allowed content',
    summary: 'Share original creative work, screenshots, and designs you have permission to publish.',
    details: 'Give credit when collaboration matters. High-resolution visuals that showcase your skill and process are celebrated.',
  },
  {
    title: 'Prohibited content',
    summary: 'No graphic violence, sexual content, scams, malware, or private personal data.',
    details: 'Skillshot uses automated screening and human review. Violating content is removed and accounts may be suspended.',
  },
  {
    title: 'Honest signals',
    summary: 'Do not buy reactions, coordinate spam, impersonate creators, or manipulate metrics.',
    details: 'Authenticity keeps discovery fair. Accounts engaging in fake engagement or reputation manipulation are restricted.',
  },
  {
    title: 'Reporting & appeals',
    summary: 'Report violations when you see them. Staff review context, and decisions can be appealed.',
    details: 'Use the report button on posts, comments, or profiles. If you believe a moderation action was mistaken, submit an appeal.',
  },
];

export default function Page() {
  return (
    <main className="policyPage shell">
      <nav className="staffNav">
        <Link className="brand" href="/"><span>S</span> Skillshot</Link>
        <Link href="/community">Community</Link>
      </nav>

      <header>
        <p className="eyebrow">COMMUNITY GUIDELINES</p>
        <h1>Make Skillshot useful, safe, and human.</h1>
        <p>Core rules that apply to all posts, comments, and interactions.</p>
      </header>

      <div className="policyGrid">
        {rules.map(({ title, summary, details }, index) => (
          <article key={title}>
            <span>0{index + 1}</span>
            <h2>{title}</h2>
            <p>{summary}</p>
            <details className="policyDetails">
              <summary>More details</summary>
              <p>{details}</p>
            </details>
          </article>
        ))}
      </div>

      <section className="policyCallout">
        <h2>Think we made a mistake?</h2>
        <p>Moderation decisions can be reviewed by our team.</p>
        <Link className="primary" href="/appeals">Submit an appeal</Link>
      </section>
    </main>
  );
}
