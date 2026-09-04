import { requirePrincipal } from '../../../../../lib/authz';
import { getReadyDb } from '../../../../../lib/db';
import { isConversationParticipant } from '../../../../../lib/chat';

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
  await sql.transaction([
    sql.query(
      `UPDATE conversation_participants SET last_read_at = now() WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, currentUserId]
    ),
    sql.query(
      `UPDATE notifications SET read_at = now() WHERE event_key = $1 AND read_at IS NULL`,
      [`chat:${conversationId}:${currentUserId}`]
    ),
  ]);

  return Response.json({ ok: true });
}
