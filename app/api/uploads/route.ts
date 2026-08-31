import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { requirePrincipal } from '../../../lib/authz';
import { getReadyDb } from '../../../lib/db';
import { rateLimit } from '../../../lib/rate-limit';
import { SKILLSHOT_MAX_BYTES, stagingType } from '../../../lib/upload-policy';

export async function POST(request: Request) {
  const auth = await requirePrincipal();
  if ('error' in auth) return auth.error;
  const body = await request.json().catch(() => null) as HandleUploadBody | null;
  if (!body || body.type !== 'blob.generate-client-token' || !body.payload || !stagingType(body.payload.pathname)) {
    return Response.json({ error: 'Invalid upload request.' }, { status: 400 });
  }
  if (!await rateLimit(`upload-token:${auth.principal.id}`, 8, 3600)) {
    return Response.json({ error: 'You have uploaded several Skillshots recently. Please try again later.' }, { status: 429 });
  }
  try {
    const result = await handleUpload({
      request, body,
      onBeforeGenerateToken: async pathname => {
        const expires = new Date(Date.now() + 15 * 60 * 1000);
        await (await getReadyDb()).query(`INSERT INTO upload_sessions(pathname,user_id,expires_at) VALUES($1,$2,$3)`, [pathname, auth.principal.id, expires.toISOString()]);
        return { allowedContentTypes: [stagingType(pathname)!], maximumSizeInBytes: SKILLSHOT_MAX_BYTES, validUntil: expires.getTime(), addRandomSuffix: false, allowOverwrite: false };
      },
    });
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'Image storage is temporarily unavailable. Please try again.' }, { status: 503 });
  }
}
