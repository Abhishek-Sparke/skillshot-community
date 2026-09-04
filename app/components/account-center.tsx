'use client';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';

type Notice={id:string;title:string;body:string;created_at:string;read_at:string|null;target_url?:string|null};
type Appeal={id:string;target_type:string;target_id:string;reason:string;status:string;created_at:string};
type Trusted={role:string;eligible:boolean;requirements:{posts:number;accountDays:number};application?:{status:string;created_at:string;review_note:string}|null};

export default function AccountCenter({section}:{section:'notifications'|'appeals'|'trusted'}){
 const [data,setData]=useState<Notice[]|Appeal[]|Trusted|null>(null),[message,setMessage]=useState('');
 useEffect(()=>{let active=true;const url=section==='trusted'?'/api/trusted-contributor':`/api/${section}`;fetch(url).then(async r=>r.ok?r.json():Promise.reject()).then(v=>{if(active)setData(section==='notifications'?v.notifications:section==='appeals'?v.appeals:v)}).catch(()=>{if(active)setMessage('Could not load this page.')});return()=>{active=false}},[section]);
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setMessage('Submitting…');const form=new FormData(event.currentTarget);const body=section==='appeals'?{targetType:form.get('targetType'),targetId:form.get('targetId'),reason:form.get('reason'),explanation:form.get('explanation')}:{reason:form.get('reason'),contribution:form.get('contribution'),portfolioUrl:form.get('portfolioUrl')};const response=await fetch(section==='appeals'?'/api/appeals':'/api/trusted-contributor',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const result=await response.json();setMessage(response.ok?'Submitted for review.':result.error||'Could not submit.');if(response.ok)event.currentTarget.reset();}

 const markRead = async (id: string) => {
   try {
     await fetch('/api/notifications', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) });
     setData(previous => Array.isArray(previous) ? (previous as Notice[]).map(item => item.id === id ? { ...item, read_at: item.read_at || new Date().toISOString() } : item) : previous);
     window.dispatchEvent(new CustomEvent('notifications:updated'));
   } catch {}
 };

 const markAllRead = async () => {
   try {
     await fetch('/api/notifications', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ all: true }) });
     setData(previous => Array.isArray(previous) ? (previous as Notice[]).map(item => ({ ...item, read_at: item.read_at || new Date().toISOString() })) : previous);
     window.dispatchEvent(new CustomEvent('notifications:updated'));
     setMessage('All notifications marked as read.');
     setTimeout(() => setMessage(''), 3000);
   } catch {}
 };

 if(section==='notifications'){
   const items=(data||[]) as Notice[];
   return <>
     <div className="sectionHead">
       <div><p className="eyebrow">INBOX</p><h1>Notifications</h1></div>
       <button className="quietButton" onClick={markAllRead}>Mark all read</button>
     </div>
     <div className="accountList">
       {items.length ? items.map(item => (
         <article className={`notificationItem ${!item.read_at ? 'unread' : 'isRead'}`} key={item.id}>
           {item.target_url ? (
             <Link href={item.target_url} className="notificationCardLink" onClick={() => { if (!item.read_at) markRead(item.id); }}>
               <div className="notificationCardContent">
                 <b>{item.title}</b>
                 <p>{item.body}</p>
               </div>
               <div className="notificationCardMeta">
                 <small>{new Date(item.created_at).toLocaleString()}</small>
                 <span className="notificationCardArrow" aria-hidden="true">→</span>
               </div>
             </Link>
           ) : (
             <div className="notificationCardLink" onClick={() => { if (!item.read_at) markRead(item.id); }}>
               <div className="notificationCardContent">
                 <b>{item.title}</b>
                 <p>{item.body}</p>
               </div>
               <div className="notificationCardMeta">
                 <small>{new Date(item.created_at).toLocaleString()}</small>
               </div>
             </div>
           )}
         </article>
       )) : <div className="emptyFeed"><span>✦</span><h3>No notifications yet</h3><p>You&apos;re all caught up.</p></div>}
     </div>
     <p role="status">{message}</p>
   </>;
 }
 if(section==='appeals'){const items=(data||[]) as Appeal[];return <><header><p className="eyebrow">FAIR REVIEW</p><h1>Appeals</h1><p>Ask the team to review a moderation decision. One clear appeal is more helpful than repeated submissions.</p></header><form className="accountForm" onSubmit={submit}><label>Item type<select name="targetType" required><option value="SKILLSHOT">Skillshot</option><option value="COMMENT">Comment</option><option value="ACCOUNT">Account</option></select></label><label>Item ID<input name="targetId" required maxLength={100}/></label><label>Short reason<input name="reason" required minLength={4} maxLength={120}/></label><label>What should we reconsider?<textarea name="explanation" required minLength={20} maxLength={1500}/></label><button className="primary">Submit appeal</button></form><div className="accountList">{items.map(item=><article key={item.id}><div><b>{item.reason}</b><p>{item.target_type} · {item.target_id}</p></div><span>{item.status.replaceAll('_',' ')}</span></article>)}</div><p role="status">{message}</p></>}
 const trusted=data as Trusted|null;return <><header><p className="eyebrow">COMMUNITY RECOGNITION</p><h1>Trusted Contributor</h1><p>This role recognizes consistently helpful creators. It never grants staff or moderation access.</p></header>{trusted&&<div className="eligibility"><div><strong>{trusted.requirements.posts}/3</strong><span>published Skillshots</span></div><div><strong>{trusted.requirements.accountDays}/7</strong><span>account days</span></div></div>}{trusted?.application&&<p className="formNotice">Latest application: <b>{trusted.application.status}</b>{trusted.application.review_note?` — ${trusted.application.review_note}`:''}</p>}{trusted?.role==='USER'&&<form className="accountForm" onSubmit={submit}><label>Why should you be recognized?<textarea name="reason" required minLength={30} maxLength={1000}/></label><label>How do you help the community?<textarea name="contribution" required minLength={30} maxLength={1000}/></label><label>Portfolio URL <small>Optional</small><input name="portfolioUrl" type="url" maxLength={300}/></label><button className="primary" disabled={!trusted?.eligible}>Apply for review</button>{!trusted?.eligible&&<small>Publish 3 Skillshots and keep your account active for 7 days to unlock applications.</small>}</form>}<p role="status">{message}</p></>;
}
