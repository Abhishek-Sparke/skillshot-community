'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function NotificationBell({ initialUnread = 0 }: { initialUnread?: number }) {
  const [unread, setUnread] = useState(initialUnread);

  useEffect(() => {
    let active = true;
    const fetchUnread = async () => {
      try {
        const response = await fetch('/api/notifications', { credentials: 'same-origin', cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        if (active && typeof data.unread === 'number') {
          setUnread(data.unread);
        }
      } catch {
        // Silently ignore network interruptions
      }
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 30_000);
    window.addEventListener('focus', fetchUnread);

    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener('focus', fetchUnread);
    };
  }, []);

  return (
    <Link
      href="/notifications"
      className={`navBellLink ${unread > 0 ? 'hasUnread' : ''}`}
      aria-label={unread > 0 ? `${unread} unread notifications` : 'Notifications'}
      title={unread > 0 ? `${unread} unread notifications` : 'Notifications'}
    >
      <span className="navBellIconWrap">
        <svg
          className="navBellIcon"
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="navBellBadge" aria-hidden="true">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </span>
    </Link>
  );
}
