'use client';

import Link from 'next/link';
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import './public-navbar.css';

/** One link list, measured at its natural desktop width even when the drawer is closed. */
export default function ResponsiveNavbar({
  children,
  bell,
  upload,
}: {
  children: ReactNode;
  bell?: ReactNode;
  upload?: ReactNode;
}) {
  const root = useRef<HTMLElement>(null);
  const links = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const brand = useRef<HTMLAnchorElement>(null);
  const id = useId();
  const [menu, setMenu] = useState({ compact: true, open: false });

  useLayoutEffect(() => {
    const nav = root.current!;
    const list = links.current!;
    let frame = 0;
    const measure = () => {
      // Measure the actual links, not a second hidden navigation or a fixed breakpoint.
      list.dataset.measuring = 'true';
      const naturalWidth = list.getBoundingClientRect().width;
      delete list.dataset.measuring;
      const style = getComputedStyle(nav);
      const available = nav.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const required = brand.current!.getBoundingClientRect().width + naturalWidth + 28;
      const compact = required + 4 > available;
      setMenu(previous => previous.compact === compact ? previous : { compact, open: false });
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(schedule);
    observer.observe(nav);
    observer.observe(brand.current!);
    // Font changes can alter link widths without changing the container width.
    document.fonts.addEventListener('loadingdone', schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.fonts.removeEventListener('loadingdone', schedule);
    };
  }, [children]);

  useEffect(() => {
    if (!menu.open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setMenu(previous => ({ ...previous, open: false }));
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMenu(previous => ({ ...previous, open: false }));
      toggle.current?.focus();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [menu.open]);

  useEffect(() => {
    let active = true;
    async function updateChatBadge() {
      try {
        const res = await fetch('/api/chats/unread', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const unread = Number(data.unread || 0);
        if (!active || !links.current) return;
        const chatLink = links.current.querySelector('a[href="/chats"]');
        if (chatLink) {
          let badge = chatLink.querySelector('.chatNavUnreadBadge');
          if (unread > 0) {
            if (!badge) {
              badge = document.createElement('span');
              badge.className = 'chatNavUnreadBadge';
              chatLink.appendChild(badge);
            }
            badge.textContent = unread > 99 ? '99+' : String(unread);
          } else if (badge) {
            badge.remove();
          }
        }
      } catch { /* graceful fallback */ }
    }
    updateChatBadge();
    const timer = setInterval(updateChatBadge, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const close = () => setMenu(previous => previous.open ? { ...previous, open: false } : previous);
  return <nav ref={root} className="publicNavbar shell" aria-label="Main navigation"
    data-compact={menu.compact} data-open={menu.open}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) close(); }}>
    <Link ref={brand} className="brand" href="/" onClick={close}><span aria-hidden="true">S</span> Skillshot</Link>
    <div className="publicNavMobileActions">
      {upload}
      {bell}
      <button ref={toggle} type="button" className="publicNavToggle" aria-label={menu.open ? 'Close navigation' : 'Open navigation'}
        aria-expanded={menu.open} aria-controls={id}
        onClick={() => setMenu(previous => ({ ...previous, open: !previous.open }))}>
        <span/><span/><span/>
      </button>
    </div>
    <div ref={links} id={id} className="publicNavLinks" inert={menu.compact && !menu.open}
      onSubmit={close}
      onClick={event => { if ((event.target as Element).closest('a')) close(); }}>
      {children}
    </div>
  </nav>;
}
