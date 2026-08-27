'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import CommunityFeed from './community-feed';
import RoleBadge from './role-badge';
import type { UserRole } from '../../lib/roles';

type FeaturedPost = { id: string; title: string; description: string; createdAt: number; reactionCount: number; commentCount: number; imageUrl: string };
type Profile = {
  displayName: string; username: string; bio: string; website: string; location: string; skills: string[];
  socialLinks: Record<string, string>; avatarUrl: string; role: UserRole; joinedAt: number; postCount: number;
  likesReceived: number; followerCount: number; followingCount: number; isFollowing: boolean; isSelf: boolean;
  signedIn: boolean; featuredPosts: FeaturedPost[];
};
type Tab = 'skillshots' | 'liked' | 'about';

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'S';
}
function websiteLabel(value: string) {
  try { return new URL(value).hostname.replace(/^www\./, ''); } catch { return value; }
}
function compactNumber(value: number) {
  return new Intl.NumberFormat(undefined, { notation: value >= 1000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value);
}

export default function CreatorProfile({ username, saved = false }: { username: string; saved?: boolean }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('skillshots');
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [shareLabel, setShareLabel] = useState('Share profile');

  useEffect(() => {
    let active = true;
    fetch(`/api/profiles/${encodeURIComponent(username)}`)
      .then(async response => response.ok ? response.json() : Promise.reject(new Error(response.status === 404 ? 'Creator not found.' : 'Could not load this profile.')))
      .then(data => { if (active) setProfile(data.profile); })
      .catch(reason => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [username]);

  async function toggleFollow() {
    if (!profile || busy) return;
    setBusy(true);
    setError('');
    const response = await fetch(`/api/profiles/${encodeURIComponent(profile.username)}/follow`, { method: profile.isFollowing ? 'DELETE' : 'POST' });
    if (response.status === 401) { window.location.assign(`/signin?callbackUrl=${encodeURIComponent(`/users/${profile.username}`)}`); return; }
    if (!response.ok) { setError('Could not update your follow. Please try again.'); setBusy(false); return; }
    const data = await response.json();
    setProfile({ ...profile, isFollowing: Boolean(data.following), followerCount: Number(data.followerCount) });
    setBusy(false);
  }

  async function shareProfile() {
    const url = `${window.location.origin}/users/${encodeURIComponent(username)}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareLabel('Copied!');
      window.setTimeout(() => setShareLabel('Share profile'), 1800);
    } catch { setError('Could not copy the profile link.'); }
  }

  if (!profile && !error) return <main className="profilePage"><div className="profileSkeleton shell" aria-label="Loading creator profile" aria-live="polite"><span className="skeletonCover"/><div><i/><b/><small/></div><span className="skeletonStats"/></div></main>;
  if (!profile) return <main className="formPage"><section className="detail"><h1>Creator not found</h1><p>{error}</p><Link className="backHome" href="/community">← Back to community</Link></section></main>;

  const joined = new Date(profile.joinedAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  return <main className="profilePage">
    <nav className="nav shell">
      <Link className="brand" href="/"><span>S</span> Skillshot</Link>
      <div className="navlinks"><Link href="/community">Community</Link><Link href="/my-posts">My posts</Link><Link href="/profile">Profile</Link><Link className="upload" href="/upload">＋ Share a shot</Link></div>
    </nav>
    {saved && <div className="saveToast" role="status">✓ Profile updated</div>}
    <section className="profileHero shell">
      <div className="profileCover"><span>SKILLSHOT CREATOR</span></div>
      <div className="profileSummary">
        <div className="profileAvatar">{profile.avatarUrl && !avatarFailed ? <img src={profile.avatarUrl} alt={`${profile.displayName}'s avatar`} onError={() => setAvatarFailed(true)}/> : initials(profile.displayName)}</div>
        <div className="profileMainInfo">
          <div className="profileNameLine"><h1>{profile.displayName}</h1><RoleBadge role={profile.role}/></div>
          <p className="profileUsername">@{profile.username}</p>
          <p className="profileBio">{profile.bio || 'This creator is building something worth sharing.'}</p>
          <div className="profileDetails">
            {profile.location && <span>⌖ {profile.location}</span>}
            {profile.website && <a href={profile.website} target="_blank" rel="noreferrer">↗ {websiteLabel(profile.website)}</a>}
            <span>Joined {joined}</span>
          </div>
          {profile.skills.length > 0 && <div className="profileSkills" aria-label="Skills">{profile.skills.map(skill => <span key={skill}>{skill}</span>)}</div>}
        </div>
        <div className="profilePrimaryAction">
          {profile.isSelf ? <Link className="profileEditButton" href="/profile/edit">✎ Edit profile</Link> : <button className={`followButton ${profile.isFollowing ? 'following' : ''}`} onClick={toggleFollow} disabled={busy}>{busy ? 'Saving…' : profile.isFollowing ? 'Following' : '＋ Follow'}</button>}
          <button className="shareProfileButton" type="button" onClick={shareProfile}>↗ {shareLabel}</button>
        </div>
      </div>
      <div className="profileStats" aria-label="Profile statistics">
        <div><strong>{compactNumber(profile.postCount)}</strong><span>Skillshots</span></div>
        <div><strong>{compactNumber(profile.likesReceived)}</strong><span>Likes</span></div>
        <div><strong>{compactNumber(profile.followerCount)}</strong><span>Followers</span></div>
        <div><strong>{compactNumber(profile.followingCount)}</strong><span>Following</span></div>
      </div>
      {error && <p className="profileActionError" role="status">{error}</p>}
      <div className="profileTabs" role="tablist" aria-label="Profile sections">
        {(['skillshots', 'liked', 'about'] as Tab[]).map(value => <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)}>{value === 'skillshots' ? 'Skillshots' : value === 'liked' ? 'Liked' : 'About'}</button>)}
      </div>
    </section>

    {tab === 'skillshots' && <section className="profileWork shell profileTabPanel" role="tabpanel">
      <div className="featuredSection">
        <div className="sectionHead"><div><p className="eyebrow">FEATURED</p><h2>Selected work.</h2></div>{profile.isSelf && <Link className="textLink" href="/profile/edit">Choose featured work →</Link>}</div>
        {profile.featuredPosts.length ? <div className="featuredGrid">{profile.featuredPosts.map(post => <article className="featuredPost" key={post.id}><Link className="featuredImage" href={`/shots/${post.id}`}><img src={post.imageUrl} alt={post.title} loading="lazy" width="900" height="600" onError={event => { event.currentTarget.style.display = 'none'; }}/></Link><div><p className="eyebrow">{new Date(post.createdAt).toLocaleDateString()}</p><h3><Link href={`/shots/${post.id}`}>{post.title}</Link></h3>{post.description && <p>{post.description}</p>}<small>♥ {post.reactionCount} <span>◌ {post.commentCount}</span></small></div></article>)}</div> : <div className="profileEmpty"><span>✦</span><h3>{profile.isSelf ? 'Choose the work that represents you best.' : 'No featured Skillshots yet.'}</h3><p>{profile.isSelf ? 'Select up to three posts from Edit Profile.' : 'This creator has not selected featured work.'}</p>{profile.isSelf && <Link className="primary" href="/profile/edit">Choose featured work →</Link>}</div>}
      </div>
      <div className="allSkillshots"><div className="sectionHead"><div><p className="eyebrow">ALL SKILLSHOTS</p><h2>{profile.isSelf ? 'Your published work.' : `${profile.displayName}'s work.`}</h2></div>{profile.isSelf && <Link className="primary" href="/upload">＋ New post</Link>}</div><CommunityFeed username={profile.username} compact showComments emptyTitle={profile.isSelf ? 'Your first Skillshot starts here.' : 'No Skillshots yet.'} emptyText={profile.isSelf ? 'Share something you are proud of and let the community discover it.' : 'This creator has not published any work yet.'}/></div>
    </section>}

    {tab === 'liked' && <section className="profileWork shell profileTabPanel" role="tabpanel"><div className="sectionHead"><div><p className="eyebrow">APPRECIATED WORK</p><h2>Skillshots {profile.displayName} likes.</h2></div></div><CommunityFeed likedBy={profile.username} compact showComments emptyTitle="No liked Skillshots yet." emptyText="Work this creator appreciates will appear here."/></section>}

    {tab === 'about' && <section className="profileWork shell profileTabPanel" role="tabpanel"><div className="aboutProfile"><div><p className="eyebrow">ABOUT</p><h2>About {profile.displayName}.</h2><p className="aboutBio">{profile.bio || 'This creator has not added a bio yet.'}</p></div><dl><div><dt>Location</dt><dd>{profile.location || 'Not added'}</dd></div><div><dt>Website</dt><dd>{profile.website ? <a href={profile.website} target="_blank" rel="noreferrer">{websiteLabel(profile.website)}</a> : 'Not added'}</dd></div><div><dt>Joined</dt><dd>{joined}</dd></div></dl>{profile.skills.length > 0 && <div><h3>Skills</h3><div className="profileSkills">{profile.skills.map(skill => <span key={skill}>{skill}</span>)}</div></div>}{Object.keys(profile.socialLinks).length > 0 && <div><h3>Find me online</h3><div className="socialLinks">{Object.entries(profile.socialLinks).map(([name, url]) => <a key={name} href={url} target="_blank" rel="noreferrer">↗ {name}</a>)}</div></div>}</div></section>}
  </main>;
}
