import PublicNavbar from '../components/public-navbar';

export default function Page() {
  return (
    <>
      <PublicNavbar returnTo="/terms" />
      <main className="settingsPage shell">
        <h1>Terms of Service</h1>

        <section className="settingsSection">
          <h2>Platform Terms</h2>
          <p>By using Skillshot, you agree to follow our Community Guidelines and share only content you have the right to publish.</p>
        </section>

        <section className="settingsSection">
          <h2>Content Ownership</h2>
          <p>You retain full ownership of the work you publish on Skillshot. You grant Skillshot permission to display and distribute your work on the platform.</p>
        </section>

        <section className="settingsSection">
          <h2>Account Responsibility</h2>
          <p>You are responsible for the activity on your account. Maintain security of your sign-in credentials and comply with all applicable laws.</p>
        </section>
      </main>
    </>
  );
}
