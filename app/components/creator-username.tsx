'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import CreatorRankBadge from './creator-rank-badge';
import RoleBadge from './role-badge';
import CreatorCard, { type CreatorCardData } from './creator-card';
import type { UserRole } from '../../lib/roles';
import { type CreatorRankId, CREATOR_RANKS } from '../../lib/creator-rank';

type Props = {
  name: string;
  username: string;
  role?: UserRole;
  creatorRank?: CreatorRankId | string;
  showRankBadge?: boolean;
  showRoleBadge?: boolean;
  enableCard?: boolean;
  cardData?: Partial<CreatorCardData>;
  href?: string;
  className?: string;
};

export default function CreatorUsername({
  name,
  username,
  role = 'USER',
  creatorRank = 'NEWCOMER',
  showRankBadge = true,
  showRoleBadge = true,
  enableCard = false,
  cardData,
  href,
  className = '',
}: Props) {
  const [showPopover, setShowPopover] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const closeTimer = useRef<NodeJS.Timeout | null>(null);

  const rankKey = (String(creatorRank || '').toUpperCase() in CREATOR_RANKS
    ? String(creatorRank).toUpperCase()
    : 'NEWCOMER') as CreatorRankId;
  const rankInfo = CREATOR_RANKS[rankKey];

  const profileUrl = href ?? (username ? `/users/${encodeURIComponent(username)}` : '#');

  const handleMouseEnter = () => {
    if (!enableCard) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setShowPopover(true);
  };

  const handleMouseLeave = () => {
    if (!enableCard) return;
    closeTimer.current = setTimeout(() => {
      setShowPopover(false);
    }, 280);
  };

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const fullCardData: CreatorCardData = {
    username,
    displayName: name,
    role,
    creatorRank: rankKey,
    ...cardData,
  };

  return (
    <span
      ref={containerRef}
      className={`creatorUsernameWrapper ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Link
        href={profileUrl}
        className={`creatorUsernameLink ${rankInfo.animationClass}`}
        data-rank={rankKey.toLowerCase()}
      >
        <span className="creatorNameText">{name}</span>
      </Link>

      {showRankBadge && (
        <CreatorRankBadge rank={rankKey} size="sm" />
      )}

      {showRoleBadge && role && role !== 'USER' && (
        <RoleBadge role={role} />
      )}

      {enableCard && showPopover && (
        <div className="creatorPopoverCard">
          <CreatorCard
            data={fullCardData}
            onClose={() => setShowPopover(false)}
          />
        </div>
      )}
    </span>
  );
}
