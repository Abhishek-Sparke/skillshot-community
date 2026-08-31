'use client';
import Link from 'next/link';
import { useEffect,useState } from 'react';
import { formatBytes, staffLinks } from '../../lib/staff-ui';
import { useStaff } from './staff-shell';
import ModerationQueue from './moderation-queue';
import { StaffEmpty,StaffError,StaffSkeleton } from './staff-states';
type Application={id:string;username:string;display_name:string;reason:string;contribution:string;created_at:string};
type Appeal={id:string;username:string;target_type:string;reason:string;created_at:string};
type Data={counts:Record<string,number>;applications:Application[];appeals:Appeal[]};
export default function StaffPanel({focus='all'}:{title?:string;focus?:'all'|'moderation'|'reports'|'skillshots'|'comments'|'trusted'}) {
  const user=useStaff();
  const [data,setData]=useState<Data|null>(null),[error,setError]=useState(false),[revision,setRevision]=useState(0),[message,setMessage]=useState(''),[busy,setBusy]=useState('');
  useEffect(()=>{const controller=new AbortController();fetch('/api/staff/overview',{signal:controller.signal}).then(r=>r.ok?r.json():Promise.reject()).then(value=>{setData(value);setError(false);}).catch(()=>{if(!controller.signal.aborted)setError(true);});return()=>controller.abort();},[revision]);
  async function review(kind:'appeals'|'trusted-contributors',id:string,action:string) {
    setBusy(id);setMessage('');
    try {const response=await fetch(`/api/staff/${kind}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({id,applicationId:id,action})});if(!response.ok)throw new Error();setMessage('Review saved.');setRevision(v=>v+1);window.dispatchEvent(new Event('staff-updated'));}catch{setMessage('Could not save this review. Check your permissions and try again.');}finally{setBusy('');}
  }
  const labels:Record<string,string>={flagged:'Pending moderation',reports:'Open reports',appeals:'Pending appeals',applications:'Contributor applications',active_staff:'Active staff',storage_used:'Tracked image storage'};
  const links=staffLinks(user);
  return <div className="staffPageBody">
    {focus==='all'&&<>{error?<StaffError retry={()=>setRevision(v=>v+1)}/>:!data?<StaffSkeleton/>:<section className="staffStats" aria-label="Dashboard statistics">{Object.entries(data.counts).map(([key,value])=><div key={key}><span>{labels[key]||key}</span><strong>{key==='storage_used'?formatBytes(value):Number(value).toLocaleString()}</strong><small>{key==='storage_used'?'Current database references':'Live community data'}</small></div>)}</section>}
      <section className="staffSection"><p className="eyebrow">YOUR WORKSPACE</p><h2>Make room for great work.</h2><p>Start with the items that need a human decision.</p><div className="staffQuickActions">{links.filter(l=>['Moderation','Reports','Trusted Contributors'].includes(l.label)).map(l=><Link href={l.href} key={l.href}>{l.label==='Moderation'?'Review moderation':l.label==='Reports'?'View reports':'Review applications'} <span aria-hidden="true">↗</span></Link>)}</div></section></>}
    {['moderation','reports','skillshots','comments'].includes(focus)&&<ModerationQueue focus={focus}/>}
    {(focus==='all'||focus==='trusted')&&user.permissions.includes('trusted_contributor.review')&&<section className="staffSection"><h2>Trusted Contributor applications</h2>{!data?(error?<StaffError retry={()=>setRevision(v=>v+1)}/>:<StaffSkeleton/>):!data.applications.length?<StaffEmpty title="No pending applications"/>:<div className="staffTable">{data.applications.map(item=><article key={item.id}><div><b>{item.display_name} · @{item.username}</b><span>{item.reason}</span><small>{item.contribution}</small></div><div>{user.permissions.includes('trusted_contributor.approve')&&<button className="staffPrimary" disabled={!!busy} onClick={()=>review('trusted-contributors',item.id,'APPROVE')}>Approve</button>}{user.permissions.includes('trusted_contributor.reject')&&<button disabled={!!busy} onClick={()=>review('trusted-contributors',item.id,'REJECT')}>Reject</button>}</div></article>)}</div>}<p className="staffHint">Showing up to 30 oldest pending applications.</p></section>}
    {(focus==='all'||focus==='reports')&&<section className="staffSection"><h2>Pending appeals</h2>{!data?(error?<StaffError retry={()=>setRevision(v=>v+1)}/>:<StaffSkeleton/>):!data.appeals.length?<StaffEmpty title="No pending appeals"/>:<div className="staffTable">{data.appeals.map(item=><article key={item.id}><div><b>{item.reason}</b><span>@{item.username} · {item.target_type}</span><small>{new Date(item.created_at).toLocaleString()}</small></div>{user.permissions.includes('reports.resolve')&&<div>{(item.target_type!=='SKILLSHOT'||user.permissions.includes('skillshots.restore'))&&<button disabled={!!busy} onClick={()=>review('appeals',item.id,'ACCEPT')}>Accept</button>}<button disabled={!!busy} onClick={()=>review('appeals',item.id,'REJECT')}>Reject</button><button disabled={!!busy} onClick={()=>review('appeals',item.id,'REVIEW')}>Mark under review</button></div>}</article>)}</div>}</section>}
    <p role="status">{message}</p>
  </div>;
}
