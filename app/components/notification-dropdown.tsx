'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import CreatorRankBadge from './creator-rank-badge';

export type NotificationCategory = 'discussion' | 'post' | 'support';

export interface NotificationItem {
  id: string;
  type: string;
  category: NotificationCategory;
  title: string;
  body: string;
  targetUrl: string | null;
  targetId: string | null;
  thumbnailUrl: string | null;
  staffComment: string | null;
  commentVisibility: string;
  readAt: string | null;
  createdAt: number;
  actor: {
    displayName: string;
    username: string;
    role: string;
    creatorRank: string;
    avatarUrl: string;
  } | null;
}

interface NotificationCounts {
  total: number;
  discussion: number;
  post: number;
  support: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onUnreadChange?: (unread: number) => void;
}

function formatRelativeTime(timestamp: number | string): string {
  const ms = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
  if (isNaN(ms)) return '';
  const diffSec = Math.floor((Date.now() - ms) / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

export default function NotificationDropdown({ isOpen, onClose, onUnreadChange }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<NotificationCategory>('discussion');
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [counts, setCounts] = useState<NotificationCounts>({ total: 0, discussion: 0, post: 0, support: 0 });
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [activeTooltipId, setActiveTooltipId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/notifications', { credentials: 'same-origin', cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.notifications)) {
        setItems(data.notifications);
      }
      if (data.counts) {
        setCounts(data.counts);
        onUnreadChange?.(data.counts.total ?? 0);
      } else if (typeof data.unread === 'number') {
        onUnreadChange?.(data.unread);
      }
    } catch {
      // Silently handle offline/network errors
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleUpdate = () => {
      fetchNotifications();
    };
    window.addEventListener('notifications:updated', handleUpdate);
    return () => {
      window.removeEventListener('notifications:updated', handleUpdate);
    };
  }, []);

  // When notifications load, auto-switch to first tab that has unread items if current tab has none
  useEffect(() => {
    if (counts.discussion > 0) {
      setActiveTab('discussion');
    } else if (counts.post > 0) {
      setActiveTab('post');
    } else if (counts.support > 0) {
      setActiveTab('support');
    }
  }, [counts.discussion, counts.post, counts.support]);

  const markAllAsRead = async () => {
    if (markingAll) return;
    try {
      setMarkingAll(true);
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ all: true, category: activeTab }),
      });

      const now = new Date().toISOString();
      setItems(prev =>
        prev.map(item => (item.category === activeTab ? { ...item, readAt: item.readAt || now } : item))
      );
      setCounts(prev => {
        const next = { ...prev, [activeTab]: 0 };
        next.total = next.discussion + next.post + next.support;
        onUnreadChange?.(next.total);
        return next;
      });

      window.dispatchEvent(new CustomEvent('notifications:updated'));
    } catch {
      // Ignore network errors
    } finally {
      setMarkingAll(false);
    }
  };

  const handleItemClick = async (item: NotificationItem, e: React.MouseEvent) => {
    // If tooltip button or inside popover was clicked, don't navigate
    if ((e.target as HTMLElement).closest('.notifTooltipTrigger') || (e.target as HTMLElement).closest('.notifCommentPopover')) {
      return;
    }

    if (!item.readAt) {
      const now = new Date().toISOString();
      setItems(prev =>
        prev.map(i => (i.id === item.id ? { ...i, readAt: now } : i))
      );
      setCounts(prev => {
        const cat = item.category;
        const next = {
          ...prev,
          [cat]: Math.max(0, prev[cat] - 1),
          total: Math.max(0, prev.total - 1),
        };
        onUnreadChange?.(next.total);
        return next;
      });

      try {
        fetch('/api/notifications', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: item.id }),
        }).then(() => {
          window.dispatchEvent(new CustomEvent('notifications:updated'));
        });
      } catch {}
    }

    onClose();

    const destination = item.targetUrl || (item.category === 'support' && item.targetId ? `/support/reports/${item.targetId}` : '/notifications');
    router.push(destination);
  };

  const filteredItems = items.filter(item => item.category === activeTab);

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className="notifDropdownPanel"
      role="dialog"
      aria-label="Notifications"
      aria-modal="false"
    >
      {/* 3 TABS HEADER */}
      <div className="notifTabsHeader" role="tablist">
        <button
          type="button"
          role="tab"
          id="tab-discussion"
          aria-selected={activeTab === 'discussion'}
          aria-controls="notif-panel-discussion"
          className={`notifTabBtn ${activeTab === 'discussion' ? 'active' : ''}`}
          onClick={() => setActiveTab('discussion')}
        >
          <span>Discussion</span>
          {counts.discussion > 0 && (
            <span className="notifTabCountBadge">{counts.discussion}</span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          id="tab-post"
          aria-selected={activeTab === 'post'}
          aria-controls="notif-panel-post"
          className={`notifTabBtn ${activeTab === 'post' ? 'active' : ''}`}
          onClick={() => setActiveTab('post')}
        >
          <span>Post</span>
          {counts.post > 0 && (
            <span className="notifTabCountBadge">{counts.post}</span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          id="tab-support"
          aria-selected={activeTab === 'support'}
          aria-controls="notif-panel-support"
          className={`notifTabBtn ${activeTab === 'support' ? 'active' : ''}`}
          onClick={() => setActiveTab('support')}
        >
          <span>Support</span>
          {counts.support > 0 && (
            <span className="notifTabCountBadge">{counts.support}</span>
          )}
        </button>
      </div>

      {/* SUB-BAR: MARK ALL AS READ */}
      <div className="notifSubBar">
        <button
          type="button"
          className="notifMarkAllBtn"
          onClick={markAllAsRead}
          disabled={markingAll || counts[activeTab] === 0}
          title="Mark all notifications in this tab as read"
        >
          {markingAll ? 'MARKING AS READ…' : 'MARK ALL AS READ'}
        </button>
      </div>

      {/* NOTIFICATIONS LIST CONTAINER */}
      <div
        id={`notif-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        className="notifListContainer"
      >
        {loading && items.length === 0 ? (
          <div className="notifLoadingState">Loading notifications…</div>
        ) : filteredItems.length === 0 ? (
          <div className="notifEmptyState">
            <div className="notifEmptyIcon">
              {activeTab === 'discussion' ? '💬' : activeTab === 'post' ? '🎨' : '🛡️'}
            </div>
            <p className="notifEmptyTitle">
              {activeTab === 'discussion'
                ? 'No discussion notifications yet'
                : activeTab === 'post'
                ? 'No post notifications yet'
                : 'No support notifications yet'}
            </p>
            <p className="notifEmptySubtitle">
              {activeTab === 'discussion'
                ? 'Replies and mentions in community discussions will appear here.'
                : activeTab === 'post'
                ? 'Likes, comments, and mentions on your Skillshots will appear here.'
                : 'Updates on your reports and moderation notices will appear here.'}
            </p>
          </div>
        ) : (
          <div className="notifItemsList">
            {filteredItems.map(item => {
              const isUnread = !item.readAt;
              const hasStaffComment = Boolean(item.staffComment);
              const tooltipOpen = activeTooltipId === item.id;

              return (
                <article
                  key={item.id}
                  className={`notifItem ${isUnread ? 'unread' : 'read'}`}
                  onClick={e => handleItemClick(item, e)}
                  tabIndex={0}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleItemClick(item, e as any);
                    }
                  }}
                >
                  {/* Left: Avatar or Category Icon */}
                  <div className="notifActorAvatarWrap">
                    {item.actor?.avatarUrl ? (
                      <img
                        src={item.actor.avatarUrl}
                        alt={item.actor.displayName}
                        className="notifActorAvatarImg"
                      />
                    ) : item.actor?.displayName ? (
                      <div className="notifActorAvatarFallback">
                        {item.actor.displayName.charAt(0).toUpperCase()}
                      </div>
                    ) : (
                      <div className="notifSupportIconBadge">
                        {activeTab === 'support' ? (
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                          </svg>
                        ) : (
                          <span>⚡</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Center: Details */}
                  <div className="notifItemBody">
                    <div className="notifItemContent">
                      {item.actor && (
                        <span className="notifActorName">
                          {item.actor.displayName}
                          {item.actor.creatorRank && item.actor.creatorRank !== 'NEWCOMER' && (
                            <span className="notifRankBadgeInline">
                              <CreatorRankBadge rank={item.actor.creatorRank} size="sm" />
                            </span>
                          )}
                        </span>
                      )}{' '}
                      <span className="notifActionText">
                        {renderActionText(item)}
                      </span>
                    </div>

                    {/* Support Staff Comment with Popover/Tooltip */}
                    {hasStaffComment && (
                      <div
                        className="notifStaffCommentNotice"
                        onMouseEnter={() => setActiveTooltipId(item.id)}
                        onMouseLeave={() => setActiveTooltipId(null)}
                      >
                        <div className="notifStaffCommentPreview">
                          <span className="notifModBadge">🛡️ Moderator Note</span>
                          <span className="notifCommentExcerpt">
                            &ldquo;{item.staffComment}&rdquo;
                          </span>
                          <button
                            type="button"
                            className="notifTooltipTrigger"
                            aria-label="View moderator comment"
                            onClick={e => {
                              e.stopPropagation();
                              setActiveTooltipId(prev => (prev === item.id ? null : item.id));
                            }}
                          >
                            ℹ️
                          </button>
                        </div>

                        {tooltipOpen && (
                          <div
                            className="notifCommentPopover"
                            role="tooltip"
                            onClick={e => e.stopPropagation()}
                          >
                            <div className="notifCommentPopoverHeader">
                              <strong>Moderator Response</strong>
                              <span className="notifReadOnlyTag">Read-only</span>
                            </div>
                            <p className="notifCommentPopoverText">{item.staffComment}</p>
                            <div className="notifCommentPopoverFooter">
                              Replies and direct messaging are disabled for support resolutions.
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Timestamp */}
                    <div className="notifItemMeta">
                      <time dateTime={new Date(item.createdAt).toISOString()}>
                        {formatRelativeTime(item.createdAt)}
                      </time>
                    </div>
                  </div>

                  {/* Right: Post Thumbnail and Unread Indicator */}
                  <div className="notifItemRight">
                    {item.thumbnailUrl && (
                      <div className="notifThumbnailWrap">
                        <img
                          src={item.thumbnailUrl}
                          alt="Thumbnail"
                          className="notifThumbnailImg"
                        />
                      </div>
                    )}
                    {isUnread && <span className="notifUnreadDot" aria-label="Unread" />}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div className="notifDropdownFooter">
        <Link
          href="/notifications"
          className="notifViewAllLink"
          onClick={onClose}
        >
          View all notifications →
        </Link>
      </div>
    </div>
  );
}

function renderActionText(item: NotificationItem): string {
  if (item.category === 'discussion') {
    if (item.type.includes('REPLY')) {
      return item.title.includes('replied to') ? item.title.replace(/^.*?replied to/, 'replied to') : `replied to "${item.title}"`;
    }
    if (item.type.includes('MENTION')) {
      return item.title.includes('mentioned you') ? item.title.replace(/^.*?mentioned you/, 'mentioned you') : `mentioned you in "${item.title}"`;
    }
    if (item.type.includes('LIKE')) {
      return item.title.includes('liked your') ? item.title.replace(/^.*?liked your/, 'liked your') : `liked your discussion "${item.title}"`;
    }
    return item.body || item.title;
  }

  if (item.category === 'post') {
    if (item.type === 'LIKE') {
      return 'liked your post';
    }
    if (item.type === 'COMMENT') {
      return 'commented on your post';
    }
    if (item.type === 'COMMENT_REPLY') {
      return 'replied to your comment';
    }
    if (item.type === 'MENTION') {
      return 'mentioned you in a comment';
    }
    return item.body || item.title;
  }

  // Support
  return item.body || item.title;
}
