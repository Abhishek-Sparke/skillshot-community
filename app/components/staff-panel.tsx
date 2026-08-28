'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Item = { id: string; source: string; target_type: string; category: string; severity: string; username?: string; created_at: string };
type Application={id:string;username:string;display_name:string;reason:string;contribution:string;created_at:string};
type Appeal={id:string;username:string;target_type:string;target_id:string;reason:string;created_at:string};
type StaffData = { counts: Record<string, number>; queue: Item[]; applications:Application[]; appeals:Appeal[]; permissions: string[]; role:string };

export default function StaffPanel({ title, focus = 'all' }: { title: string; focus?: 'all'|'moderation'|'reports'|'skillshots'|'comments'|'trusted' }) {
  const [data, setData] = useState<StaffData | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/staff/overview')
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(value => { if (active) setData(value); })
      .catch(() => { if (active) setMessage('Could not load staff data.'); });
    return () => { active = false; };
  }, []);

  async function act(id: string, action: string) {
    const response = await fetch('/api/staff/moderation', {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ queueId: id, action }),
    });
    if (response.ok) {
      setData(current => current ? { ...current, queue: current.queue.filter(item => item.id !== id) } : current);
      setMessage('Moderation action saved.');
    } else setMessage('Action was not authorized.');
  }

  async function reviewApplication(id:string,action:'APPROVE'|'REJECT'){
    const response=await fetch('/api/staff/trusted-contributors',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({applicationId:id,action})});
    if(response.ok){setData(current=>current?{...current,applications:current.applications.filter(item=>item.id!==id)}:current);setMessage(`Application ${action.toLowerCase()}d.`)}else setMessage((await response.json()).error||'Action was not authorized.');
  }
  async function reviewAppeal(id:string,action:'ACCEPT'|'REJECT'|'REVIEW'){
    const response=await fetch('/api/staff/appeals',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({id,action})});
    if(response.ok){setData(current=>current?{...current,appeals:action==='REVIEW'?current.appeals:current.appeals.filter(item=>item.id!==id)}:current);setMessage('Appeal updated.')}else setMessage((await response.json()).error||'Action was not authorized.');
  }

  const panelRoot=data?.role==='HEAD_MODERATOR'?'/head-mod':data?.role==='MODERATOR'?'/mod':'/admin';
  const visibleQueue=data?.queue.filter(item=>focus==='skillshots'?item.target_type==='SKILLSHOT':focus==='comments'?item.target_type==='COMMENT':focus==='reports'?item.source==='REPORT':true)||[];
  const showQueue=['all','moderation','reports','skillshots','comments'].includes(focus);
  return <main className="staffPage shell">
    <nav className="staffNav">
      <Link className="brand" href="/"><span>S</span> Skillshot</Link>
      <Link href="/community">Community</Link>
      {data && <Link href={panelRoot}>Overview</Link>}
      {data && <Link href={`${panelRoot}/moderation`}>Moderation</Link>}
      {data && <Link href={`${panelRoot}/reports`}>Reports</Link>}
      {data && <Link href={`${panelRoot}/skillshots`}>Skillshots</Link>}
      {data && <Link href={`${panelRoot}/comments`}>Comments</Link>}
      {data?.permissions.includes('team.view') && <Link href={data.role==='HEAD_MODERATOR'?'/head-mod/moderators':'/admin/team'}>{data.role==='HEAD_MODERATOR'?'Moderators':'Team & Roles'}</Link>}
      {data?.permissions.includes('users.view') && data.role!=='HEAD_MODERATOR' && <Link href="/admin/users">Users</Link>}
      {data?.permissions.includes('analytics.view') && <Link href="/admin/analytics">Analytics</Link>}
      {data?.permissions.includes('audit.view') && <Link href="/admin/audit">Audit log</Link>}
      {data?.permissions.includes('trusted_contributor.review') && ['OWNER','ADMIN'].includes(data.role) && <Link href="/admin/trusted-contributors">Trusted Contributors</Link>}
      {data?.permissions.includes('settings.manage') && <Link href="/admin/settings">Settings</Link>}
    </nav>
    <header><p className="eyebrow">PRIVATE STAFF AREA</p><h1>{title}</h1><p>Reports and automatic flags share one review workflow.</p></header>
    {!data ? <div className="feedState">Loading moderation data…</div> : <>
      <section className="staffStats">{Object.entries(data.counts).map(([key, value]) => <div key={key}><strong>{Number(value)}</strong><span>{key.replaceAll('_', ' ')}</span></div>)}</section>
      {showQueue&&<section className="staffSection"><h2>{focus==='reports'?'Reported content':focus==='skillshots'?'Skillshots':focus==='comments'?'Comments':'Moderation queue'}</h2>
        {visibleQueue.length === 0 ? <p>Nothing is waiting for review.</p> : <div className="staffTable">{visibleQueue.map(item => <article key={item.id}>
          <div><b>{item.target_type}</b><span>{item.category} · {item.severity}</span><small>{item.username ? `@${item.username}` : 'Unknown creator'} · {new Date(item.created_at).toLocaleString()}</small></div>
          <div>{['APPROVE', 'HIDE', 'DELETE', 'DISMISS'].map(action => <button key={action} onClick={() => act(item.id, action)}>{action.toLowerCase()}</button>)}</div>
        </article>)}</div>}
      </section>}
      {(focus==='all'||focus==='trusted')&&data.permissions.includes('trusted_contributor.review')&&<section className="staffSection"><h2>Trusted Contributor applications</h2>{data.applications.length===0?<p>No applications waiting.</p>:<div className="staffTable">{data.applications.map(item=><article key={item.id}><div><b>{item.display_name} · @{item.username}</b><span>{item.reason}</span><small>{item.contribution}</small></div><div>{data.permissions.includes('trusted_contributor.approve')&&<button onClick={()=>reviewApplication(item.id,'APPROVE')}>approve</button>}{data.permissions.includes('trusted_contributor.reject')&&<button onClick={()=>reviewApplication(item.id,'REJECT')}>reject</button>}</div></article>)}</div>}</section>}
      {(focus==='all'||focus==='reports')&&<section className="staffSection"><h2>Appeals</h2>{data.appeals.length===0?<p>No appeals waiting.</p>:<div className="staffTable">{data.appeals.map(item=><article key={item.id}><div><b>{item.reason}</b><span>{item.target_type} · {item.target_id}</span><small>@{item.username} · {new Date(item.created_at).toLocaleString()}</small></div><div><button onClick={()=>reviewAppeal(item.id,'ACCEPT')}>accept</button><button onClick={()=>reviewAppeal(item.id,'REJECT')}>reject</button></div></article>)}</div>}</section>}
    </>}
    <p role="status">{message}</p>
  </main>;
}
