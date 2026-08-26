import { chatGPTSignInPath, chatGPTSignOutPath, getChatGPTUser } from '../chatgpt-auth';

export const dynamic = 'force-dynamic';

export default async function Profile() {
  const user = await getChatGPTUser();

  if (!user) {
    return <main className="formPage">
      <a className="brand" href="/"><span>S</span> Skillshot</a>
      <section className="formCard auth">
        <p className="eyebrow">WELCOME TO SKILLSHOT</p>
        <h1>Your work deserves a home.</h1>
        <p>Sign in securely to upload screenshots, react, comment, and shape your profile. Your account provides a verified email, so there is no extra password to store.</p>
        <a className="primary" href={chatGPTSignInPath('/profile')}>Sign in to continue →</a>
      </section>
    </main>;
  }

  return <main className="formPage">
    <a className="brand" href="/"><span>S</span> Skillshot</a>
    <section className="formCard">
      <p className="eyebrow">SIGNED IN · EMAIL VERIFIED ✓</p>
      <h1>Welcome, {user.displayName}</h1>
      <p className="profileIntro">What would you like to do?</p>

      <div className="accountActions" aria-label="Account options">
        <a className="accountAction" href="/upload"><strong>＋</strong><span><b>Upload a post</b><small>Share a new screenshot</small></span></a>
        <a className="accountAction" href="/#explore"><strong>⌕</strong><span><b>Browse community</b><small>Discover other creators</small></span></a>
        <a className="accountAction" href="#edit-profile"><strong>✎</strong><span><b>Edit profile</b><small>Update your public details</small></span></a>
      </div>

      <hr className="profileDivider" />
      <form id="edit-profile" action="/api/profile" method="post">
        <label>Display name<input name="displayName" defaultValue={user.displayName}/></label>
        <label>Username<input name="username" defaultValue={user.email.split('@')[0]}/></label>
        <label>Bio<textarea name="bio" placeholder="What do you make?"/></label>
        <label>Website<input name="website" type="url" placeholder="https://"/></label>
        <button className="primary">Save profile</button>
      </form>
      <a className="quietLink" href={chatGPTSignOutPath('/')}>Sign out</a>
    </section>
  </main>;
}
