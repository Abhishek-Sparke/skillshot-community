export type CreatorRankId =
  | 'NEWCOMER'
  | 'CREATOR'
  | 'RISING_CREATOR'
  | 'SKILLED_CREATOR'
  | 'ELITE_CREATOR'
  | 'MASTER_CREATOR'
  | 'LEGEND';

export type CreatorRankInfo = {
  id: CreatorRankId;
  label: string;
  symbol: string;
  minXp: number;
  nextRank: CreatorRankId | null;
  nextRankLabel: string | null;
  animationClass: string;
};

export const CREATOR_RANKS: Record<CreatorRankId, CreatorRankInfo> = {
  NEWCOMER: {
    id: 'NEWCOMER',
    label: 'Newcomer',
    symbol: '◇',
    minXp: 0,
    nextRank: 'CREATOR',
    nextRankLabel: 'Creator',
    animationClass: 'rank-newcomer',
  },
  CREATOR: {
    id: 'CREATOR',
    label: 'Creator',
    symbol: '◆',
    minXp: 500,
    nextRank: 'RISING_CREATOR',
    nextRankLabel: 'Rising Creator',
    animationClass: 'rank-creator',
  },
  RISING_CREATOR: {
    id: 'RISING_CREATOR',
    label: 'Rising Creator',
    symbol: '✦',
    minXp: 2000,
    nextRank: 'SKILLED_CREATOR',
    nextRankLabel: 'Skilled Creator',
    animationClass: 'rank-rising-creator',
  },
  SKILLED_CREATOR: {
    id: 'SKILLED_CREATOR',
    label: 'Skilled Creator',
    symbol: '✦',
    minXp: 5000,
    nextRank: 'ELITE_CREATOR',
    nextRankLabel: 'Elite Creator',
    animationClass: 'rank-skilled-creator',
  },
  ELITE_CREATOR: {
    id: 'ELITE_CREATOR',
    label: 'Elite Creator',
    symbol: '✧',
    minXp: 10000,
    nextRank: 'MASTER_CREATOR',
    nextRankLabel: 'Master Creator',
    animationClass: 'rank-elite-creator',
  },
  MASTER_CREATOR: {
    id: 'MASTER_CREATOR',
    label: 'Master Creator',
    symbol: '♢',
    minXp: 25000,
    nextRank: 'LEGEND',
    nextRankLabel: 'Legend',
    animationClass: 'rank-master-creator',
  },
  LEGEND: {
    id: 'LEGEND',
    label: 'Legend',
    symbol: '♛',
    minXp: 50000,
    nextRank: null,
    nextRankLabel: null,
    animationClass: 'rank-legend',
  },
};

const ORDERED_RANKS: CreatorRankId[] = [
  'LEGEND',
  'MASTER_CREATOR',
  'ELITE_CREATOR',
  'SKILLED_CREATOR',
  'RISING_CREATOR',
  'CREATOR',
  'NEWCOMER',
];

export function rankFromXp(xp: number): CreatorRankInfo {
  const safeXp = Math.max(0, Math.floor(xp || 0));
  for (const rankId of ORDERED_RANKS) {
    if (safeXp >= CREATOR_RANKS[rankId].minXp) {
      return CREATOR_RANKS[rankId];
    }
  }
  return CREATOR_RANKS.NEWCOMER;
}

export type RankProgress = {
  rank: CreatorRankInfo;
  xp: number;
  currentTierXp: number;
  nextTierXp: number | null;
  progressPercent: number;
  nextRankTitle: string | null;
};

export function calculateRankProgress(xp: number): RankProgress {
  const rank = rankFromXp(xp);
  const safeXp = Math.max(0, Math.floor(xp || 0));

  if (!rank.nextRank) {
    return {
      rank,
      xp: safeXp,
      currentTierXp: rank.minXp,
      nextTierXp: null,
      progressPercent: 100,
      nextRankTitle: null,
    };
  }

  const nextRank = CREATOR_RANKS[rank.nextRank];
  const tierSpan = nextRank.minXp - rank.minXp;
  const gainedInTier = Math.max(0, safeXp - rank.minXp);
  const progressPercent = Math.min(99, Math.floor((gainedInTier / tierSpan) * 100));

  return {
    rank,
    xp: safeXp,
    currentTierXp: rank.minXp,
    nextTierXp: nextRank.minXp,
    progressPercent,
    nextRankTitle: nextRank.label,
  };
}

export function creatorRankId(value: unknown): CreatorRankId {
  const key = String(value || '').toUpperCase();
  return key in CREATOR_RANKS ? key as CreatorRankId : 'NEWCOMER';
}

export type UserActivityStats = {
  visiblePostCount: number;
  reactionCount: number;
  commentCount: number;
  saveCount: number;
  followerCount: number;
  moderationViolations?: number;
};

/**
 * Server-side algorithm for activity to XP computation.
 * Prevents gaming/spam by only counting visible, non-held posts,
 * factoring in balanced community interaction and deducting severe violations.
 */
export function calculateXpFromActivity(stats: UserActivityStats): number {
  const postPoints = Math.min(3000, Math.max(0, stats.visiblePostCount) * 35);
  const likePoints = Math.min(2500, Math.max(0, stats.reactionCount) * 3);
  const commentPoints = Math.min(1500, Math.max(0, stats.commentCount) * 2);
  const savePoints = Math.min(1500, Math.max(0, stats.saveCount) * 4);
  const followerPoints = Math.min(1500, Math.max(0, stats.followerCount) * 5);

  const violationPenalty = Math.max(0, stats.moderationViolations || 0) * 200;

  const total = postPoints + likePoints + commentPoints + savePoints + followerPoints - violationPenalty;
  return Math.max(0, total);
}
