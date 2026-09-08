/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import CommunityFeed from './community-feed';
import CreatorUsername from './creator-username';
import CreatorRankCard from './creator-rank-card';
import CreatorProgress from './creator-progress';
import CollectionsManager from './collections-manager';
import AchievementIcon from './achievement-icon';
import UiIcon from './ui-icon';
import type { UserRole } from '../../lib/roles';
import type { RankProgress, LevelProgress, CreatorRankId } from '../../lib/creator-rank';
import ReportButton from './report-button';
import { requireClientAuth, signInPath } from '../../lib/auth-path';

type FeaturedPost = { id: string; title: string; description: string; createdAt: number; reactionCount: number; commentCount: number; imageUrl: string };
type ProfileCollection = { id: string; name: string; description: string; coverUrl: string | null; isPrivate: boolean; postCount: number };
type Profile = {
  displayName: string; username: string; bio: string; website: string; location: string; skills: string[];
  socialLinks: Record<string, string>; avatarUrl: string; bannerUrl?: string; bannerType?: string;
  creatorRank?: CreatorRankId | string; rankProgress?: RankProgress;
  levelProgress?: LevelProgress;
  role: UserRole; joinedAt: number; postCount: number;
  likesReceived: number; followerCount: number; followingCount: number; isFollowing: boolean; isSelf: boolean;
  signedIn: boolean; featuredPosts: FeaturedPost[]; reputation: number; achievements: { key: string; label: string; description: string }[];
  collections: ProfileCollection[];
  canMessage?: boolean; canMessageReason?: string; isBlocked?: boolean; isBlockedByThem?: boolean;
};
type Tab = 'overview' | 'skillshots' | 'collections' | 'achievements' | 'saved' | 'liked' | 'about';
type ModalTab = 'followers' | 'following';
type SocialUser = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  role: UserRole;
  creatorRank?: CreatorRankId | string;
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

