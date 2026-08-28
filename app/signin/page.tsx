import { signIn } from '../../auth';
import Link from 'next/link';

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const { callbackUrl = '/continue' } = await searchParams;
  const destination = callbackUrl.startsWith('/') && !callbackUrl.startsWith('//') ? callbackUrl : '/profile';
  return <main className="formPage">
    <Link className="brand" href="/"><span>S</span> Skillshot</Link>
    <section className="formCard auth">
      <p className="eyebrow">WELCOME TO SKILLSHOT</p>
      <h1>Sign in with Google.</h1>
      <p>Use your Google account to publish screenshots, create your profile, react, and comment securely.</p>
      <form action={async () => { 'use server'; await signIn('google', { redirectTo: destination }); }}>
        <button className="primary" type="submit">Continue with Google →</button>
      </form>
      <Link className="backHome" href="/">← Back to home</Link>
    </section>
  </main>;
}
