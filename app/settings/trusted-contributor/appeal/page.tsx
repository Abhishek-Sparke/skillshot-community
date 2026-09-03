import { requireSettingsUser } from '../../../../lib/authz';
import { trustedProgress } from '../../../../lib/trusted-data';
import TrustedApplication from '../../../components/trusted-application';
export default async function Page(){const user=await requireSettingsUser('/settings/trusted-contributor/appeal');return <TrustedApplication initial={await trustedProgress(user.id)} appeal/>;}
