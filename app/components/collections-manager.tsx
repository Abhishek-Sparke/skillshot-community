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
  mode?: 'gallery' | 'folders';
  onPostSelect?: (post: PortfolioPost) => void;
};

export default function CollectionsManager({ username, isSelf, mode = 'gallery' }: Props) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [collectionPosts, setCollectionPosts] = useState<PortfolioPost[]>([]);
  const [allPosts, setAllPosts] = useState<PortfolioPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Collection | null>(null);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPrivate, setNewPrivate] = useState(false);
  const [selectedPostIds, setSelectedPostIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [previewPost, setPreviewPost] = useState<PortfolioPost | null>(null);
  const [signedIn, setSignedIn] = useState(false);

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

  const loadOwnPosts = useCallback(async () => {
    try {
      const res = await fetch(`/api/posts?username=${encodeURIComponent(username)}&limit=30`);
      if (!res.ok) return;
      const data = await res.json();
      setAllPosts(data.posts || []);
      setSignedIn(Boolean(data.signedIn));
    } catch {
      /* ignore */
    }
  }, [username]);

  useEffect(() => {
    if (mode === 'folders') loadCollections();
    else setLoading(false);
  }, [loadCollections, mode]);

  useEffect(() => {
    let active = true;
    if (mode === 'gallery') {
      setPostsLoading(true);
      fetch(`/api/posts?username=${encodeURIComponent(username)}&limit=30`)
        .then(res => res.json())
        .then(data => {
          if (active) {
            setAllPosts(data.posts || []);
            setSignedIn(Boolean(data.signedIn));
            setPostsLoading(false);
          }
        })
        .catch(() => { if (active) setPostsLoading(false); });
      return () => { active = false; };
    }

    if (!activeCollectionId) {
      setPostsLoading(false);
      return () => { active = false; };
    }

    setPostsLoading(true);
    fetch(`/api/collections/${activeCollectionId}`)
      .then(res => res.json())
      .then(data => {
        if (active) {
          setCollectionPosts(data.collection?.posts || []);
          setPostsLoading(false);
        }
      })
      .catch(() => { if (active) setPostsLoading(false); });
    return () => { active = false; };
  }, [activeCollectionId, mode, username]);

  const openCreateForm = async () => {
    setEditing(null);
    setNewName('');
    setNewDesc('');
    setNewPrivate(false);
    setSelectedPostIds([]);
    setFormError('');
    setFormOpen(true);
    await loadOwnPosts();
  };

  const openEditForm = async (collection: Collection, event?: React.MouseEvent) => {
    event?.stopPropagation();
    setEditing(collection);
    setNewName(collection.name);
    setNewDesc(collection.description);
    setNewPrivate(collection.isPrivate);
    setFormError('');
    setFormOpen(true);
    const [postsRes, collectionRes] = await Promise.all([
      fetch(`/api/posts?username=${encodeURIComponent(username)}&limit=30`).then(res => res.ok ? res.json() : { posts: [] }).catch(() => ({ posts: [] })),
      fetch(`/api/collections/${collection.id}`).then(res => res.ok ? res.json() : null).catch(() => null),
    ]);
    setAllPosts(postsRes.posts || []);
    setSignedIn(Boolean(postsRes.signedIn));
    setSelectedPostIds((collectionRes?.collection?.posts || []).map((post: PortfolioPost) => post.id));
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setFormError('');
  };

  const togglePost = (id: string) => {
    setSelectedPostIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  };

  const handleSaveCollection = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newName.trim() || creating) return;
    setCreating(true);
    setFormError('');
    try {
      const payload = {
        name: newName.trim(),
        description: newDesc.trim(),
        isPrivate: newPrivate,
        postIds: selectedPostIds,
      };
      const res = await fetch(editing ? `/api/collections/${editing.id}` : '/api/collections', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setFormError(data.error || 'Could not save this collection.');
        return;
      }
      closeForm();
      await loadCollections();
      if (editing && activeCollectionId === editing.id) {
        const detail = await fetch(`/api/collections/${editing.id}`).then(item => item.ok ? item.json() : null);
        setCollectionPosts(detail?.collection?.posts || []);
      }
    } catch {
      setFormError('Could not save this collection.');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCollection = async (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!window.confirm('Delete this collection? Skillshots in it will remain in your portfolio.')) return;
    try {
      const res = await fetch(`/api/collections/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (activeCollectionId === id) setActiveCollectionId(null);
        setCollections(prev => prev.filter(collection => collection.id !== id));
      }
    } catch {
      /* ignore */
    }
  };

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

  const currentPosts = mode === 'gallery' ? allPosts : collectionPosts;
  const activeCollection = collections.find(collection => collection.id === activeCollectionId) || null;

  const formModal = formOpen ? (
    <div className="modalOverlay collectionFormOverlay" onClick={closeForm}>
      <div className="collectionModal" onClick={event => event.stopPropagation()} role="dialog" aria-labelledby="collectionFormTitle">
        <h3 id="collectionFormTitle">{editing ? 'Edit collection' : 'Create collection'}</h3>
        <form onSubmit={handleSaveCollection}>
          <label>
            Collection name
            <input
              type="text"
              placeholder="e.g. Photography, Best Work"
              value={newName}
              onChange={event => setNewName(event.target.value)}
              maxLength={60}
              required
              autoFocus
            />
          </label>
          <label>
            Description (optional)
            <textarea
              placeholder="Brief description of this folder"
              value={newDesc}
              onChange={event => setNewDesc(event.target.value)}
              maxLength={280}
            />
          </label>
          <label className="checkboxLabel">
            <input type="checkbox" checked={newPrivate} onChange={event => setNewPrivate(event.target.checked)} />
            <span>Make collection private (only visible to you)</span>
          </label>
          <fieldset className="collectionPostPicker">
            <legend>Select Skillshots to include</legend>
            <p>Choose from work you uploaded. Selected shots are stored in this folder.</p>
            {allPosts.length ? (
              <div className="collectionPostPickerGrid">
                {allPosts.map(post => {
                  const selected = selectedPostIds.includes(post.id);
                  return (
                    <label key={post.id} className={`collectionPostPick ${selected ? 'selected' : ''}`}>
                      <input type="checkbox" checked={selected} onChange={() => togglePost(post.id)} />
                      <img src={post.imageUrl} alt="" />
                      <span>{post.title}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="collectionPostPickerEmpty">
                <p>You have not uploaded any Skillshots yet.</p>
                <Link href="/upload">Upload a Skillshot</Link>
              </div>
            )}
          </fieldset>
          {formError && <p className="collectionFormError" role="alert">{formError}</p>}
          <div className="modalActions">
            <button type="button" className="quietButton" onClick={closeForm}>Cancel</button>
            <button type="submit" className="primary" disabled={creating}>
              {creating ? 'Saving…' : editing ? 'Save collection' : 'Create collection'}
            </button>
          </div>
        </form>
      </div>
    </div>
  ) : null;

  const gallery = (
    <>
      {postsLoading ? (
        <div className="portfolioGridSkeleton">
          {[0, 1, 2, 3].map(n => <div key={n} className="portfolioSkeletonCard" />)}
        </div>
      ) : currentPosts.length === 0 ? (
        <div className="portfolioEmptyState">
          <span><UiIcon name="eye" size={24}/></span>
          <h3>{mode === 'folders' ? 'This collection is empty.' : 'No published Skillshots yet.'}</h3>
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
    </>
  );

  return (
    <div className={`collectionsManager ${mode === 'folders' ? 'collectionsFolders' : 'collectionsGallery'}`}>
      {mode === 'folders' && !activeCollectionId && (
        <>
          {isSelf && (
            <button type="button" className="newCollectionBar" onClick={openCreateForm}>
              <UiIcon name="plus"/> New collection
            </button>
          )}
          {loading ? (
            <div className="folderGrid">
              {[0, 1, 2].map(n => <div key={n} className="folderBox folderSkeleton" />)}
            </div>
          ) : collections.length === 0 ? (
            <div className="portfolioEmptyState">
              <span><UiIcon name="bookmark" size={24}/></span>
              <h3>No collections yet.</h3>
              <p>{isSelf ? 'Create a folder and pick Skillshots you have uploaded.' : 'This creator has not curated any folders yet.'}</p>
              {isSelf && <button type="button" className="primary" onClick={openCreateForm}><UiIcon name="plus"/> Create collection</button>}
            </div>
          ) : (
            <div className="folderGrid">
              {collections.map(collection => (
                <article key={collection.id} className="folderBox">
                  <button type="button" className="folderBoxHit" onClick={() => setActiveCollectionId(collection.id)} aria-label={`Open ${collection.name}`}>
                    <span className="folderTab" title={collection.name}>
                      <b>{collection.name}</b>
                      {collection.isPrivate && <UiIcon name="lock" size={12}/>}
                    </span>
                    <span className="folderBody">
                      {collection.coverUrl ? <img src={collection.coverUrl} alt="" /> : <span className="folderPlaceholder"><UiIcon name="bookmark" size={28}/></span>}
                      <small>{collection.postCount} {collection.postCount === 1 ? 'Skillshot' : 'Skillshots'}</small>
                    </span>
                  </button>
                  {isSelf && (
                    <div className="folderActions">
                      <button type="button" title="Edit collection name" onClick={event => openEditForm(collection, event)}>
                        <UiIcon name="edit" size={14}/>
                      </button>
                      <button type="button" title="Delete collection" onClick={event => handleDeleteCollection(collection.id, event)}>
                        <UiIcon name="trash" size={14}/>
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {mode === 'folders' && activeCollectionId && (
        <>
          <div className="collectionOpenBar">
            <button type="button" className="quietButton" onClick={() => setActiveCollectionId(null)}>← Folders</button>
            <div className="collectionOpenTitle">
              <span className="folderTab mini"><b>{activeCollection?.name || 'Collection'}</b></span>
              {activeCollection?.isPrivate && <UiIcon name="lock" size={14}/>}
            </div>
            {isSelf && activeCollection && (
              <button type="button" className="createCollectionBtn" onClick={() => openEditForm(activeCollection)}>
                <UiIcon name="edit"/> Edit name
              </button>
            )}
          </div>
          {gallery}
        </>
      )}

      {mode === 'gallery' && gallery}
      {formModal}

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
