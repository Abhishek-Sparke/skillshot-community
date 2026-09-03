import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getPrincipal } from '../../lib/authz';
import PublicNavbar from '../components/public-navbar';
export default async function Layout({children}:{children:React.ReactNode}){
  const user=await getPrincipal();if(!user||user.status!=='ACTIVE')redirect('/signin?callbackUrl=/settings');
  return <><PublicNavbar returnTo="/settings"/><main className="settingsPage shell"><Link className="settingsBack" href="/settings">← Settings & Support</Link>{children}</main></>;
}
