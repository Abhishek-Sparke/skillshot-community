'use client';

import { useEffect, useState, useRef } from 'react';

export default function PullToRefresh() {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);

  useEffect(() => {
    // Only active on touch devices
    if (typeof window === 'undefined' || !('ontouchstart' in window)) return;

    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY <= 0 && !refreshing) {
        touchStartY.current = e.touches[0].clientY;
        isPulling.current = true;
      } else {
        isPulling.current = false;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isPulling.current || refreshing) return;
      if (window.scrollY > 0) {
        isPulling.current = false;
        setPullDistance(0);
        return;
      }
      const currentY = e.touches[0].clientY;
      const diff = currentY - touchStartY.current;
      if (diff > 0) {
        // Damped pull distance maxing at 64px
        const damped = Math.min(64, Math.pow(diff, 0.85));
        setPullDistance(damped);
      } else {
        setPullDistance(0);
      }
    };

    const onTouchEnd = () => {
      if (!isPulling.current || refreshing) return;
      isPulling.current = false;
      if (pullDistance > 45) {
        setRefreshing(true);
        setPullDistance(36);
        // Trigger subtle page refresh
        setTimeout(() => {
          window.location.reload();
        }, 600);
      } else {
        setPullDistance(0);
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [pullDistance, refreshing]);

  if (pullDistance <= 0 && !refreshing) return null;

  return (
    <div
      className={`mobileTopRefreshWrap ${refreshing ? 'isRefreshing' : ''}`}
      style={{
        transform: `translateY(${Math.min(pullDistance, 48)}px)`,
        opacity: Math.min(1, pullDistance / 24),
      }}
      aria-hidden="true"
    >
      <div className="mobileRefreshIndicator">
        <span className="refreshSpinner" />
        <span className="refreshSparkle">✦</span>
      </div>
    </div>
  );
}
