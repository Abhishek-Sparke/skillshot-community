import { signIn } from '../../auth';

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const { callbackUrl = '/profile' } = await searchParams;
  const destination = callbackUrl.startsWith('/') && !callbackUrl.startsWith('//') ? callbackUrl : '/profile';
  return <main className="formPage">
    <a className="brand" href="/"><span>S</span> Skillshot</a>
    <section className="formCard auth">
      <p className="eyebrow">WELCOME TO SKILLSHOT</p>
      <h1>Sign in with Google.</h1>
      <p>Use your Google account to publish screenshots, create your profile, react, and comment securely.</p>
      <form action={async () => { 'use server'; await signIn('google', { redirectTo: destination }); }}>
        <button className="primary" type="submit">Continue with Google →</button>
      </form>
      <a className="backHome" href="/">← Back to home</a>
    </section>
  </main>;
}

