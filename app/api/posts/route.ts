import { del, put } from '@vercel/blob';
import { getChatGPTUser } from '../../chatgpt-auth';
import { getReadyDb } from '../../../lib/db';
import { normalizeRole } from '../../../lib/roles';
import { rateLimit } from '../../../lib/rate-limit';
import { moderateImage, moderateText } from '../../../lib/moderation';
import { requirePrincipal } from '../../../lib/authz';
import { processSkillshot, publicUploadMessage, SKILLSHOT_MAX_BYTES, uploadError } from '../../../lib/image-processing';

const categories = new Set(['Gaming','Development','Design','Photography','Art','Creative','Projects','Other']);

function encodeCursor(row: Record<string, unknown>) { return Buffer.from(`${new Date(row.created_at as string).toISOString()}|${row.id}`).toString('base64url'); }
function decodeCursor(value: string | null) {
  if (!value) return { date: null, id: null };
  try { const [date,id]=Buffer.from(value,'base64url').toString('utf8').split('|');if(!date||!id||Number.isNaN(Date.parse(date)))throw new Error();return {date,id}; }
  catch { return { date: null, id: null }; }
}
async function recordUpload(userId:string,outcome:string,bytes:number,reason?:string){try{await(await getReadyDb()).query(`INSERT INTO upload_events(id,user_id,kind,outcome,bytes,reason)VALUES($1,$2,'SKILLSHOT',$3,$4,$5)`,[crypto.randomUUID(),userId,outcome,bytes,reason||null])}catch{}}
function errorResponse(code:string,status:number){return Response.json({error:publicUploadMessage(code),code},{status})}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  const url = new URL(request.url);
  const mine = url.searchParams.get('mine') === '1';
  const requestedUsername = url.searchParams.get('username')?.trim().toLowerCase().slice(0, 30) || null;
  const likedByUsername = url.searchParams.get('likedBy')?.trim().toLowerCase().slice(0, 30) || null;
  const limit = Math.min(30, Math.max(1, Number(url.searchParams.get('limit')) || 18));
  const cursor = decodeCursor(url.searchParams.get('cursor'));
  if (mine && !user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const sql = await getReadyDb();
  const rows = await sql.query(`
    SELECT p.id, p.user_id, p.title, p.description, p.tags, p.skills, p.category, p.created_at,
      u.display_name, u.username, u.email, u.role, u.avatar_url,
      (SELECT COUNT(*) FROM reactions r WHERE r.post_id = p.id) AS reaction_count,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
    FROM posts p JOIN users u ON u.id = p.user_id
    WHERE p.status='VISIBLE' AND u.status='ACTIVE' AND ($1::text IS NULL OR p.user_id = $1)
      AND ($2::text IS NULL OR lower(u.username) = $2)
      AND ($3::text IS NULL OR EXISTS(
        SELECT 1 FROM reactions liked
        JOIN users liker ON liker.id=liked.user_id
        WHERE liked.post_id=p.id AND lower(liker.username)=$3
      ))
      AND ($4::timestamptz IS NULL OR (p.created_at, p.id) < ($4::timestamptz, $5::text))
    ORDER BY p.created_at DESC, p.id DESC LIMIT $6
  `, [mine ? user!.userId : null, requestedUsername, likedByUsername, cursor.date, cursor.id, limit + 1]);
  const hasMore = rows.length > limit;
  const visibleRows = hasMore ? rows.slice(0, limit) : rows;
  return Response.json({ posts: visibleRows.map(row => ({
    id: row.id, title: row.title, description: row.description,
    tags: Array.isArray(row.tags) ? row.tags : [], author: row.display_name,
    skills: Array.isArray(row.skills) ? row.skills : [], category: row.category || 'Other',
    username: row.username,
    authorRole: normalizeRole(row.role),
    avatarUrl: row.avatar_url ? `/api/avatars/${encodeURIComponent(String(row.username))}?v=${encodeURIComponent(String(row.avatar_url))}` : '',
    createdAt: new Date(row.created_at as string).getTime(),
    reactionCount: Number(row.reaction_count), commentCount: Number(row.comment_count),
    imageUrl: `/api/images/${row.id}?variant=thumbnail`, previewUrl: `/api/images/${row.id}?variant=display`, downloadUrl: `/api/images/${row.id}?download=1`,
    isOwner: user?.userId === row.user_id,
  })), nextCursor: hasMore ? encodeCursor(visibleRows[visibleRows.length - 1]) : null });
}

