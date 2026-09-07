import { requirePrincipal } from '../../../lib/authz';
import { getReadyDb } from '../../../lib/db';
import { findOrCreateDirectConversation, updateLastSeen, canUserMessage } from '../../../lib/chat';

export async function GET() {
  const auth = await requirePrincipal();
  if ('error' in auth) return auth.error;
  const currentUserId = auth.principal.id;

  await updateLastSeen(currentUserId);
  const sql = await getReadyDb();

  const rows = await sql.query(
    `SELECT 
      c.id,
      c.created_at,
      c.updated_at,
      ru.id as recipient_id,
      ru.username as recipient_username,
      ru.display_name as recipient_display_name,
      ru.avatar_url as recipient_avatar_url,
      ru.role as recipient_role,
      ru.creator_rank as recipient_creator_rank,
      ru.status as recipient_status,
      ru.last_seen_at as recipient_last_seen_at,
      (SELECT json_build_object(
        'id', lm.id,
        'content', lm.content,
        'sender_id', lm.sender_id,
        'message_type', lm.message_type,
        'status', lm.status,
        'created_at', lm.created_at
       )
       FROM messages lm 
       WHERE lm.conversation_id = c.id 
       ORDER BY lm.created_at DESC 
       LIMIT 1
      ) as last_message,
      (SELECT COUNT(*)::int
       FROM messages um
       WHERE um.conversation_id = c.id
         AND um.sender_id <> $1
         AND um.status = 'VISIBLE'
         AND um.created_at > cp.last_read_at
      ) as unread_count,
      EXISTS(
        SELECT 1 FROM user_blocks 
        WHERE blocker_id = $1 AND blocked_id = ru.id
      ) as is_blocked_by_you,
      EXISTS(
        SELECT 1 FROM user_blocks 
        WHERE blocker_id = ru.id AND blocked_id = $1
      ) as is_blocked_by_them
    FROM conversations c
    JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = $1
    JOIN conversation_participants rcp ON rcp.conversation_id = c.id AND rcp.user_id <> $1
    JOIN users ru ON ru.id = rcp.user_id
    ORDER BY COALESCE((
      SELECT lm.created_at FROM messages lm WHERE lm.conversation_id = c.id ORDER BY lm.created_at DESC LIMIT 1
    ), c.created_at) DESC`,
    [currentUserId]
  );

  return Response.json({
    conversations: rows.map(r => ({
      id: r.id,
      recipient: {
        id: r.recipient_id,
        username: r.recipient_username,
        displayName: r.recipient_display_name,
        avatarUrl: r.recipient_avatar_url,
        role: r.recipient_role,
        creatorRank: r.recipient_creator_rank || 'NEWCOMER',
        status: r.recipient_status,
        lastSeenAt: r.recipient_last_seen_at,
        isBlockedByYou: Boolean(r.is_blocked_by_you),
        isBlockedByThem: Boolean(r.is_blocked_by_them),
      },
      lastMessage: r.last_message,
      unreadCount: Number(r.unread_count || 0),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requirePrincipal();
  if ('error' in auth) return auth.error;
  const currentUserId = auth.principal.id;

  let body: { recipientId?: string; username?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const sql = await getReadyDb();
  let recipientRows;

  if (body.recipientId) {
    recipientRows = await sql.query(`SELECT id, username, display_name, status FROM users WHERE id = $1 LIMIT 1`, [body.recipientId]);
  } else if (body.username) {
    recipientRows = await sql.query(`SELECT id, username, display_name, status FROM users WHERE username = $1 LIMIT 1`, [body.username.toLowerCase().trim()]);
  } else {
    return Response.json({ error: 'recipientId or username is required' }, { status: 400 });
  }

  if (!recipientRows.length) {
    return Response.json({ error: 'User not found' }, { status: 404 });
  }

  const recipient = recipientRows[0];
  const check = await canUserMessage(currentUserId, recipient.id);
  if (!check.allowed) {
    return Response.json({ error: check.reason || 'Cannot start conversation with this user' }, { status: 403 });
  }

  const result = await findOrCreateDirectConversation(currentUserId, recipient.id);
  return Response.json({
    conversationId: result.id,
    isNew: result.isNew,
  });
}
