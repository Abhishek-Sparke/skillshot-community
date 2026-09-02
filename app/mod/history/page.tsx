import { requirePanel } from '../../../lib/authz';
import AuditView from '../../components/audit-view';
export default async function Page(){const user=await requirePanel('mod');return user.permissions.includes('audit.view')?<AuditView history/>:<p>Moderation history unavailable.</p>;}
