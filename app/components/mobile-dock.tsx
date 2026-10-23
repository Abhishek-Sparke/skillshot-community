'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function MobileDock() {
  const pathname = usePathname();
  const [unreadChat, setUnreadChat] = useState(0);

  useEffect(() => {
    let active = true;
    async function checkUnread() {
      try {
        const res = await fetch('/api/chats/unread', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (active) setUnreadChat(Number(data.unread || 0));
        }
      } catch {
        /* ignore */
      }
    }
    checkUnread();
    const interval = setInterval(checkUnread, 20000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const isHome = pathname === '/';
  const isCommunity = pathname?.startsWith('/community') || pathname?.startsWith('/shots');
  const isUpload = pathname === '/upload';
  const isChats = pathname?.startsWith('/chats') || pathname?.startsWith('/discussions');
  const isProfile = pathname?.startsWith('/profile') || pathname?.startsWith('/users') || pathname?.startsWith('/settings');

  return (
    <nav className="mobileFloatingDock" aria-label="Mobile Navigation Dock">
      <div className="mobileDockPill">
        <Link
          href="/"
          className={`dockItem ${isHome ? 'active' : ''}`}
          aria-label="Home"
        >
          <span className="dockIcon">🏠</span>
          <span className="dockLabel">Home</span>
        </Link>

        <Link
          href="/community"
          className={`dockItem ${isCommunity ? 'active' : ''}`}
          aria-label="Explore Community"
        >
          <span className="dockIcon">🧭</span>
          <span className="dockLabel">Explore</span>
        </Link>

        <Link
          href="/upload"
          className={`dockItem dockUploadBtn ${isUpload ? 'active' : ''}`}
          aria-label="Upload Skillshot"
        >
          <span className="dockUploadPlus">＋</span>
        </Link>

        <Link
          href="/chats"
          className={`dockItem ${isChats ? 'active' : ''}`}
          aria-label="Chats & Discussions"
        >
          <span className="dockIconWrap">
            <span className="dockIcon">💬</span>
            {unreadChat > 0 && (
              <span className="dockUnreadBadge">{unreadChat > 9 ? '9+' : unreadChat}</span>
            )}
          </span>
          <span className="dockLabel">Chat</span>
        </Link>

        <Link
          href="/profile"
          className={`dockItem ${isProfile ? 'active' : ''}`}
          aria-label="Profile and Settings"
        >
          <span className="dockIcon">👤</span>
          <span className="dockLabel">Profile</span>
        </Link>
      </div>
    </nav>
  );
}
