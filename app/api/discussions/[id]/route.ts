import { getReadyDb } from '../../../../lib/db';
import { requirePrincipal } from '../../../../lib/authz';
import { isStaffRole, normalizeRole } from '../../../../lib/roles';
import { moderateText } from '../../../../lib/moderation';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requirePrincipal();
  const viewerId = 'principal' in auth && auth.principal ? auth.principal.id : null;

  const sql = await getReadyDb();
  const rows = await sql.query(`
    SELECT d.id, d.user_id, d.title, d.summary, d.content, d.category,
      d.image_url, d.image_type, d.is_gif, d.is_announcement, d.is_pinned, d.is_locked,
      d.reaction_count, d.reply_count, d.created_at, d.updated_at,
      u.display_name, u.username, u.role, u.avatar_url, u.creator_rank,
      EXISTS(SELECT 1 FROM discussion_reactions dr WHERE dr.discussion_id = d.id AND dr.user_id = $2) AS viewer_reacted,
      EXISTS(SELECT 1 FROM saved_discussions sd WHERE sd.discussion_id = d.id AND sd.user_id = $2) AS viewer_saved
    FROM discussions d
    JOIN users u ON u.id = d.user_id
    WHERE d.id = $1 AND d.status = 'VISIBLE'
    LIMIT 1
  `, [id, viewerId ?? '']);

  if (!rows.length) return Response.json({ error: 'Discussion not found' }, { status: 404 });
  const r = rows[0];

  const replies = await sql.query(`
    SELECT dr.id, dr.body, dr.created_at, dr.user_id,
      u.display_name, u.username, u.role, u.avatar_url, u.creator_rank
    FROM discussion_replies dr
    JOIN users u ON u.id = dr.user_id
    WHERE dr.discussion_id = $1 AND dr.status = 'VISIBLE'
    ORDER BY dr.created_at ASC
  `, [id]);

  return Response.json({
    discussion: {
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
      replies: replies.map(rep => ({
        id: String(rep.id),
        body: String(rep.body),
        createdAt: new Date(rep.created_at as string).getTime(),
        author: {
          displayName: String(rep.display_name),
          username: String(rep.username),
          role: normalizeRole(rep.role),
          avatarUrl: rep.avatar_url ? `/api/avatars/${encodeURIComponent(String(rep.username))}?v=${encodeURIComponent(String(rep.avatar_url))}` : '',
          creatorRank: String(rep.creator_rank || 'NEWCOMER'),
        },
        isOwner: viewerId === rep.user_id,
      })),
    },
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requirePrincipal();
  if ('error' in auth) return auth.error;
  const user = auth.principal;

  const sql = await getReadyDb();
  const existing = await sql.query(`SELECT user_id, is_announcement FROM discussions WHERE id = $1 LIMIT 1`, [id]);
  if (!existing.length) return Response.json({ error: 'Discussion not found' }, { status: 404 });

  const isOwner = existing[0].user_id === user.id;
  const isStaff = isStaffRole(user.role);

  if (!isOwner && !isStaff) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    // Content edits (only owner or staff for announcements)
    if (typeof body.title === 'string') {
      const trimmed = body.title.trim().slice(0, 150);
      if (!trimmed) return Response.json({ error: 'Title cannot be empty' }, { status: 400 });
      updates.push(`title = $${idx++}`);
      values.push(trimmed);
    }
    if (typeof body.content === 'string') {
      const trimmed = body.content.trim().slice(0, 10000);
      if (!trimmed) return Response.json({ error: 'Content cannot be empty' }, { status: 400 });
      const mod = await moderateText(trimmed);
      if (mod.level !== 'SAFE') return Response.json({ error: 'Content violated guidelines' }, { status: 422 });
      updates.push(`content = $${idx++}`);
      values.push(trimmed);
    }
    if (typeof body.summary === 'string') {
      updates.push(`summary = $${idx++}`);
      values.push(body.summary.trim().slice(0, 300));
    }

    // Staff-only controls: pin, lock, hide
    if (isStaff) {
      if (typeof body.isPinned === 'boolean') {
        updates.push(`is_pinned = $${idx++}`);
        values.push(body.isPinned);
      }
      if (typeof body.isLocked === 'boolean') {
        updates.push(`is_locked = $${idx++}`);
        values.push(body.isLocked);
      }
      if (typeof body.status === 'string' && ['VISIBLE', 'HIDDEN'].includes(body.status)) {
        updates.push(`status = $${idx++}`);
        values.push(body.status);
      }
    }

    if (!updates.length) return Response.json({ error: 'No updates provided' }, { status: 400 });

    updates.push(`updated_at = now()`);
    values.push(id);

    const updated = await sql.query(`UPDATE discussions SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`, values);
    const row = updated[0];

    return Response.json({
      discussion: {
        id: String(row.id),
        title: String(row.title),
        isPinned: Boolean(row.is_pinned),
        isLocked: Boolean(row.is_locked),
        status: String(row.status),
      },
    });
  } catch {
    return Response.json({ error: 'Failed to update discussion' }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requirePrincipal();
  if ('error' in auth) return auth.error;
  const user = auth.principal;

  const sql = await getReadyDb();
  const existing = await sql.query(`SELECT user_id, is_announcement FROM discussions WHERE id = $1 LIMIT 1`, [id]);
  if (!existing.length) return Response.json({ error: 'Discussion not found' }, { status: 404 });

  const isOwner = existing[0].user_id === user.id;
  const isStaff = isStaffRole(user.role);

  if (!isOwner && !isStaff) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Normal users cannot delete official announcements
  if (existing[0].is_announcement && !isStaff) {
    return Response.json({ error: 'Only staff can delete official announcements' }, { status: 403 });
  }

  await sql.query(`DELETE FROM discussions WHERE id = $1`, [id]);
  return Response.json({ success: true });
}
