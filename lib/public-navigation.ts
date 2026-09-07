import { signInPath, signUpPath } from './auth-path.ts';
import { isStaffRole, panelForRole, type UserRole } from './roles.ts';

export type PublicNavLink = { href: string; label: string; className?: string };

/** The caller supplies the server-authenticated viewer, never the profile being viewed. */
export function publicNavigation(viewer: { role: UserRole; status: string } | null, returnTo: string): PublicNavLink[] {
  const links: PublicNavLink[] = [
    { href: '/community', label: 'Community' },
    { href: '/discussion', label: 'Discussion' },
    { href: '/search', label: 'Search' },
  ];
  if (!viewer || viewer.status !== 'ACTIVE') return [...links,
    { href: signInPath(returnTo), label: 'Sign in', className: 'authEntry' },
    { href: signUpPath(), label: 'Sign up', className: 'upload' },
  ];
  links.push({ href: '/my-posts', label: 'My posts' }, { href: '/chats', label: 'Chats' }, { href: '/profile', label: 'Profile' });
  if (isStaffRole(viewer.role)) {
    links.push({ href: panelForRole(viewer.role), label: '◆ Dashboard' });
  }
  links.push({ href: '/upload', label: '＋ Share a shot', className: 'upload' });
  return links;
}
