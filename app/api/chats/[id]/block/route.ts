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
  const recipientRows = await sql.query(
    `SELECT user_id FROM conversation_participants WHERE conversation_id = $1 AND user_id <> $2 LIMIT 1`,
    [conversationId, currentUserId]
  );

  if (!recipientRows.length) {
    return Response.json({ error: 'Recipient not found' }, { status: 404 });
  }

  const recipientId = recipientRows[0].user_id as string;

  const existing = await sql.query(
    `SELECT 1 FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2 LIMIT 1`,
    [currentUserId, recipientId]
  );

  let isBlocked = false;
  if (existing.length) {
    await sql.query(
      `DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2`,
      [currentUserId, recipientId]
    );
  } else {
    await sql.query(
      `INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [currentUserId, recipientId]
    );
    isBlocked = true;
  }

  return Response.json({ isBlocked, recipientId });
}
