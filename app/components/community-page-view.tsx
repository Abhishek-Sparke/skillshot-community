/* eslint-disable react-hooks/set-state-in-effect, @next/next/no-img-element */
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import CreatorUsername from './creator-username';
import UiIcon from './ui-icon';
import type { CreatorRankId } from '../../lib/creator-rank';
import type { UserRole } from '../../lib/roles';

export type CommunityAuthor = {
  displayName: string;
  username: string;
  role: UserRole;
  avatarUrl: string;
  creatorRank: CreatorRankId;
};

export type CommunityDiscussion = {
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
  isNew?: boolean;
  reactionCount: number;
  replyCount: number;
  createdAt: number;
  updatedAt: number;
  author: CommunityAuthor;
  viewerReacted: boolean;
  viewerSaved: boolean;
  isOwner: boolean;
};

export type DiscussionReply = {
  id: string;
  body: string;
  createdAt: number;
  author: CommunityAuthor;
  isOwner: boolean;
};

export type CommunityPageViewProps = {
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

const CATEGORIES = [
  'All',
  'General',
  'Feedback',
  'Tutorials',
  'Showcase',
  'Questions',
];

type DiscussionCardProps = {
  discussion: CommunityDiscussion;
  currentUser: CommunityPageViewProps['currentUser'];
  formatDate: (timestamp: number) => string;
  onOpen: (discussion: CommunityDiscussion) => void;
  onReact: (id: string, event?: React.MouseEvent) => void;
  onPin: (id: string, pinned: boolean, event?: React.MouseEvent) => void;
  onLock: (id: string, locked: boolean, event?: React.MouseEvent) => void;
  onDelete: (id: string, event?: React.MouseEvent) => void;
};

function AnnouncementCard({ item, formatDate, onOpen }: { item: CommunityDiscussion; formatDate: (timestamp: number) => string; onOpen: (item: CommunityDiscussion) => void }) {
  return <article className="featuredAnnouncementCard">
    <button type="button" className="featuredAnnouncementHit" onClick={() => onOpen(item)} aria-label={`Read announcement: ${item.title}`} />
    <div className="featuredAnnouncementCopy">
      <div className="featuredAnnouncementLabels">
        <span className="pinnedTypeTag tagAnnouncement"><UiIcon name="announcement" size={14} /> Official announcement</span>
        {item.isNew && <span className="announcementNewBadge">NEW</span>}
        {item.isPinned && <span className="pinnedTypeTag tagPinned"><UiIcon name="pin" size={12} /> Pinned</span>}
      </div>
      <h2>{item.title}</h2>
      {item.summary && <p className="featuredAnnouncementSummary">{item.summary}</p>}
      <div className="featuredAnnouncementAuthor">
        <span className="discAvatar">
          {item.author.avatarUrl ? <img src={item.author.avatarUrl} alt="" /> : <span className="avatarFallback">{item.author.displayName.slice(0, 1).toUpperCase()}</span>}
        </span>
        <div>
          <CreatorUsername name={item.author.displayName} username={item.author.username} role={item.author.role} creatorRank={item.author.creatorRank} />
          <time dateTime={new Date(item.createdAt).toISOString()}>{formatDate(item.createdAt)}</time>
        </div>
      </div>
      <div className="featuredAnnouncementFooter">
        <span><UiIcon name="comment" size={15} /> {item.replyCount}</span>
        <span><UiIcon name="heart" size={15} /> {item.reactionCount}</span>
        <span className="featuredAnnouncementRead">Read announcement <UiIcon name="arrow-up-right" size={14} /></span>
      </div>
    </div>
    {item.imageUrl && <div className="featuredAnnouncementMedia"><img src={item.imageUrl} alt="" />{item.isGif && <span className="gifBadge">GIF</span>}</div>}
  </article>;
}

function DiscussionCard({ discussion: disc, currentUser, formatDate, onOpen, onReact, onPin, onLock, onDelete }: DiscussionCardProps) {
  return <article
    className={`discussionCard ${disc.isPinned ? 'pinnedBorder' : ''}`}
    onClick={() => onOpen(disc)}
    onKeyDown={event => { if (event.key === 'Enter' && event.target === event.currentTarget) onOpen(disc); }}
    role="button"
    tabIndex={0}
    aria-label={`Open discussion: ${disc.title}`}
  >
    <div className="discussionCardIdentity">
      <span className="discAvatar">
        {disc.author.avatarUrl ? <img src={disc.author.avatarUrl} alt="" /> : <span className="avatarFallback">{disc.author.displayName.slice(0, 1).toUpperCase()}</span>}
      </span>
      <div className="discussionCardAuthorCopy">
        <CreatorUsername name={disc.author.displayName} username={disc.author.username} role={disc.author.role} creatorRank={disc.author.creatorRank} enableCard cardData={{ avatarUrl: disc.author.avatarUrl }} />
        <span className="discussionCardMeta">{disc.category} <span aria-hidden="true">·</span> <time dateTime={new Date(disc.createdAt).toISOString()}>{formatDate(disc.createdAt)}</time></span>
      </div>
      {disc.isPinned && <span className="discussionPinnedIcon" title="Pinned discussion"><UiIcon name="pin" size={15} /></span>}
    </div>
    <h3 className="discussionTitle">{disc.title}</h3>
    <p className="discussionPreview">{disc.summary || disc.content.slice(0, 160) + (disc.content.length > 160 ? '…' : '')}</p>
    {disc.imageUrl && <div className="discussionImagePreview"><img src={disc.imageUrl} alt={disc.title} loading="lazy" />{disc.isGif && <span className="gifBadge">GIF</span>}</div>}
    <div className="discussionCardBottom">
      <div className="discussionInteractions">
        <button type="button" className={`reactionBtn ${disc.viewerReacted ? 'reacted' : ''}`} onClick={event => onReact(disc.id, event)} aria-label={`${disc.viewerReacted ? 'Remove reaction from' : 'React to'} ${disc.title}`}><UiIcon name="heart" size={16} /><span>{disc.reactionCount}</span></button>
        <button type="button" className="replyCountBtn" onClick={event => { event.stopPropagation(); onOpen(disc); }} aria-label={`${disc.replyCount} replies`}><UiIcon name="comment" size={16} /><span>{disc.replyCount} {disc.replyCount === 1 ? 'reply' : 'replies'}</span></button>
        <span className={`discussionSaveState ${disc.viewerSaved ? 'saved' : ''}`} title={disc.viewerSaved ? 'Saved' : 'Save available from discussion'}><UiIcon name="bookmark" size={15} /></span>
      </div>
      {currentUser?.isStaff && <div className="staffQuickControls" onClick={event => event.stopPropagation()}>
        <button type="button" className={`staffActionBtn ${disc.isPinned ? 'active' : ''}`} onClick={event => onPin(disc.id, disc.isPinned, event)} title={disc.isPinned ? 'Unpin post' : 'Pin post to top'}><UiIcon name="pin" size={14} /></button>
        <button type="button" className={`staffActionBtn ${disc.isLocked ? 'active' : ''}`} onClick={event => onLock(disc.id, disc.isLocked, event)} title={disc.isLocked ? 'Unlock discussion' : 'Lock discussion'}><UiIcon name="lock" size={14} /></button>
        <button type="button" className="staffActionBtn delete" onClick={event => onDelete(disc.id, event)} title="Delete discussion"><UiIcon name="trash" size={14} /></button>
      </div>}
    </div>
  </article>;
}

export default function CommunityPageView({ currentUser }: CommunityPageViewProps) {
  const [discussions, setDiscussions] = useState<CommunityDiscussion[]>([]);
  const [pinnedDiscussions, setPinnedDiscussions] = useState<CommunityDiscussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState<'latest' | 'trending' | 'most_discussed'>('latest');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeDiscussion, setActiveDiscussion] = useState<CommunityDiscussion | null>(null);
  const [replies, setReplies] = useState<DiscussionReply[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  // Form State
  const [newTitle, setNewTitle] = useState('');
  const [newSummary, setNewSummary] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('General');
  const [newIsAnnouncement, setNewIsAnnouncement] = useState(false);
  const [newIsPinned, setNewIsPinned] = useState(false);
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const [submittingPost, setSubmittingPost] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchDiscussions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('kind', 'discussion');
      if (category !== 'All') {
        params.set('category', category);
      }
      if (sort !== 'latest') params.set('sort', sort);
      if (searchQuery.trim()) params.set('q', searchQuery.trim());

      const res = await fetch(`/api/discussions?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setDiscussions(data.discussions || []);
      }
    } catch (e) {
      console.error('Failed to load discussions', e);
    } finally {
      setLoading(false);
    }
  }, [category, sort, searchQuery]);

  const fetchPinned = useCallback(async () => {
    try {
      const res = await fetch('/api/discussions?kind=announcement');
      if (res.ok) {
        const data = await res.json();
        setPinnedDiscussions((data.discussions || []).slice(0, 3));
      }
    } catch (e) {
      console.error('Failed to load pinned discussions', e);
    }
  }, []);

  useEffect(() => {
    fetchDiscussions();
  }, [fetchDiscussions]);

  useEffect(() => {
    fetchPinned();
  }, [fetchPinned]);

  const openDiscussionModal = async (disc: CommunityDiscussion) => {
    if (disc.isAnnouncement) {
      window.location.href = `/announcements/${encodeURIComponent(disc.id)}`;
      return;
    }
    setActiveDiscussion(disc);
    setLoadingReplies(true);
    setReplies([]);
    try {
      const res = await fetch(`/api/discussions/${disc.id}`);
      if (res.ok) {
        const data = await res.json();
        setActiveDiscussion(data.discussion);
        setReplies(data.discussion.replies || []);
      }
    } catch (e) {
      console.error('Failed to load discussion details', e);
    } finally {
      setLoadingReplies(false);
    }
  };

  const handleToggleReaction = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!currentUser) {
      window.location.href = `/signin?callbackUrl=${encodeURIComponent('/discussion')}`;
      return;
    }

    try {
      const res = await fetch(`/api/discussions/${id}/react`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        const updateItem = (item: CommunityDiscussion) =>
          item.id === id ? { ...item, viewerReacted: data.reacted, reactionCount: data.reactionCount } : item;

        setDiscussions(prev => prev.map(updateItem));
        setPinnedDiscussions(prev => prev.map(updateItem));
        if (activeDiscussion && activeDiscussion.id === id) {
          setActiveDiscussion(prev => prev ? updateItem(prev) : null);
        }
      }
    } catch (e) {
      console.error('Failed to toggle reaction', e);
    }
  };

  const handleTogglePin = async (id: string, currentPinned: boolean, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(`/api/discussions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: !currentPinned }),
      });
      if (res.ok) {
        await Promise.all([fetchDiscussions(), fetchPinned()]);
        if (activeDiscussion && activeDiscussion.id === id) {
          setActiveDiscussion(prev => prev ? { ...prev, isPinned: !currentPinned } : null);
        }
      }
    } catch (e) {
      console.error('Failed to toggle pin', e);
    }
  };

  const handleToggleLock = async (id: string, currentLocked: boolean, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(`/api/discussions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isLocked: !currentLocked }),
      });
      if (res.ok) {
        setDiscussions(prev => prev.map(d => d.id === id ? { ...d, isLocked: !currentLocked } : d));
        if (activeDiscussion && activeDiscussion.id === id) {
          setActiveDiscussion(prev => prev ? { ...prev, isLocked: !currentLocked } : null);
        }
      }
    } catch (e) {
      console.error('Failed to toggle lock', e);
    }
  };

  const handleDeleteDiscussion = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm('Are you sure you want to delete this discussion?')) return;
    try {
      const res = await fetch(`/api/discussions/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDiscussions(prev => prev.filter(d => d.id !== id));
        setPinnedDiscussions(prev => prev.filter(d => d.id !== id));
        if (activeDiscussion && activeDiscussion.id === id) {
          setActiveDiscussion(null);
        }
      }
    } catch (e) {
      console.error('Failed to delete discussion', e);
    }
  };

  const handlePostReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDiscussion || !replyText.trim() || submittingReply) return;
    setSubmittingReply(true);
    try {
      const res = await fetch(`/api/discussions/${activeDiscussion.id}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: replyText.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setReplies(prev => [...prev, data.reply]);
        setReplyText('');
        setActiveDiscussion(prev => prev ? { ...prev, replyCount: prev.replyCount + 1 } : null);
        setDiscussions(prev => prev.map(d => d.id === activeDiscussion.id ? { ...d, replyCount: d.replyCount + 1 } : d));
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to post reply');
      }
    } catch (e) {
      console.error('Failed to post reply', e);
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setNewImageFile(null);
      setNewImagePreview(null);
      return;
    }
    setNewImageFile(file);
    const objectUrl = URL.createObjectURL(file);
    setNewImagePreview(objectUrl);
  };

  const handleCreateDiscussion = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!newTitle.trim()) {
      setFormError('Title is required');
      return;
    }
    if (!newContent.trim()) {
      setFormError('Content is required');
      return;
    }

    setSubmittingPost(true);
    try {
      const formData = new FormData();
      formData.append('title', newTitle.trim());
      formData.append('summary', newSummary.trim());
      formData.append('content', newContent.trim());
      formData.append('category', newIsAnnouncement ? 'Announcements' : newCategory);
      if (newIsAnnouncement) formData.append('isAnnouncement', '1');
      if (newIsPinned) formData.append('isPinned', '1');
      if (newImageFile) formData.append('image', newImageFile);

      const res = await fetch('/api/discussions', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        setIsCreateOpen(false);
        setNewTitle('');
        setNewSummary('');
        setNewContent('');
        setNewCategory('General');
        setNewIsAnnouncement(false);
        setNewIsPinned(false);
        setNewImageFile(null);
        setNewImagePreview(null);
        await Promise.all([fetchDiscussions(), fetchPinned()]);
      } else {
        const err = await res.json();
        setFormError(err.error || 'Failed to create discussion');
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setSubmittingPost(false);
    }
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    const now = Date.now();
    const diff = Math.floor((now - timestamp) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div className="communityPageContainer">
      {/* Header / Hero Section */}
      <section className="communityHero shell">
        <div className="communityHeroInner">
          <div className="communityHeroContent">
            <p className="eyebrow">DISCUSSIONS</p>
            <h1>Talk, learn, and build together.</h1>
            <p>Ask questions, share ideas, get feedback, and connect with Skillshot creators.</p>
          </div>
          <div className="communityHeroActions">
            {currentUser ? (
              <>
                <button
                  type="button"
                  className="button communityHeroBtn"
                  onClick={() => {
                    setNewIsAnnouncement(false);
                    setNewIsPinned(false);
                    setIsCreateOpen(true);
                  }}
                >
                  <UiIcon name="plus" size={17} /> New Discussion
                </button>
                {currentUser.isStaff && (
                  <button
                    type="button"
                    className="button secondary communityHeroBtn announcementBtn"
                    onClick={() => {
                      setNewIsAnnouncement(true);
                      setNewIsPinned(true);
                      setNewCategory('Announcements');
                      setIsCreateOpen(true);
                    }}
                  >
                    <UiIcon name="announcement" size={17} /> Announcement
                  </button>
                )}
              </>
            ) : (
              <Link href="/signin?callbackUrl=/discussion" className="button communityHeroBtn">
                Sign in to participate
              </Link>
            )}
          </div>
        </div>
      </section>

      <div className="communityDiscussionsBody shell">
          {/* Featured official announcement */}
          {pinnedDiscussions.length > 0 && (
            <div className="communityPinnedSection">
              <div className="pinnedHeader">
                <span className="pinnedHeaderBadge">OFFICIAL ANNOUNCEMENTS</span>
              </div>
              <AnnouncementCard item={pinnedDiscussions[0]} formatDate={formatDate} onOpen={openDiscussionModal} />
            </div>
          )}

          {/* Filter Bar & Controls */}
          <div className="communityControlsBar">
            <div className="communityCategoriesScroll">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  className={`categoryPill ${category === cat ? 'active' : ''}`}
                  onClick={() => setCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="communitySearchAndSort">
              <div className="communitySearchWrap">
                <UiIcon name="search" size={18} />
                <input
                  type="text"
                  placeholder="Search discussions, topics, creators, or tags…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="communitySearchInput"
                />
              </div>
              <select
                value={sort}
                onChange={e => setSort(e.target.value as 'latest' | 'trending' | 'most_discussed')}
                className="communitySortSelect"
                aria-label="Sort discussions"
              >
                <option value="latest">Latest</option>
                <option value="trending">Trending</option>
                <option value="most_discussed">Most Discussed</option>
              </select>
            </div>
          </div>

          {/* Discussions List */}
          <div className="discussionFeedHeader">
            <div>
              <p className="eyebrow">DISCUSSIONS</p>
              <h2>Creator conversations</h2>
            </div>
            {!loading && <span>{discussions.length} {discussions.length === 1 ? 'discussion' : 'discussions'}</span>}
          </div>
          {loading ? (
            <div className="communityLoadingState">Loading discussions…</div>
          ) : discussions.length === 0 ? (
            <div className="communityEmptyState">
              <span className="communityEmptyIcon"><UiIcon name="message" size={24} /></span>
              <h3>No discussions yet.</h3>
              <p>Be the first creator to start a conversation.</p>
              {currentUser && (
                <button
                  type="button"
                  className="button"
                  onClick={() => setIsCreateOpen(true)}
                >
                  <UiIcon name="plus" size={16} /> Start Discussion
                </button>
              )}
            </div>
          ) : (
            <div className="discussionsGrid">
              {discussions.map(disc => (
                <DiscussionCard
                  key={disc.id}
                  discussion={disc}
                  currentUser={currentUser}
                  formatDate={formatDate}
                  onOpen={openDiscussionModal}
                  onReact={handleToggleReaction}
                  onPin={handleTogglePin}
                  onLock={handleToggleLock}
                  onDelete={handleDeleteDiscussion}
                />
              ))}
            </div>
          )}
      </div>

      {/* Discussion Detail & Replies Modal */}
      {activeDiscussion && (
        <div className="discussionModalOverlay" onClick={() => setActiveDiscussion(null)}>
          <div className="discussionModalDialog" onClick={e => e.stopPropagation()}>
            <div className="discussionModalHeader">
              <div className="modalHeaderTags">
                {activeDiscussion.isAnnouncement && <span className="discTag tagAnnouncement">Announcement</span>}
                {activeDiscussion.isPinned && <span className="discTag tagPinned">Pinned</span>}
                <span className="discCategory">{activeDiscussion.category}</span>
                {activeDiscussion.isLocked && <span className="discTag tagLocked"><UiIcon name="lock" size={12} /> Locked</span>}
              </div>
              <button
                type="button"
                className="modalCloseButton"
                onClick={() => setActiveDiscussion(null)}
                aria-label="Close dialog"
              >
                <UiIcon name="close" size={19} />
              </button>
            </div>

            <div className="discussionModalScrollable">
              <h2 className="modalDiscussionTitle">{activeDiscussion.title}</h2>

              <div className="modalAuthorBar">
                <div className="modalAuthorInfo">
                  <div className="discAvatar large">
                    {activeDiscussion.author.avatarUrl ? (
                      <img src={activeDiscussion.author.avatarUrl} alt={activeDiscussion.author.displayName} />
                    ) : (
                      <div className="avatarFallback">{activeDiscussion.author.displayName.slice(0, 1).toUpperCase()}</div>
                    )}
                  </div>
                  <div>
                    <CreatorUsername
                      name={activeDiscussion.author.displayName}
                      username={activeDiscussion.author.username}
                      role={activeDiscussion.author.role}
                      creatorRank={activeDiscussion.author.creatorRank}
                      enableCard={true}
                      cardData={{ avatarUrl: activeDiscussion.author.avatarUrl }}
                    />
                    <div className="modalPostDate">{formatDate(activeDiscussion.createdAt)}</div>
                  </div>
                </div>

                <div className="modalAuthorActions">
                  <button
                    type="button"
                    className={`reactionBtn large ${activeDiscussion.viewerReacted ? 'reacted' : ''}`}
                    onClick={() => handleToggleReaction(activeDiscussion.id)}
                  >
                    <UiIcon name="heart" size={17} /> <span>{activeDiscussion.reactionCount}</span>
                  </button>

                  {/* Staff in-app controls */}
                  {currentUser?.isStaff && (
                    <div className="staffModalToolbar">
                      <button
                        type="button"
                        className={`staffActionBtn ${activeDiscussion.isPinned ? 'active' : ''}`}
                        onClick={() => handleTogglePin(activeDiscussion.id, activeDiscussion.isPinned)}
                      >
                        {activeDiscussion.isPinned ? 'Unpin' : 'Pin to Top'}
                      </button>
                      <button
                        type="button"
                        className={`staffActionBtn ${activeDiscussion.isLocked ? 'active' : ''}`}
                        onClick={() => handleToggleLock(activeDiscussion.id, activeDiscussion.isLocked)}
                      >
                        {activeDiscussion.isLocked ? 'Unlock' : 'Lock'}
                      </button>
                      <button
                        type="button"
                        className="staffActionBtn delete"
                        onClick={() => handleDeleteDiscussion(activeDiscussion.id)}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {activeDiscussion.summary && (
                <div className="modalSummaryQuote">
                  {activeDiscussion.summary}
                </div>
              )}

              <div className="modalDiscussionContent">
                {activeDiscussion.content.split('\n').map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>

              {activeDiscussion.imageUrl && (
                <div className="modalAttachedMedia">
                  <img src={activeDiscussion.imageUrl} alt="Attached media" />
                </div>
              )}

              <hr className="modalSeparator" />

              {/* Replies Section */}
              <div className="modalRepliesSection">
                <h3>Replies ({activeDiscussion.replyCount})</h3>

                {loadingReplies ? (
                  <div className="repliesLoading">Loading discussion replies…</div>
                ) : replies.length === 0 ? (
                  <div className="repliesEmpty">No replies yet. Start the conversation!</div>
                ) : (
                  <div className="repliesList">
                    {replies.map(reply => (
                      <div key={reply.id} className="replyItem">
                        <div className="replyAvatar">
                          {reply.author.avatarUrl ? (
                            <img src={reply.author.avatarUrl} alt={reply.author.displayName} />
                          ) : (
                            <div className="avatarFallback">{reply.author.displayName.slice(0, 1).toUpperCase()}</div>
                          )}
                        </div>
                        <div className="replyBodyWrap">
                          <div className="replyMeta">
                            <CreatorUsername
                              name={reply.author.displayName}
                              username={reply.author.username}
                              role={reply.author.role}
                              creatorRank={reply.author.creatorRank}
                              enableCard={true}
                              cardData={{ avatarUrl: reply.author.avatarUrl }}
                            />
                            <span className="replyTime">{formatDate(reply.createdAt)}</span>
                          </div>
                          <p className="replyText">{reply.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Reply Input Box */}
            <div className="modalReplyInputWrap">
              {activeDiscussion.isLocked ? (
                <div className="discussionLockedNotice"><UiIcon name="lock" size={16} /> This discussion has been locked by moderators.</div>
              ) : currentUser ? (
                <form onSubmit={handlePostReply} className="replyForm">
                  <input
                    type="text"
                    placeholder="Write a constructive reply…"
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    maxLength={2000}
                    disabled={submittingReply}
                    className="replyTextInput"
                  />
                  <button
                    type="submit"
                    className="button replySubmitBtn"
                    disabled={!replyText.trim() || submittingReply}
                  >
                    {submittingReply ? 'Posting…' : 'Reply'}
                  </button>
                </form>
              ) : (
                <div className="replySignInPrompt">
                  <Link href={`/signin?callbackUrl=/discussion`}>Sign in</Link> to join this discussion.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Discussion Modal */}
      {isCreateOpen && (
        <div className="discussionModalOverlay" onClick={() => setIsCreateOpen(false)}>
          <div className="discussionModalDialog createModal" onClick={e => e.stopPropagation()}>
            <div className="discussionModalHeader">
              <h2 className="createDiscussionTitle"><UiIcon name={newIsAnnouncement ? 'announcement' : 'message'} size={20} /> {newIsAnnouncement ? 'Create Official Announcement' : 'Start a Discussion'}</h2>
              <button
                type="button"
                className="modalCloseButton"
                onClick={() => setIsCreateOpen(false)}
                aria-label="Close modal"
              >
                <UiIcon name="close" size={19} />
              </button>
            </div>

            <form onSubmit={handleCreateDiscussion} className="createDiscussionForm">
              {formError && <div className="formErrorMessage">{formError}</div>}

              <div className="formField">
                <label htmlFor="discTitle">Title</label>
                <input
                  id="discTitle"
                  type="text"
                  placeholder="What would you like to discuss?"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  maxLength={150}
                  required
                />
              </div>

              {!newIsAnnouncement && (
                <div className="formField">
                  <label htmlFor="discCategory">Category</label>
                  <select
                    id="discCategory"
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                  >
                    <option value="General">General</option>
                    <option value="Feedback">Feedback</option>
                    <option value="Tutorials">Tutorials</option>
                    <option value="Showcase">Showcase</option>
                    <option value="Questions">Questions</option>
                  </select>
                </div>
              )}

              <div className="formField">
                <label htmlFor="discSummary">Short Summary (Optional)</label>
                <input
                  id="discSummary"
                  type="text"
                  placeholder="One sentence overview for previews"
                  value={newSummary}
                  onChange={e => setNewSummary(e.target.value)}
                  maxLength={250}
                />
              </div>

              <div className="formField">
                <label htmlFor="discContent">Content</label>
                <textarea
                  id="discContent"
                  placeholder="Share details, context, questions, or ideas…"
                  value={newContent}
                  onChange={e => setNewContent(e.target.value)}
                  rows={6}
                  maxLength={10000}
                  required
                />
              </div>

              <div className="formField">
                <label htmlFor="discImage">Attach Image / Animated GIF (Optional, up to 8 MB)</label>
                <input
                  id="discImage"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={handleImageChange}
                />
                {newImagePreview && (
                  <div className="createImagePreview">
                    <img src={newImagePreview} alt="Upload preview" />
                    <button
                      type="button"
                      className="removePreviewBtn"
                      onClick={() => {
                        setNewImageFile(null);
                        setNewImagePreview(null);
                      }}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              {currentUser?.isStaff && (
                <div className="staffFormToggles">
                  <label className="checkboxLabel">
                    <input
                      type="checkbox"
                      checked={newIsAnnouncement}
                      onChange={e => setNewIsAnnouncement(e.target.checked)}
                    />
                    <span>Post as Official Announcement</span>
                  </label>
                  <label className="checkboxLabel">
                    <input
                      type="checkbox"
                      checked={newIsPinned}
                      onChange={e => setNewIsPinned(e.target.checked)}
                    />
                    <span>Pin to top carousel</span>
                  </label>
                </div>
              )}

              <div className="formActions">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button"
                  disabled={submittingPost}
                >
                  {submittingPost ? 'Publishing…' : 'Publish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
