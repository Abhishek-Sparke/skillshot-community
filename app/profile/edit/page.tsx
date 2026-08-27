import { chatGPTSignOutPath, requireChatGPTUser } from '../../chatgpt-auth';
import { ensureUser, getReadyDb } from '../../../lib/db';
import Link from 'next/link';
import ProfileEditor from '../../components/profile-editor';

export const dynamic = 'force-dynamic';

const messages: Record<string, string> = {
  username: 'Please choose a valid username.',
  'username-taken': 'That username is already taken.',
  website: 'Website must begin with http:// or https://.',
  social: 'Social links must begin with http:// or https://.',
  avatar: 'Choose a PNG, JPG, or WebP avatar smaller than 2 MB.',
  'avatar-upload': 'Your avatar could not be uploaded. Please try again.',
  save: 'Your profile could not be saved. Please try again.',
};

export default async function EditProfile({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireChatGPTUser('/profile/edit');
  const profile = await ensureUser(user);
  const posts = await (await getReadyDb()).query(`
    SELECT p.id,p.title,(fp.post_id IS NOT NULL) AS featured
    FROM posts p LEFT JOIN featured_posts fp ON fp.post_id=p.id AND fp.user_id=p.user_id
    WHERE p.user_id=$1 ORDER BY p.created_at DESC
  `, [user.userId]);
  const { error } = await searchParams;
  return <main className="formPage">
    <nav className="detailNav"><Link className="brand" href="/"><span>S</span> Skillshot</Link><Link className="backHome" href="/profile">← View profile</Link></nav>
    <section className="formCard profileEditor">
      <p className="eyebrow">EDIT YOUR PUBLIC PROFILE</p>
      <h1>Make your profile yours.</h1>
      <p className="profileIntro">Keep your creator identity clear, professional, and easy to discover.</p>
      {error && <p className="formNotice errorState" role="alert">{messages[error] ?? 'Your profile could not be saved.'}</p>}
      <ProfileEditor profile={{
        displayName: String(profile.display_name), username: String(profile.username), bio: String(profile.bio || ''),
        website: String(profile.website || ''), location: String(profile.location || ''),
        skills: Array.isArray(profile.skills) ? profile.skills.map(String) : [],
        socialLinks: profile.social_links && typeof profile.social_links === 'object' ? profile.social_links as Record<string, string> : {},
        avatarUrl: profile.avatar_url ? `/api/avatars/${encodeURIComponent(String(profile.username))}?v=${encodeURIComponent(String(profile.avatar_url))}` : '',
      }} posts={posts.map(post => ({ id: String(post.id), title: String(post.title), featured: Boolean(post.featured) }))}/>
      <div className="profileLinks"><Link className="backHome" href="/">← Back to home</Link><a className="quietLink" href={chatGPTSignOutPath('/')}>Sign out</a></div>
    </section>
  </main>;
}
