import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('chat schema creates relational tables, integrity constraints and indexes', async () => {
  const schema = await read('lib/chat-schema.ts');
  assert.match(schema, /CREATE TABLE IF NOT EXISTS conversations/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS conversation_participants/);
  assert.match(schema, /PRIMARY KEY \(conversation_id, user_id\)/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS messages/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS message_attachments/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS message_reactions/);
  assert.match(schema, /UNIQUE\(message_id, user_id, emoji\)/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS pinned_messages/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS user_blocks/);
  assert.match(schema, /PRIMARY KEY \(blocker_id, blocked_id\)/);
  assert.match(schema, /CREATE INDEX IF NOT EXISTS idx_conv_part_user/);
  assert.match(schema, /CREATE INDEX IF NOT EXISTS idx_messages_conv_created/);
});

test('db initialization incorporates CHAT_MIGRATION', async () => {
  const db = await read('lib/db.ts');
  assert.match(db, /import { CHAT_MIGRATION } from '\.\/chat-schema'/);
  assert.match(db, /await sql\.transaction\(CHAT_MIGRATION\.map\(statement=>sql\.query\(statement\)\)\)/);
});

test('authenticated navigation includes /chats with unread badge support', async () => {
  const nav = await read('lib/public-navigation.ts');
  assert.match(nav, /href:\s*'\/chats',\s*label:\s*'Chats'/);

  const unreadRoute = await read('app/api/chats/unread/route.ts');
  assert.match(unreadRoute, /getUnreadChatCount/);
});

test('server endpoints enforce conversation participant authorization', async () => {
  const convRoute = await read('app/api/chats/[id]/route.ts');
  assert.match(convRoute, /isConversationParticipant\(conversationId,\s*currentUserId\)/);

  const msgRoute = await read('app/api/chats/[id]/messages/route.ts');
  assert.match(msgRoute, /isConversationParticipant\(conversationId,\s*currentUserId\)/);
  assert.match(msgRoute, /(canUserMessage|isBlockBetween)\(currentUserId,\s*recipientId\)/);

  const deleteRoute = await read('app/api/chats/[id]/messages/[messageId]/route.ts');
  assert.match(deleteRoute, /rows\[0\]\.sender_id !== currentUserId/);
  assert.match(deleteRoute, /You can only delete your own messages/);
});

test('safety moderation pipeline is enforced on chat text and attachments', async () => {
  const msgRoute = await read('app/api/chats/[id]/messages/route.ts');
  assert.match(msgRoute, /moderateText\(content\)/);
  assert.match(msgRoute, /moderateImage\(att\.url\)/);
  assert.match(msgRoute, /This message can't be sent on Skillshot\./);
  assert.match(msgRoute, /This media can't be sent on Skillshot\./);
});
