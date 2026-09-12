import { NextResponse } from 'next/server';
import { requirePrincipal } from '../../../../lib/authz';
import { getReadyDb } from '../../../../lib/db';
import { rankFromXp } from '../../../../lib/creator-rank';
import { DISCORD_CREATOR_RANK_ROLES } from '../../../../lib/discord-config';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requirePrincipal();
  if ('error' in auth) {
    return auth.error;
  }
  const principal = auth.principal;

  const sql = await getReadyDb();
  const connRows = await sql.query(
    `SELECT discord_user_id, discord_username_snapshot, connected_at, last_sync_at, sync_status, last_error
     FROM discord_connections
     WHERE skillshot_user_id = $1
     LIMIT 1`,
    [principal.id]
  );

  const xp = Number(principal.profile.creator_xp || 0);
  const currentRank = rankFromXp(xp);
  const targetRoleId = DISCORD_CREATOR_RANK_ROLES[currentRank.id];

  if (!connRows.length) {
    return NextResponse.json({
      connected: false,
      creatorRank: {
        id: currentRank.id,
        label: currentRank.label,
        symbol: currentRank.symbol,
      },
      targetRoleId,
    });
  }

  const conn = connRows[0];
  return NextResponse.json({
    connected: true,
    discordUserId: String(conn.discord_user_id),
    discordUsername: String(conn.discord_username_snapshot || 'Discord User'),
    connectedAt: conn.connected_at,
    lastSyncAt: conn.last_sync_at,
    syncStatus: conn.sync_status,
    lastError: conn.last_error,
    creatorRank: {
      id: currentRank.id,
      label: currentRank.label,
      symbol: currentRank.symbol,
    },
    targetRoleId,
  });
}
