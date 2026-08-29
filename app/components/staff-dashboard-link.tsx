import Link from 'next/link';
import { getPrincipal } from '../../lib/authz';
import { isStaffRole, panelForRole } from '../../lib/roles';

export default async function StaffDashboardLink() {
  const principal = await getPrincipal();
  if (!principal || principal.status !== 'ACTIVE' || !isStaffRole(principal.role)) return null;

  return <Link className="staffDashboardLink" href={panelForRole(principal.role)}>◆ Dashboard</Link>;
}
