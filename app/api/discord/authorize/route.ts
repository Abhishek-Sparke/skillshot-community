import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { requirePrincipal } from '../../../../lib/authz';
import { DISCORD_CLIENT_ID } from '../../../../lib/discord-config';
import { getDiscordVerificationSession } from '../../../../lib/discord-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const vt = url.searchParams.get('vt')?.trim();

  const auth = await requirePrincipal();
  if ('error' in auth) {
    const callbackPath = vt ? `/api/discord/authorize?vt=${encodeURIComponent(vt)}` : '/api/discord/authorize';
    return NextResponse.redirect(new URL(`/signin?callbackUrl=${encodeURIComponent(callbackPath)}`, url.origin));
  }

  // Default to the official registered redirect URI; fallback to request origin in local dev
  const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  const redirectUri = process.env.DISCORD_REDIRECT_URI || (isLocal
    ? `${url.origin}/api/discord/callback`
    : 'https://skillshot-community.vercel.app/api/discord/callback');

  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set('discord_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  });

  if (vt) {
    const session = await getDiscordVerificationSession(vt);
    if (session) {
      cookieStore.set('discord_bound_user_id', session.discordUserId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600,
        path: '/',
      });
    }
  }

  const discordAuthUrl = new URL('https://discord.com/api/oauth2/authorize');
  discordAuthUrl.searchParams.set('client_id', DISCORD_CLIENT_ID);
  discordAuthUrl.searchParams.set('redirect_uri', redirectUri);
  discordAuthUrl.searchParams.set('response_type', 'code');
  discordAuthUrl.searchParams.set('scope', 'identify');
  discordAuthUrl.searchParams.set('state', state);
  discordAuthUrl.searchParams.set('prompt', 'consent');

  return NextResponse.redirect(discordAuthUrl.toString());
}
