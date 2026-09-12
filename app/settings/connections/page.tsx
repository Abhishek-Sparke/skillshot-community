import { Suspense } from 'react';
import { requireSettingsUser } from '../../../lib/authz';
import DiscordConnectionCard from '../../components/discord-connection-card';

export default async function ConnectionsPage() {
  await requireSettingsUser('/settings/connections');

  return (
    <>
      <h1>Connected Accounts</h1>
      <p className="settingsHint" style={{ marginBottom: 20 }}>
        Link your external accounts to synchronize achievements, Creator Rank, and community roles.
      </p>

      <Suspense fallback={<div className="settingsSection">Loading connection…</div>}>
        <DiscordConnectionCard />
      </Suspense>
    </>
  );
}
