import { getReadyDb } from './db';

export async function isConversationParticipant(conversationId: string, userId: string): Promise<boolean> {
  const sql = await getReadyDb();
  const rows = await sql.query(
    `SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2 LIMIT 1`,
    [conversationId, userId]
  );
  return rows.length > 0;
}

export async function isUserBlocked(blockerId: string, blockedId: string): Promise<boolean> {
  const sql = await getReadyDb();
  const rows = await sql.query(
    `SELECT 1 FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2 LIMIT 1`,
    [blockerId, blockedId]
  );
  return rows.length > 0;
}

export async function isBlockBetween(userAId: string, userBId: string): Promise<{ isBlockedByYou: boolean; isBlockedByThem: boolean }> {
  const sql = await getReadyDb();
  const rows = await sql.query(
    `SELECT 
       EXISTS(SELECT 1 FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2) as blocked_by_you,
       EXISTS(SELECT 1 FROM user_blocks WHERE blocker_id = $2 AND blocked_id = $1) as blocked_by_them`,
    [userAId, userBId]
  );
  return {
    isBlockedByYou: Boolean(rows[0]?.blocked_by_you),
    isBlockedByThem: Boolean(rows[0]?.blocked_by_them),
  };
}

export async function getUnreadChatCount(userId: string): Promise<number> {
  const sql = await getReadyDb();
  const rows = await sql.query(
    `SELECT COUNT(*)::int as count
     FROM messages m
     JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id AND cp.user_id = $1
     WHERE m.sender_id <> $1
       AND m.status = 'VISIBLE'
       AND m.created_at > cp.last_read_at`,
    [userId]
  );
  return Number(rows[0]?.count || 0);
}

export async function updateLastSeen(userId: string): Promise<void> {
  const sql = await getReadyDb();
  await sql.query(`UPDATE users SET last_seen_at = now() WHERE id = $1`, [userId]);
}

export async function findOrCreateDirectConversation(userAId: string, userBId: string): Promise<{ id: string; isNew: boolean }> {
  const sql = await getReadyDb();
  
  // Find conversation where both are participants
  const existing = await sql.query(
    `SELECT c.id 
     FROM conversations c
     JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = $1
     JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = $2
     LIMIT 1`,
    [userAId, userBId]
  );

  if (existing.length) {
    return { id: existing[0].id as string, isNew: false };
  }

  // Create new conversation
  const convRows = await sql.query(`INSERT INTO conversations DEFAULT VALUES RETURNING id`);
  const convId = convRows[0].id as string;

  await sql.query(
    `INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3)`,
    [convId, userAId, userBId]
  );

  return { id: convId, isNew: true };
}

export async function canUserMessage(senderId: string, recipientId: string): Promise<{ allowed: boolean; reason?: string }> {
  if (senderId === recipientId) return { allowed: false, reason: 'You cannot message yourself.' };
  const sql = await getReadyDb();
  
  const userRows = await sql.query(`SELECT id, status, preferences FROM users WHERE id IN ($1, $2)`, [senderId, recipientId]);
  const sender = userRows.find(u => u.id === senderId);
  const recipient = userRows.find(u => u.id === recipientId);
  if (!sender || (sender.status && sender.status !== 'ACTIVE')) return { allowed: false, reason: 'Your account is not active.' };
  if (!recipient || (recipient.status && recipient.status !== 'ACTIVE')) return { allowed: false, reason: 'User account is not active.' };
  
  const blocks = await isBlockBetween(senderId, recipientId);
  if (blocks.isBlockedByYou) return { allowed: false, reason: 'You have blocked this user.' };
  if (blocks.isBlockedByThem) return { allowed: false, reason: 'You cannot message this user.' };
  
  const prefs = recipient.preferences as { whoCanMessage?: string } | undefined;
  const policy = prefs?.whoCanMessage || 'EVERYONE';
  if (policy === 'EVERYONE') return { allowed: true };
  if (policy === 'NOBODY') return { allowed: false, reason: 'This user does not accept direct messages.' };
  
  if (policy === 'FOLLOWING') {
    const follows = await sql.query(`SELECT 1 FROM follows WHERE follower_id = $1 AND followed_id = $2 LIMIT 1`, [recipientId, senderId]);
    if (!follows.length) return { allowed: false, reason: 'This user only allows messages from people they follow.' };
    return { allowed: true };
  }
  
  if (policy === 'FOLLOWERS') {
    const follows = await sql.query(`SELECT 1 FROM follows WHERE follower_id = $1 AND followed_id = $2 LIMIT 1`, [senderId, recipientId]);
    if (!follows.length) return { allowed: false, reason: 'This user only allows messages from their followers.' };
    return { allowed: true };
  }
  
  return { allowed: true };
}
