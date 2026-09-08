'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';

type Props = {
  children: ReactNode;
  title: string;
  subtitle: string;
  level?: number;
  className?: string;
  ariaLabel?: string;
  onClick?: () => void;
};

export default function RoleTooltip({
  children,
  title,
  subtitle,
  level,
  className = '',
  ariaLabel,
  onClick,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  // Close tooltip when clicking/tapping outside
  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const fullLabel = `${title} — ${subtitle}${level ? `, Level ${level}` : ''}`;

  return (
    <span
      ref={containerRef}
      className={`roleTooltipHost ${isOpen ? 'tooltipOpen' : ''} ${className}`}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onFocus={() => setIsOpen(true)}
      onBlur={() => setIsOpen(false)}
      onKeyDown={handleKeyDown}
      onClick={() => {
        // Toggle on mobile touch/tap
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
          setIsOpen((prev) => !prev);
        }
        if (onClick) {
          onClick();
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={ariaLabel || fullLabel}
      aria-expanded={isOpen}
      aria-haspopup="true"
    >
      {children}
      <span
        className={`roleTooltipPopover ${isOpen ? 'roleTooltipVisible' : ''}`}
        role="tooltip"
        aria-hidden={!isOpen}
      >
        <span className="roleTooltipTitle">{title}</span>
        <span className="roleTooltipSubtitle">{subtitle}</span>
        {typeof level === 'number' && (
          <span className="roleTooltipLevel">Level {level}</span>
        )}
      </span>
    </span>
  );
}
