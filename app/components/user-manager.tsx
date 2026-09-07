/* eslint-disable react-hooks/set-state-in-effect */
'use client';
import { useEffect, useState } from 'react';
import { canModerateUser,type UserRole,type Permission } from '../../lib/roles';
import { useStaff } from './staff-shell';
import StaffDialog from './staff-dialog';
import CreatorUsername from './creator-username';
import { StaffEmpty,StaffStatus } from './staff-states';

type User={id:string;display_name:string;username:string;role:UserRole;creator_rank:string;status:string;created_at:string;avatar_url?:string|null};

export default function UserManager(){
  const principal=useStaff();
  const [users,setUsers]=useState<User[]>([]),[q,setQ]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[searched,setSearched]=useState(false);
  const [pending,setPending]=useState<{user:User;action:string}|null>(null);
  const [roleFilter,setRoleFilter]=useState('ALL');

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setUsers([]);
      setSearched(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const response = await fetch(`/api/staff/users?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        if (!response.ok) throw new Error();
        const data = await response.json();
        setUsers(data.users || []);
        setSearched(true);
      } catch {
        if (!controller.signal.aborted) setMessage('Something went wrong. Please try searching again.');
      } finally {
        setBusy(false);
      }
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [q]);

  async function search(){
    const term = q.trim();
    if (!term) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/staff/users?q=${encodeURIComponent(term)}`);
      if (!response.ok) throw new Error();
      setUsers((await response.json()).users);
      setSearched(true);
    } catch {
      setMessage('Something went wrong. Please try searching again.');
    } finally {
      setBusy(false);
    }
  }

  async function act(){if(!pending)return;setBusy(true);try{const response=await fetch('/api/staff/users',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({userId:pending.user.id,action:pending.action})});if(!response.ok)throw new Error();setPending(null);await search();setMessage('Account status updated.');}catch{setMessage('Could not update this account. Check your access and try again.');}finally{setBusy(false);}}
  const actions=(user:User)=>user.id===principal.id||!canModerateUser(principal.role,user.role)?[]:(user.status==='ACTIVE'?['SUSPEND','BAN']:user.status==='BANNED'?['UNBAN']:['UNSUSPEND']).filter(action=>principal.permissions.includes(`users.${action.toLowerCase()}` as Permission));

  const filteredUsers = users.filter(u => roleFilter === 'ALL' || u.role === roleFilter);

  return <section className="staffSection">
    <div className="staffCardTop"><h2>Users</h2></div>
    <form className="teamSearch" onSubmit={e=>{e.preventDefault();search();}}>
      <input value={q} maxLength={50} onChange={e=>setQ(e.target.value)} placeholder="Search by name or @username" aria-label="Search users"/>
      <button className="staffPrimary" disabled={busy}>{busy?'Searching…':'Search'}</button>
    </form>
    <div className="staffTabs" aria-label="Filter by role">
      {['ALL','ADMIN','HEAD_MODERATOR','MODERATOR','TRUSTED_CONTRIBUTOR','USER'].map(role => (
        <button type="button" key={role} aria-pressed={roleFilter === role} onClick={() => setRoleFilter(role)}>
          {role === 'ALL' ? 'All' : role === 'HEAD_MODERATOR' ? 'Head Moderator' : role === 'TRUSTED_CONTRIBUTOR' ? 'Trusted Contributor' : role[0] + role.slice(1).toLowerCase()}
        </button>
      ))}
    </div>
    <div className="staffTable">
      {filteredUsers.map(user=><article key={user.id} className="staffUserCard">
        <div className="staffUserIdentity">
          <div className="staffUserAvatar">
            {user.avatar_url ? <img src={`/api/avatars/${encodeURIComponent(user.username)}?v=${encodeURIComponent(user.avatar_url)}`} alt="" width={38} height={38} loading="lazy"/> : <span>{user.display_name.slice(0, 1).toUpperCase()}</span>}
          </div>
          <div>
            <b><CreatorUsername asSpan name={user.display_name} username={user.username} creatorRank={user.creator_rank} staffRole={user.role}/></b>
            <span>@{user.username}</span>
            <small>Joined {new Date(user.created_at).toLocaleDateString()}</small>
            <StaffStatus value={user.status}/>
          </div>
        </div>
        <div>
          {actions(user).map(action=><button key={action} disabled={busy} className={action==='BAN'?'staffDanger':''} onClick={()=>setPending({user,action})}>{action==='UNSUSPEND'?'Restore':action.toLowerCase()}</button>)}
        </div>
      </article>)}
    </div>
    {!users.length&&<StaffEmpty title={searched?'No matching users':'Find an account'}>{searched?'Try another display name or username.':'Search for an account to manage it.'}</StaffEmpty>}
    <p role="status">{message}</p>
    {pending&&<StaffDialog title={`${pending.action.toLowerCase()} @${pending.user.username}?`} onClose={()=>{if(!busy)setPending(null);}}>
      <p>This changes the account’s access to Skillshot. The action is recorded in the audit log.</p>
      <div className="staffActions"><button disabled={busy} onClick={()=>setPending(null)}>Cancel</button><button className="staffDanger" disabled={busy} onClick={act}>{busy?'Saving…':'Confirm change'}</button></div>
      <p role="status">{message}</p>
    </StaffDialog>}
  </section>;
}
