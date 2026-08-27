export type UserRole = 'member' | 'admin';

export const PRIMARY_ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '')
  .trim()
  .toLowerCase();

export function roleForEmail(email: string | null | undefined): UserRole {
  return PRIMARY_ADMIN_EMAIL && email?.trim().toLowerCase() === PRIMARY_ADMIN_EMAIL ? 'admin' : 'member';
}

export function normalizeRole(value: unknown): UserRole {
  return value === 'admin' ? 'admin' : 'member';
}
