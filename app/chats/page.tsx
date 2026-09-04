import { Suspense } from 'react';
import { requirePrincipal } from '../../lib/authz';
import ChatClient from './chat-client';

export default async function ChatsPage() {
  const auth = await requirePrincipal();
  if ('error' in auth) return null;

  return (
    <Suspense fallback={<div style={{ padding: '24px', textAlign: 'center' }}>Loading chats…</div>}>
      <ChatClient currentUserId={auth.principal.id} />
    </Suspense>
  );
}
