import { get } from '@vercel/blob';
import { getReadyDb } from '../../../../lib/db';

export async function GET(_: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const rows = await (await getReadyDb()).query(`SELECT avatar_url,avatar_type FROM users WHERE lower(username)=lower($1) LIMIT 1`, [username]);
  if (!rows.length || !rows[0].avatar_url) return new Response('Avatar not found', { status: 404 });
  try {
    const result = await get(String(rows[0].avatar_url), { access: 'private' });
    if (result?.statusCode !== 200) return new Response('Avatar not found', { status: 404 });
    const contentType = ['image/png', 'image/jpeg', 'image/webp'].includes(result.blob.contentType)
      ? result.blob.contentType
      : String(rows[0].avatar_type || 'image/jpeg');
    return new Response(result.stream, { headers: {
      'Content-Type': contentType,
      'Content-Length': String(result.blob.size),
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
    } });
  } catch {
    return new Response('Avatar not found', { status: 404 });
  }
}
