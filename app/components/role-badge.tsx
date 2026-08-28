import type { UserRole } from '../../lib/roles';

const labels: Partial<Record<UserRole,string>> = { OWNER:'Owner', ADMIN:'Admin', MODERATOR:'Moderator', TRUSTED_CONTRIBUTOR:'Trusted Contributor' };
const icons: Partial<Record<UserRole,string>> = { OWNER:'♛', ADMIN:'✦', MODERATOR:'✦', TRUSTED_CONTRIBUTOR:'♙' };
export default function RoleBadge({ role, variant = 'compact' }: { role: UserRole; variant?: 'profile'|'compact' }) {
  const label = labels[role];
  if (!label) return null;
  return <span className={`roleBadge role${role} ${variant}`} aria-label={label} title={label} role="img"><span aria-hidden="true">{icons[role]}</span>{variant === 'profile' && <b>{label}</b>}</span>;
}
