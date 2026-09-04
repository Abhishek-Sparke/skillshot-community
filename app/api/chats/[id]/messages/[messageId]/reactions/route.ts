import { requirePrincipal } from '../../../../../../../lib/authz';
import { getReadyDb } from '../../../../../../../lib/db';
import { isConversationParticipant } from '../../../../../../../lib/chat';

const ALLOWED_EMOJIS = ['❤️', '😂', '👍', '😮', '😢'];

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

  let body: { emoji?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const emoji = (body.emoji || '').trim();
  if (!ALLOWED_EMOJIS.includes(emoji)) {
    return Response.json({ error: 'Invalid emoji reaction' }, { status: 400 });
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

  // Check if reaction exists
  const existing = await sql.query(
    `SELECT id FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3 LIMIT 1`,
    [messageId, currentUserId, emoji]
  );

  let toggledOn = false;
  if (existing.length) {
    await sql.query(`DELETE FROM message_reactions WHERE id = $1`, [existing[0].id]);
  } else {
    await sql.query(
      `INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)`,
      [messageId, currentUserId, emoji]
    );
    toggledOn = true;
  }

  // Fetch updated reactions
  const reactions = await sql.query(
    `SELECT 
       emoji, 
       COUNT(*)::int as count,
       BOOL_OR(user_id = $2) as reacted_by_me
     FROM message_reactions
     WHERE message_id = $1
     GROUP BY emoji`,
    [messageId, currentUserId]
  );

  return Response.json({
    messageId,
    toggledOn,
    reactions: reactions.map(r => ({
      emoji: r.emoji,
      count: Number(r.count),
      reacted_by_me: Boolean(r.reacted_by_me),
    })),
  });
}
