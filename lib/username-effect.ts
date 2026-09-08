import { CREATOR_RANKS, creatorRankId, type CreatorRankId } from './creator-rank.ts';
import { getStaffEffectClass, normalizeRole, type UserRole } from './roles.ts';

export type UsernameEffect = {
  className: string;
  source: 'creator-rank' | 'staff';
  creatorRank: CreatorRankId;
  staffRole: UserRole;
};

/**
 * The single presentation resolver for usernames.
 * Staff authority never changes Creator Rank data; it only wins visual priority.
 */
export function getUsernameEffect(user: {
  creatorRank?: CreatorRankId | string | null;
  staffRole?: UserRole | string | null;
  role?: UserRole | string | null;
}): UsernameEffect {
  const creatorRank = creatorRankId(user.creatorRank);
  const staffRole = normalizeRole(user.staffRole ?? user.role ?? 'USER');
  const staffEffect = getStaffEffectClass(staffRole);

  if (staffEffect) {
    return { className: staffEffect, source: 'staff', creatorRank, staffRole };
  }

  return {
    className: CREATOR_RANKS[creatorRank].animationClass,
    source: 'creator-rank',
    creatorRank,
    staffRole: 'USER',
  };
}
