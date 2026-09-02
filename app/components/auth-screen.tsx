import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth, signIn } from '../../auth';
import { safeReturnPath, signInPath, signUpPath } from '../../lib/auth-path';
import AuthSubmitButton from './auth-submit-button';
import './auth-screen.css';

export type AuthPageParams = { callbackUrl?: string; reason?: string; error?: string };

export default async function AuthScreen({ mode, params }: { mode: 'signin' | 'signup'; params: AuthPageParams }) {
  const creating = mode === 'signup';
  const requested = safeReturnPath(params.callbackUrl || (creating ? '/profile/edit' : '/'));
  const destination = /^\/(signin|signup)([/?#]|$)/.test(requested) ? '/' : requested;
  const session = await auth();
  if (session?.user?.email) redirect(destination);

  return <main className="authPage">
    <header className="authPageHeader shell">
      <Link className="brand" href="/"><span aria-hidden="true">S</span> Skillshot</Link>
      <Link className="authBackLink" href="/">← Back to home</Link>
    </header>
    <section className="authPageBody" aria-labelledby="auth-title">
      <p className="authTagline">Show your skills. <span>In one shot.</span></p>
      <div className="authCard">
        <nav className="authSwitch" aria-label="Account access">
          <Link href={signInPath(destination)} aria-current={!creating ? 'page' : undefined}>Sign in</Link>
          <Link href={signUpPath(destination)} aria-current={creating ? 'page' : undefined}>Sign up</Link>
        </nav>
        <div className="authCardContent">
          <p className="eyebrow">{creating ? 'JOIN THE COMMUNITY' : 'WELCOME BACK'}</p>
          <h1 id="auth-title">{creating ? 'Create your account' : 'Sign in to Skillshot'}</h1>
          <p className="authDescription">{creating
            ? 'Share what you create, discover inspiring work, and connect with other creators.'
            : 'Your work, your community, and your next idea. Pick up where you left off.'}</p>
          {params.reason && <p className="authReason">{params.reason.slice(0, 160)}</p>}
          {params.error && <p className="authFeedback" role="alert">We couldn’t complete your Google sign-in. Please try again using the same Google account you used before.</p>}
          <form action={async () => { 'use server'; await signIn('google', { redirectTo: destination }); }}>
            <AuthSubmitButton className="googleAuthButton" pendingText="Connecting to Google…">
              <span className="googleAuthIcon" aria-hidden="true">G</span>
              {creating ? 'Sign up with Google' : 'Sign in with Google'}
            </AuthSubmitButton>
          </form>
          <p className="authSecurity">Secure Google sign-in. No extra password to remember.</p>
          <div className="authExplanation">
            {creating ? 'Your first Google sign-in creates your Skillshot account. Then you can personalize your profile.' : 'New to Skillshot? Your first Google sign-in also creates your account automatically.'}
          </div>
          <p className="authAlternate">{creating ? 'Already have an account?' : 'Don’t have an account?'}{' '}
            <Link href={creating ? signInPath(destination) : signUpPath(destination)}>{creating ? 'Sign in' : 'Sign up'}</Link>
          </p>
        </div>
      </div>
      <p className="authBrowse">Just looking around? <Link href="/community">Explore the community →</Link></p>
    </section>
  </main>;
}
