export function safeReturnPath(value: string) {
  return value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

export function signInPath(returnTo: string, reason?: string) {
  const params = new URLSearchParams({ callbackUrl: safeReturnPath(returnTo) });
  if (reason) params.set('reason', reason.slice(0, 80));
  return `/signin?${params}`;
}

export function currentBrowserPath(hash = '') {
  if (typeof window === 'undefined') return '/';
  return `${window.location.pathname}${window.location.search}${hash || window.location.hash}`;
}

export function requireClientAuth(authenticated: boolean, returnTo: string, reason?: string) {
  if (authenticated) return true;
  if (typeof window !== 'undefined') window.location.assign(signInPath(returnTo, reason));
  return false;
}
