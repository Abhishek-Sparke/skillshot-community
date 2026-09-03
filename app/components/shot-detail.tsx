'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import RoleBadge from './role-badge';
import ReportButton from './report-button';
import ImageViewer from './image-viewer';
import CommentConversation from './comment-conversation';
import type { UserRole } from '../../lib/roles';
import { requireClientAuth, signInPath } from '../../lib/auth-path';

type Post = {
  id:string; title:string; description:string; tags:string[]; skills:string[]; category:string; author:string; username:string;
  avatarUrl:string; authorRole:UserRole; createdAt:number; reactionCount:number; commentCount:number; viewerLiked:boolean;
  signedIn:boolean; isOwner:boolean; canPin:boolean; commentReview:{hide:boolean;delete:boolean}|null; imageUrl:string; previewUrl:string; downloadUrl:string; imageWidth:number; imageHeight:number;
};
function initials(name:string){return name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'S';}

export default function ShotDetail({id}:{id:string}) {
  const [post,setPost]=useState<Post|null>(null);
  const [status,setStatus]=useState('');
  const [loading,setLoading]=useState(true); const [viewerOpen,setViewerOpen]=useState(false);

  useEffect(()=>{let active=true;fetch('/api/posts/'+id).then(response=>response.ok?response.json():Promise.reject()).then(data=>{if(active)setPost(data.post);}).catch(()=>{if(active)setStatus('This Skillshot could not be found.');}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[id]);

  const closeViewer=useCallback(()=>setViewerOpen(false),[]);

  async function toggleLike(){if(!post)return;if(!requireClientAuth(post.signedIn,'/shots/'+id,'Sign in to like this Skillshot'))return;const response=await fetch('/api/posts/'+id+'/react',{method:'POST'});if(response.status===401){window.location.assign(signInPath('/shots/'+id,'Sign in to like this Skillshot'));return;}if(!response.ok){setStatus('Could not update your reaction.');return;}const data=await response.json();setPost(current=>current?{...current,viewerLiked:data.liked,reactionCount:Math.max(0,current.reactionCount+(data.liked?1:-1))}:current);setStatus('');}
  async function deletePost(){if(!window.confirm('Delete this Skillshot? It will be hidden immediately and retained briefly for safety review.'))return;const response=await fetch('/api/posts/'+id,{method:'DELETE'});if(!response.ok){setStatus('Could not delete this Skillshot.');return;}window.location.assign('/my-posts');}
  if(loading)return <main className="detailPage shell"><div className="detailSkeleton" aria-live="polite"><span/><div><i/><i/><i/></div></div></main>;
  if(!post)return <main className="formPage"><section className="detail"><h1>Skillshot not found</h1><p>{status}</p><Link className="backHome" href="/community">← Back to community</Link></section></main>;

  return <main className="detailPage shell">
    <div className="detailLayout"><section className="detailVisual"><button type="button" className="detailImageButton" onClick={()=>setViewerOpen(true)} aria-label={'Open fullscreen preview of '+post.title}><img className="detailImage" src={post.imageUrl} alt={post.title} width={post.imageWidth} height={post.imageHeight}/><span>↗ Preview</span></button></section>
      <aside className="detailSidebar"><div className="detailHeading"><div><p className="eyebrow">{post.category||'SKILLSHOT'}</p><h1>{post.title}</h1></div>{post.isOwner&&<button className="postDelete" type="button" onClick={deletePost}>Delete</button>}</div>
        <Link className="detailCreator" href={'/users/'+encodeURIComponent(post.username)}><span className="detailAvatar"><i>{initials(post.author)}</i>{post.avatarUrl&&<img src={post.avatarUrl} alt="" loading="lazy"/>}</span><span><b>{post.author} <RoleBadge role={post.authorRole}/></b></span></Link>
        {post.description&&<p className="detailDescription">{post.description}</p>}<div className="detailTags">{post.skills.map(skill=><span key={'skill-'+skill}>{skill}</span>)}{post.tags.map(tag=><Link key={tag} href={'/search?tag='+encodeURIComponent(tag)}>#{tag}</Link>)}</div>
        <div className="detailActions"><button className={'likeButton '+(post.viewerLiked?'liked':'')} onClick={toggleLike}>♥ {post.viewerLiked?'Liked':'Like'} · {post.reactionCount}</button><a className="downloadButton" href={post.downloadUrl}>↓ Download</a><ReportButton targetType="SKILLSHOT" targetId={post.id}/></div>
      </aside></div>
    <CommentConversation postId={id} signedIn={post.signedIn} canPin={post.canPin} review={post.commentReview} total={post.commentCount}/>
    {viewerOpen&&<ImageViewer src={post.previewUrl||post.imageUrl} alt={post.title} title={post.title} subtitle={'by '+post.author} onClose={closeViewer}/>}
  </main>;
}
