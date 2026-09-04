import { requirePrincipal } from '../../../../../../../lib/authz';
import { getReadyDb } from '../../../../../../../lib/db';
import { isConversationParticipant } from '../../../../../../../lib/chat';
import { rateLimit } from '../../../../../../../lib/rate-limit';

const VALID_CATEGORIES = new Set(['SPAM', 'HARASSMENT', 'HATE', 'VIOLENCE', 'NSFW', 'SCAM', 'OTHER']);

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

  if (!await rateLimit(`report:${currentUserId}`, 10, 3600)) {
    return Response.json({ error: 'Too many reports submitted. Please wait.' }, { status: 429 });
  }

  let body: { category?: string; details?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const category = (body.category || 'OTHER').toUpperCase().trim();
  if (!VALID_CATEGORIES.has(category)) {
    return Response.json({ error: 'Invalid report category' }, { status: 400 });
  }

  const sql = await getReadyDb();
  const msgRows = await sql.query(
    `SELECT m.id, m.sender_id, m.content, u.username, u.display_name 
     FROM messages m 
     JOIN users u ON u.id = m.sender_id
     WHERE m.id = $1 AND m.conversation_id = $2 LIMIT 1`,
    [messageId, conversationId]
  );

  if (!msgRows.length) {
    return Response.json({ error: 'Message not found' }, { status: 404 });
  }

  const msg = msgRows[0];
  if (msg.sender_id === currentUserId) {
    return Response.json({ error: 'You cannot report your own message' }, { status: 400 });
  }

  const reportId = crypto.randomUUID();
  const queueId = crypto.randomUUID();
  const notifId = crypto.randomUUID();
  const details = `[Chat message from @${msg.username}]: ${msg.content || ''}\n${body.details || ''}`.slice(0, 500);

  try {
    await sql.transaction([
      sql.query(
        `INSERT INTO reports (id, reporter_id, target_type, target_id, category, details)
         VALUES ($1, $2, 'COMMENT', $3, $4, $5)`,
        [reportId, currentUserId, messageId, category, details]
      ),
      sql.query(
        `INSERT INTO moderation_queue (id, source, target_type, target_id, creator_id, category, severity)
         VALUES ($1, 'REPORT', 'COMMENT', $2, $3, $4, 'BORDERLINE')`,
        [queueId, messageId, msg.sender_id, category]
      ),
      sql.query(
        `INSERT INTO notifications (id, audience, type, title, body)
         VALUES ($1, 'STAFF', 'NEW_REPORT', 'Reported chat message awaiting review', $2)`,
        [notifId, `Chat message: ${category}`]
      ),
    ]);

    return Response.json({ ok: true, reportId }, { status: 201 });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === '23505') {
      return Response.json({ error: 'You already reported this message' }, { status: 409 });
    }
    return Response.json({ error: 'Could not record report. Please try again.' }, { status: 500 });
  }
}
