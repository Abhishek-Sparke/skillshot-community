import type { UserRole } from '../../lib/roles';
import IconBadge from './icon-badge';

const labels: Partial<Record<UserRole, string>> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  HEAD_MODERATOR: 'Head Moderator',
  MODERATOR: 'Moderator',
  TRUSTED_CONTRIBUTOR: 'Trusted Contributor',
};

function RoleIcon({ role }: { role: UserRole }) {
  if (role === 'OWNER') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 18 2-11 5 5 2-8 2 8 5-5 2 11Z"/><path d="M4 21h16"/></svg>;
  if (role === 'TRUSTED_CONTRIBUTOR') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 7 4v5c0 4.4-2.7 7.3-7 9.7C7.7 19.3 5 16.4 5 12V7Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg>;
  if (role === 'HEAD_MODERATOR') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.8 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"/></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 7 4v5c0 4.4-2.7 7.3-7 9.7C7.7 19.3 5 16.4 5 12V7Z"/><path d="M9 12.2 11.2 14 15 9.5"/></svg>;
}

export default function RoleBadge({
  role,
  variant = 'compact',
  showLabel = false,
  className = '',
}: {
  role?: UserRole | string | null;
  variant?: 'profile' | 'compact';
  showLabel?: boolean;
  className?: string;
}) {
  if (!role || role === 'USER') return null;
  const label = labels[role as UserRole];
  if (!label) return null;

  const accessibleLabel = `${label} Staff Role`;
  const badge = (
    <IconBadge
      className={`roleBadge role${role} ${variant} ${className}`}
      size={variant}
      tooltip={`${label} — Staff Role`}
      tooltipTitle={label}
      tooltipSubtitle="Staff Role"
      ariaLabel={accessibleLabel}
    >
      <span className="roleBadgeIcon"><RoleIcon role={role as UserRole} /></span>
    </IconBadge>
  );

  return showLabel ? <span className="roleBadgeLabel">{badge}<b>{label}</b></span> : badge;
}

export { RoleBadge as StaffRoleBadge };
