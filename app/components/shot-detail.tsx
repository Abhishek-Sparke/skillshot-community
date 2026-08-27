'use client';

import { FormEvent, useEffect, useState } from 'react';
import RoleBadge from './role-badge';
import type { UserRole } from '../../lib/roles';

type Post = {
  id: string; title: string; description: string; tags: string[]; author: string; username: string;
  authorRole: UserRole;
  createdAt: number; reactionCount: number; commentCount: number; viewerLiked: boolean;
  signedIn: boolean; imageUrl: string; downloadUrl: string;
};
type Comment = { id: string; body: string; author: string; username: string; authorRole: UserRole; createdAt: number; canDelete: boolean };

export default function ShotDetail({ id }: { id: string }) {
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  useEffect(() => {
    Promise.all([
      fetch(`/api/posts/${id}`).then(response => response.ok ? response.json() : Promise.reject()),
      fetch(`/api/posts/${id}/comments`).then(response => response.ok ? response.json() : { comments: [] }),
    ]).then(([postData, commentData]) => {
      setPost(postData.post);
      setComments(commentData.comments ?? []);
    }).catch(() => setStatus('This post could not be found.')).finally(() => setLoading(false));
  }, [id]);

  async function toggleLike() {
    if (!post) return;
    const response = await fetch(`/api/posts/${id}/react`, { method: 'POST' });
    if (response.status === 401) { setStatus('Please sign in from your profile before reacting.'); return; }
    if (!response.ok) { setStatus('Could not update your reaction.'); return; }
    const data = await response.json();
    setPost({ ...post, viewerLiked: data.liked, reactionCount: post.reactionCount + (data.liked ? 1 : -1) });
    setStatus('');
  }

  async function addComment(event: FormEvent) {
    event.preventDefault();
    const response = await fetch(`/api/posts/${id}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: text }) });
    if (response.status === 401) { setStatus('Please sign in from your profile before commenting.'); return; }
    if (!response.ok) { setStatus('Could not add your comment.'); return; }
    const comment = await response.json();
    setComments(current => [...current, comment]);
    setText('');
    setStatus('Comment added.');
  }

  async function deleteComment(commentId: string) {
    if (!window.confirm('Delete this comment?')) return;
    const response = await fetch(`/api/posts/${id}/comments?commentId=${encodeURIComponent(commentId)}`, { method: 'DELETE' });
    if (response.ok) {
      setComments(current => current.filter(comment => comment.id !== commentId));
      setOpenMenu(null);
      setStatus('Comment deleted.');
    }
  }

  function startEditing(comment: Comment) {
    setEditingId(comment.id);
    setEditingText(comment.body);
    setOpenMenu(null);
    setStatus('');
  }

  async function saveComment(event: FormEvent, commentId: string) {
    event.preventDefault();
    const response = await fetch(`/api/posts/${id}/comments?commentId=${encodeURIComponent(commentId)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: editingText }),
    });
    if (!response.ok) { setStatus('Could not edit your comment.'); return; }
    const updated = await response.json();
    setComments(current => current.map(comment => comment.id === commentId ? { ...comment, body: updated.body } : comment));
    setEditingId(null);
    setEditingText('');
    setStatus('Comment updated.');
  }

  if (loading) return <main className="formPage"><div className="feedState"><span className="loader"/> Loading shot…</div></main>;
  if (!post) return <main className="formPage"><section className="detail"><h1>Post not found</h1><p>{status}</p><a className="backHome" href="/community">← Back to community</a></section></main>;

  return <main className="formPage">
    <nav className="detailNav"><a className="brand" href="/"><span>S</span> Skillshot</a><a className="backHome" href="/community">← Community</a></nav>
    <section className="detail">
      <img className="detailImage" src={post.imageUrl} alt={post.title}/>
      <div className="detailHeading">
        <div><a className="eyebrow creatorLink" href={`/users/${encodeURIComponent(post.username)}`}>@{post.username}</a><h1>{post.title}</h1><p>Shared by <a className="authorLine creatorLink" href={`/users/${encodeURIComponent(post.username)}`}><b>{post.author}</b> <RoleBadge role={post.authorRole} /></a></p></div>
        <a className="downloadButton" href={post.downloadUrl}>↓ Download</a>
      </div>
      {post.description && <p className="detailDescription">{post.description}</p>}
      <div className="detailTags">{post.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
      <button className={`likeButton ${post.viewerLiked ? 'liked' : ''}`} onClick={toggleLike}>♥ {post.viewerLiked ? 'Liked' : 'Like'} · {post.reactionCount}</button>

      <section className="commentsSection">
        <h2>Comments <span>{comments.length}</span></h2>
        <form className="commentForm" onSubmit={addComment}>
          <input value={text} onChange={event => setText(event.target.value)} maxLength={1000} placeholder="Add a thoughtful comment" required/>
          <button className="primary">Post</button>
        </form>
        <p className="actionStatus" role="status">{status}</p>
        {comments.length === 0 && <p className="noComments">No comments yet. Start the conversation.</p>}
        {comments.map(comment => <div className="comment" key={comment.id}>
          <div className="commentHeader">
            <a className="authorLine creatorLink" href={`/users/${encodeURIComponent(comment.username)}`}><b>{comment.author}</b> <RoleBadge role={comment.authorRole} /> <small>@{comment.username}</small></a>
            {comment.canDelete && <div className="commentMenu">
              <button type="button" className="commentMenuButton" aria-label="Comment actions" aria-expanded={openMenu === comment.id} onClick={() => setOpenMenu(current => current === comment.id ? null : comment.id)}>•••</button>
              {openMenu === comment.id && <div className="commentMenuPanel" role="menu">
                <button type="button" role="menuitem" onClick={() => startEditing(comment)}>Edit</button>
                <button type="button" role="menuitem" className="dangerAction" onClick={() => deleteComment(comment.id)}>Delete</button>
              </div>}
            </div>}
          </div>
          {editingId === comment.id ? <form className="commentEditForm" onSubmit={event => saveComment(event, comment.id)}>
            <input value={editingText} onChange={event => setEditingText(event.target.value)} maxLength={1000} required autoFocus/>
            <div><button type="submit" className="editSave">Save</button><button type="button" onClick={() => setEditingId(null)}>Cancel</button></div>
          </form> : <p>{comment.body}</p>}
        </div>)}
      </section>
    </section>
  </main>;
}
