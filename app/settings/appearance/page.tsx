import { requireSettingsUser } from '../../../lib/authz';
import PreferenceEditor from '../../components/preference-editor';
export default async function Page(){const user=await requireSettingsUser('/settings/appearance');return <><h1>Appearance</h1><PreferenceEditor initial={user?.profile.preferences||{}} section="appearance"/></>;}
