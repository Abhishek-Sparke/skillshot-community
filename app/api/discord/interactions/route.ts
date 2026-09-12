import { NextResponse } from 'next/server';
import { getReadyDb } from '../../../../lib/db';
import { calculateLevelProgress, calculateRankProgress, rankFromXp } from '../../../../lib/creator-rank';
import { syncMemberCreatorRank } from '../../../../lib/discord-service';

export const dynamic = 'force-dynamic';

async function verifyDiscordSignature(
  rawBody: string,
  signature: string | null,
  timestamp: string | null,
  publicKeyHex: string | null
): Promise<boolean> {
  if (!publicKeyHex) {
    // If public key is not yet set in environment, allow through with warning in non-production
    return process.env.NODE_ENV !== 'production';
  }
  if (!signature || !timestamp) return false;

  try {
    const pubKeyBytes = new Uint8Array(
      publicKeyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
    );
    const sigBytes = new Uint8Array(
      signature.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
    );
    const msgBytes = new TextEncoder().encode(timestamp + rawBody);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      pubKeyBytes,
      { name: 'Ed25519' },
      false,
      ['verify']
    );

    return await crypto.subtle.verify('Ed25519', cryptoKey, sigBytes, msgBytes);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('X-Signature-Ed25519');
  const timestamp = request.headers.get('X-Signature-Timestamp');
  const publicKey = process.env.DISCORD_PUBLIC_KEY?.trim() || null;

  const isValid = await verifyDiscordSignature(rawBody, signature, timestamp, publicKey);
  if (!isValid) {
    return new NextResponse('Invalid interaction signature', { status: 401 });
  }

  let interaction: any;
  try {
    interaction = JSON.parse(rawBody);
  } catch {
    return new NextResponse('Invalid JSON body', { status: 400 });
  }

  // 1. Interaction Type 1: PING -> Respond with PONG (Type 1)
  if (interaction.type === 1) {
    return NextResponse.json({ type: 1 });
  }

  // 2. Interaction Type 2: APPLICATION_COMMAND
  if (interaction.type === 2) {
    const commandName = String(interaction.data?.name || '').toLowerCase();
    const callerId = String(interaction.member?.user?.id || interaction.user?.id || '');

    // /rank command: Show user's current Creator Rank, Level, XP, and profile link
    if (commandName === 'rank') {
      if (!callerId) {
        return NextResponse.json({
          type: 4,
          data: { content: 'Unable to identify your Discord user ID.', flags: 64 },
        });
      }

      const sql = await getReadyDb();
      const rows = await sql.query(
        `SELECT u.username, u.display_name, u.creator_xp, u.creator_rank
         FROM discord_connections dc
         JOIN users u ON u.id = dc.skillshot_user_id
         WHERE dc.discord_user_id = $1
         LIMIT 1`,
        [callerId]
      );

      if (!rows.length) {
        return NextResponse.json({
          type: 4,
          data: {
            content:
              '✦ **Your Discord account is not connected to Skillshot yet.**\n' +
              'Connect your account to sync your Creator Rank role and view rank details:\n' +
              'https://skillshot-community.vercel.app/settings/connections',
            flags: 64, // Ephemeral
          },
        });
      }

      const user = rows[0];
      const xp = Number(user.creator_xp || 0);
      const lp = calculateLevelProgress(xp);
      const rp = calculateRankProgress(xp);

      const responseText = [
        `${rp.rank.symbol} **${rp.rank.label}**`,
        `Level ${lp.level}`,
        rp.nextTierXp ? `${xp.toLocaleString()} / ${rp.nextTierXp.toLocaleString()} XP` : `${xp.toLocaleString()} XP (MAX)`,
        '',
        'Next:',
        rp.nextRankTitle ? rp.nextRankTitle : 'MAX',
        '',
        `Profile: https://skillshot-community.vercel.app/users/${encodeURIComponent(String(user.username))}`,
      ].join('\n');

      return NextResponse.json({
        type: 4,
        data: {
          content: responseText,
        },
      });
    }

    // /link command: Provide link to connect Discord account
    if (commandName === 'link') {
      return NextResponse.json({
        type: 4,
        data: {
          content:
            '🔗 **Connect your Discord account to Skillshot:**\n' +
            'https://skillshot-community.vercel.app/settings/connections\n\n' +
            'Connecting your account automatically assigns your Skillshot Creator Rank role in this server.',
          flags: 64,
        },
      });
    }

    // /sync command: Trigger server-side synchronization
    if (commandName === 'sync') {
      if (!callerId) {
        return NextResponse.json({
          type: 4,
          data: { content: 'Unable to identify your Discord user ID.', flags: 64 },
        });
      }

      const sql = await getReadyDb();
      const rows = await sql.query(
        `SELECT u.id, u.creator_xp
         FROM discord_connections dc
         JOIN users u ON u.id = dc.skillshot_user_id
         WHERE dc.discord_user_id = $1
         LIMIT 1`,
        [callerId]
      );

      if (!rows.length) {
        return NextResponse.json({
          type: 4,
          data: {
            content:
              'Your Discord account is not connected to Skillshot. Connect here:\n' +
              'https://skillshot-community.vercel.app/settings/connections',
            flags: 64,
          },
        });
      }

      const xp = Number(rows[0].creator_xp || 0);
      const rank = rankFromXp(xp);
      const res = await syncMemberCreatorRank(callerId, rank.id);

      return NextResponse.json({
        type: 4,
        data: {
          content: res.success
            ? `✓ **Synchronized!** Your Discord role has been updated to **${rank.label}**.`
            : `⚠️ ${res.message || 'Synchronization could not be completed.'}`,
          flags: 64,
        },
      });
    }

    return NextResponse.json({
      type: 4,
      data: { content: 'Unknown command.', flags: 64 },
    });
  }

  return NextResponse.json({ error: 'Unsupported interaction type' }, { status: 400 });
}
