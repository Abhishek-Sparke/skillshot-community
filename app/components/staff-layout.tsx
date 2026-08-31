import { requirePanel } from '../../lib/authz';
import StaffShell from './staff-shell';

export default async function StaffLayout({ kind, children }: { kind: 'admin'|'head-mod'|'mod'; children: React.ReactNode }) {
  const principal = await requirePanel(kind);
  return <StaffShell user={{ id: principal.id, role: principal.role, permissions: principal.permissions, username: String(principal.profile.username || 'staff') }}>{children}</StaffShell>;
}
