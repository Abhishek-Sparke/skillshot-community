import { requirePanel } from '../../../lib/authz';
import TeamManager from '../../components/team-manager';
export default async function TeamPage(){const principal=await requirePanel('admin');if(!principal.permissions.includes('team.view'))return <main className="formPage"><section className="detail"><h1>Access denied</h1></section></main>;return <TeamManager/>}

