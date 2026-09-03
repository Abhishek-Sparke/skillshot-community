import { get } from '@vercel/blob';
import { getReadyDb } from '../../../../lib/db';
import { createHash } from 'node:crypto';

export async function GET(request: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const rows = await (await getReadyDb()).query(`SELECT avatar_url,avatar_type FROM users WHERE lower(username)=lower($1) AND status='ACTIVE' AND profile_status='VISIBLE' LIMIT 1`, [username]);
  if (!rows.length || !rows[0].avatar_url) return new Response('Avatar not found', { status: 404 });
  const etag = '"' + createHash('sha256').update(String(rows[0].avatar_url)).digest('hex') + '"';
  if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers: { ETag: etag, 'Cache-Control': 'private, no-cache' } });
  try {
    const result = await get(String(rows[0].avatar_url), { access: 'private' });
    if (result?.statusCode !== 200) return new Response('Avatar not found', { status: 404 });
    const contentType = ['image/png', 'image/jpeg', 'image/webp'].includes(result.blob.contentType)
      ? result.blob.contentType
      : String(rows[0].avatar_type || 'image/jpeg');
    return new Response(result.stream, { headers: {
      'Content-Type': contentType,
      ETag: etag,
      'Content-Length': String(result.blob.size),
      'Cache-Control': 'private, no-cache',
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
    } });
  } catch {
    return new Response('Avatar not found', { status: 404 });
  }
}
