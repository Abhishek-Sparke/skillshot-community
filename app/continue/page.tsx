import { redirect } from 'next/navigation';
import { getPrincipal } from '../../lib/authz';
import { panelForRole } from '../../lib/roles';
export default async function ContinuePage(){const principal=await getPrincipal();redirect(principal?panelForRole(principal.role):'/signin')}
