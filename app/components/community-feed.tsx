'use client';

import { useEffect, useMemo, useState } from 'react';
import RoleBadge from './role-badge';
import type { UserRole } from '../../lib/roles';

export type CommunityPost = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  author: string;
  username: string;
  authorRole: UserRole;
  createdAt: number;
  reactionCount: number;
  commentCount: number;
  imageUrl: string;
  downloadUrl: string;
  isOwner: boolean;
};

type Props = { mine?: boolean; limit?: number; compact?: boolean };

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'S';
}

export default function CommunityFeed({ mine = false, limit, compact = false }: Props) {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'recent' | 'popular'>('recent');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [previewPost, setPreviewPost] = useState<CommunityPost | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/posts${mine ? '?mine=1' : ''}`)
      .then(async response => {
        if (!response.ok) throw new Error(response.status === 401 ? 'Please sign in to see your posts.' : 'Could not load posts.');
        return response.json();
      })
      .then(data => { if (active) setPosts(data.posts ?? []); })
      .catch(reason => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [mine]);

  useEffect(() => {
    if (!previewPost) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewPost(null);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [previewPost]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    const filtered = posts.filter(post => !term || [post.title, post.description, post.author, post.username, ...post.tags].join(' ').toLowerCase().includes(term));
    filtered.sort((a, b) => sort === 'popular'
      ? (b.reactionCount + b.commentCount) - (a.reactionCount + a.commentCount)
      : b.createdAt - a.createdAt);
    return typeof limit === 'number' ? filtered.slice(0, limit) : filtered;
  }, [posts, query, sort, limit]);

  if (loading) return <div className="feedState"><span className="loader"/> Loading community posts…</div>;
  if (error) return <div className="feedState errorState">{error}</div>;

  return <>
    {!compact && <div className="communityTools">
      <label className="communitySearch">⌕<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search posts, skills, or creators" aria-label="Search community posts"/></label>
      <div className="filters" aria-label="Sort posts">
        <button className={sort === 'recent' ? 'active' : ''} onClick={() => setSort('recent')}>Newest</button>
        <button className={sort === 'popular' ? 'active' : ''} onClick={() => setSort('popular')}>Popular</button>
      </div>
    </div>}

    {visible.length === 0 ? <div className="emptyFeed">
      <span>✦</span>
      <h3>{query ? 'No matching shots yet.' : mine ? 'You have not shared a shot yet.' : 'Be the first creator here.'}</h3>
      <p>{query ? 'Try another search term.' : 'Upload a screenshot and it will appear here.'}</p>
      {!query && <a className="primary" href="/upload">Share a shot →</a>}
    </div> : <div className="grid">
      {visible.map(post => <article className="post" key={post.id}>
        <div className="shot uploadedShot">
          <a className="shotMediaLink" href={`/shots/${post.id}`} aria-label={`Open ${post.title}`}>
            <img src={post.imageUrl} alt={post.title}/>
          </a>
          <button className="shotPreview" type="button" onClick={() => setPreviewPost(post)} aria-haspopup="dialog">
            Preview ↗
          </button>
          <span className="postAvatar" aria-hidden="true">{initials(post.author)}</span>
        </div>
        <div className="meta">
          <div className="user">
            <div className="postIdentity">
              <a className="postTitle" href={`/shots/${post.id}`}>{post.title}</a>
              <small className="authorBlock">
                <span className="authorName"><span>{post.author}</span><RoleBadge role={post.authorRole} /></span>
                <span className="authorHandle">@{post.username}</span>
              </small>
            </div>
          </div>
          <div className="tags">
            {post.tags.slice(0, 3).map(tag => <span key={tag}>{tag}</span>)}
            <span className="postStat">♥ {post.reactionCount}</span>
            <a className="cardDownload" href={post.downloadUrl} title="Download image">↓</a>
          </div>
        </div>
      </article>)}
    </div>}

    {previewPost && <div className="imageLightbox" role="dialog" aria-modal="true" aria-label={`Preview ${previewPost.title}`} onClick={() => setPreviewPost(null)}>
      <div className="imageLightboxPanel" onClick={event => event.stopPropagation()}>
        <div className="imageLightboxTop">
          <div>
            <strong>{previewPost.title}</strong>
            <span>by {previewPost.author}</span>
          </div>
          <button type="button" onClick={() => setPreviewPost(null)} aria-label="Close image preview">×</button>
        </div>
        <img src={previewPost.imageUrl} alt={previewPost.title}/>
      </div>
    </div>}
  </>;
}
