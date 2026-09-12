/**
 * Skillshot Discord Gateway Bot Worker
 * Maintains a persistent WebSocket connection to the Discord Gateway (v10).
 * Listens for real-time member join events (GUILD_MEMBER_ADD) and dispatches welcome messages.
 *
 * Usage:
 *   DISCORD_BOT_TOKEN="your_token" node scripts/discord-bot.mjs
 *   or configure DISCORD_BOT_TOKEN in .env / environment variables.
 */

const GUILD_ID = process.env.DISCORD_GUILD_ID || '1548208097112236124';
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN?.trim();
const API_BASE = 'https://discord.com/api/v10';
const GATEWAY_URL = 'wss://gateway.discord.gg/?v=10&encoding=json';
const EMBED_COLOR = 0xff5039;

if (!BOT_TOKEN) {
  console.error('[Bot Error] DISCORD_BOT_TOKEN environment variable is required.');
  console.error('Run: set DISCORD_BOT_TOKEN=your_token && node scripts/discord-bot.mjs');
  process.exit(1);
}

let ws = null;
let heartbeatTimer = null;
let sequence = null;
let sessionId = null;
let welcomeChannelId = process.env.DISCORD_WELCOME_CHANNEL_ID || '1548209055569420380';

async function callApi(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  return res.json().catch(() => null);
}

async function findWelcomeChannel() {
  if (welcomeChannelId) return welcomeChannelId;
  const channels = await callApi(`/guilds/${GUILD_ID}/channels`);
  if (!Array.isArray(channels)) return null;
  const exact = channels.find(c => {
    const clean = c.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return clean === 'welcome';
  });
  if (exact) return exact.id;
  const contains = channels.find(c => c.name.toLowerCase().includes('welcome'));
  return contains ? contains.id : null;
}

function buildWelcomePayload(memberId) {
  return {
    content: `👋 Welcome to Skillshot, <@${memberId}>!`,
    embeds: [
      {
        author: {
          name: '🏆 Skillshot Community',
          icon_url: 'https://skillshot-community.vercel.app/icon.png',
        },
        title: '👋 Welcome to the Skillshot Community!',
        description:
          'Welcome to the Skillshot community.\n\n' +
          'Share your work, discover creators, connect with other creators, and grow your skills.\n\n' +
          '**START HERE:**\n\n' +
          '📜 **Read the rules**\n' +
          '🏆 **Verify your Skillshot Rank**\n' +
          '🎨 **Share your work**\n' +
          '💬 **Meet the community**\n\n' +
          'Enjoy your stay! 🚀',
        color: EMBED_COLOR,
        thumbnail: {
          url: 'https://skillshot-community.vercel.app/icon.png',
        },
        footer: {
          text: 'Skillshot Community • Welcome to the Community',
        },
      },
    ],
    components: [
      {
        type: 1, // Action Row
        components: [
          {
            type: 2, // Button
            style: 5, // Link button
            label: '🏆 Verify Rank',
            url: 'https://skillshot-community.vercel.app/api/discord/authorize',
          },
          {
            type: 2, // Button
            style: 5, // Link button
            label: '📜 Read Rules',
            url: 'https://skillshot-community.vercel.app/guidelines',
          },
          {
            type: 2, // Button
            style: 5, // Link button
            label: '🌐 Open Skillshot',
            url: 'https://skillshot-community.vercel.app',
          },
        ],
      },
    ],
  };
}

async function sendWelcome(userId, username) {
  if (!welcomeChannelId) {
    welcomeChannelId = await findWelcomeChannel();
  }
  if (!welcomeChannelId) {
    console.error('[Bot Error] Could not find welcome channel in Guild', GUILD_ID);
    return;
  }

  const payload = buildWelcomePayload(userId);
  const res = await callApi(`/channels/${welcomeChannelId}/messages`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (res && res.id) {
    console.log(`[Bot] ✅ Dispatched welcome message for @${username} (ID: ${userId}) in #${welcomeChannelId} (Message: ${res.id})`);
  } else {
    console.error('[Bot] ❌ Failed to send welcome message:', res);
  }
}

function connect() {
  console.log('[Bot] Connecting to Discord Gateway...');
  ws = new WebSocket(GATEWAY_URL);

  ws.onopen = () => {
    console.log('[Bot] Gateway WebSocket connected.');
  };

  ws.onmessage = async (event) => {
    try {
      const msg = JSON.parse(event.data);
      const { op, d, s, t } = msg;

      if (s) sequence = s;

      // Opcode 10: Hello
      if (op === 10) {
        const interval = d.heartbeat_interval;
        console.log(`[Bot] Received Hello. Heartbeat interval: ${interval}ms`);

        if (heartbeatTimer) clearInterval(heartbeatTimer);
        heartbeatTimer = setInterval(() => {
          ws.send(JSON.stringify({ op: 1, d: sequence }));
        }, interval);

        // Identify: Intents 1 (GUILDS) | 2 (GUILD_MEMBERS) = 3
        const identifyPayload = {
          op: 2,
          d: {
            token: BOT_TOKEN,
            intents: 3,
            properties: {
              os: process.platform,
              browser: 'SkillshotApp',
              device: 'SkillshotApp',
            },
          },
        };
        ws.send(JSON.stringify(identifyPayload));
      }

      // Opcode 11: Heartbeat ACK
      if (op === 11) {
        // Heartbeat confirmed
      }

      // Opcode 0: Dispatch Events
      if (op === 0) {
        if (t === 'READY') {
          sessionId = d.session_id;
          console.log(`[Bot] 🚀 Ready! Logged in as ${d.user.username}#${d.user.discriminator} (ID: ${d.user.id})`);
          welcomeChannelId = await findWelcomeChannel();
          console.log(`[Bot] 🎯 Active Welcome Channel: #${welcomeChannelId}`);
          console.log('[Bot] 👂 Listening for member joins (GUILD_MEMBER_ADD)...');
        }

        if (t === 'GUILD_MEMBER_ADD') {
          const user = d.user;
          console.log(`[Bot] 🎉 New member joined guild: @${user.username} (ID: ${user.id}, bot: ${!!user.bot})`);
          if (!user.bot) {
            await sendWelcome(user.id, user.username);
          }
        }
      }

      // Opcode 7: Reconnect
      if (op === 7) {
        console.log('[Bot] Gateway requested reconnect.');
        ws.close();
      }

      // Opcode 9: Invalid Session
      if (op === 9) {
        console.log('[Bot] Invalid session. Reconnecting in 5s...');
        setTimeout(connect, 5000);
      }
    } catch (err) {
      console.error('[Bot Error] Message parsing error:', err);
    }
  };

  ws.onclose = (event) => {
    console.log(`[Bot] Gateway disconnected (code: ${event.code}, reason: ${event.reason || 'None'}).`);
    if (event.code === 4014) {
      console.error('[Bot CRITICAL] Disallowed Intent(s) (Error 4014)!');
      console.error('[Bot CRITICAL] Go to https://discord.com/developers/applications');
      console.error('[Bot CRITICAL] Select "Skillshot App" -> Bot -> "Privileged Gateway Intents"');
      console.error('[Bot CRITICAL] Turn ON "Server Members Intent" and click "Save Changes".');
      process.exit(1);
    }
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    console.log('[Bot] Reconnecting in 5s...');
    setTimeout(connect, 5000);
  };

  ws.onerror = (err) => {
    console.error('[Bot Error] WebSocket error:', err.message || err);
  };
}

connect();
