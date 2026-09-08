'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';

type Props = {
  children: ReactNode;
  className: string;
  tooltip: string;
  size: 'compact' | 'profile' | 'hero';
  onClick?: () => void;
  ariaLabel?: string;
  tooltipTitle?: string;
  tooltipSubtitle?: string;
  level?: number;
};

export default function IconBadge({
  children,
  className,
  tooltip,
  size,
  onClick,
  ariaLabel,
  tooltipTitle,
  tooltipSubtitle,
  level,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const badgeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!badgeRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [isOpen]);

  let parsedTitle = tooltipTitle;
  let parsedSubtitle = tooltipSubtitle;
  let parsedLevel = level;

  if (!parsedTitle || !parsedSubtitle) {
    const parts = tooltip.split(' — ');
    if (parts.length >= 2) {
      parsedSubtitle = parsedSubtitle || parts[1].trim();
      const leftPart = parts[0].trim();
      const matchLevel = leftPart.match(/^(.*?)(?:,\s*Level\s*(\d+))?$/i);
      if (matchLevel) {
        parsedTitle = parsedTitle || matchLevel[1].trim();
        if (matchLevel[2] && parsedLevel === undefined) {
          parsedLevel = parseInt(matchLevel[2], 10);
        }
      } else {
        parsedTitle = parsedTitle || leftPart;
      }
    } else {
      parsedTitle = parsedTitle || tooltip;
      parsedSubtitle = parsedSubtitle || '';
    }
  }

  const tooltipElement = (
    <span
      className={`iconBadgeTooltip roleTooltipPopover ${isOpen ? 'roleTooltipVisible' : ''}`}
      role="tooltip"
    >
      <span className="roleTooltipTitle">{parsedTitle}</span>
      {parsedSubtitle && <span className="roleTooltipSubtitle">{parsedSubtitle}</span>}
      {typeof parsedLevel === 'number' && (
        <span className="roleTooltipLevel">Level {parsedLevel}</span>
      )}
    </span>
  );

  const badgeClassName = `iconBadge iconBadge-${size} ${className} ${isOpen ? 'tooltipOpen' : ''}`;
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') setIsOpen(false);
  };
  const handleClick = () => {
    if ('ontouchstart' in window || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0)) {
      setIsOpen(prev => !prev);
    }
    onClick?.();
  };

  return onClick ? (
    <button
      ref={node => { badgeRef.current = node; }}
      type="button"
      className={badgeClassName}
      aria-label={ariaLabel || tooltip}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onFocus={() => setIsOpen(true)}
      onBlur={() => setIsOpen(false)}
      onKeyDown={handleKeyDown}
      onClick={handleClick}
    >{children}{tooltipElement}</button>
  ) : (
    <span
      ref={node => { badgeRef.current = node; }}
      className={badgeClassName}
      aria-label={ariaLabel || tooltip}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onFocus={() => setIsOpen(true)}
      onBlur={() => setIsOpen(false)}
      onKeyDown={handleKeyDown}
      onClick={handleClick}
      role="img"
      tabIndex={0}
    >{children}{tooltipElement}</span>
  );
}
