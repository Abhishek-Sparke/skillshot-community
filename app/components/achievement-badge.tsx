import { Achievement } from '../../lib/achievements';

export default function AchievementBadge({ achievement, compact = false }: { achievement: Achievement; compact?: boolean }) {
  if (compact) {
    return (
      <span
        className="compactAchievementBadge"
        title={`${achievement.label}: ${achievement.description}`}
        data-tooltip={`${achievement.label}: ${achievement.description}`}
        aria-label={achievement.label}
      >
        <span className="badgeIcon">{achievement.icon}</span>
      </span>
    );
  }

  return (
    <article className="achievementCard">
      <div className="achievementIconBubble">{achievement.icon}</div>
      <div className="achievementText">
        <b>{achievement.label}</b>
        <small>{achievement.description}</small>
      </div>
    </article>
  );
}
