import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { getReadyDb } from '../../../../db';
import { posts } from '../../../../db/schema';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [row] = await (await getReadyDb()).select().from(posts).where(eq(posts.id, id)).limit(1);
  if (!row) return new Response('Image not found', { status: 404 });
  const object = await env.FILES.get(row.imageKey);
  if (!object) return new Response('Image not found', { status: 404 });
  const download = new URL(request.url).searchParams.get('download') === '1';
  return new Response(object.body, { headers: {
    'Content-Type': row.imageType,
    'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="skillshot-${id}"`,
    'Cache-Control': 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
  } });
}
