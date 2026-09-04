import { requirePrincipal } from '../../../../lib/authz';
import { getReadyDb } from '../../../../lib/db';
import { isConversationParticipant, updateLastSeen } from '../../../../lib/chat';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePrincipal();
  if ('error' in auth) return auth.error;
  const currentUserId = auth.principal.id;
  const { id: conversationId } = await params;

  if (!await isConversationParticipant(conversationId, currentUserId)) {
    return Response.json({ error: 'Conversation not found' }, { status: 404 });
  }

  await updateLastSeen(currentUserId);
  const sql = await getReadyDb();

  // Recipient details & block status
  const recipientRows = await sql.query(
    `SELECT 
      u.id,
      u.username,
      u.display_name,
      u.avatar_url,
      u.role,
      u.status,
      u.last_seen_at,
      EXISTS(
        SELECT 1 FROM user_blocks 
        WHERE blocker_id = $1 AND blocked_id = u.id
      ) as is_blocked_by_you,
      EXISTS(
        SELECT 1 FROM user_blocks 
        WHERE blocker_id = u.id AND blocked_id = $1
      ) as is_blocked_by_them
    FROM conversation_participants cp
    JOIN users u ON u.id = cp.user_id
    WHERE cp.conversation_id = $2 AND cp.user_id <> $1
    LIMIT 1`,
    [currentUserId, conversationId]
  );

  if (!recipientRows.length) {
    return Response.json({ error: 'Participant not found' }, { status: 404 });
  }

  const r = recipientRows[0];

  // Fetch pinned messages
  const pinnedRows = await sql.query(
    `SELECT 
      m.id,
      m.content,
      m.sender_id,
      m.message_type,
      m.status,
      m.created_at,
      u.display_name as sender_name,
      u.username as sender_username
     FROM pinned_messages pm
     JOIN messages m ON m.id = pm.message_id
     JOIN users u ON u.id = m.sender_id
     WHERE pm.conversation_id = $1 AND m.status = 'VISIBLE'
     ORDER BY pm.created_at DESC`,
    [conversationId]
  );

  return Response.json({
    conversationId,
    recipient: {
      id: r.id,
      username: r.username,
      displayName: r.display_name,
      avatarUrl: r.avatar_url,
      role: r.role,
      status: r.status,
      lastSeenAt: r.last_seen_at,
      isBlockedByYou: Boolean(r.is_blocked_by_you),
      isBlockedByThem: Boolean(r.is_blocked_by_them),
    },
    pinnedMessages: pinnedRows.map(p => ({
      id: p.id,
      content: p.content,
      senderId: p.sender_id,
      messageType: p.message_type,
      createdAt: p.created_at,
      senderName: p.sender_name,
      senderUsername: p.sender_username,
    })),
  });
}
