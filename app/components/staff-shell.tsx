'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useState } from 'react';
import { staffLinks, type StaffIdentity } from '../../lib/staff-ui';
import StaffDialog from './staff-dialog';
import RoleBadge from './role-badge';

const IdentityContext = createContext<StaffIdentity | null>(null);
export function useStaff() { const user = useContext(IdentityContext); if (!user) throw new Error('Staff context required'); return user; }
const descriptions: Record<string, string> = {
  Moderation: 'Review reported and automatically flagged content.', Reports: 'Review community reports and appeals.',
  Skillshots: 'Review flagged visual work shared with the community.', Comments: 'Review flagged conversations in context.',
  'Team & Roles': 'Manage Skillshot staff and their responsibilities.', Moderators: 'Manage your community moderation team.',
  Users: 'Find and manage community accounts.', 'Trusted Contributors': 'Recognize people making a positive contribution.',
  Analytics: 'Understand community activity at a glance.', Storage: 'Monitor image storage and review retained files safely.',
  'Audit Log': 'A record of sensitive staff actions.', 'Moderation History': 'Review moderation activity within your access.',
  Settings: 'Server-enforced safety and publishing policies.',
};
export default function StaffShell({ user, children }: { user: StaffIdentity; children: React.ReactNode }) {
  const path = usePathname();
  const links = staffLinks(user);
  const [drawer, setDrawer] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const active = links.find(link => link.href === path);
  const title = active?.label || 'Dashboard';
  useEffect(() => {
    let alive = true;
    const refresh = () => { fetch('/api/staff/overview').then(r => r.ok ? r.json() : null).then(data => { if (alive && data) setCounts(data.counts); }).catch(() => {}); };
    refresh(); window.addEventListener('staff-updated', refresh);
    return () => { alive = false; window.removeEventListener('staff-updated', refresh); };
  }, []);
  const nav = <nav aria-label="Staff navigation">{['Workspace','Management','Insights','Settings'].map(section => {
    const group = links.filter(link => link.section === section);
    return group.length ? <div className="staffNavGroup" key={section}><p>{section}</p>{group.map(link => <Link key={link.href} href={link.href} aria-current={path === link.href ? 'page' : undefined} onClick={() => setDrawer(false)}><span>{link.label}</span>{link.count && Number(counts[link.count]) > 0 && <span className="staffNavCount" aria-label={`${counts[link.count]} pending`}>{counts[link.count]}</span>}</Link>)}</div> : null;
  })}<Link className="staffBack" href="/community" onClick={() => setDrawer(false)}>← Back to community</Link></nav>;
  return <IdentityContext.Provider value={user}><div className="staffWorkspace">
    <a className="staffSkip" href="#staff-content">Skip to content</a>
    <aside className="staffSidebar"><Link href="/" className="brand"><span>S</span> Skillshot</Link><p className="staffWorkspaceLabel">STAFF WORKSPACE</p>{nav}<div className="staffSignedIn"><span>@{user.username}</span><RoleBadge role={user.role} variant="profile"/></div></aside>
    <div className="staffMain"><div className="staffTopbar"><button type="button" className="staffMenu" aria-label="Open staff navigation" aria-expanded={drawer} onClick={() => setDrawer(true)}>☰</button><span className="staffTopLabel">Skillshot <span>/ Staff workspace</span></span><div className="staffHeaderActions"><Link href="/notifications">Notifications</Link><Link href="/profile">Profile</Link></div></div>
      <main id="staff-content" className="staffContent"><header className="staffHeader"><nav aria-label="Breadcrumb"><Link href={links[0]?.href || '/community'}>Dashboard</Link>{title !== 'Dashboard' && <><span aria-hidden="true"> / </span><span aria-current="page">{title}</span></>}</nav><h1>{title}</h1><p>{title === 'Dashboard' ? `Welcome back, @${user.username}. Here’s what needs your attention.` : descriptions[title]}</p></header>{children}</main>
    </div>{drawer && <StaffDialog title="Staff navigation" onClose={() => setDrawer(false)}>{nav}</StaffDialog>}
  </div></IdentityContext.Provider>;
}
