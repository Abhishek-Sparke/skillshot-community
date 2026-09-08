import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  className: string;
  tooltip: string;
  size: 'compact' | 'profile' | 'hero';
  onClick?: () => void;
  ariaLabel?: string;
};

export default function IconBadge({ children, className, tooltip, size, onClick, ariaLabel }: Props) {
  const content = <>{children}<span className="iconBadgeTooltip" role="tooltip">{tooltip}</span></>;
  const common = {
    className: `iconBadge iconBadge-${size} ${className}`,
    title: tooltip,
    'data-tooltip': tooltip,
    'aria-label': ariaLabel || tooltip,
  };

  return onClick ? (
    <button type="button" {...common} onClick={onClick}>{content}</button>
  ) : (
    <span {...common} role="img" tabIndex={0}>{content}</span>
  );
}