export default function CreatorProfile({ username, saved = false, initialTab = 'overview' }: { username: string; saved?: boolean; initialTab?: Tab }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>(initialTab);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [shareLabel, setShareLabel] = useState('Share profile');
  const [profileMenuOpen,setProfileMenuOpen]=useState(false);

  // Followers / Following Modal state
  const [modalTab, setModalTab] = useState<ModalTab | null>(null);
  const [modalUsers, setModalUsers] = useState<SocialUser[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [modalActionBusy, setModalActionBusy] = useState<string | null>(null);
  const [rankCardOpen,setRankCardOpen]=useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlTab = params.get('tab');
      if (urlTab === 'overview' || urlTab === 'skillshots' || urlTab === 'collections' || urlTab === 'achievements' || urlTab === 'saved' || urlTab === 'liked' || urlTab === 'about') {
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
  const tabs: Tab[] = ['overview', 'skillshots', 'collections', 'achievements', 'about'];
  const tabLabels: Record<Tab, string> = { overview: 'Overview', skillshots: 'Skillshots', collections: 'Collections', achievements: 'Achievements', saved: 'Saved', liked: 'Liked', about: 'About' };

  return <main className="profilePage">
    {saved && <div className="saveToast" role="status">✓ Profile updated</div>}
    <section className="profileHero shell">
      <div className="profileCover">
        {profile.bannerUrl ? (
          <img
            src={profile.bannerUrl}
            alt={`${profile.displayName}'s banner`}
            className="profileCoverImage"
          />
        ) : null}
        <div className="profileCoverOverlay" />
        <span>SHOW YOUR SKILLS. IN ONE SHOT.</span>
        {profile.isSelf && <Link className="profileCoverEdit" href="/profile/edit?tab=appearance"><UiIcon name="edit"/> Edit Profile</Link>}
      </div>
      <div className="profileSummary">
        <div className="profileIdentityArea">
          <div className="profileAvatar">
            {profile.avatarUrl && !avatarFailed ? (
              <img
                src={profile.avatarUrl}
                alt={`${profile.displayName}'s avatar`}
                className="animatedPfp"
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              initials(profile.displayName)
            )}
            {profile.isSelf && (
              <Link className="profileAvatarEditBtn" href="/profile/edit?tab=appearance" title="Change profile picture" aria-label="Change profile picture">
                <UiIcon name="edit"/>
              </Link>
            )}
          </div>
          <div className="profileMainInfo">
            <div className="profileNameLine">
              <CreatorUsername asSpan layout="profile" name={profile.displayName} username={profile.username} creatorRank={profile.creatorRank} staffRole={profile.role} roleVariant="profile" onRankClick={() => setRankCardOpen(true)} rankLevel={profile.levelProgress?.level}/>
            </div>
            {profile.bio && <p className="profileBio">{profile.bio}</p>}
            <div className="profileDetails">
              {profile.location && <span><UiIcon name="location"/> {profile.location}</span>}
              {profile.website && <a href={profile.website} target="_blank" rel="noreferrer"><UiIcon name="link"/> {websiteLabel(profile.website)}</a>}
              <span>Joined {joined}</span>
            </div>
            {profile.skills.length > 0 && <div className="profileSkills" aria-label="Skills">{profile.skills.map(skill => <span key={skill}>{skill}</span>)}</div>}
          </div>
        </div>
        <aside className="profileHeaderAside">
          {profile.rankProgress && <CreatorProgress rankProgress={profile.rankProgress} levelProgress={profile.levelProgress} onOpen={() => setRankCardOpen(true)}/>}
          <div className="profilePrimaryAction">
            {profile.isSelf ? (
              <div className="profileActionButtonsRow">
                <button className="shareProfileButton" type="button" onClick={shareProfile}><UiIcon name="share"/> {shareLabel}</button>
              </div>
            ) : (
              <div className="profileActionButtonsRow">
                <button
                  className={`followButton ${profile.isFollowing ? 'following' : ''}`}
                  onClick={toggleFollow}
                  disabled={busy}
                >
                  {busy ? 'Saving…' : profile.isFollowing ? 'Following' : <><UiIcon name="plus"/> Follow</>}
                </button>

                {profile.canMessage !== false ? (
                  <Link
                    className="profileMessageButton"
                    href={`/chats?user=${encodeURIComponent(profile.username)}`}
                  >
                    <UiIcon name="message"/> Message
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="profileMessageButton disabled"
                    disabled
                    title={profile.canMessageReason || 'Messaging is unavailable'}
                  >
                    <UiIcon name="message"/> Message
                  </button>
                )}

                <button className="shareProfileButton" type="button" onClick={shareProfile}><UiIcon name="share"/> {shareLabel}</button>

                <div className="profileMoreMenu">
                  <button type="button" className="profileMoreButton" aria-label="More profile actions" aria-expanded={profileMenuOpen} onClick={()=>setProfileMenuOpen(value=>!value)}><UiIcon name="more"/></button>
                  {profileMenuOpen&&<div className="profileMoreDropdown">
                    <button type="button" className={`profileBlockButton ${profile.isBlocked ? 'blocked' : ''}`} onClick={()=>{setProfileMenuOpen(false);toggleBlock()}}>{profile.isBlocked ? 'Unblock creator' : 'Block creator'}</button>
                    <ReportButton targetType="PROFILE" targetId={profile.username}/>
                  </div>}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
      {error && <p className="profileActionError" role="status">{error}</p>}
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
      <div className="profileTabs" role="tablist" aria-label="Profile sections">
        {tabs.map(value => <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)}>{tabLabels[value]}</button>)}
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
            ><UiIcon name="close"/></button>
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
                        <CreatorUsername asSpan name={userItem.displayName} username={userItem.username} creatorRank={userItem.creatorRank} staffRole={userItem.role}/>
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

    {rankCardOpen && profile.rankProgress && profile.levelProgress && <CreatorRankCard rank={profile.rankProgress.rank.id} rankProgress={profile.rankProgress} levelProgress={profile.levelProgress} onClose={() => setRankCardOpen(false)}/>}

    {tab === 'overview' && <section className="profileWork shell profileTabPanel profileOverview" role="tabpanel">
      <div className="profileOverviewGrid">
        <article className="profileDashboardCard profileAboutCard">
          <div className="profileCardHeading"><h2>About Me</h2>{profile.isSelf && <Link href="/profile/edit">Edit →</Link>}</div>
          <p>{profile.bio || 'This creator has not added a bio yet.'}</p>
          <div className="profileMiniDetails">
            {profile.location && <span><UiIcon name="location"/> {profile.location}</span>}
            {profile.website && <a href={profile.website} target="_blank" rel="noreferrer"><UiIcon name="link"/> {websiteLabel(profile.website)}</a>}
            <span>Joined {joined}</span>
          </div>
          {profile.skills.length > 0 && <div className="profileSkills">{profile.skills.slice(0, 8).map(skill => <span key={skill}>{skill}</span>)}</div>}
        </article>

        <article className="profileDashboardCard profileAchievementsCard">
          <div className="profileCardHeading"><h2>Achievements</h2><button type="button" onClick={() => setTab('achievements')}>View all →</button></div>
          {profile.achievements.length ? <div className="profileAchievementPreview">{profile.achievements.slice(0, 8).map(item => <div key={item.key} title={item.description}><span><AchievementIcon achievementKey={item.key}/></span><small>{item.label}</small></div>)}</div> : <p className="profileCardEmpty">Achievements appear as this creator contributes.</p>}
        </article>

        <article className="profileDashboardCard profileCollectionsCard">
          <div className="profileCardHeading"><h2>Collections</h2><button type="button" onClick={() => setTab('collections')}>View all →</button></div>
          <div className="profileCollectionPreview">
            {profile.collections.map(collection => (
              <button type="button" className="profileFolderBox" onClick={() => setTab('collections')} key={collection.id}>
                <span className="folderTab"><b>{collection.name}</b></span>
                <span className="folderBody">
                  {collection.coverUrl ? <img src={collection.coverUrl} alt="" loading="lazy"/> : <span className="profileCollectionPlaceholder"><UiIcon name="bookmark"/></span>}
                  <small>{collection.postCount} {collection.postCount === 1 ? 'Skillshot' : 'Skillshots'}</small>
                </span>
              </button>
            ))}
            {!profile.collections.length && <div className="profileCollectionEmpty"><p>No collections yet.</p>{profile.isSelf && <button type="button" onClick={() => setTab('collections')}><UiIcon name="plus"/> Create collection</button>}</div>}
          </div>
        </article>
      </div>

      <div className="profileOverviewWork">
        <div className="sectionHead"><div><p className="eyebrow">YOUR WORK</p><h2>{profile.isSelf ? 'Your published work.' : `${profile.displayName}'s published work.`}</h2></div><div className="profileOverviewActions">{profile.isSelf && <Link className="primary" href="/upload"><UiIcon name="plus"/> New Skillshot</Link>}<button type="button" onClick={() => setTab('skillshots')}>View all <UiIcon name="arrow-up-right"/></button></div></div>
        <CollectionsManager username={profile.username} isSelf={profile.isSelf} mode="gallery" />
      </div>
    </section>}

    {tab === 'collections' && <section className="profileWork shell profileTabPanel" role="tabpanel"><div className="sectionHead"><div><p className="eyebrow">CURATED WORK</p><h2>Collections.</h2></div></div><CollectionsManager username={profile.username} isSelf={profile.isSelf} mode="folders"/></section>}

    {tab === 'achievements' && <section className="profileWork shell profileTabPanel" role="tabpanel"><div className="sectionHead"><div><p className="eyebrow">MILESTONES</p><h2>Achievements.</h2></div></div><div className="profileAchievementFull">{profile.achievements.length ? profile.achievements.map(item=><article key={item.key}><span><AchievementIcon achievementKey={item.key}/></span><div><h3>{item.label}</h3><p>{item.description}</p></div></article>) : <p>No achievements yet.</p>}</div></section>}

    {tab === 'skillshots' && <section className="profileWork shell profileTabPanel" role="tabpanel">
      {profile.featuredPosts.length > 0 && (
        <div className="featuredSection compactFeatured">
          <div className="sectionHead">
            <div>
              <p className="eyebrow">FEATURED</p>
              <h2>Selected work.</h2>
            </div>
            {profile.isSelf && <Link className="textLink" href="/profile/edit">Choose featured work →</Link>}
          </div>
          <div className="featuredGrid">
            {profile.featuredPosts.map(post => (
              <article className="featuredPost" key={post.id}>
                <Link className="featuredImage" href={`/shots/${post.id}`}>
                  <img
                    src={post.imageUrl}
                    alt={post.title}
                    loading="lazy"
                    width="900"
                    height="600"
                    onError={event => { event.currentTarget.style.display = 'none'; }}
                  />
                </Link>
                <div>
                  <p className="eyebrow">{new Date(post.createdAt).toLocaleDateString()}</p>
                  <h3><Link href={`/shots/${post.id}`}>{post.title}</Link></h3>
                  {post.description && <p>{post.description}</p>}
                  <small>♥ {post.reactionCount} <span>◌ {post.commentCount}</span></small>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      <div className="allSkillshots yourWorkSection">
        <div className="sectionHead">
          <div>
            <p className="eyebrow">YOUR WORK</p>
            <h2>{profile.isSelf ? 'Your published work.' : `${profile.displayName}'s work.`}</h2>
          </div>
          {profile.isSelf && <Link className="primary" href="/upload"><UiIcon name="plus"/> New post</Link>}
        </div>
        <CollectionsManager username={profile.username} isSelf={profile.isSelf} mode="gallery" />
      </div>
    </section>}

    {tab === 'saved' && <section className="profileWork shell profileTabPanel" role="tabpanel">
      <div className="sectionHead"><div><p className="eyebrow">SAVED WORK</p><h2>Saved Skillshots.</h2></div></div>
      <CommunityFeed saved compact emptyTitle="No saved Skillshots yet" emptyText="Save Skillshots you want to revisit."/>
    </section>}

    {tab === 'liked' && <section className="profileWork shell profileTabPanel" role="tabpanel"><div className="sectionHead"><div><p className="eyebrow">APPRECIATED WORK</p><h2>Skillshots {profile.displayName} likes.</h2></div></div><CommunityFeed likedBy={profile.username} compact emptyTitle="No liked Skillshots yet." emptyText="Work this creator appreciates will appear here."/></section>}

    {tab === 'about' && (
      <section className="profileWork shell profileTabPanel aboutTabSection" role="tabpanel">
        <div className="aboutModernContainer">
          {/* 1. Header & Bio Showcase */}
          <div className="aboutHeroCard">
            <div className="aboutHeroTop">
              <div className="aboutHeroMeta">
                <span className="aboutBadgePill">✦ CREATOR STORY</span>
                <h2 className="aboutHeroTitle">About {profile.displayName}</h2>
                <span className="aboutHeroHandle">@{profile.username}</span>
              </div>
              {profile.isSelf && (
                <Link href="/profile/edit" className="aboutEditPill">
                  <UiIcon name="edit" /> Edit bio & details
                </Link>
              )}
            </div>

            <div className="aboutBioWrap">
              {profile.bio ? (
                <blockquote className="aboutBioQuote">
                  <span className="aboutQuoteMark">“</span>
                  <p className="aboutBioText">{profile.bio}</p>
                </blockquote>
              ) : (
                <div className="aboutBioEmpty">
                  <p>This creator has not written a public bio yet.</p>
                  {profile.isSelf && (
                    <Link href="/profile/edit" className="aboutBioPromptBtn">
                      <UiIcon name="plus" /> Add your creator story
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 2. Key Details & Stats Grid */}
          <div className="aboutDetailsGrid">
            {/* Location */}
            <div className="aboutDetailCard">
              <div className="aboutDetailIconWrap">
                <UiIcon name="location" />
              </div>
              <div className="aboutDetailContent">
                <span className="aboutDetailLabel">LOCATION</span>
                {profile.location ? (
                  <strong className="aboutDetailValue">{profile.location}</strong>
                ) : profile.isSelf ? (
                  <Link href="/profile/edit" className="aboutActionLink">
                    + Add location
                  </Link>
                ) : (
                  <span className="aboutDetailMuted">Not specified</span>
                )}
              </div>
            </div>

            {/* Website */}
            <div className="aboutDetailCard">
              <div className="aboutDetailIconWrap">
                <UiIcon name="link" />
              </div>
              <div className="aboutDetailContent">
                <span className="aboutDetailLabel">WEBSITE & PORTFOLIO</span>
                {profile.website ? (
                  <a
                    href={profile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="aboutLinkAction"
                  >
                    <span>{websiteLabel(profile.website)}</span>
                    <UiIcon name="arrow-up-right" />
                  </a>
                ) : profile.isSelf ? (
                  <Link href="/profile/edit" className="aboutActionLink">
                    + Add website
                  </Link>
                ) : (
                  <span className="aboutDetailMuted">Not specified</span>
                )}
              </div>
            </div>

            {/* Member Since */}
            <div className="aboutDetailCard">
              <div className="aboutDetailIconWrap">
                <span className="aboutDateBadge">✦</span>
              </div>
              <div className="aboutDetailContent">
                <span className="aboutDetailLabel">MEMBER SINCE</span>
                <strong className="aboutDetailValue">{joined}</strong>
              </div>
            </div>

            {/* Community Reputation & Rank */}
            <div className="aboutDetailCard aboutReputationCard">
              <div className="aboutDetailIconWrap">
                <span className="aboutRepBadge">★</span>
              </div>
              <div className="aboutDetailContent">
                <span className="aboutDetailLabel">COMMUNITY REPUTATION</span>
                <div className="aboutReputationRow">
                  <strong className="aboutDetailValue">{compactNumber(profile.reputation)} pts</strong>
                  {profile.creatorRank && (
                    <span className="aboutRankPill">{profile.creatorRank.replace(/_/g, ' ')}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 3. Creative Skills */}
          {profile.skills.length > 0 && (
            <div className="aboutSectionBlock">
              <div className="aboutSectionHead">
                <h3>Skills & Expertise</h3>
                <span className="aboutCountBadge">{profile.skills.length}</span>
              </div>
              <div className="aboutSkillsWrap">
                {profile.skills.map((skill) => (
                  <span key={skill} className="aboutSkillChip">
                    <span className="aboutSkillHash">#</span>
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 4. Social Links */}
          {Object.keys(profile.socialLinks).length > 0 && (
            <div className="aboutSectionBlock">
              <div className="aboutSectionHead">
                <h3>Find me online</h3>
              </div>
              <div className="aboutSocialRow">
                {Object.entries(profile.socialLinks).map(([name, url]) => (
                  <a
                    key={name}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="aboutSocialBtn"
                  >
                    <span>{name}</span>
                    <UiIcon name="arrow-up-right" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* 5. Achievements Showcase */}
          {profile.achievements.length > 0 && (
            <div className="aboutSectionBlock">
              <div className="aboutSectionHead">
                <h3>Achievements & Milestones</h3>
                <span className="aboutCountBadge">{profile.achievements.length}</span>
              </div>
              <div className="aboutAchievementsGrid">
                {profile.achievements.map((item) => (
                  <article key={item.key} className="aboutAchievementCard">
                    <div className="aboutAchievementIcon">
                      <AchievementIcon achievementKey={item.key} />
                    </div>
                    <div className="aboutAchievementInfo">
                      <h4>{item.label}</h4>
                      <p>{item.description}</p>
                    </div>
                    <span className="aboutUnlockedBadge" title="Unlocked">
                      <UiIcon name="check" size={14} /> Unlocked
                    </span>
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    )}
  </main>;
}
