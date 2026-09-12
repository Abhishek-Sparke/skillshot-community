import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { requirePrincipal } from '../../../../lib/authz';
import { getReadyDb } from '../../../../lib/db';
import { DISCORD_API_BASE, DISCORD_CLIENT_ID } from '../../../../lib/discord-config';
import { syncMemberCreatorRank, sendWelcomeMessageForMember } from '../../../../lib/discord-service';
import { rankFromXp } from '../../../../lib/creator-rank';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');

  const redirectSettings = (query: string) => {
    return NextResponse.redirect(new URL(`/settings/connections?${query}`, url.origin));
  };

  if (errorParam) {
    return redirectSettings(`error=${encodeURIComponent(`Discord authorization failed: ${errorParam}`)}`);
  }

  // 1. Authenticate Skillshot user
  const auth = await requirePrincipal();
  if ('error' in auth) {
    return NextResponse.redirect(new URL(`/signin?callbackUrl=${encodeURIComponent('/settings/connections')}`, url.origin));
  }
  const principal = auth.principal;

  // 2. Validate CSRF state
  const cookieStore = await cookies();
  const savedState = cookieStore.get('discord_oauth_state')?.value;
  cookieStore.delete('discord_oauth_state');

  if (!state || !savedState || state !== savedState) {
    return redirectSettings('error=Invalid+or+expired+OAuth+state.+Please+try+connecting+again.');
  }

  if (!code) {
    return redirectSettings('error=Missing+authorization+code+from+Discord.');
  }

  const clientSecret = process.env.DISCORD_CLIENT_SECRET?.trim();
  if (!clientSecret) {
    return redirectSettings('error=Discord+integration+is+temporarily+unavailable+(missing+client+secret).');
  }

  // 3. Server-side code exchange
  const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  const redirectUri = process.env.DISCORD_REDIRECT_URI || (isLocal
    ? `${url.origin}/api/discord/callback`
    : 'https://skillshot-community.vercel.app/api/discord/callback');

  const tokenParams = new URLSearchParams();
  tokenParams.set('client_id', DISCORD_CLIENT_ID);
  tokenParams.set('client_secret', clientSecret);
  tokenParams.set('grant_type', 'authorization_code');
  tokenParams.set('code', code);
  tokenParams.set('redirect_uri', redirectUri);

  let tokenData: any;
  try {
    const tokenRes = await fetch(`${DISCORD_API_BASE}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString(),
    });

    tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      return redirectSettings(`error=${encodeURIComponent(tokenData.error_description || 'Failed to exchange authorization code.')}`);
    }
  } catch {
    return redirectSettings('error=Network+error+connecting+to+Discord+servers.');
  }

  // 4. Fetch Discord user identity
  let discordUser: { id: string; username: string; global_name?: string | null };
  try {
    const userRes = await fetch(`${DISCORD_API_BASE}/users/@me`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!userRes.ok) {
      return redirectSettings('error=Failed+to+fetch+Discord+user+profile.');
    }
    discordUser = await userRes.json();
  } catch {
    return redirectSettings('error=Network+error+reading+Discord+profile.');
  }

  const discordUserId = String(discordUser.id);
  const discordUsername = String(discordUser.global_name || discordUser.username);

  // 4b. Enforce Discord User ID match if initiated via Discord button
  const boundDiscordUserId = cookieStore.get('discord_bound_user_id')?.value;
  cookieStore.delete('discord_bound_user_id');

  if (boundDiscordUserId && boundDiscordUserId !== discordUserId) {
    return redirectSettings(
      `error=${encodeURIComponent(
        'The Discord account signed into your browser does not match the Discord user who clicked Verify in Discord.'
      )}`
    );
  }

  // 5. Enforce unique mapping:
  // - Prevent one Discord account from being linked to multiple Skillshot accounts
  // - Prevent one Skillshot account from being linked to multiple Discord accounts
  const sql = await getReadyDb();
  const [existingDiscord, existingSkillshot] = await Promise.all([
    sql.query(`SELECT skillshot_user_id FROM discord_connections WHERE discord_user_id = $1 LIMIT 1`, [discordUserId]),
    sql.query(`SELECT discord_user_id FROM discord_connections WHERE skillshot_user_id = $1 LIMIT 1`, [principal.id]),
  ]);

  if (existingDiscord.length && existingDiscord[0].skillshot_user_id !== principal.id) {
    return redirectSettings('error=This+Discord+account+is+already+connected+to+another+Skillshot+account.');
  }

  if (existingSkillshot.length && existingSkillshot[0].discord_user_id !== discordUserId) {
    return redirectSettings('error=Your+Skillshot+account+is+already+connected+to+a+different+Discord+account.+Please+disconnect+it+first+to+switch.');
  }

  const wasAlreadyLinked = existingDiscord.length > 0 && existingSkillshot.length > 0;

  // 6. Persist connection
  await sql.query(
    `INSERT INTO discord_connections (
       id, skillshot_user_id, discord_user_id, discord_username_snapshot,
       connected_at, updated_at, sync_status, last_error
     )
     VALUES ($1, $2, $3, $4, now(), now(), 'PENDING', null)
     ON CONFLICT (skillshot_user_id) DO UPDATE
     SET discord_user_id = $3,
         discord_username_snapshot = $4,
         updated_at = now(),
         sync_status = 'PENDING',
         last_error = null`,
    [crypto.randomUUID(), principal.id, discordUserId, discordUsername]
  );

  // 7. Audit log
  await sql.query(
    `INSERT INTO audit_logs(id, actor_id, action, target_type, target_id, metadata)
     VALUES($1, $2, 'DISCORD_CONNECTED', 'USER', $3, $4::jsonb)`,
    [
      crypto.randomUUID(),
      principal.id,
      principal.id,
      JSON.stringify({
        discordUserId,
        discordUsername,
        reconnection: wasAlreadyLinked,
      }),
    ]
  );

  // 8. Trigger immediate role sync with user's current Creator Rank
  const xp = Number(principal.profile.creator_xp || 0);
  const currentRank = rankFromXp(xp);
  const syncResult = await syncMemberCreatorRank(discordUserId, currentRank.id, principal.id);

  if (!syncResult.inGuild) {
    return redirectSettings(`verified=1&connected=1&warning=not_in_guild${wasAlreadyLinked ? '&already_linked=1' : ''}`);
  }

  // 9. Dispatch welcome message if user has not been welcomed yet
  await sendWelcomeMessageForMember({
    id: discordUserId,
    username: discordUsername,
    isBot: false,
  }).catch(() => null);

  return redirectSettings(`verified=1&connected=1${wasAlreadyLinked ? '&already_linked=1' : ''}`);
}
