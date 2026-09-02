import { chatGPTSignInPath, getChatGPTUser } from '../chatgpt-auth';
import CreatorProfile from '../components/creator-profile';
import PublicNavbar from '../components/public-navbar';
import { ensureUser } from '../../lib/db';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function Profile({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const user = await getChatGPTUser();
  if (!user) redirect(chatGPTSignInPath('/profile'));
  const profile = await ensureUser(user);
  const { saved } = await searchParams;
  return <><PublicNavbar returnTo="/profile"/><CreatorProfile username={String(profile.username)} saved={saved === '1'} /></>;
}
