import PublicNavbar from '../components/public-navbar';

export default function Page() {
  return (
    <>
      <PublicNavbar returnTo="/privacy" />
      <main className="settingsPage shell">
        <h1>Privacy Policy</h1>

        <section className="settingsSection">
          <h2>Information We Collect</h2>
          <p>Skillshot collects your account email, display name, username, profile information, and uploaded content to operate the community platform.</p>
        </section>

        <section className="settingsSection">
          <h2>Public vs. Private Data</h2>
          <p>Your published Skillshots, creator profile, bio, and comments are visible to the public. Your sign-in email, account settings, and staff moderation records remain private.</p>
        </section>

        <section className="settingsSection">
          <h2>Data Protection</h2>
          <p>We do not sell personal information. You can update or request deletion of your account at any time through Account Settings.</p>
        </section>
      </main>
    </>
  );
}
