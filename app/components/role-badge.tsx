import type { UserRole } from '../../lib/roles';

export default function RoleBadge({ role }: { role: UserRole }) {
  if (role !== 'admin') return null;

  return <span className="adminBadge" aria-label="Admin" tabIndex={0}>
    <span aria-hidden="true">✓</span>
  </span>;
}
