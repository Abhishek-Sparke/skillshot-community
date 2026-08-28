export const ROLES = ['OWNER', 'ADMIN', 'MODERATOR', 'TRUSTED_CONTRIBUTOR', 'USER'] as const;
export type UserRole = typeof ROLES[number];
export const PERMISSIONS = ['reports.view','reports.resolve','skillshots.view','skillshots.hide','skillshots.restore','skillshots.delete','comments.view','comments.delete','users.view','users.suspend','users.unsuspend','users.ban','users.unban','team.view','team.manage','roles.manage','trusted_contributor.review','trusted_contributor.approve','trusted_contributor.reject','trusted_contributor.revoke','audit.view','analytics.view','settings.manage'] as const;
export type Permission = typeof PERMISSIONS[number];
const MODERATOR_DEFAULTS: Permission[] = ['reports.view','reports.resolve','skillshots.view','skillshots.hide','skillshots.restore','comments.view','comments.delete','trusted_contributor.review'];
const ADMIN_DEFAULTS: Permission[] = PERMISSIONS.filter(permission => permission !== 'settings.manage');
export const OWNER_EMAIL = (process.env.OWNER_EMAIL || '').trim().toLowerCase();
export const PRIMARY_ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
export function roleForEmail(email: string | null | undefined): UserRole | null {
  const normalized = email?.trim().toLowerCase();
  if (OWNER_EMAIL && normalized === OWNER_EMAIL) return 'OWNER';
  if (PRIMARY_ADMIN_EMAIL && normalized === PRIMARY_ADMIN_EMAIL) return 'ADMIN';
  return null;
}
export function normalizeRole(value: unknown): UserRole {
  const normalized = String(value || '').toUpperCase();
  if (normalized === 'MEMBER') return 'USER';
  return ROLES.includes(normalized as UserRole) ? normalized as UserRole : 'USER';
}
export function permissionsFor(role: UserRole, custom: unknown = []): Permission[] {
  const extra = Array.isArray(custom) ? custom.filter((value): value is Permission => PERMISSIONS.includes(value as Permission)) : [];
  if (role === 'OWNER') return [...PERMISSIONS];
  if (role === 'ADMIN') return [...new Set([...ADMIN_DEFAULTS, ...extra])];
  if (role === 'MODERATOR') return [...new Set([...MODERATOR_DEFAULTS, ...extra])];
  return [];
}
export function can(role: UserRole, permission: Permission, custom?: unknown) { return permissionsFor(role, custom).includes(permission); }
export function panelForRole(role: UserRole) { return role === 'OWNER' || role === 'ADMIN' ? '/admin' : role === 'MODERATOR' ? '/mod' : '/community'; }
