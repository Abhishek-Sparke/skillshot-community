export type Achievement = {
  key: string;
  label: string;
  description: string;
  icon: string;
  category: 'CREATION' | 'COMMUNITY' | 'ENGAGEMENT' | 'RECOGNITION';
};

export const ACHIEVEMENTS: Record<string, Achievement> = {
  first_skillshot: {
    key: 'first_skillshot',
    label: 'First Skillshot',
    description: 'Published your first creative Skillshot to the community.',
    icon: '✦',
    category: 'CREATION',
  },
  ten_published: {
    key: 'ten_published',
    label: '10 Published',
    description: 'Published 10 original Skillshots.',
    icon: '◈',
    category: 'CREATION',
  },
  hundred_likes: {
    key: 'hundred_likes',
    label: '100 Likes',
    description: 'Received 100 or more appreciations across your work.',
    icon: '♥',
    category: 'ENGAGEMENT',
  },
  featured_creator: {
    key: 'featured_creator',
    label: 'Featured Creator',
    description: 'Selected for the community featured showcase.',
    icon: '★',
    category: 'RECOGNITION',
  },
  skillshot_of_the_week: {
    key: 'skillshot_of_the_week',
    label: 'Skillshot of the Week',
    description: 'Earned the top spot in weekly community spotlight.',
    icon: '🏆',
    category: 'RECOGNITION',
  },
  community_helper: {
    key: 'community_helper',
    label: 'Community Helper',
    description: 'Active contributor in discussions, feedback, and positive support.',
    icon: '💬',
    category: 'COMMUNITY',
  },
  multi_skill_creator: {
    key: 'multi_skill_creator',
    label: 'Multi-Skill Creator',
    description: 'Demonstrated mastery across 3 or more distinct skill categories.',
    icon: '⚡',
    category: 'CREATION',
  },
};

export function calculateAchievements(stats: {
  postCount: number;
  likesReceived: number;
  skillsCount: number;
  isFeatured?: boolean;
  commentCount?: number;
}): Achievement[] {
  const earned: Achievement[] = [];
  if (stats.postCount >= 1) earned.push(ACHIEVEMENTS.first_skillshot);
  if (stats.postCount >= 10) earned.push(ACHIEVEMENTS.ten_published);
  if (stats.likesReceived >= 100) earned.push(ACHIEVEMENTS.hundred_likes);
  if (stats.isFeatured) earned.push(ACHIEVEMENTS.featured_creator);
  if (stats.skillsCount >= 3) earned.push(ACHIEVEMENTS.multi_skill_creator);
  if ((stats.commentCount || 0) >= 15) earned.push(ACHIEVEMENTS.community_helper);
  return earned;
}
