'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ChallengeData {
  id: string;
  title: string;
  prompt: string;
  category: string;
  xpBonus: number;
  badgeIcon: string;
  tag: string;
}

export default function CommunityChallengeBanner() {
  const [challenge, setChallenge] = useState<ChallengeData | null>(null);

  useEffect(() => {
    fetch('/api/challenges')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data?.challenge) {
          setChallenge(data.challenge);
        }
      })
      .catch(() => {});
  }, []);

  if (!challenge) return null;

  return (
    <aside
      className="communityChallengeCard shell"
      style={{
        margin: '0 auto 2.5rem',
        padding: '1.5rem 1.75rem',
        borderRadius: '16px',
        background: 'linear-gradient(135deg, rgba(255, 80, 57, 0.12) 0%, rgba(20, 20, 24, 0.95) 75%)',
        border: '1px solid rgba(255, 80, 57, 0.28)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1.25rem',
      }}
    >
      <div style={{ flex: '1 1 320px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '1.25rem' }}>{challenge.badgeIcon}</span>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--accent, #ff5039)',
            }}
          >
            Weekly Quest · +{challenge.xpBonus} XP Bonus
          </span>
        </div>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 0.35rem', color: '#ffffff' }}>
          {challenge.title}
        </h2>
        <p style={{ margin: 0, fontSize: '0.92rem', color: 'rgba(255, 255, 255, 0.78)', lineHeight: 1.45 }}>
          {challenge.prompt}
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Link
          href={`/search?tag=${encodeURIComponent(challenge.tag)}`}
          style={{
            padding: '0.55rem 1rem',
            borderRadius: '999px',
            fontSize: '0.85rem',
            fontWeight: 600,
            color: '#ffffff',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            textDecoration: 'none',
          }}
        >
          #{challenge.tag} entries
        </Link>
        <Link
          href="/upload"
          style={{
            padding: '0.55rem 1.25rem',
            borderRadius: '999px',
            fontSize: '0.85rem',
            fontWeight: 700,
            color: '#ffffff',
            backgroundColor: 'var(--accent, #ff5039)',
            textDecoration: 'none',
            boxShadow: '0 4px 14px rgba(255, 80, 57, 0.35)',
          }}
        >
          Submit Shot ↗
        </Link>
      </div>
    </aside>
  );
}
