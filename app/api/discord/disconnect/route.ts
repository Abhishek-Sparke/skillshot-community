import { NextResponse } from 'next/server';
import { requirePrincipal } from '../../../../lib/authz';
import { disconnectDiscordAccount } from '../../../../lib/discord-service';

export const dynamic = 'force-dynamic';

export async function POST() {
  const auth = await requirePrincipal();
  if ('error' in auth) {
    return auth.error;
  }

  const result = await disconnectDiscordAccount(auth.principal.id, true);
  return NextResponse.json(result);
}
