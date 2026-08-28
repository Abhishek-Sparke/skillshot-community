import { get } from '@vercel/blob';
import { getReadyDb } from '../../../../lib/db';
import { getPrincipal } from '../../../../lib/authz';

const imageExtensions: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getPrincipal();
  const rows = await (await getReadyDb()).query(`SELECT image_url,image_type,user_id,status FROM posts WHERE id=$1 LIMIT 1`, [id]);
  if (!rows.length) return new Response('Image not found', { status: 404 });
  if (rows[0].status !== 'VISIBLE' && viewer?.id !== rows[0].user_id && !viewer?.permissions.includes('skillshots.view')) return new Response('Image not found', { status: 404 });
  const result = await get(String(rows[0].image_url), { access: 'private' });
  if (result?.statusCode !== 200) return new Response('Image not found', { status: 404 });
  const download = new URL(request.url).searchParams.get('download') === '1';
  const imageType = String(rows[0].image_type).toLowerCase();
  const extension = imageExtensions[imageType] ?? 'png';
  return new Response(result.stream, { headers: {
    'Content-Type': imageType,
    'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="skillshot-${id}.${extension}"`,
    'Cache-Control': rows[0].status === 'VISIBLE' ? 'public, max-age=3600' : 'private, no-store', 'X-Content-Type-Options': 'nosniff',
  } });
}
