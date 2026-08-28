'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Member = { id: string; display_name: string; username: string; role: string; status: string; created_at: string; custom_permissions:string[] };
const optionalPermissions=['skillshots.delete','users.suspend','users.unsuspend','trusted_contributor.approve','trusted_contributor.reject','analytics.view'] as const;

export default function TeamManager() {
  const [members, setMembers] = useState<Member[]>([]);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [selfRole,setSelfRole]=useState('');

  async function load(search = '') {
    const response = await fetch(`/api/staff/team?q=${encodeURIComponent(search)}`);
    if (response.ok) {const data=await response.json();setMembers(data.members);setSelfRole(data.role)}
  }

  useEffect(() => {
    let active = true;
    fetch('/api/staff/team')
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(data => { if (active) {setMembers(data.members);setSelfRole(data.role);} })
      .catch(() => { if (active) setMessage('Could not load team members.'); });
    return () => { active = false; };
  }, []);

  async function change(id: string, role: string,permissions:string[] = []) {
    if (!confirm(`Change this team member to ${role}?`)) return;
    const response = await fetch('/api/staff/team', {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: id, role,permissions }),
    });
    setMessage(response.ok ? 'Team role updated.' : (await response.json()).error || 'Not authorized.');
    if (response.ok) await load(query);
  }

  return <main className="staffPage shell">
    <nav className="staffNav"><Link className="brand" href="/"><span>S</span> Skillshot</Link><Link href="/admin">Dashboard</Link></nav>
    <header><p className="eyebrow">TEAM & ROLES</p><h1>Manage the Skillshot team.</h1><p>Owner protection and every role change are enforced and recorded on the server.</p></header>
    <form className="teamSearch" onSubmit={event => { event.preventDefault(); load(query); }}><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search @username to add a team member"/><button className="primary">Search</button></form>
    <div className="staffTable">{members.map(member => <article key={member.id}>
      <div><b>{member.display_name} · @{member.username}</b><span>{member.role} · {member.status}</span><small>Joined {new Date(member.created_at).toLocaleDateString()}</small></div>
      <div>{member.role !== 'OWNER' && <><button onClick={() => change(member.id, 'MODERATOR',member.custom_permissions||[])}>moderator</button>{selfRole==='OWNER'&&<button onClick={() => change(member.id, 'ADMIN')}>admin</button>}<button onClick={() => change(member.id, 'USER')}>remove role</button></>}</div>
      {member.role==='MODERATOR'&&<fieldset className="permissionEditor"><legend>Optional moderator permissions</legend>{optionalPermissions.map(permission=><label key={permission}><input type="checkbox" checked={(member.custom_permissions||[]).includes(permission)} onChange={event=>setMembers(current=>current.map(item=>item.id===member.id?{...item,custom_permissions:event.target.checked?[...(item.custom_permissions||[]),permission]:(item.custom_permissions||[]).filter(value=>value!==permission)}:item))}/><span>{permission.replaceAll('.',' · ')}</span></label>)}<button onClick={()=>change(member.id,'MODERATOR',member.custom_permissions||[])}>Save permissions</button></fieldset>}
    </article>)}</div>
    <p role="status">{message}</p>
  </main>;
}
