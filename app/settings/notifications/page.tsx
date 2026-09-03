import { requireSettingsUser } from '../../../lib/authz';
import PreferenceEditor from '../../components/preference-editor';
export default async function Page(){const user=await requireSettingsUser('/settings/notifications');return <><h1>Notifications</h1><PreferenceEditor initial={user?.profile.preferences||{}} section="notifications"/></>;}
