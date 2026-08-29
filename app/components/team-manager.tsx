'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import type { UserRole } from '../../lib/roles';
import RoleBadge from './role-badge';

type Member = { id: string; display_name: string; username: string; role: UserRole; status: string; created_at: string; avatar_url?: string; custom_permissions: string[] };
type TeamData = { members: Member[]; role: UserRole; assignableRoles: UserRole[] };
const optionalPermissions = ['skillshots.delete','users.suspend','users.unsuspend','trusted_contributor.approve','trusted_contributor.reject','analytics.view'] as const;
const roleLabel = (role: string) => role.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, value => value.toUpperCase());

export default function TeamManager({ home = '/admin', moderatorsOnly = false }: { home?: string; moderatorsOnly?: boolean }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [selfRole, setSelfRole] = useState<UserRole>('USER');
  const [assignableRoles, setAssignableRoles] = useState<UserRole[]>([]);

  const apply = useCallback((data: TeamData) => {
    setMembers(moderatorsOnly ? data.members.filter(member => ['MODERATOR','USER'].includes(member.role)) : data.members);
    setSelfRole(data.role);
    setAssignableRoles(data.assignableRoles);
  }, [moderatorsOnly]);

  async function load(search = '') {
    const response = await fetch(`/api/staff/team?q=${encodeURIComponent(search)}`);
    if (response.ok) apply(await response.json());
    else setMessage('Could not load team members.');
  }

  useEffect(() => {
    let active = true;
    fetch('/api/staff/team').then(response => response.ok ? response.json() : Promise.reject()).then(data => { if (active) apply(data); }).catch(() => { if (active) setMessage('Could not load team members.'); });
    return () => { active = false; };
  }, [apply]);

  async function change(member: Member, role: UserRole, permissions: string[] = []) {
    if (!confirm(`${member.role === 'USER' ? 'Promote' : 'Change'} @${member.username} to ${roleLabel(role)}?`)) return;
    const response = await fetch('/api/staff/team', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: member.id, role, permissions }) });
    const data = await response.json();
    setMessage(response.ok ? `@${member.username} is now ${roleLabel(role)}.` : data.error || 'Not authorized.');
    if (response.ok) await load(query);
  }

  return <main className="staffPage shell">
    <nav className="staffNav"><Link className="brand" href="/"><span>S</span> Skillshot</Link><Link href={home}>Dashboard</Link></nav>
    <header><p className="eyebrow">{moderatorsOnly ? 'MODERATION TEAM' : 'TEAM & ROLES'}</p><h1>{moderatorsOnly ? 'Manage moderators.' : 'Manage the Skillshot team.'}</h1><p>Every role change follows the staff hierarchy and is recorded in the audit log.</p></header>
    <form className="teamSearch" onSubmit={event => { event.preventDefault(); load(query); }}><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search @username to add a team member"/><button className="primary">Search</button></form>
    <div className="staffTable teamTable">{members.map(member => <article key={member.id}>
      <div className="teamIdentity"><span className="teamAvatar">{member.avatar_url ? <Image src={`/api/avatars/${encodeURIComponent(member.username)}`} alt="" width={42} height={42}/> : member.display_name.slice(0, 1).toUpperCase()}</span><span><b>{member.display_name} <RoleBadge role={member.role}/></b><small>@{member.username}</small><small>{member.status} · Joined {new Date(member.created_at).toLocaleDateString()}</small></span></div>
      <div className="roleActions">{member.role !== 'OWNER' && assignableRoles.map(role => role !== member.role && (!moderatorsOnly || ['MODERATOR','USER'].includes(role)) ? <button type="button" key={role} onClick={() => change(member, role, member.custom_permissions || [])}>{role === 'USER' ? 'Remove role' : roleLabel(role)}</button> : null)}</div>
      {!moderatorsOnly && ['OWNER','ADMIN'].includes(selfRole) && ['HEAD_MODERATOR','MODERATOR'].includes(member.role) && <fieldset className="permissionEditor"><legend>Optional permissions</legend>{optionalPermissions.map(permission => <label key={permission}><input type="checkbox" checked={(member.custom_permissions || []).includes(permission)} onChange={event => setMembers(current => current.map(item => item.id === member.id ? { ...item, custom_permissions: event.target.checked ? [...(item.custom_permissions || []), permission] : (item.custom_permissions || []).filter(value => value !== permission) } : item))}/><span>{permission.replaceAll('.', ' · ')}</span></label>)}<button type="button" onClick={() => change(member, member.role, member.custom_permissions || [])}>Save permissions</button></fieldset>}
    </article>)}</div>
    {!members.length && <p className="feedState">No matching team members.</p>}<p role="status">{message}</p>
  </main>;
}
