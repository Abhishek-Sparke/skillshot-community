import Link from 'next/link';
import { getPrincipal } from '../../lib/authz';
import { publicNavigation } from '../../lib/public-navigation';
import ResponsiveNavbar from './responsive-navbar';

export default async function PublicNavbar({ returnTo }: { returnTo: string }) {
  const principal = await getPrincipal();
  return <ResponsiveNavbar>
    {publicNavigation(principal, returnTo).map(link => <Link key={link.href} href={link.href} className={link.className}>{link.label}</Link>)}
  </ResponsiveNavbar>;
}
