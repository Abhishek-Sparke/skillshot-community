import { NextResponse } from 'next/server';
import { getReadyDb } from '../../../../lib/db';
import { calculateLevelProgress, calculateRankProgress, rankFromXp, CREATOR_RANKS, type CreatorRankId } from '../../../../lib/creator-rank';
import { syncMemberCreatorRank, createDiscordVerificationSession, callDiscordApi } from '../../../../lib/discord-service';
import { DISCORD_CLIENT_ID, DISCORD_EMBED_COLOR } from '../../../../lib/discord-config';

export const dynamic = 'force-dynamic';

async function verifyDiscordSignature(
  rawBody: string,
  signature: string | null,
  timestamp: string | null,
  publicKeyHex: string | null
): Promise<boolean> {
  if (!publicKeyHex || !signature || !timestamp) {
    return false;
  }

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

  if (publicKey) {
    const isValid = await verifyDiscordSignature(rawBody, signature, timestamp, publicKey);
    if (!isValid) {
      return new NextResponse('Invalid interaction signature', { status: 401 });
    }
  } else {
    console.warn('DISCORD_PUBLIC_KEY is not configured on the server; skipping signature verification.');
  }

  type DiscordIncomingInteraction = {
    type?: number;
    token?: string;
    data?: {
      name?: string;
      custom_id?: string;
      options?: Array<{ name: string; value: unknown }>;
    };
    member?: {
      user?: {
        id?: string;
        username?: string;
        global_name?: string | null;
      };
    };
    user?: {
      id?: string;
      username?: string;
      global_name?: string | null;
    };
  };

  let interaction: DiscordIncomingInteraction;
  try {
    interaction = JSON.parse(rawBody) as DiscordIncomingInteraction;
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

    // /verify and /link command: Provide link to connect and verify Skillshot account
    if (commandName === 'verify' || commandName === 'link') {
      return NextResponse.json({
        type: 4,
        data: {
          content:
            '🏆 **Skillshot Rank Verification**\n\n' +
            'Connect your Skillshot account to Discord to verify your Creator Rank and receive your matching Discord role.\n\n' +
            '🔗 https://skillshot-community.vercel.app/api/discord/authorize',
          flags: 64, // Ephemeral
          components: [
            {
              type: 1,
              components: [
                {
                  type: 2,
                  style: 5,
                  label: '🔗 Verify Skillshot',
                  url: 'https://skillshot-community.vercel.app/api/discord/authorize',
                },
              ],
            },
          ],
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
              'Your Discord account is not connected to Skillshot. Connect and verify here:\n' +
              'https://skillshot-community.vercel.app/api/discord/authorize',
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

    // /showcase command: Return standout or random visible Skillshot embed
    if (commandName === 'showcase') {
      const sql = await getReadyDb();
      const rows = await sql.query(`
        SELECT p.id, p.title, p.description, p.category, u.username, u.display_name,
          (SELECT COUNT(*) FROM reactions r WHERE r.post_id = p.id) AS reaction_count
        FROM posts p
        JOIN users u ON u.id = p.user_id
        WHERE p.status = 'VISIBLE' AND u.status = 'ACTIVE'
        ORDER BY random()
        LIMIT 1
      `);

      if (!rows.length) {
        return NextResponse.json({
          type: 4,
          data: { content: 'No Skillshots available to showcase at this time.', flags: 64 },
        });
      }

      const shot = rows[0];
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://skillshot-community.vercel.app';
      const shotUrl = `${appUrl}/shots/${shot.id}`;

      return NextResponse.json({
        type: 4,
        data: {
          embeds: [
            {
              author: {
                name: `🏆 Skillshot Community Showcase • by @${shot.username}`,
                url: `${appUrl}/users/${encodeURIComponent(String(shot.username))}`,
              },
              title: String(shot.title),
              url: shotUrl,
              description: String(shot.description || 'Check out this showcase on Skillshot!'),
              color: DISCORD_EMBED_COLOR,
              image: {
                url: `${appUrl}/api/images/${shot.id}`,
              },
              footer: {
                text: `${shot.category} • ${shot.reaction_count} Likes • Skillshot Community`,
              },
            },
          ],
          components: [
            {
              type: 1,
              components: [
                {
                  type: 2,
                  style: 5,
                  label: '👀 View on Skillshot',
                  url: shotUrl,
                },
              ],
            },
          ],
        },
      });
    }

    // /creator command: Look up creator by username
    if (commandName === 'creator') {
      const usernameOption = interaction.data?.options?.find(o => o.name === 'username')?.value;
      const targetUsername = String(usernameOption || '').trim().toLowerCase();
      if (!targetUsername) {
        return NextResponse.json({
          type: 4,
          data: { content: 'Please provide a Skillshot username.', flags: 64 },
        });
      }

      const sql = await getReadyDb();
      const rows = await sql.query(`
        SELECT u.id, u.username, u.display_name, u.creator_rank, u.creator_xp, u.bio,
          (SELECT COUNT(*) FROM posts p WHERE p.user_id = u.id AND p.status = 'VISIBLE') AS post_count,
          (SELECT COUNT(*) FROM reactions r JOIN posts p ON p.id = r.post_id WHERE p.user_id = u.id) AS likes_received
        FROM users u
        WHERE lower(u.username) = lower($1) AND u.status = 'ACTIVE'
        LIMIT 1
      `, [targetUsername]);

      if (!rows.length) {
        return NextResponse.json({
          type: 4,
          data: { content: `Creator @${targetUsername} not found on Skillshot.`, flags: 64 },
        });
      }

      const creator = rows[0];
      const rank = CREATOR_RANKS[(creator.creator_rank as CreatorRankId) || 'NEWCOMER'];
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://skillshot-community.vercel.app';
      const profileUrl = `${appUrl}/users/${encodeURIComponent(String(creator.username))}`;

      return NextResponse.json({
        type: 4,
        data: {
          embeds: [
            {
              title: `${creator.display_name} (@${creator.username})`,
              url: profileUrl,
              description: String(creator.bio || 'Creator on Skillshot Community.'),
              color: DISCORD_EMBED_COLOR,
              fields: [
                { name: 'Rank', value: `${rank?.symbol || '🌱'} **${rank?.label || 'Newcomer'}**`, inline: true },
                { name: 'Creator XP', value: `✨ **${creator.creator_xp} XP**`, inline: true },
                { name: 'Works & Likes', value: `🎨 **${creator.post_count}** shots • ♥ **${creator.likes_received}** likes`, inline: true },
              ],
              footer: { text: 'Skillshot Community Creator Profile' },
            },
          ],
          components: [
            {
              type: 1,
              components: [
                {
                  type: 2,
                  style: 5,
                  label: 'View Profile',
                  url: profileUrl,
                },
              ],
            },
          ],
        },
      });
    }

    return NextResponse.json({
      type: 4,
      data: { content: 'Unknown command.', flags: 64 },
    });
  }

  // 3. Interaction Type 3: MESSAGE_COMPONENT (Buttons, etc.)
  if (interaction.type === 3) {
    const customId = String(interaction.data?.custom_id || '');
    const callerId = String(interaction.member?.user?.id || interaction.user?.id || '');

    if (customId === 'skillshot_rank_verify') {
      if (!callerId) {
        return NextResponse.json({
          type: 4,
          data: { content: '❌ Unable to identify your Discord user ID. Please try again.', flags: 64 },
        });
      }

      const sql = await getReadyDb();
      const existing = await sql.query(
        `SELECT u.username, u.display_name, u.creator_xp, u.creator_rank
         FROM discord_connections dc
         JOIN users u ON u.id = dc.skillshot_user_id
         WHERE dc.discord_user_id = $1
         LIMIT 1`,
        [callerId]
      );

      // Existing verified user
      if (existing.length) {
        const user = existing[0];
        const xp = Number(user.creator_xp || 0);
        const rank = rankFromXp(xp);
        await syncMemberCreatorRank(callerId, rank.id);

        if (interaction.token) {
          setTimeout(() => {
            callDiscordApi(`/webhooks/${DISCORD_CLIENT_ID}/${interaction.token}/messages/@original`, { method: 'DELETE' }).catch(() => {});
          }, 10000);
        }

        return NextResponse.json({
          type: 4,
          data: {
            content:
              '✅ **Discord Verified**\n\n' +
              'Your Skillshot account has been successfully verified.\n\n' +
              `**Creator Rank:**\n${rank.label}\n\n` +
              `**Discord Role:**\n${rank.label}\n\n` +
              'Your role has been assigned successfully.\n' +
              'Your Discord role will automatically update when your Skillshot rank changes.',
            flags: 64, // Ephemeral: visible ONLY to the user who clicked the button
          },
        });
      }

      // New / Unconnected user: preserve original Discord user ID in server-side verification session
      const vt = await createDiscordVerificationSession(callerId, interaction.token);
      const verifyUrl = `https://skillshot-community.vercel.app/api/discord/authorize?vt=${encodeURIComponent(vt)}`;

      return NextResponse.json({
        type: 4,
        data: {
          content:
            '🏆 **Skillshot Rank Verification**\n\n' +
            'Connect your Skillshot account to Discord to verify your Creator Rank and automatically receive your matching Discord role.\n\n' +
            '1. Click **"Verify Skillshot"** below\n' +
            '2. Sign in or sign up on Skillshot\n' +
            '3. Confirm your Discord account\n' +
            '4. Your Creator Rank will be verified and role assigned instantly!',
          flags: 64, // Ephemeral
          components: [
            {
              type: 1,
              components: [
                {
                  type: 2,
                  style: 5, // Link button
                  label: '🔗 Verify Skillshot',
                  url: verifyUrl,
                },
              ],
            },
          ],
        },
      });
    }

    if (customId === 'skillshot_how_it_works') {
      return NextResponse.json({
        type: 4,
        data: {
          content:
            'ℹ️ **How Skillshot Creator Ranks Work**\n\n' +
            'Skillshot has 7 Creator Ranks based entirely on XP earned on the platform:\n' +
            '• **Newcomer** (0 - 499 XP)\n' +
            '• **Creator** (500 - 1,499 XP)\n' +
            '• **Rising Creator** (1,500 - 3,499 XP)\n' +
            '• **Skilled Creator** (3,500 - 6,999 XP)\n' +
            '• **Elite Creator** (7,000 - 11,999 XP)\n' +
            '• **Master Creator** (12,000 - 19,999 XP)\n' +
            '• **Legend** (20,000+ XP)\n\n' +
            'Earn XP by sharing Skillshots, getting likes, meaningful comments, and completing achievements.\n' +
            'Your Discord role syncs automatically whenever you rank up!',
          flags: 64, // Ephemeral
        },
      });
    }

    return NextResponse.json({
      type: 4,
      data: { content: 'Unknown component action.', flags: 64 },
    });
  }

  return NextResponse.json({ error: 'Unsupported interaction type' }, { status: 400 });
}
