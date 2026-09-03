import Link from 'next/link';
import { getPrincipal } from '../../lib/authz';
import { publicNavigation } from '../../lib/public-navigation';
import ResponsiveNavbar from './responsive-navbar';
import { signOut } from '../../auth';
import AuthSubmitButton from './auth-submit-button';
import SettingsMenu from './settings-menu';
import { isStaffRole,panelForRole } from '../../lib/roles';

export default async function PublicNavbar({ returnTo }: { returnTo: string }) {
  const principal = await getPrincipal();
  return <ResponsiveNavbar>
    {publicNavigation(principal, returnTo).map(link => <Link key={link.href} href={link.href} className={link.className}>{link.label}</Link>)}
    {principal?.status==='ACTIVE' && <SettingsMenu name={String(principal.profile?.display_name||'Your account')} dashboard={isStaffRole(principal.role)?panelForRole(principal.role):undefined} logout={<form className="publicNavLogout" action={async () => { 'use server'; await signOut({ redirectTo: '/' }); }}>
      <AuthSubmitButton className="publicNavLogoutButton" pendingText="Logging out…">Log out</AuthSubmitButton>
    </form>}/>}
  </ResponsiveNavbar>;
}
