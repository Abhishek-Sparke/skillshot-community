import Link from 'next/link';

export default function Page() {
  return (
    <>
      <h1>Privacy</h1>

      <section className="settingsSection">
        <h2>Profile visibility</h2>
        <p>Your profile and published Skillshots are public.<br/>Your email and staff information stay private.</p>
        <div className="settingsActions">
          <Link href="/profile/edit" className="settingsBtn">Edit profile</Link>
        </div>
      </section>

      <section className="settingsSection">
        <h2>Content visibility</h2>
        <p>Published Skillshots are visible to visitors.</p>
        <div className="settingsActions">
          <Link href="/my-posts" className="settingsBtn">Manage Skillshots</Link>
        </div>
      </section>

      <p className="settingsMutedNote">Private profiles and blocking aren&apos;t available yet.</p>

      <div className="settingsFooterLink">
        <Link href="/privacy">Privacy Policy →</Link>
      </div>
    </>
  );
}
