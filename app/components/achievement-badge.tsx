import { Achievement } from '../../lib/achievements';
import AchievementIcon from './achievement-icon';

export default function AchievementBadge({ achievement, compact = false }: { achievement: Achievement; compact?: boolean }) {
  if (compact) {
    return (
      <span
        className="compactAchievementBadge"
        title={`${achievement.label}: ${achievement.description}`}
        data-tooltip={`${achievement.label}: ${achievement.description}`}
        aria-label={achievement.label}
      >
        <span className="badgeIcon"><AchievementIcon achievementKey={achievement.key} size={16}/></span>
      </span>
    );
  }

  return (
    <article className="achievementCard">
      <div className="achievementIconBubble"><AchievementIcon achievementKey={achievement.key}/></div>
      <div className="achievementText">
        <b>{achievement.label}</b>
        <small>{achievement.description}</small>
      </div>
    </article>
  );
}
