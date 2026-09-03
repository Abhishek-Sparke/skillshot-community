import type { Permission, UserRole } from './roles';

export type StaffIdentity = { role: UserRole; permissions: Permission[]; username: string; id: string };
export type StaffLink = { label: string; href: string; section: string; count?: string };
export function staffLinks(user: StaffIdentity): StaffLink[] {
  const admin = ['OWNER', 'ADMIN'].includes(user.role);
  const head = user.role === 'HEAD_MODERATOR';
  if (!admin && !head && user.role !== 'MODERATOR') return [];
  const root = admin ? '/admin' : head ? '/head-mod' : '/mod';
  const links: StaffLink[] = [{ label: 'Dashboard', href: root, section: 'Workspace' }];
  const add = (permission: Permission, label: string, href: string, section = 'Workspace', count?: string) => {
    if (user.permissions.includes(permission)) links.push({ label, href, section, count });
  };
  add('moderation.view', 'Moderation', `${root}/moderation`, 'Workspace', 'flagged');
  add('reports.view', 'Reports', `${root}/reports`, 'Workspace', 'reports');
  add('reports.view', 'My Cases', `${root}/reports?mine=1`);
  add('skillshots.view', 'Skillshots', `${root}/skillshots`);
  add('comments.view', 'Comments', `${root}/comments`);
  if (admin) {
    add('team.view', 'Team & Roles', '/admin/team', 'Management');
    add('users.view', 'Users', '/admin/users', 'Management');
    add('trusted_contributor.review', 'Trusted Contributors', '/admin/trusted-contributors', 'Management', 'applications');
    add('analytics.view', 'Analytics', '/admin/analytics', 'Insights');
    add('storage.view', 'Storage', '/admin/storage', 'Insights');
    add('audit.view', 'Audit Log', '/admin/audit', 'Insights');
    add('settings.manage', 'Settings', '/admin/settings', 'Settings');
  } else {
    if (head) add('team.view', 'Moderators', '/head-mod/moderators', 'Management');
    if (head || user.permissions.includes('audit.view')) links.push({ label: 'Moderation History', href: `${root}/history`, section: 'Insights' });
  }
  return links;
}

// Mirrors the existing PATCH authorization without granting new capabilities.
export function moderationActions(target: string, permissions: readonly string[]) {
  if (!permissions.includes('reports.resolve') || !['SKILLSHOT', 'COMMENT'].includes(target)) return [];
  return ['APPROVE', 'DISMISS', 'HIDE', 'DELETE'].filter(action => {
    if (target === 'COMMENT') return action !== 'DELETE' || permissions.includes('comments.delete');
    const required = action === 'DELETE' ? 'skillshots.delete' : action === 'HIDE' ? 'skillshots.hide' : action === 'APPROVE' ? 'skillshots.restore' : null;
    return !required || permissions.includes(required);
  });
}
export function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const index = Math.min(4, Math.floor(Math.log(value) / Math.log(1024)));
  return `${(value / 1024 ** index).toFixed(index > 1 ? 1 : 0)} ${['B','KB','MB','GB','TB'][index]}`;
}
export function readable(value: string) { return value.replaceAll('_', ' ').toLowerCase().replace(/^./, c => c.toUpperCase()); }
