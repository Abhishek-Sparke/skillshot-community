'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import CreatorUsername from './creator-username';
import ReportButton from './report-button';
import ImageViewer from './image-viewer';
import CommentConversation from './comment-conversation';
import type { UserRole } from '../../lib/roles';
import type { CreatorRankId } from '../../lib/creator-rank';
import { requireClientAuth, signInPath } from '../../lib/auth-path';

type CaptureSpecs = {
  game?: string;
  platform?: string;
  resolution?: string;
  tools?: string[] | string;
};

type Post = {
  id: string; title: string; description: string; tags: string[]; skills: string[]; category: string; author: string; username: string;
  avatarUrl: string; authorRole: UserRole; creatorRank: CreatorRankId; createdAt: number; reactionCount: number; commentCount: number; viewerLiked: boolean; viewerSaved?: boolean;
  signedIn: boolean; isOwner: boolean; canPin: boolean; isPinned?: boolean; commentReview: { hide: boolean; delete: boolean } | null; imageUrl: string; previewUrl: string; downloadUrl: string; imageWidth: number; imageHeight: number;
  captureSpecs?: CaptureSpecs;
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'S';
}

export default function ShotDetail({ id }: { id: string }) {
  const [post, setPost] = useState<Post | null>(null);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [sharedLabel, setSharedLabel] = useState('Share');
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/posts/' + id)
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(data => { if (active) setPost(data.post); })
      .catch(() => { if (active) setStatus('This Skillshot could not be found.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  const closeViewer = useCallback(() => setViewerOpen(false), []);

  async function toggleLike() {
    if (!post) return;
    if (!requireClientAuth(post.signedIn, '/shots/' + id, 'Sign in to like this Skillshot')) return;
    const response = await fetch('/api/posts/' + id + '/react', { method: 'POST' });
    if (response.status === 401) {
      window.location.assign(signInPath('/shots/' + id, 'Sign in to like this Skillshot'));
      return;
    }
    if (!response.ok) {
      setStatus('Could not update your reaction.');
      return;
    }
    const data = await response.json();
    setPost(current => current ? { ...current, viewerLiked: data.liked, reactionCount: Math.max(0, current.reactionCount + (data.liked ? 1 : -1)) } : current);
    setStatus('');
  }

  async function toggleSave() {
    if (!post) return;
    if (!requireClientAuth(post.signedIn, '/shots/' + id, 'Sign in to save this Skillshot')) return;
    const response = await fetch('/api/posts/' + id + '/save', { method: 'POST' });
    if (response.status === 401) {
      window.location.assign(signInPath('/shots/' + id, 'Sign in to save this Skillshot'));
      return;
    }
    if (!response.ok) {
      setStatus('Could not update your saved status.');
      return;
    }
    const data = await response.json();
    setPost(current => current ? { ...current, viewerSaved: Boolean(data.saved) } : current);
    setStatus('');
  }

  async function togglePin() {
    if (!post || !post.isOwner) return;
    const response = await fetch('/api/posts/' + id + '/pin', { method: 'POST' });
    if (!response.ok) {
      setStatus('Could not update pinned status.');
      return;
    }
    const data = await response.json();
    setPost(current => current ? { ...current, isPinned: Boolean(data.pinned) } : current);
    setStatus(data.message || 'Updated pinned status.');
  }

  async function shareSkillshot() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setSharedLabel('Copied!');
      setTimeout(() => setSharedLabel('Share'), 2000);
    } catch {
      setStatus('Could not copy link.');
    }
  }

  async function deletePost() {
    if (!window.confirm('Delete this Skillshot? It will be hidden immediately and retained briefly for safety review.')) return;
    const response = await fetch('/api/posts/' + id, { method: 'DELETE' });
    if (!response.ok) {
      setStatus('Could not delete this Skillshot.');
      return;
    }
    window.location.assign('/my-posts');
  }

  if (loading) return (
    <main className="detailPage shell">
      <div className="detailSkeleton" aria-live="polite">
        <span />
        <div><i /><i /><i /></div>
      </div>
    </main>
  );

  if (!post) return (
    <main className="formPage">
      <section className="detail">
        <h1>Skillshot not found</h1>
        <p>{status}</p>
        <Link className="backHome" href="/community">← Back to community</Link>
      </section>
    </main>
  );

  const rawTools = post.captureSpecs?.tools;
  const toolsList: string[] = Array.isArray(rawTools)
    ? rawTools
    : typeof rawTools === 'string' && rawTools
    ? rawTools.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const hasSpecs = Boolean(
    post.captureSpecs?.game ||
    post.captureSpecs?.platform ||
    post.captureSpecs?.resolution ||
    toolsList.length > 0 ||
    (post.imageWidth && post.imageHeight)
  );

  return (
    <main className="detailPage shell">
      <div className="detailNavHeader">
        <Link className="backToCommunity" href="/community">← Back to Community</Link>
      </div>

      <div
        className="dominantImageStage"
        style={{ aspectRatio: `${post.imageWidth || 16} / ${post.imageHeight || 9}` }}
      >
        <button
          type="button"
          className={`detailImageButton ${imgLoaded ? 'imageLoaded' : 'imageLoading'}`}
          onClick={() => setViewerOpen(true)}
          aria-label={'Open fullscreen preview of ' + post.title}
        >
          {!imgLoaded && <div className="detailImageShimmer" aria-hidden="true" />}
          <img
            className={`detailImage ${imgLoaded ? 'thumbFadeIn' : 'thumbHidden'}`}
            src={post.imageUrl}
            alt={post.title}
            width={post.imageWidth}
            height={post.imageHeight}
            onLoad={() => setImgLoaded(true)}
          />
          <span className="imageZoomHint">↗ Expand</span>
        </button>
      </div>

      <div className="detailEditorialBody">
        <div className="detailTitleBar">
          <div className="detailTitleLeft">
            {post.category && <p className="eyebrow">{post.category}</p>}
            <h1 className="detailMainTitle">{post.title}</h1>
          </div>
          <Link className="detailCreator" href={'/users/' + encodeURIComponent(post.username)}>
            <span className="detailAvatar">
              {post.avatarUrl ? <img src={post.avatarUrl} alt="" loading="lazy" /> : <i>{initials(post.author)}</i>}
            </span>
            <span className="detailAuthorDetails">
              <b><CreatorUsername asSpan name={post.author} username={post.username} creatorRank={post.creatorRank} staffRole={post.authorRole} /></b>
              <small className="detailHandle">{'@' + post.username}</small>
            </span>
          </Link>
        </div>

        <div className="detailActionBar">
          <button className={'likeButton ' + (post.viewerLiked ? 'liked' : '')} onClick={toggleLike}>
            {post.viewerLiked ? '♥ Liked' : '♡ Like'} · {post.reactionCount}
          </button>
          <a className="detailCommentJump" href="#comments">
            💬 Comment · {post.commentCount}
          </a>
          <button type="button" className={'detailSaveButton ' + (post.viewerSaved ? 'saved' : '')} onClick={toggleSave}>
            🔖 {post.viewerSaved ? 'Saved' : 'Save'}
          </button>
          <button type="button" className="detailShareButton" onClick={shareSkillshot}>
            ↗ {sharedLabel}
          </button>
          <div className="detailMoreWrap">
            <button type="button" className="detailMoreButton" onClick={() => setMoreOpen(v => !v)} aria-expanded={moreOpen} aria-label="More actions">
              ⋯ More
            </button>
            {moreOpen && (
              <div className="detailMoreMenu">
                <a className="detailMenuItem" href={'/chats?shareShotId=' + id + '&shareShotTitle=' + encodeURIComponent(post.title) + '&shareShotImage=' + encodeURIComponent(post.imageUrl) + '&shareShotAuthor=' + encodeURIComponent(post.username)}>💬 Share into Chat</a>
                {post.isOwner && <button className="detailMenuItem" type="button" onClick={togglePin}>{post.isPinned ? '📌 Unpin from Profile' : '📌 Pin to Profile'}</button>}
                <a className="detailMenuItem" href={post.downloadUrl} download>↓ Download image</a>
                <div className="detailMenuReport"><ReportButton targetType="SKILLSHOT" targetId={post.id} /></div>
                {post.isOwner && <button className="detailMenuDelete" type="button" onClick={deletePost}>Delete Skillshot</button>}
              </div>
            )}
          </div>
        </div>

        {post.description && <p className="detailDescription">{post.description}</p>}

        {/* Capture Specs & Gear Inspector */}
        {hasSpecs && (
          <div className="captureSpecsInspector" aria-label="Capture specifications and gear">
            <div className="specsHeader">
              <span className="specsBadge">⚙️ GEAR & SPECS</span>
              <span className="specsSub">Capture mode metadata</span>
            </div>
            <div className="specsPillsGrid">
              {post.captureSpecs?.game && (
                <div className="specPillItem">
                  <span className="specPillIcon">🎮</span>
                  <div className="specPillMeta">
                    <small>GAME / ENGINE</small>
                    <strong>{post.captureSpecs.game}</strong>
                  </div>
                </div>
              )}
              {post.captureSpecs?.platform && (
                <div className="specPillItem">
                  <span className="specPillIcon">🖥️</span>
                  <div className="specPillMeta">
                    <small>PLATFORM</small>
                    <strong>{post.captureSpecs.platform}</strong>
                  </div>
                </div>
              )}
              <div className="specPillItem">
                <span className="specPillIcon">📐</span>
                <div className="specPillMeta">
                  <small>RESOLUTION</small>
                  <strong>{post.captureSpecs?.resolution || `${post.imageWidth}×${post.imageHeight}`}</strong>
                </div>
              </div>
              {toolsList.map(tool => (
                <div key={tool} className="specPillItem toolPill">
                  <span className="specPillIcon">✦</span>
                  <div className="specPillMeta">
                    <small>TOOL / ENHANCEMENT</small>
                    <strong>{tool}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {((post.skills && post.skills.length > 0) || (post.tags && post.tags.length > 0)) && (
          <div className="detailTags">
            {post.skills.map(skill => <span key={'skill-' + skill}>#{skill}</span>)}
            {post.tags.map(tag => <Link key={tag} href={'/search?tag=' + encodeURIComponent(tag)}>#{tag}</Link>)}
          </div>
        )}

        {status && <p className="detailStatus" role="status">{status}</p>}
      </div>

      <div id="comments">
        <CommentConversation postId={id} signedIn={post.signedIn} canPin={post.canPin} review={post.commentReview} total={post.commentCount} />
      </div>

      {viewerOpen && <ImageViewer src={post.previewUrl || post.imageUrl} alt={post.title} title={post.title} subtitle={'by ' + post.author} onClose={closeViewer} />}
    </main>
  );
}
