import { getReadyDb } from '../../../lib/db';
import { requirePrincipal } from '../../../lib/authz';
import { isStaffRole, normalizeRole } from '../../../lib/roles';
import { moderateText, moderateImage } from '../../../lib/moderation';
import { moderationFrames } from '../../../lib/image-processing';
import { put } from '@vercel/blob';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const category = url.searchParams.get('category');
  const sort = url.searchParams.get('sort') || 'latest';
  const query = url.searchParams.get('q')?.trim().toLowerCase() || '';
  const pinnedOnly = url.searchParams.get('pinned') === '1';

  const auth = await requirePrincipal();
  const viewerId = 'principal' in auth && auth.principal ? auth.principal.id : null;

  const sql = await getReadyDb();
  let whereClause = `WHERE d.status = 'VISIBLE'`;
  const params: unknown[] = [];
  let paramIdx = 1;

  if (pinnedOnly) {
    whereClause += ` AND d.is_pinned = true`;
  }

  if (category && category !== 'All') {
    whereClause += ` AND lower(d.category) = lower($${paramIdx++})`;
    params.push(category);
  }

  if (query) {
    whereClause += ` AND (lower(d.title) LIKE $${paramIdx} OR lower(d.content) LIKE $${paramIdx} OR lower(d.summary) LIKE $${paramIdx++})`;
    params.push(`%${query}%`);
  }

  let orderBy = `ORDER BY d.is_pinned DESC, d.created_at DESC`;
  if (sort === 'trending') {
    orderBy = `ORDER BY (d.reaction_count * 3 + d.reply_count * 5) DESC, d.created_at DESC`;
  } else if (sort === 'most_discussed') {
    orderBy = `ORDER BY d.reply_count DESC, d.created_at DESC`;
  }

  const rows = await sql.query(`
    SELECT d.id, d.user_id, d.title, d.summary, d.content, d.category,
      d.image_url, d.image_type, d.is_gif, d.is_announcement, d.is_pinned, d.is_locked,
      d.reaction_count, d.reply_count, d.created_at, d.updated_at,
      u.display_name, u.username, u.role, u.avatar_url,
      u.creator_rank,
      EXISTS(SELECT 1 FROM discussion_reactions dr WHERE dr.discussion_id = d.id AND dr.user_id = $${paramIdx}) AS viewer_reacted,
      EXISTS(SELECT 1 FROM saved_discussions sd WHERE sd.discussion_id = d.id AND sd.user_id = $${paramIdx}) AS viewer_saved
    FROM discussions d
    JOIN users u ON u.id = d.user_id
    ${whereClause}
    ${orderBy}
    LIMIT 50
  `, [...params, viewerId ?? '']);

  return Response.json({
    discussions: rows.map(r => ({
      id: String(r.id),
      userId: String(r.user_id),
      title: String(r.title),
      summary: String(r.summary || ''),
      content: String(r.content),
      category: String(r.category || 'General'),
      imageUrl: r.image_url ? String(r.image_url) : null,
      imageType: r.image_type ? String(r.image_type) : null,
      isGif: Boolean(r.is_gif),
      isAnnouncement: Boolean(r.is_announcement),
      isPinned: Boolean(r.is_pinned),
      isLocked: Boolean(r.is_locked),
      reactionCount: Number(r.reaction_count || 0),
      replyCount: Number(r.reply_count || 0),
      createdAt: new Date(r.created_at as string).getTime(),
      updatedAt: new Date(r.updated_at as string).getTime(),
      author: {
        displayName: String(r.display_name),
        username: String(r.username),
        role: normalizeRole(r.role),
        avatarUrl: r.avatar_url ? `/api/avatars/${encodeURIComponent(String(r.username))}?v=${encodeURIComponent(String(r.avatar_url))}` : '',
        creatorRank: String(r.creator_rank || 'NEWCOMER'),
      },
      viewerReacted: Boolean(r.viewer_reacted),
      viewerSaved: Boolean(r.viewer_saved),
      isOwner: viewerId === r.user_id,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requirePrincipal();
  if ('error' in auth) return auth.error;
  const user = auth.principal;

  try {
    const contentType = request.headers.get('content-type') || '';
    let title = '';
    let summary = '';
    let content = '';
    let category = 'General';
    let isAnnouncement = false;
    let isPinned = false;
    let imageUrl: string | null = null;
    let imageType: string | null = null;
    let isGif = false;

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      title = String(form.get('title') || '').trim();
      summary = String(form.get('summary') || '').trim();
      content = String(form.get('content') || '').trim();
      category = String(form.get('category') || 'General').trim();
      isAnnouncement = form.get('isAnnouncement') === '1';
      isPinned = form.get('isPinned') === '1';

      const file = form.get('image');
      if (file instanceof File && file.size > 0) {
        if (file.size > 8 * 1024 * 1024) {
          return Response.json({ error: 'Image cannot exceed 8 MB' }, { status: 400 });
        }
        isGif = file.type === 'image/gif';
        const buffer = Buffer.from(await file.arrayBuffer());

        // Moderation
        let safe = false;
        if (isGif) {
          const frames = await moderationFrames(buffer, file.type);
          const checks = await Promise.all(frames.map(f => moderateImage(f)));
          safe = checks.every(c => c.level === 'SAFE');
        } else {
          const preview = await moderateImage(`data:${file.type};base64,${buffer.toString('base64')}`);
          safe = preview.level === 'SAFE';
        }
        if (!safe) {
          return Response.json({ error: 'Image failed safety moderation' }, { status: 422 });
        }

        const ext = isGif ? 'gif' : 'webp';
        const mime = isGif ? 'image/gif' : 'image/webp';
        const blob = await put(`discussions/${user.id}/${crypto.randomUUID()}.${ext}`, buffer, {
          access: 'private',
          addRandomSuffix: false,
          contentType: mime,
        });
        imageUrl = blob.pathname;
        imageType = mime;
      }
    } else {
      const body = await request.json();
      title = String(body.title || '').trim();
      summary = String(body.summary || '').trim();
      content = String(body.content || '').trim();
      category = String(body.category || 'General').trim();
      isAnnouncement = Boolean(body.isAnnouncement);
      isPinned = Boolean(body.isPinned);
    }

    if (!title || !content) {
      return Response.json({ error: 'Title and content are required' }, { status: 400 });
    }

    // Role verification for official announcements
    if (isAnnouncement) {
      if (!isStaffRole(user.role)) {
        return Response.json({ error: 'Only staff can create official announcements' }, { status: 403 });
      }
    }

    // Only staff can pin posts
    if (isPinned && !isStaffRole(user.role)) {
      isPinned = false;
    }

    // Text moderation check
    const textCheck = await moderateText(`${title}\n${summary}\n${content}`);
    if (textCheck.level !== 'SAFE') {
      return Response.json({ error: 'Content violated community guidelines' }, { status: 422 });
    }

    const sql = await getReadyDb();
    const inserted = await sql.query(`
      INSERT INTO discussions (
        id, user_id, title, summary, content, category,
        image_url, image_type, is_gif, is_announcement, is_pinned, is_locked
      ) VALUES (
        gen_random_uuid()::text, $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, false
      )
      RETURNING *
    `, [
      user.id,
      title.slice(0, 150),
      summary.slice(0, 300),
      content.slice(0, 10000),
      category.slice(0, 50),
      imageUrl,
      imageType,
      isGif,
      isAnnouncement,
      isPinned,
    ]);

    const row = inserted[0];
    return Response.json({
      discussion: {
        id: String(row.id),
        title: String(row.title),
        summary: String(row.summary),
        content: String(row.content),
        category: String(row.category),
        isAnnouncement: Boolean(row.is_announcement),
        isPinned: Boolean(row.is_pinned),
        createdAt: new Date(row.created_at as string).getTime(),
      },
    }, { status: 201 });
  } catch (err) {
    return Response.json({ error: 'Failed to create discussion' }, { status: 500 });
  }
}
