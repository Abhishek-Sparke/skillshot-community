/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
  const [postSearchQuery, setPostSearchQuery] = useState('');
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
      const res = await fetch(`/api/posts?username=${encodeURIComponent(username)}&limit=50`);
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
      fetch(`/api/posts?username=${encodeURIComponent(username)}&limit=50`)
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
    setPostSearchQuery('');
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
    setPostSearchQuery('');
    setFormError('');
    setFormOpen(true);
    const [postsRes, collectionRes] = await Promise.all([
      fetch(`/api/posts?username=${encodeURIComponent(username)}&limit=50`).then(res => res.ok ? res.json() : { posts: [] }).catch(() => ({ posts: [] })),
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
    setPostSearchQuery('');
  };

  const togglePost = (id: string) => {
    setSelectedPostIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  };

  const selectAllPosts = () => {
    setSelectedPostIds(allPosts.map(p => p.id));
  };

  const clearSelectedPosts = () => {
    setSelectedPostIds([]);
  };

  const filteredPosts = useMemo(() => {
    if (!postSearchQuery.trim()) return allPosts;
    const query = postSearchQuery.trim().toLowerCase();
    return allPosts.filter(p => p.title.toLowerCase().includes(query) || (p.description && p.description.toLowerCase().includes(query)));
  }, [allPosts, postSearchQuery]);

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
        <div className="collectionModalHeader">
          <div className="collectionModalHeaderTitle">
            <span className="collectionModalHeaderIcon">
              <UiIcon name="folder" size={20} />
            </span>
            <div>
              <h3 id="collectionFormTitle">{editing ? 'Edit collection' : 'Create collection'}</h3>
              <p className="collectionModalSubtitle">
                {editing ? 'Update the folder name, description, or selected Skillshots.' : 'Name your folder and select which of your uploaded Skillshots to include.'}
              </p>
            </div>
          </div>
          <button type="button" className="collectionModalCloseBtn" onClick={closeForm} aria-label="Close dialog">
            <UiIcon name="close" size={18} />
          </button>
        </div>

        <form onSubmit={handleSaveCollection} className="collectionModalForm">
          <div className="collectionFormField">
            <div className="collectionFieldLabelRow">
              <label htmlFor="colNameInput">Collection name</label>
              <span className="collectionCharCounter">{newName.length}/60</span>
            </div>
            <input
              id="colNameInput"
              type="text"
              placeholder="e.g. Photography, 3D Art, Best Work"
              value={newName}
              onChange={event => setNewName(event.target.value)}
              maxLength={60}
              required
              autoFocus
            />
          </div>

          <div className="collectionFormField">
            <div className="collectionFieldLabelRow">
              <label htmlFor="colDescInput">Description (optional)</label>
              <span className="collectionCharCounter">{newDesc.length}/280</span>
            </div>
            <textarea
              id="colDescInput"
              placeholder="Brief description of this folder"
              value={newDesc}
              onChange={event => setNewDesc(event.target.value)}
              maxLength={280}
            />
          </div>

          <label className="checkboxLabel collectionPrivacyCheckbox">
            <input type="checkbox" checked={newPrivate} onChange={event => setNewPrivate(event.target.checked)} />
            <div className="checkboxTextGroup">
              <span className="checkboxTitle">
                <UiIcon name={newPrivate ? 'lock' : 'eye'} size={14} />
                Make collection private
              </span>
              <span className="checkboxSub">Only visible to you on your profile</span>
            </div>
          </label>

          <fieldset className="collectionPostPicker">
            <div className="collectionPostPickerHeader">
              <div>
                <legend>Select Skillshots to include</legend>
                <p>Choose from work you uploaded. Selected shots are stored in this folder.</p>
              </div>
              {allPosts.length > 0 && (
                <div className="collectionPickerMeta">
                  <span className="collectionSelectedCounter">
                    <b>{selectedPostIds.length}</b> of {allPosts.length} selected
                  </span>
                  <div className="collectionPickerQuickActions">
                    <button type="button" className="collectionQuickBtn" onClick={selectAllPosts}>
                      Select all
                    </button>
                    <button type="button" className="collectionQuickBtn" onClick={clearSelectedPosts}>
                      Clear
                    </button>
                  </div>
                </div>
              )}
            </div>

            {allPosts.length > 4 && (
              <div className="collectionPickerFilterRow">
                <UiIcon name="search" size={14} />
                <input
                  type="text"
                  placeholder="Filter uploaded Skillshots..."
                  value={postSearchQuery}
                  onChange={e => setPostSearchQuery(e.target.value)}
                />
                {postSearchQuery && (
                  <button type="button" onClick={() => setPostSearchQuery('')} aria-label="Clear search">
                    <UiIcon name="close" size={12} />
                  </button>
                )}
              </div>
            )}

            {allPosts.length ? (
              <div className="collectionPostPickerGrid">
                {filteredPosts.map(post => {
                  const selected = selectedPostIds.includes(post.id);
                  return (
                    <label key={post.id} className={`collectionPostPick ${selected ? 'selected' : ''}`}>
                      <input type="checkbox" checked={selected} onChange={() => togglePost(post.id)} />
                      <div className="collectionPostPickThumb">
                        <img src={post.imageUrl} alt="" loading="lazy" />
                        <span className={`collectionPickCheck ${selected ? 'checked' : ''}`}>
                          {selected && <UiIcon name="check" size={12} />}
                        </span>
                      </div>
                      <span className="collectionPickTitle" title={post.title}>{post.title}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="collectionPostPickerEmpty">
                <UiIcon name="folder" size={32} />
                <p>You have not uploaded any Skillshots yet.</p>
                <Link href="/upload" className="collectionUploadShortcut">
                  <UiIcon name="plus" size={14} /> Upload a Skillshot
                </Link>
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
            <div className="newCollectionBarContainer">
              <button
                type="button"
                className="newCollectionBar"
                onClick={openCreateForm}
                aria-label="Create new collection"
              >
                <div className="newCollectionBarLeft">
                  <span className="newCollectionBarIcon">
                    <UiIcon name="folder" size={20} />
                    <span className="newCollectionBarBadge"><UiIcon name="plus" size={10} /></span>
                  </span>
                  <div className="newCollectionBarInfo">
                    <strong className="newCollectionBarTitle">New collection</strong>
                    <span className="newCollectionBarSubtitle">Organize your uploaded Skillshots into curated folders</span>
                  </div>
                </div>
                <span className="newCollectionBarCta">
                  <UiIcon name="plus" size={14} /> Create folder
                </span>
              </button>
            </div>
          )}

          {loading ? (
            <div className="folderGrid">
              {[0, 1, 2].map(n => <div key={n} className="folderBox folderSkeleton" />)}
            </div>
          ) : collections.length === 0 ? (
            <div className="portfolioEmptyState">
              <span><UiIcon name="folder" size={28}/></span>
              <h3>No collections yet.</h3>
              <p>{isSelf ? 'Create a folder and pick Skillshots you have uploaded.' : 'This creator has not curated any folders yet.'}</p>
              {isSelf && <button type="button" className="primary" onClick={openCreateForm}><UiIcon name="plus"/> Create collection</button>}
            </div>
          ) : (
            <div className="folderGrid">
              {collections.map(collection => (
                <article key={collection.id} className="folderBox">
                  <div className="folderBoxTabRow">
                    <span className="folderTab" title={collection.name}>
                      <UiIcon name="folder" size={13} className="folderTabIcon" />
                      <b className="folderTabTitle">{collection.name}</b>
                      {collection.isPrivate && <UiIcon name="lock" size={11} className="folderTabLock" />}
                    </span>
                    {isSelf && (
                      <div className="folderActions">
                        <button
                          type="button"
                          className="folderActionEdit"
                          title="Edit collection name"
                          aria-label={`Edit ${collection.name}`}
                          onClick={event => openEditForm(collection, event)}
                        >
                          <UiIcon name="edit" size={13} />
                          <span className="folderActionText">Edit</span>
                        </button>
                        <button
                          type="button"
                          className="folderActionDelete"
                          title="Delete collection"
                          aria-label={`Delete ${collection.name}`}
                          onClick={event => handleDeleteCollection(collection.id, event)}
                        >
                          <UiIcon name="trash" size={13} />
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    className="folderBoxHit"
                    onClick={() => setActiveCollectionId(collection.id)}
                    aria-label={`Open folder ${collection.name}`}
                  >
                    <div className="folderBody">
                      {collection.coverUrl ? (
                        <div className="folderCoverWrapper">
                          <img src={collection.coverUrl} alt="" loading="lazy" />
                          <div className="folderCoverGradient" />
                        </div>
                      ) : (
                        <div className="folderPlaceholder">
                          <UiIcon name="folder" size={32} />
                          <span>Empty folder</span>
                        </div>
                      )}
                      <div className="folderMetaBottom">
                        <span className="folderCountPill">
                          <UiIcon name="bookmark" size={10} />
                          {collection.postCount} {collection.postCount === 1 ? 'Skillshot' : 'Skillshots'}
                        </span>
                        {collection.description && (
                          <span className="folderDescTruncate" title={collection.description}>
                            {collection.description}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {mode === 'folders' && activeCollectionId && (
        <>
          <div className="collectionOpenBar">
            <button type="button" className="quietButton backFoldersBtn" onClick={() => setActiveCollectionId(null)}>
              ← All Folders
            </button>
            <div className="collectionOpenTitle">
              <span className="folderTab mini">
                <UiIcon name="folder" size={13} />
                <b>{activeCollection?.name || 'Collection'}</b>
                {activeCollection?.isPrivate && <UiIcon name="lock" size={12} />}
              </span>
              <span className="collectionOpenCount">
                {collectionPosts.length} {collectionPosts.length === 1 ? 'Skillshot' : 'Skillshots'}
              </span>
            </div>
            {isSelf && activeCollection && (
              <div className="collectionOpenActions">
                <button type="button" className="createCollectionBtn editCollectionBtn" onClick={() => openEditForm(activeCollection)}>
                  <UiIcon name="edit" size={14} /> Edit name & posts
                </button>
                <button
                  type="button"
                  className="deleteCollectionBtn"
                  title="Delete collection"
                  aria-label="Delete collection"
                  onClick={event => handleDeleteCollection(activeCollection.id, event)}
                >
                  <UiIcon name="trash" size={14} />
                </button>
              </div>
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
