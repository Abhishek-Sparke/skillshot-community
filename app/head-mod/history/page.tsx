import { requirePanel } from '../../../lib/authz';
import AuditView from '../../components/audit-view';
export default async function Page(){await requirePanel('head-mod');return <AuditView history/>;}
