export const SOCIAL_PLATFORMS = [
  { key: 'github', label: 'GitHub', placeholder: 'github.com/username' },
  { key: 'instagram', label: 'Instagram', placeholder: 'instagram.com/username' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'linkedin.com/in/username' },
] as const;

export type SocialPlatformKey = (typeof SOCIAL_PLATFORMS)[number]['key'];

const profilePaths: Record<SocialPlatformKey, RegExp> = {
  github: /^\/[a-z0-9](?:[a-z0-9-]{0,38})\/?$/i,
  instagram: /^\/[a-z0-9._]{1,30}\/?$/i,
  linkedin: /^\/in\/[a-z0-9_%.-]+\/?$/i,
};

export function normalizeSocialUrl(platform: SocialPlatformKey, value: string) {
  const raw = value.trim();
  if (!raw) return '';
  const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  const parsed = new URL(withProtocol);
  const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
  const expectedHost = `${platform}.com`;
  if (!['http:', 'https:'].includes(parsed.protocol) || hostname !== expectedHost || !profilePaths[platform].test(parsed.pathname)) {
    throw new Error(`Invalid ${platform} profile URL`);
  }
  parsed.protocol = 'https:';
  parsed.hostname = expectedHost;
  parsed.port = '';
  parsed.search = '';
  parsed.hash = '';
  parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  return parsed.toString().replace(/\/$/, '');
}

export function safeStoredSocialLinks(value: unknown) {
  const stored = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const links: Partial<Record<SocialPlatformKey, string>> = {};
  for (const platform of SOCIAL_PLATFORMS) {
    const candidate = stored[platform.key];
    const raw = typeof candidate === 'string' ? candidate.trim() : '';
    if (!raw) continue;
    try {
      links[platform.key] = normalizeSocialUrl(platform.key, raw);
    } catch { /* Keep invalid legacy data stored, but do not render it publicly. */ }
  }
  return links;
}
