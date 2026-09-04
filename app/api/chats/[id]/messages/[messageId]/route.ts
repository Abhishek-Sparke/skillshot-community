import { requirePrincipal } from '../../../../../../lib/authz';
import { getReadyDb } from '../../../../../../lib/db';
import { isConversationParticipant } from '../../../../../../lib/chat';

export async function DELETE(
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
  const rows = await sql.query(
    `SELECT sender_id, status FROM messages WHERE id = $1 AND conversation_id = $2 LIMIT 1`,
    [messageId, conversationId]
  );

  if (!rows.length) {
    return Response.json({ error: 'Message not found' }, { status: 404 });
  }

  if (rows[0].sender_id !== currentUserId) {
    return Response.json({ error: 'You can only delete your own messages' }, { status: 403 });
  }

  await sql.transaction([
    sql.query(
      `UPDATE messages SET status = 'DELETED', content = '', updated_at = now() WHERE id = $1`,
      [messageId]
    ),
    sql.query(`DELETE FROM message_attachments WHERE message_id = $1`, [messageId]),
  ]);

  return Response.json({ ok: true, deleted: true });
}
