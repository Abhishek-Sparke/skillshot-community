'use client';

import { useEffect, useState, useRef } from 'react';
import NotificationDropdown from './notification-dropdown';

export default function NotificationBell({ initialUnread = 0 }: { initialUnread?: number }) {
  const [unread, setUnread] = useState(initialUnread);
  const [isOpen, setIsOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

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
    const handleUpdate = () => { fetchUnread(); };
    window.addEventListener('focus', fetchUnread);
    window.addEventListener('notifications:updated', handleUpdate);

    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener('focus', fetchUnread);
      window.removeEventListener('notifications:updated', handleUpdate);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const toggleDropdown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(prev => !prev);
  };

  return (
    <div ref={bellRef} className="navBellContainer" style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onClick={toggleDropdown}
        className={`navBellLink ${unread > 0 ? 'hasUnread' : ''} ${isOpen ? 'active' : ''}`}
        aria-label={unread > 0 ? `${unread} unread notifications` : 'Notifications'}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
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
      </button>

      <NotificationDropdown
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onUnreadChange={count => setUnread(count)}
      />
    </div>
  );
}
