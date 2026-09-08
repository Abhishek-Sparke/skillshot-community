export default function AchievementIcon({ achievementKey, size = 22 }: { achievementKey: string; size?: number }) {
  const variant = achievementKey.includes('like') ? 'heart' : achievementKey.includes('helper') ? 'community' : achievementKey.includes('featured') ? 'star' : achievementKey.includes('skill') ? 'spark' : 'badge';
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {variant === 'heart' && <path d="M20.8 5.8a5.5 5.5 0 0 0-7.8 0L12 6.9l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.4a5.5 5.5 0 0 0 0-7.8Z"/>}
    {variant === 'community' && <><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M3 20c.6-4 2.6-6 6-6s5.4 2 6 6M15 15c3 0 4.5 1.6 5 4"/></>}
    {variant === 'star' && <path d="m12 2.7 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.3l6.2-.9Z"/>}
    {variant === 'spark' && <><path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8Z"/><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7Z"/></>}
    {variant === 'badge' && <><path d="m12 2 7 4v6c0 4.5-2.8 7.6-7 10-4.2-2.4-7-5.5-7-10V6Z"/><path d="m9 12 2 2 4-5"/></>}
  </svg>;
}
