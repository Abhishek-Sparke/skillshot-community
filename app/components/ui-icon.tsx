import type { ReactNode } from 'react';

export type IconName = 'announcement'|'arrow-up-right'|'bookmark'|'check'|'close'|'comment'|'edit'|'eye'|'heart'|'link'|'location'|'lock'|'message'|'more'|'pin'|'plus'|'search'|'share'|'trash';

const paths: Record<IconName, ReactNode> = {
  announcement: <><path d="m3 11 16-6v14L3 13Z"/><path d="M11 8.2v11.3a2.5 2.5 0 0 1-5 0V13"/><path d="M19 9a3 3 0 0 1 0 6"/></>,
  'arrow-up-right': <><path d="M7 17 17 7"/><path d="M8 7h9v9"/></>,
  bookmark: <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z"/>,
  check: <path d="m5 12 4 4L19 6"/>,
  close: <><path d="m6 6 12 12"/><path d="M18 6 6 18"/></>,
  comment: <path d="M20 15a4 4 0 0 1-4 4H8l-4 3V7a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4Z"/>,
  edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></>,
  eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></>,
  heart: <path d="M20.8 5.8a5.5 5.5 0 0 0-7.8 0L12 6.9l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.4a5.5 5.5 0 0 0 0-7.8Z"/>,
  link: <><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1"/></>,
  location: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
  message: <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/>,
  more: <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/></>,
  pin: <><path d="m12 17 5 5"/><path d="M5 11.5 14.5 2l.5 5 4 4-5 .5L4.5 21 3 19.5Z"/></>,
  plus: <><path d="M12 5v14"/><path d="M5 12h14"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  share: <><circle cx="18" cy="5" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="18" cy="19" r="2"/><path d="m8 11 8-5M8 13l8 5"/></>,
  trash: <><path d="M4 7h16"/><path d="M9 3h6l1 4H8Z"/><path d="m6 7 1 14h10l1-14"/><path d="M10 11v6M14 11v6"/></>,
};

export default function UiIcon({ name, size = 16, className = '' }: { name: IconName; size?: number; className?: string }) {
  return <svg className={`uiIcon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}
