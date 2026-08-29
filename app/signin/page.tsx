import { signIn } from '../../auth';
import Link from 'next/link';
import { safeReturnPath } from '../../lib/auth-path';

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; reason?: string; error?: string }> }) {
  const { callbackUrl = '/', reason, error } = await searchParams;
  const destination = safeReturnPath(callbackUrl);
  return <main className="formPage">
    <Link className="brand" href="/"><span>S</span> Skillshot</Link>
    <section className="formCard auth">
      <p className="eyebrow">WELCOME TO SKILLSHOT</p>
      <h1>Sign in with Google.</h1>
      <p>{reason || 'Use your Google account to create your profile, publish Skillshots, follow creators, react, and comment securely.'}</p>
      {error && <p className="authError" role="alert">Sign-in could not be completed. Please try again.</p>}
      <form action={async () => { 'use server'; await signIn('google', { redirectTo: destination }); }}>
        <button className="primary" type="submit">Continue with Google →</button>
      </form>
      <Link className="backHome" href={destination}>← Return to the previous page</Link>
    </section>
  </main>;
}
