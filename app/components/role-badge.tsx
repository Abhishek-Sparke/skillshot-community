import type { UserRole } from '../../lib/roles';

const labels: Partial<Record<UserRole,string>> = { OWNER:'Owner', ADMIN:'Admin', HEAD_MODERATOR:'Head Moderator', MODERATOR:'Moderator', TRUSTED_CONTRIBUTOR:'Trusted Contributor' };
const icons: Partial<Record<UserRole,string>> = { OWNER:'♛', ADMIN:'◆', HEAD_MODERATOR:'★', MODERATOR:'◆', TRUSTED_CONTRIBUTOR:'♟' };
export default function RoleBadge({ role, variant = 'compact' }: { role: UserRole; variant?: 'profile'|'compact' }) {
  const label = labels[role];
  if (!label) return null;
  const tooltip=`${label} — Staff Role`;
  return <span className={`roleBadge role${role} ${variant}`} aria-label={tooltip} title={tooltip} data-tooltip={tooltip} role="img" tabIndex={0}><span aria-hidden="true">{icons[role]}</span>{variant === 'profile' && <b>{label}</b>}</span>;
}
