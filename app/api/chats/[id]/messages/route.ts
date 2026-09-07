import { requirePrincipal } from '../../../../../lib/authz';
import { getReadyDb } from '../../../../../lib/db';
import { isConversationParticipant, updateLastSeen, isBlockBetween, canUserMessage } from '../../../../../lib/chat';
import { moderateText, moderateImage } from '../../../../../lib/moderation';

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

  const { searchParams } = new URL(request.url);
  const before = searchParams.get('before');
  const limit = Math.min(Math.max(Number(searchParams.get('limit') || 40), 1), 100);

  const sql = await getReadyDb();

  let query: string;
  let queryParams: unknown[];

  if (before) {
    query = `
      SELECT 
        m.id,
        m.conversation_id,
        m.sender_id,
        m.message_type,
        m.content,
        m.reply_to_id,
        m.status,
        m.created_at,
        u.display_name as sender_name,
        u.username as sender_username,
        u.avatar_url as sender_avatar_url,
        (
          SELECT json_build_object(
            'id', rm.id,
            'content', rm.content,
            'sender_id', rm.sender_id,
            'sender_name', ru.display_name,
            'sender_username', ru.username
          )
          FROM messages rm
          JOIN users ru ON ru.id = rm.sender_id
          WHERE rm.id = m.reply_to_id
        ) as reply_preview,
        (
          SELECT json_agg(
            json_build_object(
              'id', a.id,
              'attachment_type', a.attachment_type,
              'url', a.url,
              'metadata', a.metadata
            )
          )
          FROM message_attachments a
          WHERE a.message_id = m.id
        ) as attachments,
        (
          SELECT json_agg(
            json_build_object(
              'emoji', mr.emoji,
              'count', mr.cnt,
              'reacted_by_me', mr.by_me
            )
          )
          FROM (
            SELECT 
              emoji, 
              COUNT(*)::int as cnt,
              BOOL_OR(user_id = $1) as by_me
            FROM message_reactions
            WHERE message_id = m.id
            GROUP BY emoji
          ) mr
        ) as reactions,
        EXISTS(
          SELECT 1 FROM pinned_messages pm WHERE pm.conversation_id = m.conversation_id AND pm.message_id = m.id
        ) as is_pinned
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.conversation_id = $2
        AND m.created_at < $3
      ORDER BY m.created_at DESC
      LIMIT $4
    `;
    queryParams = [currentUserId, conversationId, before, limit];
  } else {
    query = `
      SELECT 
        m.id,
        m.conversation_id,
        m.sender_id,
        m.message_type,
        m.content,
        m.reply_to_id,
        m.status,
        m.created_at,
        u.display_name as sender_name,
        u.username as sender_username,
        u.avatar_url as sender_avatar_url,
        (
          SELECT json_build_object(
            'id', rm.id,
            'content', rm.content,
            'sender_id', rm.sender_id,
            'sender_name', ru.display_name,
            'sender_username', ru.username
          )
          FROM messages rm
          JOIN users ru ON ru.id = rm.sender_id
          WHERE rm.id = m.reply_to_id
        ) as reply_preview,
        (
          SELECT json_agg(
            json_build_object(
              'id', a.id,
              'attachment_type', a.attachment_type,
              'url', a.url,
              'metadata', a.metadata
            )
          )
          FROM message_attachments a
          WHERE a.message_id = m.id
        ) as attachments,
        (
          SELECT json_agg(
            json_build_object(
              'emoji', mr.emoji,
              'count', mr.cnt,
              'reacted_by_me', mr.by_me
            )
          )
          FROM (
            SELECT 
              emoji, 
              COUNT(*)::int as cnt,
              BOOL_OR(user_id = $1) as by_me
            FROM message_reactions
            WHERE message_id = m.id
            GROUP BY emoji
          ) mr
        ) as reactions,
        EXISTS(
          SELECT 1 FROM pinned_messages pm WHERE pm.conversation_id = m.conversation_id AND pm.message_id = m.id
        ) as is_pinned
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.conversation_id = $2
      ORDER BY m.created_at DESC
      LIMIT $3
    `;
    queryParams = [currentUserId, conversationId, limit];
  }

  const rows = await sql.query(query, queryParams);
  // Return in chronological order for easy appending
  const messages = rows.reverse().map(r => ({
    id: r.id,
    conversationId: r.conversation_id,
    senderId: r.sender_id,
    senderName: r.sender_name,
    senderUsername: r.sender_username,
    senderAvatarUrl: r.sender_avatar_url,
    messageType: r.message_type,
    content: r.status === 'DELETED' ? '' : r.content,
    replyToId: r.reply_to_id,
    replyPreview: r.reply_preview,
    status: r.status,
    createdAt: r.created_at,
    attachments: r.status === 'DELETED' ? [] : (r.attachments || []),
    reactions: r.reactions || [],
    isPinned: Boolean(r.is_pinned),
  }));

  return Response.json({ messages });
}

