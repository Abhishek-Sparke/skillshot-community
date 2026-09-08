import { type CreatorRankId, CREATOR_RANKS, creatorRankId } from '../../lib/creator-rank';
import IconBadge from './icon-badge';

type Props = {
  rank: CreatorRankId | string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
  level?: number;
};

export default function CreatorRankBadge({ rank, size = 'md', className = '', onClick, level }: Props) {
  const rankKey = creatorRankId(rank);
  const info = CREATOR_RANKS[rankKey];

  const renderIcon = () => {
    switch (rankKey) {
      case 'NEWCOMER':
        return (
          <svg className="rankIconSvg newcomerSvg" viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8">
            <polygon points="8,1.5 14.5,8 8,14.5 1.5,8" />
          </svg>
        );
      case 'CREATOR':
        return (
          <svg className="rankIconSvg creatorSvg" viewBox="0 0 16 16" width="13" height="13" fill="currentColor">
            <polygon points="8,1.5 14.5,8 8,14.5 1.5,8" />
          </svg>
        );
      case 'RISING_CREATOR':
        return (
          <svg className="rankIconSvg risingSvg" viewBox="0 0 16 16" width="13" height="13" fill="currentColor">
            <path d="M8,1 L9.6,6.4 L15,8 L9.6,9.6 L8,15 L6.4,9.6 L1,8 L6.4,6.4 Z" />
          </svg>
        );
      case 'SKILLED_CREATOR':
        return (
          <svg className="rankIconSvg skilledSvg" viewBox="0 0 16 16" width="13" height="13" fill="currentColor">
            <path d="M8,1 L9.8,6.2 L15,8 L9.8,9.8 L8,15 L6.2,9.8 L1,8 L6.2,6.2 Z" />
            <circle cx="8" cy="8" r="1.5" fill="#fff" />
          </svg>
        );
      case 'ELITE_CREATOR':
        return (
          <svg className="rankIconSvg eliteSvg" viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
            <path d="M8,0.5 L9.8,5.8 L15.5,8 L9.8,10.2 L8,15.5 L6.2,10.2 L0.5,8 L6.2,5.8 Z" />
            <path d="M8,4.5 L9,7 L11.5,8 L9,9 L8,11.5 L7,9 L4.5,8 L7,7 Z" fill="#fff" />
          </svg>
        );
      case 'MASTER_CREATOR':
        return (
          <svg className="rankIconSvg masterSvg" viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
            <polygon points="8,1 15,8 8,15 1,8" />
            <polygon points="8,4 12,8 8,12 4,8" fill="#171715" />
            <polygon points="8,6 10,8 8,10 6,8" fill="currentColor" />
          </svg>
        );
      case 'LEGEND':
        return (
          <svg className="rankIconSvg legendSvg" viewBox="0 0 16 16" width="15" height="15" fill="currentColor">
            <path d="M2.5,12.5 L13.5,12.5 L13.5,14 L2.5,14 Z M2,11 L3.5,4.5 L6.5,8 L8,3 L9.5,8 L12.5,4.5 L14,11 Z" />
            <circle cx="8" cy="2" r="1" />
            <circle cx="3.5" cy="3.5" r="0.9" />
            <circle cx="12.5" cy="3.5" r="0.9" />
          </svg>
        );
    }
  };

  const accessibleLabel = `${info.label}${level ? `, Level ${level}` : ''} — Creator Rank`;
  return <IconBadge
    className={`creatorRankBadge ${info.badgeClass} size-${size} ${className}`}
    size={size === 'sm' ? 'compact' : size === 'lg' ? 'hero' : 'profile'}
    tooltip={accessibleLabel}
    ariaLabel={onClick ? `Open ${accessibleLabel}` : accessibleLabel}
    onClick={onClick}
  >
    <span className="rankIconContainer">{renderIcon()}</span>
  </IconBadge>;
}
