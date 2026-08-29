import { requirePanel } from '../../../lib/authz';
import TeamManager from '../../components/team-manager';
export default async function Page(){await requirePanel('head-mod');return <TeamManager home="/head-mod" moderatorsOnly/>}
