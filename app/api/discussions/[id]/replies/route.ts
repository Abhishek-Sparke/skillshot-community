import { getReadyDb } from '../../../../../lib/db';
import { requirePrincipal } from '../../../../../lib/authz';
import { normalizeRole, isStaffRole } from '../../../../../lib/roles';
import { moderateText } from '../../../../../lib/moderation';
import { awardXp, XP_REWARDS, isMeaningfulComment } from '../../../../../lib/xp';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sql = await getReadyDb();
  const auth = await requirePrincipal();
  const viewerId = 'principal' in auth && auth.principal ? auth.principal.id : null;

  const rows = await sql.query(`
    SELECT dr.id, dr.body, dr.created_at, dr.user_id,
      u.display_name, u.username, u.role, u.avatar_url, u.creator_rank
    FROM discussion_replies dr
    JOIN users u ON u.id = dr.user_id
    WHERE dr.discussion_id = $1 AND dr.status = 'VISIBLE'
    ORDER BY dr.created_at ASC
  `, [id]);

  return Response.json({
    replies: rows.map((rep: Record<string, unknown>) => ({
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
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requirePrincipal();
  if ('error' in auth) return auth.error;
  const user = auth.principal;

  try {
    const body = await request.json();
    const replyBody = String(body.body || '').trim().slice(0, 2000);

    if (!replyBody) {
      return Response.json({ error: 'Reply text cannot be empty' }, { status: 400 });
    }

    const mod = await moderateText(replyBody);
    if (mod.level !== 'SAFE') {
      return Response.json({ error: 'Reply violates community guidelines' }, { status: 422 });
    }

    const sql = await getReadyDb();
    const disc = await sql.query(`SELECT id, user_id, title, is_locked, status FROM discussions WHERE id = $1 LIMIT 1`, [id]);
    if (!disc.length || disc[0].status !== 'VISIBLE') {
      return Response.json({ error: 'Discussion not found' }, { status: 404 });
    }

    if (disc[0].is_locked) {
      return Response.json({ error: 'This discussion is locked' }, { status: 403 });
    }

    const res = await sql.query(`
      INSERT INTO discussion_replies (discussion_id, user_id, body)
      VALUES ($1, $2, $3)
      RETURNING id, created_at
    `, [id, user.id, replyBody]);

    const replyId = res[0].id;
    const createdAt = res[0].created_at;

    await sql.query(`
      UPDATE discussions
      SET reply_count = reply_count + 1, updated_at = now()
      WHERE id = $1
    `, [id]);
    if(isMeaningfulComment(replyBody))await awardXp({userId:user.id,amount:XP_REWARDS.DISCUSSION_REPLY,eventType:'DISCUSSION_REPLY',reason:'Meaningful discussion reply',actionId:`discussion-reply:${replyId}`,relatedType:'DISCUSSION',relatedId:id});

    const actorName = String(user.profile.display_name || user.profile.username || 'Someone');
    const discAuthorId = String(disc[0].user_id);

    // 1. Notify discussion author if not replying to own discussion
    if (discAuthorId !== user.id) {
      await sql.query(
        `INSERT INTO notifications (id, user_id, actor_id, category, type, title, body, event_key, target_url, target_id)
         VALUES ($1, $2, $3, 'discussion', 'DISCUSSION_REPLY', $4, $5, $6, $7, $8)
         ON CONFLICT (event_key) WHERE event_key IS NOT NULL DO NOTHING`,
        [
          crypto.randomUUID(),
          discAuthorId,
          user.id,
          `${actorName} replied to your discussion`,
          replyBody.slice(0, 160),
          `disc-reply:${replyId}:${discAuthorId}`,
          `/discussion/${id}#reply-${replyId}`,
          id,
        ]
      ).catch(() => undefined);
    }

    // 2. Notify users mentioned in reply (@username)
    const mentions = Array.from(replyBody.matchAll(/(?:^|\s)@([a-z0-9][a-z0-9_-]{1,29})\b/gi), m => m[1].toLowerCase());
    const uniqueMentions = [...new Set(mentions)].slice(0, 10);
    if (uniqueMentions.length > 0) {
      await sql.query(
        `INSERT INTO notifications (id, user_id, actor_id, category, type, title, body, event_key, target_url, target_id)
         SELECT gen_random_uuid()::text, u.id, $1, 'discussion', 'DISCUSSION_MENTION', $2, $3, 'disc-mention:' || $4 || ':' || u.id, $5, $6
         FROM users u
         WHERE lower(u.username) = ANY($7::text[]) AND u.status = 'ACTIVE' AND u.id <> $1 AND u.id <> $8
         ON CONFLICT (event_key) WHERE event_key IS NOT NULL DO NOTHING`,
        [
          user.id,
          `${actorName} mentioned you in a discussion`,
          replyBody.slice(0, 160),
          replyId,
          `/discussion/${id}#reply-${replyId}`,
          id,
          uniqueMentions,
          discAuthorId,
        ]
      ).catch(() => undefined);
    }

    return Response.json({
      reply: {
        id: String(replyId),
        body: replyBody,
        createdAt: new Date(createdAt as string).getTime(),
        author: {
          displayName: String(user.profile.display_name || user.profile.username || 'Creator'),
          username: String(user.profile.username || ''),
          role: normalizeRole(user.role),
          avatarUrl: user.profile.avatar_url ? `/api/avatars/${encodeURIComponent(String(user.profile.username))}?v=${encodeURIComponent(String(user.profile.avatar_url))}` : '',
          creatorRank: String(user.profile.creator_rank || 'NEWCOMER'),
        },
        isOwner: true,
      },
    }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to post reply';
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requirePrincipal();
  if ('error' in auth) return auth.error;
  const user = auth.principal;

  try {
    const url = new URL(request.url);
    const replyId = url.searchParams.get('replyId');
    if (!replyId) {
      return Response.json({ error: 'Missing replyId' }, { status: 400 });
    }

    const sql = await getReadyDb();
    const existing = await sql.query(`SELECT id, user_id FROM discussion_replies WHERE id = $1 AND discussion_id = $2 LIMIT 1`, [replyId, id]);
    if (!existing.length) {
      return Response.json({ error: 'Reply not found' }, { status: 404 });
    }

    const isOwner = existing[0].user_id === user.id;
    const isStaff = isStaffRole(user.role);
    if (!isOwner && !isStaff) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    await sql.query(`DELETE FROM discussion_replies WHERE id = $1 AND discussion_id = $2`, [replyId, id]);
    await sql.query(`UPDATE discussions SET reply_count = GREATEST(0, reply_count - 1), updated_at = now() WHERE id = $1`, [id]);

    return Response.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete reply';
    return Response.json({ error: msg }, { status: 500 });
  }
}

