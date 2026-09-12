import { NextResponse } from 'next/server';
import { requirePrincipal } from '../../../../lib/authz';
import { getReadyDb } from '../../../../lib/db';
import { rankFromXp } from '../../../../lib/creator-rank';
import { syncMemberCreatorRank } from '../../../../lib/discord-service';

export const dynamic = 'force-dynamic';

export async function POST() {
  const auth = await requirePrincipal();
  if ('error' in auth) {
    return auth.error;
  }
  const principal = auth.principal;

  const sql = await getReadyDb();
  const connRows = await sql.query(
    `SELECT discord_user_id, discord_username_snapshot FROM discord_connections WHERE skillshot_user_id = $1 LIMIT 1`,
    [principal.id]
  );

  if (!connRows.length) {
    return NextResponse.json(
      { success: false, status: 'NOT_LINKED', message: 'No Discord account is connected to your profile.' },
      { status: 400 }
    );
  }

  const discordUserId = String(connRows[0].discord_user_id);
  const xp = Number(principal.profile.creator_xp || 0);
  const currentRank = rankFromXp(xp);

  const result = await syncMemberCreatorRank(discordUserId, currentRank.id, principal.id);
  return NextResponse.json(result);
}
