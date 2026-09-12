/**
 * Script to register Discord slash commands for Skillshot:
 * - /rank: Displays current Creator Rank, Level, XP, and profile link
 * - /link: Provides direct link to connect Skillshot account
 * - /sync: Triggers immediate server-side role synchronization
 *
 * Usage:
 *   DISCORD_BOT_TOKEN="your_token" npx tsx scripts/register-discord-commands.ts
 */

import { DISCORD_CLIENT_ID, DISCORD_GUILD_ID, DISCORD_API_BASE } from '../lib/discord-config';

const COMMANDS = [
  {
    name: 'rank',
    description: 'Display your current Skillshot Creator Rank, level, and XP progress',
    type: 1,
  },
  {
    name: 'verify',
    description: 'Verify your Skillshot account and receive your Creator Rank role',
    type: 1,
  },
  {
    name: 'link',
    description: 'Get the official link to connect your Discord account to Skillshot',
    type: 1,
  },
  {
    name: 'sync',
    description: 'Synchronize your Discord Creator Rank role with your Skillshot account',
    type: 1,
  },
];

async function registerCommands() {
  const token = process.env.DISCORD_BOT_TOKEN?.trim();
  if (!token) {
    console.error('Error: DISCORD_BOT_TOKEN environment variable is required.');
    process.exit(1);
  }

  // Registering guild-scoped commands is instant (global commands take up to 1 hour to propagate)
  const url = `${DISCORD_API_BASE}/applications/${DISCORD_CLIENT_ID}/guilds/${DISCORD_GUILD_ID}/commands`;

  console.log(`Registering slash commands for Guild ${DISCORD_GUILD_ID}...`);
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(COMMANDS),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`Failed to register commands (${res.status}):`, errorText);
    process.exit(1);
  }

  const data = await res.json();
  console.log(`Successfully registered ${data.length} slash commands:`);
  for (const cmd of data) {
    console.log(` - /${cmd.name}: ${cmd.description}`);
  }
}

if (require.main === module || process.argv[1]?.includes('register-discord-commands')) {
  registerCommands().catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
  });
}
