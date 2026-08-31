export function pageSize(value: string | null) {
  const size = Number(value);
  return Number.isFinite(size) && size > 0 ? Math.min(30, Math.max(1, Math.floor(size))) : 18;
}

export function encodeCursor(row: Record<string, unknown>) {
  return Buffer.from(`${new Date(row.created_at as string).toISOString()}|${row.id}`).toString('base64url');
}

export function decodeCursor(value: string | null): { date: string | null; id: string | null } {
  if (!value || value.length > 512) return { date: null, id: null };
  try {
    const [date, id, extra] = Buffer.from(value, 'base64url').toString('utf8').split('|');
    if (!date || !id || extra || id.length > 100 || Number.isNaN(Date.parse(date))) throw new Error();
    return { date: new Date(date).toISOString(), id };
  } catch { return { date: null, id: null }; }
}
