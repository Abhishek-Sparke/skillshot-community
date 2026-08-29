import Link from 'next/link';
import { getPrincipal } from '../../lib/authz';
import { signInPath } from '../../lib/auth-path';
import { isStaffRole, panelForRole } from '../../lib/roles';

export default async function AuthNavItems({ returnTo, notifications = true }: { returnTo: string; notifications?: boolean }) {
  const principal = await getPrincipal();
  if (!principal) return <>
    <Link className="authEntry" href={signInPath(returnTo)}>Sign in</Link>
    <Link className="upload" href={signInPath('/upload', 'Sign in to create a Skillshot')}>＋ Share a shot</Link>
  </>;
  return <>
    <Link href="/my-posts">My posts</Link>
    {notifications && <Link href="/notifications">Notifications</Link>}
    <Link href="/profile">Profile</Link>
    {isStaffRole(principal.role) && <Link className="staffDashboardLink" href={panelForRole(principal.role)}>◆ Dashboard</Link>}
    <Link className="upload" href="/upload">＋ Share a shot</Link>
  </>;
}