export async function POST(
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

  const sql = await getReadyDb();

  // Find recipient ID
  const recipientRows = await sql.query(
    `SELECT user_id FROM conversation_participants WHERE conversation_id = $1 AND user_id <> $2 LIMIT 1`,
    [conversationId, currentUserId]
  );
  if (!recipientRows.length) {
    return Response.json({ error: 'Recipient not found' }, { status: 404 });
  }
  const recipientId = recipientRows[0].user_id as string;

  // Check messaging permissions (blocks, account status, whoCanMessage privacy settings)
  const canSend = await canUserMessage(currentUserId, recipientId);
  if (!canSend.allowed) {
    return Response.json({ error: canSend.reason || 'Cannot send message to this user' }, { status: 403 });
  }

  let body: {
    content?: string;
    messageType?: string;
    replyToId?: string;
    attachments?: { attachmentType: string; url: string; metadata?: Record<string, unknown> }[];
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const content = (body.content || '').trim();
  const messageType = body.messageType || (body.attachments?.length ? body.attachments[0].attachmentType : 'TEXT');
  const replyToId = body.replyToId || null;
  const attachments = Array.isArray(body.attachments) ? body.attachments : [];

  if (!content && !attachments.length) {
    return Response.json({ error: 'Message cannot be empty' }, { status: 400 });
  }

  // Safety moderation check on text
  if (content) {
    const textDecision = await moderateText(content);
    if (textDecision.level === 'HIGH') {
      return Response.json({ error: "This message can't be sent on Skillshot." }, { status: 422 });
    }
  }

  // Safety moderation check on images/GIFs
  for (const att of attachments) {
    if (att.url) {
      const imgDecision = await moderateImage(att.url);
      if (imgDecision.level === 'HIGH') {
        return Response.json({ error: "This media can't be sent on Skillshot." }, { status: 422 });
      }
    }
  }

  // Insert message
  const msgRows = await sql.query(
    `INSERT INTO messages (conversation_id, sender_id, message_type, content, reply_to_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, created_at, updated_at`,
    [conversationId, currentUserId, messageType, content, replyToId]
  );
  const msg = msgRows[0];

  // Insert attachments if any
  for (const att of attachments) {
    await sql.query(
      `INSERT INTO message_attachments (message_id, attachment_type, url, metadata)
       VALUES ($1, $2, $3, $4)`,
      [msg.id, att.attachmentType || 'IMAGE', att.url, JSON.stringify(att.metadata || {})]
    );
  }

  // Update conversation updated_at and sender's last_read_at
  await sql.query(`UPDATE conversations SET updated_at = now() WHERE id = $1`, [conversationId]);
  await sql.query(
    `UPDATE conversation_participants SET last_read_at = now() WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, currentUserId]
  );

  // Grouped in-app notification for recipient
  const senderUsername = String(auth.principal.profile.username || '');
  const senderDisplayName = String(auth.principal.profile.display_name || (senderUsername ? `@${senderUsername}` : 'Creator'));
  const notificationBody = content ? (content.length > 80 ? content.slice(0, 77) + '…' : content) : 'Sent you an attachment';
  const eventKey = `chat:${conversationId}:${recipientId}`;

  try {
    await sql.query(
      `INSERT INTO notifications (id, user_id, type, title, body, event_key, target_url, created_at, read_at)
       VALUES (gen_random_uuid()::text, $1, 'SYSTEM', $2, $3, $4, $5, now(), NULL)
       ON CONFLICT (event_key) WHERE event_key IS NOT NULL DO UPDATE
       SET body = EXCLUDED.body, read_at = NULL, created_at = now()`,
      [
        recipientId,
        `${senderDisplayName} sent you a message`,
        notificationBody,
        eventKey,
        `/chats?id=${conversationId}`,
      ]
    );
  } catch (notifErr) {
    console.error('Failed to create in-app notification for chat message:', notifErr);
  }

  return Response.json({
    id: msg.id,
    conversationId,
    senderId: currentUserId,
    senderName: senderDisplayName,
    senderUsername,
    senderAvatarUrl: auth.principal.profile.avatar_url ? String(auth.principal.profile.avatar_url) : undefined,
    messageType,
    content,
    replyToId,
    status: 'VISIBLE',
    createdAt: msg.created_at,
    attachments,
    reactions: [],
    isPinned: false,
  });
}
