import type { CreatorRankId } from './creator-rank';

export const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID?.trim() || '1548208097112236124';
export const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID?.trim() || '1548215059103227904';
export const DISCORD_RANK_CHANNEL_ID = process.env.DISCORD_RANK_CHANNEL_ID?.trim() || '';
export const DISCORD_API_BASE = 'https://discord.com/api/v10';
export const DISCORD_EMBED_COLOR = 0xff5039; // Skillshot orange/coral accent
export const VERIFY_BUTTON_CUSTOM_ID = 'skillshot_rank_verify';

export const DISCORD_CREATOR_RANK_ROLES: Record<CreatorRankId, string> = {
  NEWCOMER: process.env.DISCORD_ROLE_NEWCOMER?.trim() || '1548217177348374548',
  CREATOR: process.env.DISCORD_ROLE_CREATOR?.trim() || '1548216871499726949',
  RISING_CREATOR: process.env.DISCORD_ROLE_RISING_CREATOR?.trim() || '1548216618935525418',
  SKILLED_CREATOR: process.env.DISCORD_ROLE_SKILLED_CREATOR?.trim() || '1548216452182577152',
  ELITE_CREATOR: process.env.DISCORD_ROLE_ELITE_CREATOR?.trim() || '1548216305683931176',
  MASTER_CREATOR: process.env.DISCORD_ROLE_MASTER_CREATOR?.trim() || '1548216185152086089',
  LEGEND: process.env.DISCORD_ROLE_LEGEND?.trim() || '1548215999336030208',
};

/**
 * Array of strictly managed Skillshot Creator Rank role IDs.
 * Under NO circumstances should any roles outside this set (such as Owner,
 * Admin, Head Moderator, Moderator, or Trusted Contributor) be removed or modified.
 */
export const MANAGED_DISCORD_ROLE_IDS: readonly string[] = Object.values(DISCORD_CREATOR_RANK_ROLES);

export function isManagedCreatorRankRole(roleId: string): boolean {
  return MANAGED_DISCORD_ROLE_IDS.includes(roleId);
}

export function roleIdForRank(rank: CreatorRankId): string {
  return DISCORD_CREATOR_RANK_ROLES[rank] || DISCORD_CREATOR_RANK_ROLES.NEWCOMER;
}

export function rankForRoleId(roleId: string): CreatorRankId | null {
  for (const [rank, id] of Object.entries(DISCORD_CREATOR_RANK_ROLES)) {
    if (id === roleId) return rank as CreatorRankId;
  }
  return null;
}
