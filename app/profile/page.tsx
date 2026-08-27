import { chatGPTSignInPath, getChatGPTUser } from '../chatgpt-auth';
import Link from 'next/link';
import CreatorProfile from '../components/creator-profile';
import { ensureUser } from '../../lib/db';

export const dynamic = 'force-dynamic';

export default async function Profile({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const user = await getChatGPTUser();
  if (!user) {
    return <main className="formPage">
      <Link className="brand" href="/"><span>S</span> Skillshot</Link>
      <section className="formCard auth">
        <p className="eyebrow">WELCOME TO SKILLSHOT</p>
        <h1>Your work deserves a home.</h1>
        <p>Sign in securely with Google to build your creator profile, publish screenshots, follow makers, react, and comment.</p>
        <a className="primary" href={chatGPTSignInPath('/profile')}>Continue with Google →</a>
      </section>
    </main>;
  }
  const profile = await ensureUser(user);
  const { saved } = await searchParams;
  return <CreatorProfile username={String(profile.username)} saved={saved === '1'} />;
}
