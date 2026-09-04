import { redirect } from 'next/navigation';
import { getPrincipal } from '../../lib/authz';
import PublicNavbar from '../components/public-navbar';
import './chats.css';

export default async function ChatsLayout({ children }: { children: React.ReactNode }) {
  const principal = await getPrincipal();
  if (!principal || principal.status !== 'ACTIVE') {
    redirect('/signin?callbackUrl=%2Fchats');
  }

  return (
    <>
      <PublicNavbar returnTo="/chats" />
      <main className="chatsPageContainer" style={{ padding: '12px 16px' }}>
        {children}
      </main>
    </>
  );
}
