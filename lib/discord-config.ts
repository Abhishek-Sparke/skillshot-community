import type { CreatorRankId } from './creator-rank';

export const DISCORD_GUILD_ID = '1548208097112236124';
export const DISCORD_CLIENT_ID = '1548215059103227904';
export const DISCORD_API_BASE = 'https://discord.com/api/v10';

export const DISCORD_CREATOR_RANK_ROLES: Record<CreatorRankId, string> = {
  NEWCOMER: '1548217177348374548',
  CREATOR: '1548216871499726949',
  RISING_CREATOR: '1548216618935525418',
  SKILLED_CREATOR: '1548216452182577152',
  ELITE_CREATOR: '1548216305683931176',
  MASTER_CREATOR: '1548216185152086089',
  LEGEND: '1548215999336030208',
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
