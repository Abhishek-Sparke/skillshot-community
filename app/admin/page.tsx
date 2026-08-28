import { requirePanel } from '../../lib/authz';
import StaffPanel from '../components/staff-panel';
export default async function AdminPage(){await requirePanel('admin');return <StaffPanel title="Admin dashboard"/>}
