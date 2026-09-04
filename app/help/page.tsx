import Link from 'next/link';
import PublicNavbar from '../components/public-navbar';

const faqs = [
  {
    topic: 'Getting Started',
    summary: 'Sign in with Google, choose a display name, and share your visual work.',
    link: { label: 'Sign in', href: '/signin' },
  },
  {
    topic: 'Publishing Skillshots',
    summary: 'Upload PNG, JPG, or WebP images up to 10 MB. Safe images publish after automated checks.',
    link: { label: 'Share a shot', href: '/upload' },
  },
  {
    topic: 'Profiles & Portfolio',
    summary: 'Customize your avatar, bio, skills, and links from the profile editor.',
    link: { label: 'Edit profile', href: '/profile/edit' },
  },
  {
    topic: 'Community & Comments',
    summary: 'Join discussions on any Skillshot. You can edit or delete your own comments anytime.',
    link: { label: 'Explore community', href: '/community' },
  },
  {
    topic: 'Safety & Reporting',
    summary: 'Report violations directly from any post or profile. Human moderators review reported context.',
    link: { label: 'Community Guidelines', href: '/community-guidelines' },
  },
  {
    topic: 'Account Security',
    summary: 'Authentication is handled securely via Google. Manage security settings in your Google Account.',
    link: { label: 'Security settings', href: '/settings/security' },
  },
];

export default function Page() {
  return (
    <>
      <PublicNavbar returnTo="/help" />
      <main className="settingsPage shell helpPage">
        <h1>Help Center</h1>
        <p className="helpIntro">Quick answers to common questions about Skillshot.</p>

        <div className="helpGrid">
          {faqs.map(({ topic, summary, link }) => (
            <article className="helpCard" key={topic}>
              <h2>{topic}</h2>
              <p>{summary}</p>
              <Link href={link.href} className="helpLink">{link.label} →</Link>
            </article>
          ))}
        </div>

        <section className="settingsSection helpContactSection">
          <h2>Still need help?</h2>
          <p>Contact our team directly for account support or to report a technical issue.</p>
          <div className="settingsActions">
            <Link href="/support/contact" className="settingsBtn primary">Contact Support</Link>
            <Link href="/support/report" className="settingsBtn">Report a Problem</Link>
          </div>
        </section>
      </main>
    </>
  );
}
