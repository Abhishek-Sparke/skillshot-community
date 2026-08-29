export const ROLES = ['OWNER', 'ADMIN', 'HEAD_MODERATOR', 'MODERATOR', 'TRUSTED_CONTRIBUTOR', 'USER'] as const;
export type UserRole = typeof ROLES[number];
export const PERMISSIONS = ['reports.view','reports.resolve','moderation.view','moderation.approve','moderation.hide','moderation.restore','moderation.delete','skillshots.view','skillshots.hide','skillshots.restore','skillshots.delete','comments.view','comments.delete','users.view','users.suspend','users.unsuspend','users.ban','users.unban','team.view','team.manage','roles.manage','admins.manage','head_moderators.manage','moderators.manage','trusted_contributor.review','trusted_contributor.approve','trusted_contributor.reject','trusted_contributor.revoke','audit.view','analytics.view','settings.manage'] as const;
export type Permission = typeof PERMISSIONS[number];
const MODERATOR_DEFAULTS: Permission[] = ['reports.view','reports.resolve','moderation.view','moderation.approve','moderation.hide','moderation.restore','skillshots.view','skillshots.hide','skillshots.restore','comments.view','comments.delete'];
const HEAD_MODERATOR_DEFAULTS: Permission[] = [...MODERATOR_DEFAULTS,'team.view','team.manage','roles.manage','moderators.manage'];
const ADMIN_DEFAULTS: Permission[] = PERMISSIONS.filter(permission => !['settings.manage','admins.manage'].includes(permission));
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
  if (role === 'HEAD_MODERATOR') return [...new Set([...HEAD_MODERATOR_DEFAULTS, ...extra])];
  if (role === 'MODERATOR') return [...new Set([...MODERATOR_DEFAULTS, ...extra])];
  return [];
}
export function can(role: UserRole, permission: Permission, custom?: unknown) { return permissionsFor(role, custom).includes(permission); }
export function panelForRole(role: UserRole) { return role === 'OWNER' || role === 'ADMIN' ? '/admin' : role === 'HEAD_MODERATOR' ? '/head-mod' : role === 'MODERATOR' ? '/mod' : '/community'; }
export function isStaffRole(role: UserRole) { return ['OWNER','ADMIN','HEAD_MODERATOR','MODERATOR'].includes(role); }

export function assignableRoles(role: UserRole): UserRole[] {
  if (role === 'OWNER') return ['ADMIN','HEAD_MODERATOR','MODERATOR','USER'];
  if (role === 'ADMIN') return ['HEAD_MODERATOR','MODERATOR','USER'];
  if (role === 'HEAD_MODERATOR') return ['MODERATOR','USER'];
  return [];
}

export function canChangeRole(actor: UserRole, target: UserRole, next: UserRole) {
  if (target === 'OWNER' || next === 'OWNER' || next === 'TRUSTED_CONTRIBUTOR') return false;
  if (actor === 'OWNER') return ['ADMIN','HEAD_MODERATOR','MODERATOR','USER'].includes(next);
  if (actor === 'ADMIN') return !['OWNER','ADMIN'].includes(target) && ['HEAD_MODERATOR','MODERATOR','USER'].includes(next);
  if (actor === 'HEAD_MODERATOR') return ['USER','MODERATOR'].includes(target) && ['USER','MODERATOR'].includes(next) && target !== next;
  return false;
}

const ROLE_RANK: Record<UserRole, number> = { OWNER: 5, ADMIN: 4, HEAD_MODERATOR: 3, MODERATOR: 2, TRUSTED_CONTRIBUTOR: 1, USER: 0 };
export function canModerateUser(actor: UserRole, target: UserRole) {
  return actor !== target && ROLE_RANK[actor] > ROLE_RANK[target];
}
