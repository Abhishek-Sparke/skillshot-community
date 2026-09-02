import { redirect } from 'next/navigation';
import { getChatGPTUser } from '../app/chatgpt-auth';
import { ensureUser } from './db';
import { can, normalizeRole, panelForRole, permissionsFor, type Permission, type UserRole } from './roles';

export type Principal = { id: string; email: string; role: UserRole; status: string; permissions: Permission[]; profile: Record<string, unknown> };
export async function getPrincipal(): Promise<Principal | null> {
  const sessionUser = await getChatGPTUser();
  if (!sessionUser) return null;
  const profile = await ensureUser(sessionUser);
  const role = normalizeRole(profile.role);
  return { id: sessionUser.userId, email: sessionUser.email, role, status: String(profile.status || 'ACTIVE'), permissions: permissionsFor(role, profile.custom_permissions), profile };
}
export async function requirePrincipal(permission?: Permission) {
  const principal = await getPrincipal();
  if (!principal) return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) } as const;
  if (principal.status !== 'ACTIVE') return { error: Response.json({ error: 'Account unavailable' }, { status: 403 }) } as const;
  if (permission && !can(principal.role, permission, principal.profile.custom_permissions)) return { error: Response.json({ error: 'Forbidden' }, { status: 403 }) } as const;
  return { principal } as const;
}
export async function requirePanel(kind: 'admin' | 'head-mod' | 'mod') {
  const principal = await getPrincipal();
  if (!principal) redirect(`/signin?callbackUrl=/${kind}`);
  if (principal.status !== 'ACTIVE') redirect('/signin?reason=Your%20account%20is%20unavailable');
  const allowed = kind === 'admin'
    ? ['OWNER','ADMIN'].includes(principal.role)
    : kind === 'head-mod'
      ? ['OWNER','ADMIN','HEAD_MODERATOR'].includes(principal.role)
      : ['OWNER','ADMIN','HEAD_MODERATOR','MODERATOR'].includes(principal.role);
  if (!allowed) redirect(panelForRole(principal.role));
  return principal;
}
