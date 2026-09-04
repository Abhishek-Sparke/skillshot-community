import { requirePrincipal } from '../../../../../../../lib/authz';
import { getReadyDb } from '../../../../../../../lib/db';
import { isConversationParticipant } from '../../../../../../../lib/chat';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  const auth = await requirePrincipal();
  if ('error' in auth) return auth.error;
  const currentUserId = auth.principal.id;
  const { id: conversationId, messageId } = await params;

  if (!await isConversationParticipant(conversationId, currentUserId)) {
    return Response.json({ error: 'Conversation not found' }, { status: 404 });
  }

  const sql = await getReadyDb();

  // Verify message exists and is visible
  const msgRows = await sql.query(
    `SELECT id, status FROM messages WHERE id = $1 AND conversation_id = $2 LIMIT 1`,
    [messageId, conversationId]
  );
  if (!msgRows.length || msgRows[0].status === 'DELETED') {
    return Response.json({ error: 'Message not found' }, { status: 404 });
  }

  const existing = await sql.query(
    `SELECT 1 FROM pinned_messages WHERE conversation_id = $1 AND message_id = $2 LIMIT 1`,
    [conversationId, messageId]
  );

  let isPinned = false;
  if (existing.length) {
    await sql.query(
      `DELETE FROM pinned_messages WHERE conversation_id = $1 AND message_id = $2`,
      [conversationId, messageId]
    );
  } else {
    // Check max pinned count (10)
    const countRows = await sql.query(
      `SELECT COUNT(*)::int as cnt FROM pinned_messages WHERE conversation_id = $1`,
      [conversationId]
    );
    if (Number(countRows[0]?.cnt || 0) >= 10) {
      return Response.json({ error: 'Maximum of 10 pinned messages reached' }, { status: 400 });
    }

    await sql.query(
      `INSERT INTO pinned_messages (conversation_id, message_id, pinned_by) VALUES ($1, $2, $3)`,
      [conversationId, messageId, currentUserId]
    );
    isPinned = true;
  }

  return Response.json({ messageId, isPinned });
}
