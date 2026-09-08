import type { ReactNode } from 'react';
import { getStaffEffectClass, type UserRole } from '../../lib/roles';

export { getStaffEffectClass };

export default function StaffVisualEffect({
  role,
  children,
  className = '',
}: {
  role?: UserRole | string | null;
  children: ReactNode;
  className?: string;
}) {
  const effectClass = getStaffEffectClass(role);
  if (!effectClass) {
    return <span className={className}>{children}</span>;
  }
  return <span className={`${effectClass} ${className}`}>{children}</span>;
}
