'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import RoleBadge from './role-badge';
import ImageViewer from './image-viewer';
import { requireClientAuth, signInPath } from '../../lib/auth-path';
import type { UserRole } from '../../lib/roles';

export type CommunityPost = {
  id:string; title:string; description:string; tags:string[]; skills:string[]; category:string;
  author:string; username:string; avatarUrl:string; authorRole:UserRole; createdAt:number;
  reactionCount:number; commentCount:number; imageUrl:string; previewUrl:string; downloadUrl:string;
  imageWidth:number; imageHeight:number; viewerLiked:boolean; isOwner:boolean;
};
type Mode = 'latest' | 'trending' | 'following';
type Props = { mine?:boolean; username?:string; likedBy?:string; limit?:number; compact?:boolean; showComments?:boolean; emptyTitle?:string; emptyText?:string };
const categories = ['All','Gaming','Development','Design','Photography','Art','Creative','Projects','Other'];
function initials(name:string) { return name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase() || 'S'; }

export default function CommunityFeed({ mine=false,username,likedBy,limit,compact=false,showComments=false,emptyTitle,emptyText }:Props) {
  const [posts,setPosts]=useState<CommunityPost[]>([]); const [query,setQuery]=useState('');
  const [mode,setMode]=useState<Mode>('latest'); const [category,setCategory]=useState('All');
  const [loading,setLoading]=useState(true); const [error,setError]=useState(''); const [signedIn,setSignedIn]=useState(false);
  const [previewPost,setPreviewPost]=useState<CommunityPost|null>(null); const [nextCursor,setNextCursor]=useState<string|null>(null); const [loadingMore,setLoadingMore]=useState(false);

  const makeSearch=useCallback((cursor?:string) => {
    const search=new URLSearchParams();
    if(mine)search.set('mine','1'); if(username)search.set('username',username); if(likedBy)search.set('likedBy',likedBy);
    if(mode==='trending')search.set('sort','trending'); if(mode==='following')search.set('following','1');
    if(category!=='All')search.set('category',category); if(cursor)search.set('cursor',cursor);
    search.set('limit',String(limit||18)); return search;
  },[category,likedBy,limit,mine,mode,username]);

  useEffect(()=>{ let active=true;
    fetch('/api/posts?'+makeSearch()).then(async response=>{ if(!response.ok)throw new Error(response.status===401?(mode==='following'?'Sign in to see creators you follow.':'Please sign in to see your posts.'):'Could not load Skillshots.'); return response.json(); })
      .then(data=>{if(active){setPosts(data.posts??[]);setNextCursor(data.nextCursor??null);setSignedIn(Boolean(data.signedIn));}})
      .catch(reason=>{if(active){setError(reason.message);setPosts([]);setNextCursor(null);}}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[makeSearch,mode]);

  async function loadMore(){ if(!nextCursor||loadingMore)return; setLoadingMore(true);
    try{const response=await fetch('/api/posts?'+makeSearch(nextCursor));if(!response.ok)throw new Error();const data=await response.json();setPosts(current=>[...current,...(data.posts??[])]);setNextCursor(data.nextCursor??null);}catch{setError('Could not load more Skillshots.');}finally{setLoadingMore(false);} }
  async function toggleLike(post:CommunityPost){ if(!requireClientAuth(signedIn,'/shots/'+post.id,'Sign in to like this Skillshot'))return;
    const response=await fetch('/api/posts/'+post.id+'/react',{method:'POST'}); if(response.status===401){window.location.assign(signInPath('/shots/'+post.id,'Sign in to like this Skillshot'));return;} if(!response.ok){setError('Could not update your reaction.');return;}
    const data=await response.json(); setPosts(current=>current.map(item=>item.id===post.id?{...item,viewerLiked:Boolean(data.liked),reactionCount:Math.max(0,item.reactionCount+(data.liked?1:-1))}:item)); }
  function selectMode(value:Mode){if(value===mode)return;setError('');setLoading(true);setMode(value);}
  function selectCategory(value:string){if(value===category)return;setError('');setLoading(true);setCategory(value);}

  const visible=useMemo(()=>{const term=query.trim().toLowerCase();const filtered=posts.filter(post=>!term||[post.title,post.description,post.author,post.username,post.category,...post.tags,...post.skills].join(' ').toLowerCase().includes(term));return typeof limit==='number'?filtered.slice(0,limit):filtered;},[limit,posts,query]);
  const previewIndex=previewPost?visible.findIndex(post=>post.id===previewPost.id):-1;
  const closePreview=useCallback(()=>setPreviewPost(null),[]);
  const previousPreview=useCallback(()=>setPreviewPost(current=>{const index=current?visible.findIndex(item=>item.id===current.id):-1;return index>0?visible[index-1]:current;}),[visible]);
  const nextPreview=useCallback(()=>setPreviewPost(current=>{const index=current?visible.findIndex(item=>item.id===current.id):-1;return index>=0&&index<visible.length-1?visible[index+1]:current;}),[visible]);

  if(loading)return <div className="feedSkeleton" aria-label="Loading Skillshots" aria-live="polite">{[0,1,2].map(item=><span key={item} className="skeletonCard"><i/><b/><small/></span>)}</div>;
  return <>
    {!compact&&<div className="discoveryControls"><div className="communityTools"><label className="communitySearch">⌕<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search posts, skills, or creators" aria-label="Filter loaded Skillshots"/></label><div className="filters" aria-label="Choose feed"><button className={mode==='latest'?'active':''} onClick={()=>selectMode('latest')}>Latest</button><button className={mode==='trending'?'active':''} onClick={()=>selectMode('trending')}>Trending</button><button className={mode==='following'?'active':''} onClick={()=>selectMode('following')}>Following</button></div></div><div className="categoryFilters" aria-label="Filter by category">{categories.map(value=><button key={value} className={category===value?'active':''} onClick={()=>selectCategory(value)}>{value}</button>)}</div></div>}
    {error&&<div className="feedState errorState" role="alert">{error}{mode==='following'&&!signedIn&&<a className="primary" href={signInPath('/community','Sign in to see creators you follow')}>Sign in</a>}</div>}
    {!error&&visible.length===0?<div className="emptyFeed"><span>✦</span><h3>{query?'No matching Skillshots yet.':emptyTitle??(mine?'Have something you’re proud of?':'Nothing here yet.')}</h3><p>{query?'Try another search term or category.':emptyText??(mine?'Share it with the Skillshot community.':'Try a different feed or be the first to share.')}</p>{!query&&<a className="primary" href="/upload">Create your first Skillshot →</a>}</div>:!error&&<div className="masonryGrid">{visible.map(post=><article className="post discoveryCard" key={post.id}>
      <div className="shot uploadedShot" style={{aspectRatio:String(post.imageWidth||4)+'/'+String(post.imageHeight||3)}}><a className="shotMediaLink" href={'/shots/'+post.id} aria-label={'Open '+post.title}><img src={post.imageUrl} alt={post.title} loading="lazy" decoding="async" width={post.imageWidth||640} height={post.imageHeight||480} sizes="(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 33vw"/></a><div className="shotHoverActions"><button type="button" className={post.viewerLiked?'liked':''} onClick={()=>toggleLike(post)} aria-label={(post.viewerLiked?'Unlike ':'Like ')+post.title}>♥ {post.reactionCount}</button><a href={'/shots/'+post.id+'#comments'} aria-label={post.commentCount+' comments'}>◌ {post.commentCount}</a><button type="button" onClick={()=>setPreviewPost(post)} aria-haspopup="dialog" aria-label={'Preview '+post.title}>↗</button></div><a className="postAvatar" href={'/users/'+encodeURIComponent(post.username)} aria-label={"View "+post.author+"'s profile"}><span>{initials(post.author)}</span>{post.avatarUrl&&<img src={post.avatarUrl} alt="" loading="lazy"/>}</a></div>
      <div className="meta"><div className="postIdentity"><a className="postTitle" href={'/shots/'+post.id}>{post.title}</a><small className="authorBlock"><span className="authorName"><a href={'/users/'+encodeURIComponent(post.username)}>{post.author}</a><RoleBadge role={post.authorRole}/></span><a className="authorHandle" href={'/users/'+encodeURIComponent(post.username)}>@{post.username}</a></small></div>{post.description&&<p className="cardDescription">{post.description}</p>}<div className="cardSkills">{post.skills.slice(0,3).map(skill=><span key={skill}>{skill}</span>)}{post.category&&<span>{post.category}</span>}</div><div className="tags">{post.tags.slice(0,3).map(tag=><a key={tag} href={'/search?tag='+encodeURIComponent(tag)}>#{tag}</a>)}<span className="postStat">♥ {post.reactionCount}</span>{showComments&&<a href={'/shots/'+post.id+'#comments'}>◌ {post.commentCount}</a>}<a className="cardDownload" href={post.downloadUrl} title="Download image">↓</a></div></div>
    </article>)}</div>}
    {previewPost&&<ImageViewer src={previewPost.previewUrl||previewPost.imageUrl} alt={previewPost.title} title={previewPost.title} subtitle={'by '+previewPost.author} onClose={closePreview} onPrevious={previewIndex>0?previousPreview:undefined} onNext={previewIndex>=0&&previewIndex<visible.length-1?nextPreview:undefined}/>}
    {!limit&&nextCursor&&!query&&!error&&<div className="loadMore"><button type="button" onClick={loadMore} disabled={loadingMore}>{loadingMore?'Loading…':'Load more Skillshots'}</button></div>}
  </>;
}
