import type { UserRole } from '../../lib/roles';

const labels: Partial<Record<UserRole,string>> = { OWNER:'Owner', ADMIN:'Admin', HEAD_MODERATOR:'Head Moderator', MODERATOR:'Moderator', TRUSTED_CONTRIBUTOR:'Trusted Contributor' };
const icons: Partial<Record<UserRole,string>> = { OWNER:'♛', ADMIN:'◆', HEAD_MODERATOR:'★', MODERATOR:'◆', TRUSTED_CONTRIBUTOR:'♟' };
export default function RoleBadge({ role, variant = 'compact' }: { role: UserRole; variant?: 'profile'|'compact' }) {
  const label = labels[role];
  if (!label) return null;
  return <span className={`roleBadge role${role} ${variant}`} aria-label={label} title={variant==='profile'?label:undefined} data-tooltip={variant === 'compact' ? label : undefined} role="img" tabIndex={variant === 'compact' ? 0 : undefined}><span aria-hidden="true">{icons[role]}</span>{variant === 'profile' && <b>{label}</b>}</span>;
}
