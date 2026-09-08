'use client';

import Link from 'next/link';
import type { CreatorRankId } from '../../lib/creator-rank';
import type { UserRole } from '../../lib/roles';
import CreatorUsername from './creator-username';
import ShotThumbnail, { shotFrameRatio } from './shot-thumbnail';
import UiIcon from './ui-icon';

export type PortfolioCardPost = {
  id: string;
  title: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  isGif: boolean;
  reactionCount: number;
  commentCount: number;
  category?: string;
  author?: string;
  username?: string;
  avatarUrl?: string;
  creatorRank?: CreatorRankId;
  authorRole?: UserRole;
  viewerSaved?: boolean;
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'S';
}

export default function PortfolioSkillshotCard({
  post,
  fallbackUsername,
  onPreview,
  onToggleSave,
}: {
  post: PortfolioCardPost;
  fallbackUsername: string;
  onPreview: () => void;
  onToggleSave: () => void;
}) {
  const creatorUsername = post.username || fallbackUsername;
  const creatorName = post.author || creatorUsername;
  const detailUrl = `/shots/${post.id}`;

  async function share() {
    const url = new URL(detailUrl, window.location.origin).toString();
    if (navigator.share) {
      await navigator.share({ title: post.title, url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard?.writeText(url).catch(() => undefined);
  }

  return <article className="portfolioCard">
    <div
      className="portfolioThumbWrap"
      style={{ aspectRatio: String(shotFrameRatio(post.imageWidth, post.imageHeight)) }}
    >
      <ShotThumbnail
        src={post.imageUrl}
        title={post.title}
        author={creatorName}
        width={post.imageWidth}
        height={post.imageHeight}
        onPreview={onPreview}
      />
      {post.isGif && <span className="gifBadge" aria-label="Animated GIF">GIF</span>}
    </div>

    <div className="portfolioCardMeta">
      <div className="portfolioCreatorRow">
        <Link className="portfolioCreatorAvatar" href={`/users/${encodeURIComponent(creatorUsername)}`} aria-label={`View ${creatorName}'s profile`}>
          {post.avatarUrl ? <img src={post.avatarUrl} alt="" loading="lazy"/> : <span>{initials(creatorName)}</span>}
        </Link>
        <CreatorUsername
          name={creatorName}
          username={creatorUsername}
          creatorRank={post.creatorRank || 'NEWCOMER'}
          staffRole={post.authorRole || 'USER'}
          roleVariant="compact"
        />
      </div>

      <Link href={detailUrl} className="portfolioCardTitle">{post.title}</Link>
      <span className="portfolioTag">{post.category || 'Visual'}</span>

      <div className="portfolioCardActions" aria-label={`${post.title} engagement and actions`}>
        <div className="portfolioCounters">
          <span title={`${post.reactionCount} likes`}><UiIcon name="heart"/> {post.reactionCount}</span>
          <Link href={`${detailUrl}#comments`} title={`${post.commentCount} comments`}><UiIcon name="comment"/> {post.commentCount}</Link>
        </div>
        <div className="portfolioUtilityActions">
          <button type="button" className={post.viewerSaved ? 'saved' : ''} onClick={onToggleSave} aria-label={`${post.viewerSaved ? 'Unsave' : 'Save'} ${post.title}`} title={post.viewerSaved ? 'Unsave' : 'Save'}><UiIcon name="bookmark"/></button>
          <button type="button" onClick={share} aria-label={`Share ${post.title}`} title="Share"><UiIcon name="share"/></button>
          <Link href={detailUrl} aria-label={`View ${post.title} details`} title="View details"><UiIcon name="arrow-up-right"/></Link>
        </div>
      </div>
    </div>
  </article>;
}