export async function POST(request: Request) {
  const auth = await requirePrincipal();
  if ('error' in auth) return auth.error;
  const userId = auth.principal.id;
  if (!await rateLimit(`post:${userId}`, 8, 3600)) return Response.json({ error: 'You have uploaded several Skillshots recently. Please try again later.', code: 'RATE_LIMITED' }, { status: 429 });

  let sourceBytes = 0;
  const uploaded: string[] = [];
  try {
    const data = await request.formData();
    const image = data.get('image');
    if (!(image instanceof File)) return errorResponse('INVALID_IMAGE', 400);
    sourceBytes = image.size;
    const validation = uploadError(image, SKILLSHOT_MAX_BYTES);
    if (validation) return errorResponse(validation, 400);
    const title = String(data.get('title') || '').trim().slice(0, 100);
    if (!title) return Response.json({ error: 'Please add a title.', code: 'TITLE_REQUIRED' }, { status: 400 });
    const description = String(data.get('description') || '').trim().slice(0, 1000);
    const tags = String(data.get('tags') || '').split(',').map(value => value.trim()).filter(Boolean).slice(0, 8);
    const skills = String(data.get('skills') || '').split(',').map(value => value.trim()).filter(Boolean).slice(0, 8);
    const requestedCategory = String(data.get('category') || 'Other');
    const category = categories.has(requestedCategory) ? requestedCategory : 'Other';
    const textDecision = await moderateText(`${title}\n${description}\n${skills.join(' ')}\n${tags.join(' ')}`);
    if (textDecision.level === 'HIGH') {
      await recordUpload(userId, 'BLOCKED', sourceBytes, 'MODERATION_FAILED');
      return errorResponse('MODERATION_FAILED', 422);
    }

    const sourceBuffer = Buffer.from(await image.arrayBuffer());
    let processed;
    try { processed = await processSkillshot(sourceBuffer); }
    catch (error) { return errorResponse(error instanceof Error && error.message === 'HUGE_DIMENSIONS' ? 'HUGE_DIMENSIONS' : 'INVALID_IMAGE', 400); }

    const id = crypto.randomUUID();
    const extension = image.type === 'image/png' ? 'png' : image.type === 'image/webp' ? 'webp' : 'jpg';
    const original = await put(`shots/${userId}/${id}/original.${extension}`, sourceBuffer, { access: 'private', addRandomSuffix: false, contentType: image.type });
    uploaded.push(original.pathname);
    let imageDecision;
    try { imageDecision = await moderateImage(original.url); }
    catch { await recordUpload(userId, 'FAILED', sourceBytes, 'MODERATION_FAILED'); return errorResponse('MODERATION_FAILED', 503); }
    if (imageDecision.level === 'HIGH') {
      await recordUpload(userId, 'BLOCKED', sourceBytes, 'MODERATION_FAILED');
      await del(uploaded);
      return errorResponse('MODERATION_FAILED', 422);
    }
    const [display, thumbnail] = await Promise.all([
      put(`shots/${userId}/${id}/display.webp`, processed.display, { access: 'private', addRandomSuffix: false, contentType: 'image/webp' }),
      put(`shots/${userId}/${id}/thumbnail.webp`, processed.thumbnail, { access: 'private', addRandomSuffix: false, contentType: 'image/webp' }),
    ]);
    uploaded.push(display.pathname, thumbnail.pathname);
    const held = textDecision.level !== 'SAFE' || imageDecision.level !== 'SAFE';
    const sql = await getReadyDb();
    await sql.query(`INSERT INTO posts (id,user_id,title,description,tags,skills,category,image_url,display_url,thumbnail_url,image_type,image_size,display_size,thumbnail_size,image_width,image_height,status,moderation_category) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`, [
      id, userId, title, description, JSON.stringify(tags), JSON.stringify(skills), category, original.pathname, display.pathname, thumbnail.pathname, image.type, image.size, processed.display.length, processed.thumbnail.length, processed.width, processed.height, held ? 'PENDING_MODERATION' : 'VISIBLE', textDecision.category ?? imageDecision.category ?? null,
    ]);
    if (held) await sql.query(`INSERT INTO moderation_queue(id,source,target_type,target_id,creator_id,category,severity,provider_ref) VALUES($1,'AUTOMATIC','SKILLSHOT',$2,$3,$4,$5,$6)`, [crypto.randomUUID(), id, userId, textDecision.category ?? imageDecision.category ?? 'REVIEW', 'BORDERLINE', textDecision.providerRef ?? imageDecision.providerRef ?? null]);
    await recordUpload(userId, held ? 'HELD' : 'SUCCESS', sourceBytes);
    return Response.json({ id, status: held ? 'PENDING_MODERATION' : 'VISIBLE' }, { status: 201 });
  } catch (error) {
    if (uploaded.length) await del(uploaded).catch(() => undefined);
    await recordUpload(userId, 'FAILED', sourceBytes, 'STORAGE_UNAVAILABLE');
    console.error('Skillshot upload failed', error);
    return errorResponse('STORAGE_UNAVAILABLE', 503);
  }
}
