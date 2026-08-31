import { requirePanel } from '../../../lib/authz';
import AuditView from '../../components/audit-view';
export default async function Page(){const user=await requirePanel('admin');return user.permissions.includes('audit.view')?<AuditView/>:<p>Audit log unavailable.</p>;}
