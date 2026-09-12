/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import CreatorUsername from './creator-username';
import UiIcon from './ui-icon';
import type { CreatorRankId } from '../../lib/creator-rank';
import type { UserRole } from '../../lib/roles';

export type DiscussionAuthor = {
  displayName: string;
  username: string;
  role: UserRole;
  avatarUrl: string;
  creatorRank: CreatorRankId;
};

export type DiscussionDetailItem = {
  id: string;
  userId: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  imageUrl: string | null;
  imageType: string | null;
  isGif: boolean;
  isAnnouncement: boolean;
  isPinned: boolean;
  isLocked: boolean;
  reactionCount: number;
  replyCount: number;
  createdAt: number;
  updatedAt: number;
  author: DiscussionAuthor;
  viewerReacted: boolean;
  viewerSaved: boolean;
  isOwner: boolean;
};

export type DiscussionDetailReply = {
  id: string;
  body: string;
  createdAt: number;
  author: DiscussionAuthor;
  isOwner: boolean;
};

export type DiscussionDetailViewProps = {
  initialDiscussion: DiscussionDetailItem;
  initialReplies: DiscussionDetailReply[];
  currentUser?: {
    id: string;
    username: string;
    displayName: string;
    role: UserRole;
    avatarUrl?: string;
    creatorRank?: CreatorRankId;
    isStaff: boolean;
  } | null;
};

function formatRelativeTime(timestamp: number) {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: new Date(timestamp).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
}

function renderTextWithLinks(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.split('\n').map((line, lineIdx) => {
    const parts = line.split(urlRegex);
    return (
      <p key={lineIdx} className="discussionParagraph">
        {parts.map((part, partIdx) => {
          if (part.match(urlRegex)) {
            return (
              <a
                key={partIdx}
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                className="discussionLink"
                onClick={e => e.stopPropagation()}
              >
                {part}
              </a>
            );
          }
          return part;
        })}
      </p>
    );
  });
}

