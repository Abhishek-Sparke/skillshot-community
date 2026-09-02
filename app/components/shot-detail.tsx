'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import RoleBadge from './role-badge';
import ReportButton from './report-button';
import ImageViewer from './image-viewer';
import type { UserRole } from '../../lib/roles';
import { requireClientAuth, signInPath } from '../../lib/auth-path';

type Post = {
  id:string; title:string; description:string; tags:string[]; skills:string[]; category:string; author:string; username:string;
  avatarUrl:string; authorRole:UserRole; createdAt:number; reactionCount:number; commentCount:number; viewerLiked:boolean;
  signedIn:boolean; isOwner:boolean; imageUrl:string; previewUrl:string; downloadUrl:string; imageWidth:number; imageHeight:number;
};
type Comment = {
  id:string; parentId:string|null; body:string; author:string; username:string; avatarUrl:string; authorRole:UserRole;
  createdAt:number; canDelete:boolean; reactionCount:number; viewerLiked:boolean;
};
function initials(name:string){return name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'S';}

export default function ShotDetail({id}:{id:string}) {
  const [post,setPost]=useState<Post|null>(null); const [comments,setComments]=useState<Comment[]>([]);
  const [text,setText]=useState(''); const [replyTo,setReplyTo]=useState<Comment|null>(null); const [status,setStatus]=useState('');
  const [loading,setLoading]=useState(true); const [commentsLoading,setCommentsLoading]=useState(true); const [viewerOpen,setViewerOpen]=useState(false);
  const [openMenu,setOpenMenu]=useState<string|null>(null); const [editingId,setEditingId]=useState<string|null>(null); const [editingText,setEditingText]=useState('');

  useEffect(()=>{let active=true;fetch('/api/posts/'+id).then(response=>response.ok?response.json():Promise.reject()).then(data=>{if(active)setPost(data.post);}).catch(()=>{if(active)setStatus('This Skillshot could not be found.');}).finally(()=>{if(active)setLoading(false);});
    fetch('/api/posts/'+id+'/comments').then(response=>response.ok?response.json():{comments:[]}).then(data=>{if(active)setComments(data.comments??[]);}).finally(()=>{if(active)setCommentsLoading(false);});
    return()=>{active=false;};
  },[id]);

  const rootComments=useMemo(()=>comments.filter(comment=>!comment.parentId),[comments]);
  const closeViewer=useCallback(()=>setViewerOpen(false),[]);

  async function toggleLike(){if(!post)return;if(!requireClientAuth(post.signedIn,'/shots/'+id,'Sign in to like this Skillshot'))return;const response=await fetch('/api/posts/'+id+'/react',{method:'POST'});if(response.status===401){window.location.assign(signInPath('/shots/'+id,'Sign in to like this Skillshot'));return;}if(!response.ok){setStatus('Could not update your reaction.');return;}const data=await response.json();setPost(current=>current?{...current,viewerLiked:data.liked,reactionCount:Math.max(0,current.reactionCount+(data.liked?1:-1))}:current);setStatus('');}
  async function toggleCommentLike(comment:Comment){if(!requireClientAuth(Boolean(post?.signedIn),'/shots/'+id+'#comments','Sign in to like comments'))return;const response=await fetch('/api/posts/'+id+'/comments/'+comment.id+'/react',{method:'POST'});if(!response.ok){setStatus('Could not update that comment reaction.');return;}const data=await response.json();setComments(current=>current.map(item=>item.id===comment.id?{...item,viewerLiked:data.liked,reactionCount:Math.max(0,item.reactionCount+(data.liked?1:-1))}:item));}
  async function addComment(event:FormEvent){event.preventDefault();if(!requireClientAuth(Boolean(post?.signedIn),'/shots/'+id+'#comments','Sign in to join the conversation'))return;const response=await fetch('/api/posts/'+id+'/comments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({body:text,parentId:replyTo?.id??null})});if(response.status===401){window.location.assign(signInPath('/shots/'+id+'#comments','Sign in to join the conversation'));return;}const comment=await response.json();if(!response.ok||comment.held){setStatus(comment.message||comment.error||'Could not add your comment.');if(comment.held)setText('');return;}setComments(current=>[...current,comment]);setText('');setReplyTo(null);setStatus(comment.parentId?'Reply added.':'Comment added.');}
  function descendants(commentId:string){const ids=new Set([commentId]);let changed=true;while(changed){changed=false;for(const item of comments)if(item.parentId&&ids.has(item.parentId)&&!ids.has(item.id)){ids.add(item.id);changed=true;}}return ids;}
  async function deleteComment(commentId:string){if(!window.confirm('Delete this comment and its replies?'))return;const response=await fetch('/api/posts/'+id+'/comments?commentId='+encodeURIComponent(commentId),{method:'DELETE'});if(response.ok){const removed=descendants(commentId);setComments(current=>current.filter(comment=>!removed.has(comment.id)));setOpenMenu(null);setStatus('Comment deleted.');}}
  async function deletePost(){if(!window.confirm('Delete this Skillshot? It will be hidden immediately and retained briefly for safety review.'))return;const response=await fetch('/api/posts/'+id,{method:'DELETE'});if(!response.ok){setStatus('Could not delete this Skillshot.');return;}window.location.assign('/my-posts');}
  function startEditing(comment:Comment){setEditingId(comment.id);setEditingText(comment.body);setOpenMenu(null);setStatus('');}
  async function saveComment(event:FormEvent,commentId:string){event.preventDefault();const response=await fetch('/api/posts/'+id+'/comments?commentId='+encodeURIComponent(commentId),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({body:editingText})});const updated=await response.json();if(!response.ok){setStatus(updated.error||'Could not edit your comment.');return;}setComments(current=>current.map(comment=>comment.id===commentId?{...comment,body:updated.body}:comment));setEditingId(null);setEditingText('');setStatus('Comment updated.');}

  function CommentItem({comment,depth=0}:{comment:Comment;depth?:number}) {
    const replies=comments.filter(item=>item.parentId===comment.id);
    return <div className={'commentThread '+(depth?'isReply':'')}><article className="comment">
      <div className="commentHeader"><Link className="commentAuthor creatorLink" href={'/users/'+encodeURIComponent(comment.username)}><span className="commentAvatar"><i>{initials(comment.author)}</i>{comment.avatarUrl&&<img src={comment.avatarUrl} alt="" loading="lazy"/>}</span><span><b>{comment.author} <RoleBadge role={comment.authorRole}/></b><small>@{comment.username} · {new Date(comment.createdAt).toLocaleDateString()}</small></span></Link>
        <div className="commentActions"><ReportButton targetType="COMMENT" targetId={comment.id} label=""/>{comment.canDelete&&<div className="commentMenu"><button type="button" className="commentMenuButton" aria-label="Comment actions" aria-expanded={openMenu===comment.id} onClick={()=>setOpenMenu(current=>current===comment.id?null:comment.id)}>•••</button>{openMenu===comment.id&&<div className="commentMenuPanel" role="menu"><button type="button" role="menuitem" onClick={()=>startEditing(comment)}>Edit</button><button type="button" role="menuitem" className="dangerAction" onClick={()=>deleteComment(comment.id)}>Delete</button></div>}</div>}</div></div>
      {editingId===comment.id?<form className="commentEditForm" onSubmit={event=>saveComment(event,comment.id)}><input value={editingText} onChange={event=>setEditingText(event.target.value)} maxLength={1000} required autoFocus/><div><button type="submit" className="editSave">Save</button><button type="button" onClick={()=>setEditingId(null)}>Cancel</button></div></form>:<p>{comment.body}</p>}
      <div className="commentFooter"><button type="button" className={comment.viewerLiked?'liked':''} onClick={()=>toggleCommentLike(comment)}>♥ {comment.reactionCount||''}</button><button type="button" onClick={()=>{setReplyTo(comment);setText('');document.getElementById('comment-composer')?.focus();}}>Reply</button></div>
    </article>{replies.map(reply=><CommentItem key={reply.id} comment={reply} depth={Math.min(depth+1,2)}/>)}</div>;
  }

  if(loading)return <main className="detailPage shell"><div className="detailSkeleton" aria-live="polite"><span/><div><i/><i/><i/></div></div></main>;
  if(!post)return <main className="formPage"><section className="detail"><h1>Skillshot not found</h1><p>{status}</p><Link className="backHome" href="/community">← Back to community</Link></section></main>;

  return <main className="detailPage shell">
    <div className="detailLayout"><section className="detailVisual"><button type="button" className="detailImageButton" onClick={()=>setViewerOpen(true)} aria-label={'Open fullscreen preview of '+post.title}><img className="detailImage" src={post.imageUrl} alt={post.title} width={post.imageWidth} height={post.imageHeight}/><span>↗ Preview</span></button></section>
      <aside className="detailSidebar"><div className="detailHeading"><div><p className="eyebrow">{post.category||'SKILLSHOT'}</p><h1>{post.title}</h1></div>{post.isOwner&&<button className="postDelete" type="button" onClick={deletePost}>Delete</button>}</div>
        <Link className="detailCreator" href={'/users/'+encodeURIComponent(post.username)}><span className="detailAvatar"><i>{initials(post.author)}</i>{post.avatarUrl&&<img src={post.avatarUrl} alt="" loading="lazy"/>}</span><span><b>{post.author} <RoleBadge role={post.authorRole}/></b><small>@{post.username}</small></span></Link>
        {post.description&&<p className="detailDescription">{post.description}</p>}<div className="detailTags">{post.skills.map(skill=><span key={'skill-'+skill}>{skill}</span>)}{post.tags.map(tag=><Link key={tag} href={'/search?tag='+encodeURIComponent(tag)}>#{tag}</Link>)}</div>
        <div className="detailActions"><button className={'likeButton '+(post.viewerLiked?'liked':'')} onClick={toggleLike}>♥ {post.viewerLiked?'Liked':'Like'} · {post.reactionCount}</button><a className="downloadButton" href={post.downloadUrl}>↓ Download</a><ReportButton targetType="SKILLSHOT" targetId={post.id}/></div>
      </aside></div>
    <section className="commentsSection" id="comments"><div className="commentsHeading"><div><p className="eyebrow">CONVERSATION</p><h2>Comments <span>{comments.length}</span></h2></div></div>
      <form className="commentForm" onSubmit={addComment}>{replyTo&&<div className="replyContext"><span>Replying to @{replyTo.username}</span><button type="button" onClick={()=>setReplyTo(null)}>Cancel</button></div>}<textarea id="comment-composer" value={text} onFocus={()=>requireClientAuth(post.signedIn,'/shots/'+id+'#comments','Sign in to join the conversation')} onChange={event=>setText(event.target.value)} maxLength={1000} placeholder={post.signedIn?(replyTo?'Write a reply…':'Add a thoughtful comment…'):'Sign in to add a comment'} required/><div><small>{text.length}/1000</small><button className="primary">{replyTo?'Reply':'Post comment'}</button></div></form>
      <p className="actionStatus" role="status" aria-live="polite">{status}</p>
      {commentsLoading?<div className="commentSkeleton"><i/><i/><i/></div>:rootComments.length===0?<p className="noComments">No comments yet. Start the conversation.</p>:<div className="commentList">{rootComments.map(comment=><CommentItem key={comment.id} comment={comment}/>)}</div>}
    </section>
    {viewerOpen&&<ImageViewer src={post.previewUrl||post.imageUrl} alt={post.title} title={post.title} subtitle={'by '+post.author} onClose={closeViewer}/>}
  </main>;
}
