'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import CreatorRankBadge from './creator-rank-badge';
import RoleBadge from './role-badge';
import CreatorCard, { type CreatorCardData } from './creator-card';
import type { UserRole } from '../../lib/roles';
import { type CreatorRankId, CREATOR_RANKS, creatorRankId } from '../../lib/creator-rank';

type Props = {
  name: string;
  username: string;
  role?: UserRole;
  staffRole?: UserRole;
  creatorRank?: CreatorRankId | string;
  showRankBadge?: boolean;
  showRoleBadge?: boolean;
  enableCard?: boolean;
  cardData?: Partial<CreatorCardData>;
  href?: string;
  className?: string;
  asSpan?: boolean;
  prefix?: string;
  roleVariant?: 'profile'|'compact';
  layout?: 'inline'|'profile';
  onRankClick?: () => void;
  rankLevel?: number;
};

export default function CreatorUsername({
  name,
  username,
  role = 'USER',
  staffRole,
  creatorRank = 'NEWCOMER',
  showRankBadge = true,
  showRoleBadge = true,
  enableCard = false,
  cardData,
  href,
  className = '',
  asSpan = false,
  prefix = '',
  roleVariant = 'compact',
  layout = 'inline',
  onRankClick,
  rankLevel,
}: Props) {
  const [showPopover, setShowPopover] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const closeTimer = useRef<NodeJS.Timeout | null>(null);

  const rankKey = creatorRankId(creatorRank);
  const rankInfo = CREATOR_RANKS[rankKey];
  const resolvedRole = staffRole ?? role;
  // Creator Rank is the single source of the username effect. Staff role stays
  // visually separate in RoleBadge and never overrides or stacks this effect.
  const nameEffectClass = rankInfo.animationClass;

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
    role: resolvedRole,
    creatorRank: rankKey,
    ...cardData,
  };

  const nameElement = asSpan
    ? <span className={`creatorUsernameLink ${nameEffectClass}`} data-rank={rankKey.toLowerCase()} data-management-role={resolvedRole.toLowerCase()}><span className="creatorNameText">{prefix}{name}</span></span>
    : <Link href={profileUrl} className={`creatorUsernameLink ${nameEffectClass}`} data-rank={rankKey.toLowerCase()} data-management-role={resolvedRole.toLowerCase()}><span className="creatorNameText">{prefix}{name}</span></Link>;
  const rankBadge = showRankBadge
    ? <CreatorRankBadge rank={rankKey} showLabel={layout === 'profile'} size={layout === 'profile' ? 'md' : 'sm'} onClick={onRankClick} level={rankLevel} />
    : null;
  const roleBadge = showRoleBadge && resolvedRole && resolvedRole !== 'USER'
    ? <RoleBadge role={resolvedRole} variant={layout === 'profile' ? 'profile' : roleVariant} />
    : null;

  return (
    <span
      ref={containerRef}
      className={`creatorUsernameWrapper ${layout === 'profile' ? 'creatorProfileIdentity' : ''} ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {layout === 'profile' ? <>
        <span className="creatorProfileNameRow">{nameElement}</span>
        <span className="creatorProfileMetaRow">
          <span className="creatorProfileHandle">@{username}</span>
          {rankBadge}
          {roleBadge}
        </span>
      </> : <>
        {nameElement}
        {rankBadge}
        {roleBadge}
      </>}

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
