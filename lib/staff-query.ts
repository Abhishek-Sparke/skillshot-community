export function queueFilters(params: URLSearchParams) {
  const choice = (key: string, allowed: string[], fallback: string) => { const value = params.get(key) || ''; return allowed.includes(value) ? value : fallback; };
  return {
    type: choice('type', ['ALL','IMAGE','PROFILE','SKILLSHOT','COMMENT'], 'ALL'),
    source: choice('source', ['ALL','AUTO','REPORT'], 'ALL'),
    status: choice('status', ['ALL','PENDING','RESOLVED','DISMISSED'], 'PENDING'),
    severity: choice('severity', ['ALL','BORDERLINE','HIGH'], 'ALL'),
    reason: (params.get('reason') || '').trim().slice(0, 100),
    page: Math.min(10000, Math.max(1, Math.floor(Number(params.get('page')) || 1))),
  };
}
