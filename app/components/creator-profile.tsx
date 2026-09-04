'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import CommunityFeed from './community-feed';
import RoleBadge from './role-badge';
import type { UserRole } from '../../lib/roles';
import ReportButton from './report-button';
import { requireClientAuth, signInPath } from '../../lib/auth-path';

type FeaturedPost = { id: string; title: string; description: string; createdAt: number; reactionCount: number; commentCount: number; imageUrl: string };
type Profile = {
  displayName: string; username: string; bio: string; website: string; location: string; skills: string[];
  socialLinks: Record<string, string>; avatarUrl: string; role: UserRole; joinedAt: number; postCount: number;
  likesReceived: number; followerCount: number; followingCount: number; isFollowing: boolean; isSelf: boolean;
  signedIn: boolean; featuredPosts: FeaturedPost[]; reputation: number; achievements: { key: string; label: string; description: string }[];
  canMessage?: boolean; canMessageReason?: string; isBlocked?: boolean; isBlockedByThem?: boolean;
};
type Tab = 'skillshots' | 'saved' | 'liked' | 'about';
type ModalTab = 'followers' | 'following';
type SocialUser = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  role: UserRole;
  isFollowing: boolean;
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'S';
}
function websiteLabel(value: string) {
  try { return new URL(value).hostname.replace(/^www\./, ''); } catch { return value; }
}
function compactNumber(value: number) {
  return new Intl.NumberFormat(undefined, { notation: value >= 1000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value);
}

export default function CreatorProfile({ username, saved = false, initialTab = 'skillshots' }: { username: string; saved?: boolean; initialTab?: Tab }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>(initialTab);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [shareLabel, setShareLabel] = useState('Share profile');

  // Followers / Following Modal state
  const [modalTab, setModalTab] = useState<ModalTab | null>(null);
  const [modalUsers, setModalUsers] = useState<SocialUser[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [modalActionBusy, setModalActionBusy] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlTab = params.get('tab');
      if (urlTab === 'saved' || urlTab === 'liked' || urlTab === 'about' || urlTab === 'skillshots') {
        setTab(urlTab);
      }
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch(`/api/profiles/${encodeURIComponent(username)}`)
      .then(async response => response.ok ? response.json() : Promise.reject(new Error(response.status === 404 ? 'Creator not found.' : 'Could not load this profile.')))
      .then(data => { if (active) setProfile(data.profile); })
      .catch(reason => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [username]);

  // Load modal users whenever modalTab or modalSearch changes
  const loadModalUsers = useCallback(async (tabType: ModalTab, query: string) => {
    setModalLoading(true);
    try {
      const qParam = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';
      const res = await fetch(`/api/profiles/${encodeURIComponent(username)}/${tabType}${qParam}`);
      if (res.ok) {
        const data = await res.json();
        setModalUsers(data[tabType] || []);
      }
    } catch {
      /* ignore */
    } finally {
      setModalLoading(false);
    }
  }, [username]);

  useEffect(() => {
    if (!modalTab) return;
    const timer = setTimeout(() => {
      loadModalUsers(modalTab, modalSearch);
    }, modalSearch ? 250 : 0);
    return () => clearTimeout(timer);
  }, [modalTab, modalSearch, loadModalUsers]);

  // Handle escape key to close modal
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && modalTab) {
        setModalTab(null);
        setModalSearch('');
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalTab]);

  function openModal(type: ModalTab) {
    setModalTab(type);
    setModalSearch('');
  }

  async function toggleFollow() {
    if (!profile || busy) return;
    if (!requireClientAuth(profile.signedIn, `/users/${profile.username}`, `Sign in to follow @${profile.username}`)) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/profiles/${encodeURIComponent(profile.username)}/follow`, { method: profile.isFollowing ? 'DELETE' : 'POST' });
      if (response.status === 401) { window.location.assign(signInPath(`/users/${profile.username}`, `Sign in to follow @${profile.username}`)); return; }
      if (!response.ok) {
        const d = await response.json().catch(() => ({}));
        setError(d.error || 'Could not update your follow. Please try again.');
        setBusy(false);
        return;
      }
      const data = await response.json();
      setProfile({ ...profile, isFollowing: Boolean(data.following), followerCount: Number(data.followerCount) });
    } catch {
      setError('Could not update your follow.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleBlock() {
    if (!profile || busy) return;
    if (!requireClientAuth(profile.signedIn, `/users/${profile.username}`, 'Sign in to block or unblock users')) return;
    if (!profile.isBlocked && !window.confirm(`Block @${profile.username}? Blocked users cannot message you or follow you.`)) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/profiles/${encodeURIComponent(profile.username)}/block`, { method: 'POST' });
      if (response.status === 401) {
        window.location.assign(signInPath(`/users/${profile.username}`, 'Sign in to block or unblock users'));
        return;
      }
      if (!response.ok) {
        const d = await response.json().catch(() => ({}));
        setError(d.error || 'Could not update block status.');
        setBusy(false);
        return;
      }
      const data = await response.json();
      const nowBlocked = Boolean(data.blocked);
      setProfile({
        ...profile,
        isBlocked: nowBlocked,
        isFollowing: nowBlocked ? false : profile.isFollowing,
        canMessage: nowBlocked ? false : profile.canMessage,
        canMessageReason: nowBlocked ? 'You have blocked this user.' : '',
        followerCount: nowBlocked && profile.isFollowing ? Math.max(0, profile.followerCount - 1) : profile.followerCount,
      });
    } catch {
      setError('Failed to update block status.');
    } finally {
      setBusy(false);
    }
  }

  async function removeFollower(userId: string) {
    if (!profile || modalActionBusy) return;
    setModalActionBusy(userId);
    try {
      const response = await fetch(`/api/profiles/${encodeURIComponent(profile.username)}/followers?userId=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        const data = await response.json();
        setModalUsers(prev => prev.filter(u => u.id !== userId));
        setProfile(prev => prev ? { ...prev, followerCount: Number(data.followerCount) } : prev);
      }
    } catch {
      /* ignore */
    } finally {
      setModalActionBusy(null);
    }
  }

  async function toggleModalUserFollow(targetUser: SocialUser) {
    if (!profile || modalActionBusy) return;
    if (!requireClientAuth(profile.signedIn, `/users/${username}`, `Sign in to follow @${targetUser.username}`)) return;
    setModalActionBusy(targetUser.id);
    try {
      const method = targetUser.isFollowing ? 'DELETE' : 'POST';
      const response = await fetch(`/api/profiles/${encodeURIComponent(targetUser.username)}/follow`, { method });
      if (response.ok) {
        const data = await response.json();
        const nextFollowing = Boolean(data.following);
        setModalUsers(prev => prev.map(u => u.id === targetUser.id ? { ...u, isFollowing: nextFollowing } : u));
        if (profile.isSelf && modalTab === 'following') {
          setProfile(prev => prev ? {
            ...prev,
            followingCount: nextFollowing ? prev.followingCount + 1 : Math.max(0, prev.followingCount - 1)
          } : prev);
        }
      }
    } catch {
      /* ignore */
    } finally {
      setModalActionBusy(null);
    }
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
  const tabs: Tab[] = profile.isSelf ? ['skillshots', 'saved', 'liked', 'about'] : ['skillshots', 'liked', 'about'];

  return <main className="profilePage">
    {saved && <div className="saveToast" role="status">✓ Profile updated</div>}
    <section className="profileHero shell">
      <div className="profileCover"><span>SKILLSHOT CREATOR</span></div>
      <div className="profileSummary">
        <div className="profileAvatar">{profile.avatarUrl && !avatarFailed ? <img src={profile.avatarUrl} alt={`${profile.displayName}'s avatar`} onError={() => setAvatarFailed(true)}/> : initials(profile.displayName)}</div>
        <div className="profileMainInfo">
          <div className="profileNameLine"><h1>{profile.displayName}</h1><RoleBadge role={profile.role} variant="profile"/></div>
          <p className="profileUsername">@{profile.username}</p>
          <p className="profileBio">{profile.bio || 'This creator is building something worth sharing.'}</p>
          
          {/* Live Followers / Following Counts right on profile */}
          <div className="profileFollowCounts">
            <button
              type="button"
              className="profileFollowCountBtn"
              onClick={() => openModal('followers')}
              aria-label={`View ${profile.followerCount} followers`}
            >
              <strong>{compactNumber(profile.followerCount)}</strong> <span>Followers</span>
            </button>
            <button
              type="button"
              className="profileFollowCountBtn"
              onClick={() => openModal('following')}
              aria-label={`View ${profile.followingCount} following`}
            >
              <strong>{compactNumber(profile.followingCount)}</strong> <span>Following</span>
            </button>
          </div>

          <div className="profileDetails">
            {profile.location && <span>⌖ {profile.location}</span>}
            {profile.website && <a href={profile.website} target="_blank" rel="noreferrer">↗ {websiteLabel(profile.website)}</a>}
            <span>Joined {joined}</span>
          </div>
          {profile.skills.length > 0 && <div className="profileSkills" aria-label="Skills">{profile.skills.map(skill => <span key={skill}>{skill}</span>)}</div>}
        </div>
        <div className="profilePrimaryAction">
          {profile.isSelf ? (
            <Link className="profileEditButton" href="/profile/edit">✎ Edit profile</Link>
          ) : (
            <>
              <button
                className={`followButton ${profile.isFollowing ? 'following' : ''}`}
                onClick={toggleFollow}
                disabled={busy}
              >
                {busy ? 'Saving…' : profile.isFollowing ? 'Following' : '＋ Follow'}
              </button>

              {profile.canMessage !== false ? (
                <Link
                  className="profileMessageButton"
                  href={`/chats?user=${encodeURIComponent(profile.username)}`}
                >
                  💬 Message
                </Link>
              ) : (
                <button
                  type="button"
                  className="profileMessageButton disabled"
                  disabled
                  title={profile.canMessageReason || 'Messaging is unavailable'}
                >
                  💬 Message
                </button>
              )}
            </>
          )}

          <button className="shareProfileButton" type="button" onClick={shareProfile}>↗ {shareLabel}</button>

          {!profile.isSelf && (
            <>
              <button
                type="button"
                className={`profileBlockButton ${profile.isBlocked ? 'blocked' : ''}`}
                onClick={toggleBlock}
                title={profile.isBlocked ? 'Unblock creator' : 'Block creator'}
              >
                {profile.isBlocked ? 'Unblock' : 'Block'}
              </button>
              <ReportButton targetType="PROFILE" targetId={profile.username}/>
            </>
          )}
        </div>
      </div>
      <div className="profileStats" aria-label="Profile statistics">
        <div><strong>{compactNumber(profile.postCount)}</strong><span>Skillshots</span></div>
        <div><strong>{compactNumber(profile.likesReceived)}</strong><span>Likes</span></div>
        <button
          type="button"
          className="profileStatBtn"
          onClick={() => openModal('followers')}
          aria-label={`View ${profile.followerCount} followers`}
        >
          <strong>{compactNumber(profile.followerCount)}</strong><span>Followers</span>
        </button>
        <button
          type="button"
          className="profileStatBtn"
          onClick={() => openModal('following')}
          aria-label={`View ${profile.followingCount} following`}
        >
          <strong>{compactNumber(profile.followingCount)}</strong><span>Following</span>
        </button>
      </div>
      {error && <p className="profileActionError" role="status">{error}</p>}
      <div className="profileTabs" role="tablist" aria-label="Profile sections">
        {tabs.map(value => <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)}>{value === 'skillshots' ? 'Skillshots' : value === 'saved' ? 'Saved' : value === 'liked' ? 'Liked' : 'About'}</button>)}
      </div>
    </section>

    {/* Followers / Following Modal */}
    {modalTab && (
      <div
        className="socialModalOverlay"
        role="dialog"
        aria-modal="true"
        aria-label={`${modalTab === 'followers' ? 'Followers' : 'Following'} list`}
        onClick={() => { setModalTab(null); setModalSearch(''); }}
      >
        <div className="socialModalCard" onClick={e => e.stopPropagation()}>
          <div className="socialModalHeader">
            <div className="socialModalTabs">
              <button
                type="button"
                className={`socialModalTab ${modalTab === 'followers' ? 'active' : ''}`}
                onClick={() => setModalTab('followers')}
              >
                Followers ({profile.followerCount})
              </button>
              <button
                type="button"
                className={`socialModalTab ${modalTab === 'following' ? 'active' : ''}`}
                onClick={() => setModalTab('following')}
              >
                Following ({profile.followingCount})
              </button>
            </div>
            <button
              type="button"
              className="socialModalClose"
              onClick={() => { setModalTab(null); setModalSearch(''); }}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="socialModalSearch">
            <input
              type="text"
              placeholder={`Search ${modalTab}…`}
              value={modalSearch}
              onChange={e => setModalSearch(e.target.value)}
              autoFocus
            />
          </div>

          <div className="socialModalList">
            {modalLoading ? (
              <div className="socialModalEmpty">Loading…</div>
            ) : modalUsers.length === 0 ? (
              <div className="socialModalEmpty">
                {modalSearch
                  ? `No matching ${modalTab} found.`
                  : modalTab === 'followers'
                  ? 'No followers yet.'
                  : 'Not following anyone yet.'}
              </div>
            ) : (
              modalUsers.map(userItem => (
                <div key={userItem.id} className="socialModalItem">
                  <Link
                    href={`/users/${userItem.username}`}
                    className="socialModalUserLink"
                    onClick={() => { setModalTab(null); setModalSearch(''); }}
                  >
                    <div className="socialModalAvatar">
                      {userItem.avatarUrl ? (
                        <img src={userItem.avatarUrl} alt="" />
                      ) : (
                        initials(userItem.displayName)
                      )}
                    </div>
                    <div className="socialModalUserDetails">
                      <div className="socialModalUserNameLine">
                        <span>{userItem.displayName}</span>
                        <RoleBadge role={userItem.role} />
                      </div>
                      <span className="socialModalUsername">@{userItem.username}</span>
                    </div>
                  </Link>

                  <div className="socialModalActions">
                    {profile.isSelf && modalTab === 'followers' ? (
                      <button
                        type="button"
                        className="socialRemoveBtn"
                        disabled={modalActionBusy === userItem.id}
                        onClick={() => removeFollower(userItem.id)}
                        title="Remove follower"
                      >
                        {modalActionBusy === userItem.id ? '…' : 'Remove'}
                      </button>
                    ) : userItem.username !== profile.username ? (
                      <button
                        type="button"
                        className={`socialFollowBtn ${userItem.isFollowing ? 'following' : ''}`}
                        disabled={modalActionBusy === userItem.id}
                        onClick={() => toggleModalUserFollow(userItem)}
                      >
                        {modalActionBusy === userItem.id ? '…' : userItem.isFollowing ? 'Following' : 'Follow'}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    )}

    {tab === 'skillshots' && <section className="profileWork shell profileTabPanel" role="tabpanel">
      <div className="featuredSection">
        <div className="sectionHead"><div><p className="eyebrow">FEATURED</p><h2>Selected work.</h2></div>{profile.isSelf && <Link className="textLink" href="/profile/edit">Choose featured work →</Link>}</div>
        {profile.featuredPosts.length ? <div className="featuredGrid">{profile.featuredPosts.map(post => <article className="featuredPost" key={post.id}><Link className="featuredImage" href={`/shots/${post.id}`}><img src={post.imageUrl} alt={post.title} loading="lazy" width="900" height="600" onError={event => { event.currentTarget.style.display = 'none'; }}/></Link><div><p className="eyebrow">{new Date(post.createdAt).toLocaleDateString()}</p><h3><Link href={`/shots/${post.id}`}>{post.title}</Link></h3>{post.description && <p>{post.description}</p>}<small>♥ {post.reactionCount} <span>◌ {post.commentCount}</span></small></div></article>)}</div> : <div className="profileEmpty"><span>✦</span><h3>{profile.isSelf ? 'Feature your best work' : 'No featured Skillshots'}</h3>{profile.isSelf && <Link className="primary" href="/profile/edit">Choose featured work →</Link>}</div>}
      </div>
      <div className="allSkillshots"><div className="sectionHead"><div><p className="eyebrow">ALL SKILLSHOTS</p><h2>{profile.isSelf ? 'Your published work.' : `${profile.displayName}'s work.`}</h2></div>{profile.isSelf && <Link className="primary" href="/upload">＋ New post</Link>}</div><CommunityFeed username={profile.username} compact emptyTitle="No Skillshots yet." emptyText={profile.isSelf ? 'Share your first one.' : 'No published work yet.'}/></div>
    </section>}

    {tab === 'saved' && <section className="profileWork shell profileTabPanel" role="tabpanel">
      <div className="sectionHead"><div><p className="eyebrow">SAVED WORK</p><h2>Saved Skillshots.</h2></div></div>
      <CommunityFeed saved compact emptyTitle="No saved Skillshots yet" emptyText="Save Skillshots you want to revisit."/>
    </section>}

    {tab === 'liked' && <section className="profileWork shell profileTabPanel" role="tabpanel"><div className="sectionHead"><div><p className="eyebrow">APPRECIATED WORK</p><h2>Skillshots {profile.displayName} likes.</h2></div></div><CommunityFeed likedBy={profile.username} compact emptyTitle="No liked Skillshots yet." emptyText="Work this creator appreciates will appear here."/></section>}

    {tab === 'about' && <section className="profileWork shell profileTabPanel" role="tabpanel"><div className="aboutProfile"><div><p className="eyebrow">ABOUT</p><h2>About {profile.displayName}.</h2><p className="aboutBio">{profile.bio || 'This creator has not added a bio yet.'}</p></div><dl><div><dt>Location</dt><dd>{profile.location || 'Not added'}</dd></div><div><dt>Website</dt><dd>{profile.website ? <a href={profile.website} target="_blank" rel="noopener noreferrer">{websiteLabel(profile.website)}</a> : 'Not added'}</dd></div><div><dt>Joined</dt><dd>{joined}</dd></div><div><dt>Reputation</dt><dd>{compactNumber(profile.reputation)} points</dd></div></dl>{profile.achievements.length>0&&<div><h3>Achievements</h3><div className="achievementGrid">{profile.achievements.map(item=><article key={item.key}><span>✦</span><div><b>{item.label}</b><small>{item.description}</small></div></article>)}</div></div>}{profile.skills.length > 0 && <div><h3>Skills</h3><div className="profileSkills">{profile.skills.map(skill => <span key={skill}>{skill}</span>)}</div></div>}{Object.keys(profile.socialLinks).length > 0 && <div><h3>Find me online</h3><div className="socialLinks">{Object.entries(profile.socialLinks).map(([name, url]) => <a key={name} href={url} target="_blank" rel="noopener noreferrer">↗ {name}</a>)}</div></div>}</div></section>}
  </main>;
}

