import { requireSettingsUser } from '../../../lib/authz';
import { signOut } from '../../../auth';
import AuthSubmitButton from '../../components/auth-submit-button';

export default async function Page() {
  const user = await requireSettingsUser('/settings/security');
  return (
    <>
      <h1>Security</h1>

      <section className="settingsSection">
        <h2>Google Account</h2>
        <p className="settingsEmailText">{user?.email}</p>
        <p className="settingsHint">Password and two-step verification are managed in Google.</p>
        <div className="settingsActions">
          <a
            href="https://myaccount.google.com/security"
            target="_blank"
            rel="noopener noreferrer"
            className="settingsBtn"
          >
            Google Account security ↗
          </a>
        </div>
      </section>

      <section className="settingsSection">
        <h2>Active Session</h2>
        <p className="settingsHint">Signed in on this browser.</p>
        <div className="settingsActions">
          <form action={async () => { 'use server'; await signOut({ redirectTo: '/' }); }}>
            <AuthSubmitButton className="settingsBtn settingsDanger" pendingText="Signing out…">
              Log out
            </AuthSubmitButton>
          </form>
        </div>
      </section>
    </>
  );
}
