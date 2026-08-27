import { get } from '@vercel/blob';
import { getReadyDb } from '../../../../lib/db';

export async function GET(_: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const rows = await (await getReadyDb()).query(`SELECT avatar_url,avatar_type FROM users WHERE lower(username)=lower($1) LIMIT 1`, [username]);
  if (!rows.length || !rows[0].avatar_url) return new Response('Avatar not found', { status: 404 });
  const result = await get(String(rows[0].avatar_url), { access: 'private' });
  if (result?.statusCode !== 200) return new Response('Avatar not found', { status: 404 });
  return new Response(result.stream, { headers: {
    'Content-Type': String(rows[0].avatar_type || 'image/jpeg'),
    'Cache-Control': 'public, max-age=3600',
    'Content-Disposition': 'inline',
    'X-Content-Type-Options': 'nosniff',
  } });
}
