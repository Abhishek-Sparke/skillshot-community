'use client';

import { useRef, useState, type MouseEvent } from 'react';
import { Achievement } from '../../lib/achievements';
import AchievementIcon from './achievement-icon';

export default function AchievementBadge({ achievement, compact = false }: { achievement: Achievement; compact?: boolean }) {
  const cardRef = useRef<HTMLElement>(null);
  const [coords, setCoords] = useState<{ x: number; y: number; rotateX: number; rotateY: number; active: boolean }>({
    x: 50,
    y: 50,
    rotateX: 0,
    rotateY: 0,
    active: false,
  });

  const handleMouseMove = (e: MouseEvent<HTMLElement>) => {
    if (compact || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const percentX = (x / rect.width) * 100;
    const percentY = (y / rect.height) * 100;
    const rotateY = ((percentX - 50) / 50) * 10;
    const rotateX = -((percentY - 50) / 50) * 10;
    setCoords({ x: percentX, y: percentY, rotateX, rotateY, active: true });
  };

  const handleMouseLeave = () => {
    setCoords({ x: 50, y: 50, rotateX: 0, rotateY: 0, active: false });
  };

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
    <article
      ref={cardRef}
      className={`achievementCard interactiveTiltCard ${coords.active ? 'tiltActive' : ''}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: coords.active
          ? `perspective(700px) rotateX(${coords.rotateX}deg) rotateY(${coords.rotateY}deg) translateY(-3px) scale3d(1.025, 1.025, 1.025)`
          : 'perspective(700px) rotateX(0deg) rotateY(0deg) translateY(0) scale3d(1, 1, 1)',
        transition: coords.active ? 'transform 0.08s ease-out' : 'transform 0.35s ease',
      }}
    >
      <div
        className="holographicFoilOverlay"
        style={{
          background: `radial-gradient(circle at ${coords.x}% ${coords.y}%, rgba(255,255,255,0.4) 0%, rgba(0, 240, 255, 0.22) 28%, rgba(255, 0, 128, 0.22) 55%, transparent 80%)`,
          opacity: coords.active ? 1 : 0,
        }}
        aria-hidden="true"
      />
      <div className="achievementIconBubble"><AchievementIcon achievementKey={achievement.key}/></div>
      <div className="achievementText">
        <b>{achievement.label}</b>
        <small>{achievement.description}</small>
      </div>
    </article>
  );
}
