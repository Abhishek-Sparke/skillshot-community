import { get } from '@vercel/blob';
import { getReadyDb } from '../../../../lib/db';
import { getPrincipal } from '../../../../lib/authz';
import { createHash } from 'node:crypto';
import { imageDelivery } from '../../../../lib/image-delivery';


export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const principal = await getPrincipal();
  const viewer = principal?.status === 'ACTIVE' ? principal : null;
  const rows = await (await getReadyDb()).query(`SELECT p.image_url,p.display_url,p.thumbnail_url,p.image_type,p.user_id,p.status,u.status author_status FROM posts p JOIN users u ON u.id=p.user_id WHERE p.id=$1 AND p.status NOT IN ('PURGING','PURGED') LIMIT 1`, [id]);
  if (!rows.length) return new Response('Image not found', { status: 404 });
  if ((rows[0].status !== 'VISIBLE' || rows[0].author_status !== 'ACTIVE') && viewer?.id !== rows[0].user_id && !viewer?.permissions.includes('skillshots.view')) return new Response('Image not found', { status: 404 });
  const url = new URL(request.url);
  const download = url.searchParams.get('download') === '1';
  const variant = url.searchParams.get('variant');
  const { pathname, type: imageType, extension } = imageDelivery(rows[0] as { image_url: unknown; image_type: unknown; display_url?: unknown; thumbnail_url?: unknown }, variant, download);
  const etag = '"' + createHash('sha256').update(String(pathname)).digest('hex') + '"';
  if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers: { ETag: etag, 'Cache-Control': 'private, no-cache' } });
  const result = await get(String(pathname), { access: 'private' });
  if (result?.statusCode !== 200) return new Response('Image not found', { status: 404 });
  return new Response(result.stream, { headers: {
    'Content-Type': imageType,
    ETag: etag,
    'Content-Length': String(result.blob.size),
    'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="skillshot-${id}.${extension}"`,
    'Cache-Control': 'private, no-cache', 'X-Content-Type-Options': 'nosniff',
  } });
}
