import { requirePanel } from '../../lib/authz';
import StaffPanel from '../components/staff-panel';
export default async function ModPage(){await requirePanel('mod');return <StaffPanel title="Moderator panel"/>}

