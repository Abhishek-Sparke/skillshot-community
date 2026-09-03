import { del, get, put } from '@vercel/blob';
import { getChatGPTUser } from '../../chatgpt-auth';
import { getReadyDb } from '../../../lib/db';
import { normalizeRole } from '../../../lib/roles';
import { rateLimit } from '../../../lib/rate-limit';
import { moderateImage, moderateText, scanUnavailable } from '../../../lib/moderation';
import { requirePrincipal } from '../../../lib/authz';
import { moderationFrames, processSkillshot, publicUploadMessage, SKILLSHOT_MAX_BYTES, uploadError } from '../../../lib/image-processing';
import { readBoundedImage, stagingType } from '../../../lib/upload-policy';
import { decodeCursor, encodeCursor, pageSize } from '../../../lib/pagination';

const categories = new Set(['Gaming','Development','Design','Photography','Art','Creative','Projects','Other']);

async function recordUpload(userId:string,outcome:string,bytes:number,reason?:string){try{await(await getReadyDb()).query(`INSERT INTO upload_events(id,user_id,kind,outcome,bytes,reason)VALUES($1,$2,'SKILLSHOT',$3,$4,$5)`,[crypto.randomUUID(),userId,outcome,bytes,reason||null])}catch{}}
function errorResponse(code:string,status:number){return Response.json({error:publicUploadMessage(code),code},{status})}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  const url = new URL(request.url);
  const mine = url.searchParams.get('mine') === '1';
  const requestedUsername = url.searchParams.get('username')?.trim().toLowerCase().slice(0, 30) || null;
  const likedByUsername = url.searchParams.get('likedBy')?.trim().toLowerCase().slice(0, 30) || null;
  const sort = url.searchParams.get('sort') === 'trending' ? 'trending' : 'latest';
  const following = url.searchParams.get('following') === '1';
  const category = categories.has(String(url.searchParams.get('category'))) ? String(url.searchParams.get('category')) : null;
  const limit = pageSize(url.searchParams.get('limit'));
  const cursor = decodeCursor(url.searchParams.get('cursor'));
  if (mine && !user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (following && !user) return Response.json({ error: 'Sign in to see creators you follow.' }, { status: 401 });
  const sql = await getReadyDb();
  const rows = await sql.query(`
    SELECT p.id, p.user_id, p.title, p.description, p.tags, p.skills, p.category, p.created_at,p.image_width,p.image_height,
      u.display_name, u.username, u.email, u.role, u.avatar_url,
      (SELECT COUNT(*) FROM reactions r WHERE r.post_id = p.id) AS reaction_count,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.status='VISIBLE') AS comment_count,
      EXISTS(SELECT 1 FROM reactions mine WHERE mine.post_id=p.id AND mine.user_id=$11) AS viewer_liked,
      ((SELECT COUNT(*) FROM reactions r WHERE r.post_id=p.id)*3 +
       (SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id AND c.status='VISIBLE')*5 +
       GREATEST(0,14-EXTRACT(EPOCH FROM (now()-p.created_at))/86400.0)) AS trend_score
    FROM posts p JOIN users u ON u.id = p.user_id
    WHERE p.status='VISIBLE' AND u.status='ACTIVE' AND ($1::text IS NULL OR p.user_id = $1)
      AND ($2::text IS NULL OR lower(u.username) = $2)
      AND ($3::text IS NULL OR EXISTS(
        SELECT 1 FROM reactions liked
        JOIN users liker ON liker.id=liked.user_id
        WHERE liked.post_id=p.id AND lower(liker.username)=$3
      ))
      AND ($4::boolean=false OR EXISTS(SELECT 1 FROM follows f WHERE f.follower_id=$5 AND f.followed_id=p.user_id))
      AND ($6::text IS NULL OR p.category=$6)
      AND ($7::timestamptz IS NULL OR (p.created_at, p.id) < ($7::timestamptz, $8::text))
      AND ($9::text='latest' OR p.created_at>=now()-interval '45 days')
    ORDER BY CASE WHEN $9='trending' THEN ((SELECT COUNT(*) FROM reactions r WHERE r.post_id=p.id)*3 + (SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id AND c.status='VISIBLE')*5 + GREATEST(0,14-EXTRACT(EPOCH FROM (now()-p.created_at))/86400.0)) END DESC,
      p.created_at DESC,p.id DESC LIMIT $10
  `, [mine ? user!.userId : null, requestedUsername, likedByUsername, following, user?.userId ?? '', category, sort === 'trending' ? null : cursor.date, sort === 'trending' ? '' : cursor.id, sort, limit + 1, user?.userId ?? '']);
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
    imageWidth: Number(row.image_width) || 4, imageHeight: Number(row.image_height) || 3,
    imageUrl: `/api/images/${row.id}?variant=thumbnail`, previewUrl: `/api/images/${row.id}?variant=display`, downloadUrl: `/api/images/${row.id}?download=1`,
    isOwner: user?.userId === row.user_id, viewerLiked: Boolean(row.viewer_liked),
  })), nextCursor: sort === 'latest' && hasMore ? encodeCursor(visibleRows[visibleRows.length - 1]) : null,
    signedIn: Boolean(user) });
}

