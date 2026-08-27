import { get } from '@vercel/blob';
import { getReadyDb } from '../../../../lib/db';

const imageExtensions: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await (await getReadyDb()).query(`SELECT image_url,image_type FROM posts WHERE id=$1 LIMIT 1`, [id]);
  if (!rows.length) return new Response('Image not found', { status: 404 });
  const result = await get(String(rows[0].image_url), { access: 'private' });
  if (result?.statusCode !== 200) return new Response('Image not found', { status: 404 });
  const download = new URL(request.url).searchParams.get('download') === '1';
  const imageType = String(rows[0].image_type).toLowerCase();
  const extension = imageExtensions[imageType] ?? 'png';
  return new Response(result.stream, { headers: {
    'Content-Type': imageType,
    'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="skillshot-${id}.${extension}"`,
    'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff',
  } });
}