export default function DiscussionDetailView({
  initialDiscussion,
  initialReplies,
  currentUser,
}: DiscussionDetailViewProps) {
  const router = useRouter();
  const [discussion, setDiscussion] = useState<DiscussionDetailItem>(initialDiscussion);
  const [replies, setReplies] = useState<DiscussionDetailReply[]>(initialReplies);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const [imageZoom, setImageZoom] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);
  const [deletingReplyId, setDeletingReplyId] = useState<string | null>(null);

  const handleToggleReaction = async () => {
    if (!currentUser) {
      router.push(`/signin?callbackUrl=${encodeURIComponent(`/discussion/${discussion.id}`)}`);
      return;
    }

    try {
      const res = await fetch(`/api/discussions/${discussion.id}/react`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setDiscussion(prev => ({
          ...prev,
          viewerReacted: data.reacted,
          reactionCount: data.reactionCount,
        }));
      }
    } catch (e) {
      console.error('Failed to react', e);
    }
  };

  const handleToggleSave = async () => {
    if (!currentUser) {
      router.push(`/signin?callbackUrl=${encodeURIComponent(`/discussion/${discussion.id}`)}`);
      return;
    }

    try {
      const res = await fetch(`/api/discussions/${discussion.id}/save`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setDiscussion(prev => ({
          ...prev,
          viewerSaved: data.saved,
        }));
      }
    } catch (e) {
      console.error('Failed to toggle save', e);
    }
  };

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : `/discussion/${discussion.id}`;
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url);
        setCopiedToast(true);
        setTimeout(() => setCopiedToast(false), 2400);
      } catch {
        prompt('Copy discussion link:', url);
      }
    } else {
      prompt('Copy discussion link:', url);
    }
  };

  const handleTogglePin = async () => {
    if (busyAction) return;
    setBusyAction(true);
    try {
      const res = await fetch(`/api/discussions/${discussion.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: !discussion.isPinned }),
      });
      if (res.ok) {
        setDiscussion(prev => ({ ...prev, isPinned: !prev.isPinned }));
      }
    } catch (e) {
      console.error('Failed to toggle pin', e);
    } finally {
      setBusyAction(false);
    }
  };

  const handleToggleLock = async () => {
    if (busyAction) return;
    setBusyAction(true);
    try {
      const res = await fetch(`/api/discussions/${discussion.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isLocked: !discussion.isLocked }),
      });
      if (res.ok) {
        setDiscussion(prev => ({ ...prev, isLocked: !prev.isLocked }));
      }
    } catch (e) {
      console.error('Failed to toggle lock', e);
    } finally {
      setBusyAction(false);
    }
  };

  const handleDeleteDiscussion = async () => {
    if (!confirm('Are you sure you want to permanently delete this discussion?')) return;
    setBusyAction(true);
    try {
      const res = await fetch(`/api/discussions/${discussion.id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/discussion');
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete discussion');
      }
    } catch (e) {
      console.error('Failed to delete discussion', e);
    } finally {
      setBusyAction(false);
    }
  };

  const handlePostReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || submittingReply || discussion.isLocked) return;
    setSubmittingReply(true);

    try {
      const res = await fetch(`/api/discussions/${discussion.id}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: replyText.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setReplies(prev => [...prev, data.reply]);
        setDiscussion(prev => ({ ...prev, replyCount: prev.replyCount + 1 }));
        setReplyText('');
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to post reply');
      }
    } catch (e) {
      console.error('Failed to submit reply', e);
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleDeleteReply = async (replyId: string) => {
    if (!confirm('Delete this reply?')) return;
    setDeletingReplyId(replyId);
    try {
      const res = await fetch(`/api/discussions/${discussion.id}/replies?replyId=${encodeURIComponent(replyId)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setReplies(prev => prev.filter(r => r.id !== replyId));
        setDiscussion(prev => ({ ...prev, replyCount: Math.max(0, prev.replyCount - 1) }));
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete reply');
      }
    } catch (e) {
      console.error('Failed to delete reply', e);
    } finally {
      setDeletingReplyId(null);
    }
  };

  const formattedExactDate = new Date(discussion.createdAt).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <div className="discussionPageWrapper">
      {/* Breadcrumb & Navigation */}
      <nav className="discussionBreadcrumbs" aria-label="Breadcrumb">
        <Link href="/discussion" className="discussionBackLink">
          <span className="backArrow">←</span>
          <span>Back to Discussions</span>
        </Link>
        <span className="breadcrumbSep">/</span>
        <span className="breadcrumbCategory">{discussion.category}</span>
        <span className="breadcrumbSep">/</span>
        <span className="breadcrumbTitle">{discussion.title}</span>
      </nav>

      {/* Main Discussion Article Card */}
      <article className="discussionMainCard">
        {/* Top Badges & Meta */}
        <div className="discussionHeaderBadges">
          <span className={`discussionCategoryBadge cat-${discussion.category.toLowerCase()}`}>
            {discussion.category}
          </span>
          {discussion.isAnnouncement && (
            <span className="discTag tagAnnouncement">
              <UiIcon name="announcement" size={13} />
              <span>Official Announcement</span>
            </span>
          )}
          {discussion.isPinned && (
            <span className="discTag tagPinned">
              <UiIcon name="pin" size={13} />
              <span>Pinned</span>
            </span>
          )}
          {discussion.isLocked && (
            <span className="discTag tagLocked">
              <UiIcon name="lock" size={13} />
              <span>Locked</span>
            </span>
          )}
        </div>

        {/* Discussion Title */}
        <h1 className="discussionDetailTitle">{discussion.title}</h1>

        {/* Author & Action Controls Bar */}
        <div className="discussionAuthorBar">
          <div className="discussionAuthorLeft">
            <div className="discussionAuthorAvatar">
              {discussion.author.avatarUrl ? (
                <img src={discussion.author.avatarUrl} alt={discussion.author.displayName} />
              ) : (
                <div className="avatarFallback">{discussion.author.displayName.slice(0, 1).toUpperCase()}</div>
              )}
            </div>
            <div className="discussionAuthorMeta">
              <CreatorUsername
                name={discussion.author.displayName}
                username={discussion.author.username}
                role={discussion.author.role}
                creatorRank={discussion.author.creatorRank}
              />
              <div className="discussionPostMeta">
                <time dateTime={new Date(discussion.createdAt).toISOString()} title={formattedExactDate}>
                  {formatRelativeTime(discussion.createdAt)}
                </time>
                {discussion.updatedAt > discussion.createdAt + 1000 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="discussionEditedTag">Edited</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="discussionToolbar">
            {/* Reaction Button */}
            <button
              type="button"
              className={`discussionActionBtn reactionBtn ${discussion.viewerReacted ? 'reacted' : ''}`}
              onClick={handleToggleReaction}
              title={discussion.viewerReacted ? 'Unlike' : 'Like discussion'}
              aria-label={`${discussion.reactionCount} likes`}
            >
              <UiIcon name="heart" size={16} />
              <span>{discussion.reactionCount}</span>
            </button>

            {/* Save / Bookmark Button */}
            <button
              type="button"
              className={`discussionActionBtn bookmarkBtn ${discussion.viewerSaved ? 'saved' : ''}`}
              onClick={handleToggleSave}
              title={discussion.viewerSaved ? 'Remove from saved' : 'Save discussion'}
              aria-label="Save discussion"
            >
              <UiIcon name="bookmark" size={15} />
              <span>{discussion.viewerSaved ? 'Saved' : 'Save'}</span>
            </button>

            {/* Share Button */}
            <button
              type="button"
              className="discussionActionBtn shareBtn"
              onClick={handleShare}
              title="Share discussion"
              aria-label="Share discussion"
            >
              <UiIcon name="share" size={15} />
              <span>Share</span>
            </button>

            {/* Staff Moderation Toolbar */}
            {currentUser?.isStaff && (
              <div className="staffDiscussionToolbar">
                <button
                  type="button"
                  className={`staffActionBtn ${discussion.isPinned ? 'active' : ''}`}
                  onClick={handleTogglePin}
                  disabled={busyAction}
                  title={discussion.isPinned ? 'Unpin discussion' : 'Pin to top'}
                >
                  <UiIcon name="pin" size={14} />
                  <span>{discussion.isPinned ? 'Unpin' : 'Pin to Top'}</span>
                </button>
                <button
                  type="button"
                  className={`staffActionBtn ${discussion.isLocked ? 'active' : ''}`}
                  onClick={handleToggleLock}
                  disabled={busyAction}
                  title={discussion.isLocked ? 'Unlock discussion' : 'Lock discussion'}
                >
                  <UiIcon name="lock" size={14} />
                  <span>{discussion.isLocked ? 'Unlock' : 'Lock'}</span>
                </button>
                <button
                  type="button"
                  className="staffActionBtn delete"
                  onClick={handleDeleteDiscussion}
                  disabled={busyAction}
                  title="Delete discussion"
                >
                  <UiIcon name="trash" size={14} />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Summary Callout Box */}
        {discussion.summary && (
          <div className="discussionSummaryQuote">
            <span className="summaryQuoteIcon">&ldquo;</span>
            <p className="summaryQuoteText">{discussion.summary}</p>
          </div>
        )}

        {/* Main Body Content */}
        <div className="discussionBody">
          {renderTextWithLinks(discussion.content)}
        </div>

        {/* Attached Media */}
        {discussion.imageUrl && (
          <div
            className="discussionAttachedMedia"
            onClick={() => setImageZoom(true)}
            role="button"
            tabIndex={0}
            title="Click to expand full image"
          >
            <img src={discussion.imageUrl} alt={discussion.title} />
            {discussion.isGif && <span className="gifBadge">GIF</span>}
            <span className="mediaZoomHint">
              <UiIcon name="eye" size={14} /> Expand image
            </span>
          </div>
        )}

        {/* Discussion Stats Footer */}
        <div className="discussionStatsFooter">
          <span className="statsItem">
            <UiIcon name="heart" size={15} />
            <strong>{discussion.reactionCount}</strong> {discussion.reactionCount === 1 ? 'reaction' : 'reactions'}
          </span>
          <span className="statsItem">
            <UiIcon name="comment" size={15} />
            <strong>{discussion.replyCount}</strong> {discussion.replyCount === 1 ? 'reply' : 'replies'}
          </span>
          <span className="statsItem date">
            Published on {formattedExactDate}
          </span>
        </div>
      </article>

      {/* Lightbox Image Zoom */}
      {imageZoom && discussion.imageUrl && (
        <div className="discussionLightboxOverlay" onClick={() => setImageZoom(false)}>
          <div className="discussionLightboxContent" onClick={e => e.stopPropagation()}>
            <img src={discussion.imageUrl} alt={discussion.title} />
            <button
              type="button"
              className="discussionLightboxClose"
              onClick={() => setImageZoom(false)}
              aria-label="Close image zoom"
            >
              <UiIcon name="close" size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Discussion Replies Section */}
      <section className="discussionRepliesCard" id="replies">
        <div className="discussionRepliesHeader">
          <h2>
            <UiIcon name="comment" size={20} />
            <span>Replies</span>
            <span className="replyCountBadge">{replies.length}</span>
          </h2>
        </div>

        {/* Locked Notice */}
        {discussion.isLocked && (
          <div className="discussionLockedNoticeBanner">
            <UiIcon name="lock" size={16} />
            <span>This discussion is locked. New replies cannot be added.</span>
          </div>
        )}

        {/* Reply Composer */}
        {!discussion.isLocked && (
          <div className="discussionReplyComposer">
            {currentUser ? (
              <form onSubmit={handlePostReply} className="discussionReplyForm">
                <div className="replyFormHeader">
                  <div className="replyUserMini">
                    {currentUser.avatarUrl ? (
                      <img src={currentUser.avatarUrl} alt={currentUser.displayName} />
                    ) : (
                      <div className="avatarFallback">{currentUser.displayName.slice(0, 1).toUpperCase()}</div>
                    )}
                    <span>Replying as <strong>{currentUser.displayName}</strong></span>
                  </div>
                </div>
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Write a constructive reply or share your thoughts…"
                  rows={4}
                  maxLength={2000}
                  className="discussionReplyTextarea"
                  disabled={submittingReply}
                  required
                />
                <div className="replyComposerFooter">
                  <span className="replyCharCount">{replyText.length} / 2000</span>
                  <div className="replyComposerButtons">
                    {replyText.trim() && (
                      <button
                        type="button"
                        className="button secondary sm"
                        onClick={() => setReplyText('')}
                        disabled={submittingReply}
                      >
                        Clear
                      </button>
                    )}
                    <button
                      type="submit"
                      className="button sm"
                      disabled={submittingReply || !replyText.trim()}
                    >
                      {submittingReply ? 'Posting…' : 'Post Reply'}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="discussionSignInPrompt">
                <p>Join the conversation and share your feedback with creators.</p>
                <Link
                  href={`/signin?callbackUrl=${encodeURIComponent(`/discussion/${discussion.id}`)}`}
                  className="button sm"
                >
                  Sign in to reply
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Replies List */}
        <div className="discussionRepliesList">
          {replies.length === 0 ? (
            <div className="discussionRepliesEmpty">
              <div className="emptyRepliesIcon">
                <UiIcon name="message" size={24} />
              </div>
              <h3>No replies yet.</h3>
              <p>Be the first creator to start the conversation!</p>
            </div>
          ) : (
            replies.map(reply => (
              <div key={reply.id} className="discussionReplyCard">
                <div className="replyCardAvatar">
                  {reply.author.avatarUrl ? (
                    <img src={reply.author.avatarUrl} alt={reply.author.displayName} />
                  ) : (
                    <div className="avatarFallback">{reply.author.displayName.slice(0, 1).toUpperCase()}</div>
                  )}
                </div>
                <div className="replyCardContent">
                  <div className="replyCardTop">
                    <div className="replyAuthorDetails">
                      <CreatorUsername
                        name={reply.author.displayName}
                        username={reply.author.username}
                        role={reply.author.role}
                        creatorRank={reply.author.creatorRank}
                      />
                      <time dateTime={new Date(reply.createdAt).toISOString()} className="replyCardTime">
                        {formatRelativeTime(reply.createdAt)}
                      </time>
                    </div>

                    {/* Delete reply if owner or staff */}
                    {(currentUser?.isStaff || reply.isOwner) && (
                      <button
                        type="button"
                        className="replyDeleteAction"
                        onClick={() => handleDeleteReply(reply.id)}
                        disabled={deletingReplyId === reply.id}
                        title="Delete reply"
                        aria-label="Delete reply"
                      >
                        <UiIcon name="trash" size={13} />
                      </button>
                    )}
                  </div>
                  <div className="replyCardBody">
                    {reply.body.split('\n').map((para, idx) => (
                      <p key={idx}>{para}</p>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Copy Toast Notification */}
      {copiedToast && (
        <div className="discussionToastNotification" role="status">
          <UiIcon name="check" size={16} />
          <span>Discussion link copied to clipboard!</span>
        </div>
      )}
    </div>
  );
}