export const runtime = 'nodejs';
export const maxDuration = 60;

async function discardPaths(paths: string[]) {
  for (const pathname of [...new Set(paths)]) {
    try {
      const referenced = await (await getReadyDb()).query(`SELECT 1 FROM posts WHERE image_url=$1 OR display_url=$1 OR thumbnail_url=$1 UNION SELECT 1 FROM users WHERE avatar_url=$1 LIMIT 1`, [pathname]);
      if (!referenced.length) await del(pathname);
    }
    catch {
      // A failed rollback must remain discoverable rather than silently orphaned.
      await (await getReadyDb()).query(`INSERT INTO storage_cleanup_queue(id,pathname,reason,cleanup_after) VALUES($1,$2,'FAILED_UPLOAD',now()+interval '1 day')`, [crypto.randomUUID(), pathname]).catch(() => undefined);
    }
  }
}

export async function POST(request: Request) {
  const auth = await requirePrincipal();
  if ('error' in auth) return auth.error;
  const userId = auth.principal.id;
  if (!await rateLimit(`post:${userId}`, 8, 3600)) return Response.json({ error: 'You have uploaded several Skillshots recently. Please try again later.', code: 'RATE_LIMITED' }, { status: 429 });

  let sourceBytes = 0;
  let stagingPath = '';
  let committed = false;
  const uploaded: string[] = [];
  const sql = await getReadyDb();
  try {
    let data: FormData;
    let image: File;
    if (request.headers.get('content-type')?.includes('application/json')) {
      const body = await request.json() as Record<string, unknown>;
      const pathname = typeof body.pathname === 'string' ? body.pathname : '';
      if (!stagingType(pathname)) return errorResponse('INVALID_IMAGE', 400);
      const claimed = await sql.query(`UPDATE upload_sessions SET state='PROCESSING' WHERE pathname=$1 AND user_id=$2 AND state='PENDING' AND expires_at>now() RETURNING pathname`, [pathname, userId]);
      if (!claimed.length) {
        const completed = await sql.query(`SELECT s.post_id,p.status FROM upload_sessions s JOIN posts p ON p.id=s.post_id WHERE s.pathname=$1 AND s.user_id=$2 AND s.state='COMPLETE'`, [pathname, userId]);
        return completed.length ? Response.json({ id: completed[0].post_id, status: completed[0].status }) : Response.json({ error: 'This upload expired or is already processing. Please try again.', code: 'UPLOAD_EXPIRED' }, { status: 409 });
      }
      stagingPath = pathname;
      const staged = await get(pathname, { access: 'private' });
      if (!staged || staged.statusCode !== 200) throw new Error('STORAGE_UNAVAILABLE');
      sourceBytes = staged.blob.size;
      if (sourceBytes > SKILLSHOT_MAX_BYTES) throw new Error('FILE_TOO_LARGE');
      if (staged.blob.contentType !== stagingType(pathname)) throw new Error('INVALID_IMAGE');
      const bytes = await readBoundedImage(staged.stream, SKILLSHOT_MAX_BYTES);
      image = new File([new Uint8Array(bytes)], pathname.split('/').pop()!, { type: staged.blob.contentType });
      data = new FormData();
      for (const key of ['title', 'description', 'tags', 'skills', 'category']) data.set(key, typeof body[key] === 'string' ? body[key] as string : '');
    } else {
      // Compatibility for existing clients; the website now stages directly in
      // private Blob storage so 10 MB uploads do not cross the Function body cap.
      if (Number(request.headers.get('content-length')) > SKILLSHOT_MAX_BYTES + 64 * 1024) throw new Error('FILE_TOO_LARGE');
      data = await request.formData();
      const file = data.get('image');
      if (!(file instanceof File)) throw new Error('INVALID_IMAGE');
      image = file;
    }
    sourceBytes = image.size;
    const validation = uploadError(image, SKILLSHOT_MAX_BYTES);
    if (validation) throw new Error(validation);
    const title = String(data.get('title') || '').trim().slice(0, 100);
    if (!title) return Response.json({ error: 'Please add a title.', code: 'TITLE_REQUIRED' }, { status: 400 });
    const description = String(data.get('description') || '').trim().slice(0, 1000);
    const tags = String(data.get('tags') || '').split(',').map(value => value.trim().slice(0, 40)).filter(Boolean).slice(0, 8);
    const skills = String(data.get('skills') || '').split(',').map(value => value.trim().slice(0, 40)).filter(Boolean).slice(0, 8);
    const requestedCategory = String(data.get('category') || 'Other');
    const category = categories.has(requestedCategory) ? requestedCategory : 'Other';
    const sourceBuffer = Buffer.from(await image.arrayBuffer());
    let previews: string[];
    try { previews = await moderationFrames(sourceBuffer, image.type); }
    catch (error) {
      const message = error instanceof Error ? error.message : '';
      throw new Error(message==='GIF_TOO_COMPLEX'?message:message === 'HUGE_DIMENSIONS' || /pixel limit/i.test(message) ? 'HUGE_DIMENSIONS' : 'INVALID_IMAGE');
    }
    const textDecision = await moderateText(`${title}\n${description}\n${skills.join(' ')}\n${tags.join(' ')}`);
    const imageDecisions=[];
    for(let start=0;start<previews.length;start+=4)imageDecisions.push(...await Promise.all(previews.slice(start,start+4).map(preview=>moderateImage(preview))));
    const imageDecision=imageDecisions.find(value=>value.level==='HIGH')||imageDecisions.find(scanUnavailable)||imageDecisions.find(value=>value.level==='BORDERLINE')||imageDecisions[0];
    if (textDecision.level === 'HIGH' || imageDecision.level === 'HIGH') throw new Error('MODERATION_FAILED');
    // Scanner outages are retryable errors, not evidence requiring staff review.
    // Never publish an image that has not actually been scanned.
    if (scanUnavailable(textDecision) || scanUnavailable(imageDecision)) throw new Error('MODERATION_UNAVAILABLE');
    let processed;
    try{processed=await processSkillshot(sourceBuffer,image.type);}catch(error){const message=error instanceof Error?error.message:'';throw new Error(message==='GIF_TOO_COMPLEX'?message:/pixel limit|HUGE_DIMENSIONS/i.test(message)?'HUGE_DIMENSIONS':'INVALID_IMAGE');}
    const id = crypto.randomUUID();
    const extension = image.type === 'image/gif'?'gif':image.type === 'image/png' ? 'png' : image.type === 'image/webp' ? 'webp' : 'jpg';
    const original = await put(`shots/${userId}/${id}/original.${extension}`, sourceBuffer, { access: 'private', addRandomSuffix: false, contentType: image.type });
    uploaded.push(original.pathname);
    const display = await put(`shots/${userId}/${id}/display.webp`, processed.display, { access: 'private', addRandomSuffix: false, contentType: 'image/webp' });
    uploaded.push(display.pathname);
    const thumbnail = await put(`shots/${userId}/${id}/thumbnail.webp`, processed.thumbnail, { access: 'private', addRandomSuffix: false, contentType: 'image/webp' });
    uploaded.push(thumbnail.pathname);
    const held = textDecision.level !== 'SAFE' || imageDecision.level !== 'SAFE';
    const writes = [sql.query(`INSERT INTO posts (id,user_id,title,description,tags,skills,category,image_url,display_url,thumbnail_url,image_type,image_size,display_size,thumbnail_size,image_width,image_height,status,moderation_category) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`, [
      id, userId, title, description, JSON.stringify(tags), JSON.stringify(skills), category, original.pathname, display.pathname, thumbnail.pathname, image.type, image.size, processed.display.length, processed.thumbnail.length, processed.width, processed.height, held ? 'PENDING_MODERATION' : 'VISIBLE', textDecision.category ?? imageDecision.category ?? null,
    ])];
    if (held) writes.push(sql.query(`INSERT INTO moderation_queue(id,source,target_type,target_id,creator_id,category,severity,provider_ref) VALUES($1,'AUTOMATIC','SKILLSHOT',$2,$3,$4,$5,$6)`, [crypto.randomUUID(), id, userId, textDecision.category ?? imageDecision.category ?? 'REVIEW', 'BORDERLINE', textDecision.providerRef ?? imageDecision.providerRef ?? null]));
    if (stagingPath) writes.push(sql.query(`UPDATE upload_sessions SET state='COMPLETE',post_id=$2 WHERE pathname=$1`, [stagingPath, id]));
    await sql.transaction(writes);
    committed = true;
    await recordUpload(userId, held ? 'HELD' : 'SUCCESS', sourceBytes);
    return Response.json({ id, status: held ? 'PENDING_MODERATION' : 'VISIBLE' }, { status: 201 });
  } catch (error) {
    const known = ['FILE_TOO_LARGE', 'UNSUPPORTED_FORMAT', 'INVALID_IMAGE', 'HUGE_DIMENSIONS', 'GIF_TOO_COMPLEX','MODERATION_FAILED', 'MODERATION_UNAVAILABLE'];
    const code = error instanceof Error && known.includes(error.message) ? error.message : 'STORAGE_UNAVAILABLE';
    await recordUpload(userId, code === 'MODERATION_FAILED' ? 'BLOCKED' : 'FAILED', sourceBytes, code);
    return errorResponse(code, ['STORAGE_UNAVAILABLE', 'MODERATION_UNAVAILABLE'].includes(code) ? 503 : code === 'MODERATION_FAILED' ? 422 : 400);
  } finally {
    // Never roll back committed image references if later logging/cleanup fails.
    await discardPaths([...(committed ? [] : uploaded), ...(stagingPath ? [stagingPath] : [])]).catch(() => undefined);
    if (stagingPath && !committed) await sql.query(`UPDATE upload_sessions SET state='FAILED' WHERE pathname=$1 AND state='PROCESSING'`, [stagingPath]).catch(() => undefined);
  }
}
