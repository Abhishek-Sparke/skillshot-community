import { requirePrincipal } from '../../../../lib/authz';
import { getUnreadChatCount, updateLastSeen } from '../../../../lib/chat';

export async function GET() {
  const auth = await requirePrincipal();
  if ('error' in auth) return auth.error;
  
  await updateLastSeen(auth.principal.id);
  const unread = await getUnreadChatCount(auth.principal.id);
  return Response.json({ unread });
}
