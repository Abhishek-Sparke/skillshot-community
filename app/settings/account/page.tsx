import Link from 'next/link';
import { requireSettingsUser } from '../../../lib/authz';
import SupportForm from '../../components/support-form';

export default async function Page() {
  const user = await requireSettingsUser('/settings/account');
  const profile = user.profile;

  const fields = [
    ['Display name', profile.display_name],
    ['Username', profile.username],
    ['Email', user.email],
    ['Bio', profile.bio],
    ['Location', profile.location],
    ['Website', profile.website],
  ];

  return (
    <>
      <h1>Account</h1>

      <section className="settingsSection">
        <h2>Profile information</h2>
        <dl className="settingsDetails">
          {fields.map(([key, value]) => (
            <div key={String(key)}>
              <dt>{String(key)}</dt>
              <dd>{String(value || 'Not added')}</dd>
            </div>
          ))}
        </dl>
        <div className="settingsActions" style={{ marginTop: '16px' }}>
          <Link className="settingsBtn primary" href="/profile/edit">
            Edit profile
          </Link>
        </div>
      </section>

      <section className="settingsSection">
        <h2>Delete account</h2>
        <p className="settingsHint">Request account deletion from support. Requests are reviewed before data is removed.</p>
        <SupportForm mode="deletion" />
      </section>
    </>
  );
}
