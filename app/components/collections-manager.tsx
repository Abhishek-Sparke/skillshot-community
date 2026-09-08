/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import ImageViewer from './image-viewer';
import UiIcon from './ui-icon';
import PortfolioSkillshotCard, { type PortfolioCardPost } from './portfolio-skillshot-card';
import { requireClientAuth, signInPath } from '../../lib/auth-path';
import type { UserRole } from '../../lib/roles';
import type { CreatorRankId } from '../../lib/creator-rank';

export type Collection = {
  id: string;
  name: string;
  description: string;
  coverUrl: string | null;
  isPrivate: boolean;
  isFeatured: boolean;
  position: number;
  postCount: number;
};

export type PortfolioPost = PortfolioCardPost & {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  previewUrl: string;
  imageWidth: number;
  imageHeight: number;
  isGif: boolean;
  reactionCount: number;
  commentCount: number;
  category?: string;
  skills?: string[];
  createdAt: number;
  author?: string;
  username?: string;
  avatarUrl?: string;
  creatorRank?: CreatorRankId;
  authorRole?: UserRole;
  viewerSaved?: boolean;
};

type Props = {
  username: string;
  isSelf: boolean;
  onPostSelect?: (post: PortfolioPost) => void;
};

export default function CollectionsManager({ username, isSelf }: Props) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [collectionPosts, setCollectionPosts] = useState<PortfolioPost[]>([]);
  const [allPosts, setAllPosts] = useState<PortfolioPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPrivate, setNewPrivate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [previewPost, setPreviewPost] = useState<PortfolioPost | null>(null);
  const [signedIn, setSignedIn] = useState(false);

  // Load collections
  const loadCollections = useCallback(async () => {
    try {
      const res = await fetch(`/api/collections?username=${encodeURIComponent(username)}`);
      if (res.ok) {
        const data = await res.json();
        setCollections(data.collections || []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  // Load posts for active collection or all posts
  useEffect(() => {
    let active = true;
    setPostsLoading(true);
    if (!activeCollectionId) {
      // Load all creator posts
      fetch(`/api/posts?username=${encodeURIComponent(username)}&limit=40`)
        .then(res => res.json())
        .then(data => {
          if (active) {
            setAllPosts(data.posts || []);
            setSignedIn(Boolean(data.signedIn));
            setPostsLoading(false);
          }
        })
        .catch(() => { if (active) setPostsLoading(false); });
    } else {
      // Load specific collection posts
      fetch(`/api/collections/${activeCollectionId}`)
        .then(res => res.json())
        .then(data => {
          if (active) {
            setCollectionPosts(data.collection?.posts || []);
            setPostsLoading(false);
          }
        })
        .catch(() => { if (active) setPostsLoading(false); });
    }
    return () => { active = false; };
  }, [activeCollectionId, username]);

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDesc.trim(),
          isPrivate: newPrivate,
        }),
      });
      if (res.ok) {
        setNewName('');
        setNewDesc('');
        setNewPrivate(false);
        setShowCreateModal(false);
        loadCollections();
      }
    } catch {
      /* ignore */
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCollection = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Delete this collection? Skillshots in it will remain in your portfolio.')) return;
    try {
      const res = await fetch(`/api/collections/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (activeCollectionId === id) setActiveCollectionId(null);
        setCollections(prev => prev.filter(c => c.id !== id));
      }
    } catch {
      /* ignore */
    }
  };

  const currentPosts = activeCollectionId ? collectionPosts : allPosts;

  async function toggleSave(post: PortfolioPost) {
    if (!requireClientAuth(signedIn, `/shots/${post.id}`, 'Sign in to save this Skillshot')) return;
    const response = await fetch(`/api/posts/${post.id}/save`, { method: 'POST' });
    if (response.status === 401) {
      window.location.assign(signInPath(`/shots/${post.id}`, 'Sign in to save this Skillshot'));
      return;
    }
    if (!response.ok) return;
    const data = await response.json();
    const update = (items: PortfolioPost[]) => items.map(item => item.id === post.id ? { ...item, viewerSaved: Boolean(data.saved) } : item);
    setAllPosts(update);
    setCollectionPosts(update);
  }

  return (
    <div className="collectionsManager">
      {/* Collections filter bar */}
      <div className="collectionsTabBar">
        <div className="collectionsScroll">
          <button
            type="button"
            className={`collectionChip ${activeCollectionId === null ? 'active' : ''}`}
            onClick={() => setActiveCollectionId(null)}
          >
            All Work
          </button>
          {collections.map(col => (
            <div key={col.id} className="collectionChipWrap">
              <button
                type="button"
                className={`collectionChip ${activeCollectionId === col.id ? 'active' : ''}`}
                onClick={() => setActiveCollectionId(col.id)}
              >
                {col.name} <span className="chipCount">({col.postCount})</span>
                {col.isPrivate && <span className="privateBadge" title="Private"><UiIcon name="lock" size={12}/></span>}
              </button>
              {isSelf && (
                <button
                  type="button"
                  className="chipDeleteBtn"
                  title="Delete collection"
                  onClick={e => handleDeleteCollection(col.id, e)}
                >
                  <UiIcon name="close" size={13}/>
                </button>
              )}
            </div>
          ))}
        </div>

        {isSelf && (
          <button
            type="button"
            className="createCollectionBtn"
            onClick={() => setShowCreateModal(true)}
          >
            <UiIcon name="plus"/> Collection
          </button>
        )}
      </div>

      {/* Modal for creating collection */}
      {showCreateModal && (
        <div className="modalOverlay" onClick={() => setShowCreateModal(false)}>
          <div className="collectionModal" onClick={e => e.stopPropagation()}>
            <h3>Create Collection</h3>
            <form onSubmit={handleCreateCollection}>
              <label>
                Collection Name
                <input
                  type="text"
                  placeholder="e.g. Photography, Bleach Collection, Best Work"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  maxLength={60}
                  required
                  autoFocus
                />
              </label>
              <label>
                Description (optional)
                <textarea
                  placeholder="Brief description of this collection"
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  maxLength={280}
                />
              </label>
              <label className="checkboxLabel">
                <input
                  type="checkbox"
                  checked={newPrivate}
                  onChange={e => setNewPrivate(e.target.checked)}
                />
                <span>Make collection private (only visible to you)</span>
              </label>
              <div className="modalActions">
                <button type="button" className="quietButton" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary" disabled={creating}>
                  {creating ? 'Creating…' : 'Create Collection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Portfolio Gallery: exactly 2 Skillshots per row on mobile, 3-4 columns desktop */}
      {postsLoading ? (
        <div className="portfolioGridSkeleton">
          {[0, 1, 2, 3].map(n => (
            <div key={n} className="portfolioSkeletonCard" />
          ))}
        </div>
      ) : currentPosts.length === 0 ? (
        <div className="portfolioEmptyState">
          <span><UiIcon name="eye" size={24}/></span>
          <h3>{activeCollectionId ? 'This collection is empty.' : 'No published Skillshots yet.'}</h3>
          <p>{isSelf ? 'Share something you’re proud of with the community.' : 'This creator has not shared any work here yet.'}</p>
          {isSelf && <Link className="primary" href="/upload"><UiIcon name="plus"/> Create your first Skillshot</Link>}
        </div>
      ) : (
        <div className="portfolioGalleryGrid">
          {currentPosts.map(post => (
            <PortfolioSkillshotCard
              key={post.id}
              post={post}
              fallbackUsername={username}
              onPreview={() => setPreviewPost(post)}
              onToggleSave={() => toggleSave(post)}
            />
          ))}
        </div>
      )}

      {/* Lightbox / Preview */}
      {previewPost && (
        <ImageViewer
          src={previewPost.previewUrl || previewPost.imageUrl}
          alt={previewPost.title}
          title={previewPost.title}
          subtitle={`by ${username}`}
          onClose={() => setPreviewPost(null)}
        />
      )}
    </div>
  );
}
