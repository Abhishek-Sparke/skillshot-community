'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import CreatorUsername from './creator-username';
import type { UserRole } from '../../lib/roles';
import { type CreatorRankId, CREATOR_RANKS } from '../../lib/creator-rank';

export type CreatorCardData = {
  username: string;
  displayName: string;
  avatarUrl?: string;
  bannerUrl?: string;
  bio?: string;
  role?: UserRole;
  creatorRank?: CreatorRankId | string;
  skills?: string[];
  postCount?: number;
  followerCount?: number;
  isFollowing?: boolean;
};

type Props = {
  data: CreatorCardData;
  onFollowToggle?: () => void;
  onClose?: () => void;
  className?: string;
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'S';
}

function compactNumber(value: number) {
  return new Intl.NumberFormat(undefined, { notation: value >= 1000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value);
}

export default function CreatorCard({ data, onFollowToggle, onClose, className = '' }: Props) {
  const [profile, setProfile] = useState<Partial<CreatorCardData>>(data);
  const rankKey = (String(profile.creatorRank || data.creatorRank || '').toUpperCase() in CREATOR_RANKS
    ? String(profile.creatorRank || data.creatorRank).toUpperCase()
    : 'NEWCOMER') as CreatorRankId;
  const rankInfo = CREATOR_RANKS[rankKey];
  const [following, setFollowing] = useState(Boolean(data.isFollowing));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    if (data.postCount === undefined || !data.avatarUrl) {
      fetch(`/api/profiles/${encodeURIComponent(data.username)}`)
        .then(r => r.ok ? r.json() : null)
        .then(res => {
          if (!active || !res?.profile) return;
          const p = res.profile;
          setProfile(prev => ({
            ...prev,
            avatarUrl: p.avatar_url ? `/api/avatars/${encodeURIComponent(data.username)}?v=${encodeURIComponent(p.avatar_url)}` : undefined,
            bannerUrl: p.banner_url ? `/api/banners/${encodeURIComponent(data.username)}?v=${encodeURIComponent(p.banner_url)}` : undefined,
            bio: p.bio,
            postCount: p.post_count,
            followerCount: p.follower_count,
            isFollowing: p.is_following,
          }));
          if (p.is_following !== undefined) {
            setFollowing(Boolean(p.is_following));
          }
        })
        .catch(() => {});
    }
    return () => { active = false; };
  }, [data.username, data.postCount, data.avatarUrl]);

  const handleFollowClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      const method = following ? 'DELETE' : 'POST';
      const res = await fetch(`/api/profiles/${encodeURIComponent(data.username)}/follow`, { method });
      if (res.ok) {
        const json = await res.json();
        setFollowing(Boolean(json.following));
        onFollowToggle?.();
      }
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`creatorIdentityCard ${className}`} onClick={e => e.stopPropagation()}>
      <div className="cardHeader">
        <Link href={`/users/${encodeURIComponent(data.username)}`} className="cardAvatarWrap" onClick={onClose}>
          {(profile.avatarUrl || data.avatarUrl) ? (
            <img src={profile.avatarUrl || data.avatarUrl} alt="" className="cardAvatar animatedPfp" />
          ) : (
            <span className="cardAvatarFallback">{initials(data.displayName)}</span>
          )}
        </Link>
        <div className="cardIdentityDetails">
          <div className="cardNameRow">
            <CreatorUsername name={data.displayName} username={data.username} creatorRank={rankKey} staffRole={data.role} className="cardDisplayName" enableCard={false}/>
          </div>
          <p className="cardRankTitle">{rankInfo.label}</p>
          <span className="cardHandle">@{data.username}</span>
        </div>
      </div>

      {profile.bio && <p className="cardBioSnippet">{profile.bio}</p>}

      {data.skills && data.skills.length > 0 && (
        <div className="cardSkillsRow">
          {data.skills.slice(0, 3).map(skill => (
            <span key={skill} className="cardSkillPill">{skill}</span>
          ))}
        </div>
      )}

      <div className="cardStatsRow">
        <div className="cardStat">
          <strong>{compactNumber(profile.postCount ?? data.postCount ?? 0)}</strong>
          <span>Skillshots</span>
        </div>
        <div className="cardStat">
          <strong>{compactNumber(profile.followerCount ?? data.followerCount ?? 0)}</strong>
          <span>Followers</span>
        </div>
      </div>

      <div className="cardActionsRow">
        <button
          type="button"
          className={`cardFollowBtn ${following ? 'isFollowing' : ''}`}
          onClick={handleFollowClick}
          disabled={busy}
        >
          {busy ? '…' : following ? 'Following' : '＋ Follow'}
        </button>
        <Link
          href={`/users/${encodeURIComponent(data.username)}`}
          className="cardViewProfileBtn"
          onClick={onClose}
        >
          View Profile
        </Link>
      </div>
    </div>
  );
}
