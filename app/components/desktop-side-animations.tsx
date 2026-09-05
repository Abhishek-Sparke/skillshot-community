'use client';

import { useEffect, useRef, useState, useId } from 'react';
import './desktop-side-animations.css';

export interface SideShotItem {
  id: string;
  title: string;
  category?: string;
  displayName?: string;
  imageWidth?: number;
  imageHeight?: number;
}

interface DesktopSideAnimationsProps {
  initialShots?: SideShotItem[];
}

export default function DesktopSideAnimations({ initialShots = [] }: DesktopSideAnimationsProps) {
  const [shots, setShots] = useState<SideShotItem[]>(initialShots);
  const leftTrackRef = useRef<HTMLDivElement>(null);
  const rightTrackRef = useRef<HTMLDivElement>(null);
  const uniqueId = useId();

  // Load visible community skillshots if initial list was empty
  useEffect(() => {
    if (shots.length >= 6) return;
    let cancelled = false;

    fetch('/api/posts?limit=6')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (cancelled || !data?.posts || !Array.isArray(data.posts)) return;
        const mapped: SideShotItem[] = data.posts.slice(0, 6).map((p: Record<string, unknown>) => ({
          id: String(p.id),
          title: String(p.title || 'Untitled Skillshot'),
          category: String(p.category || 'Creative'),
          displayName: String(p.displayName || p.display_name || 'Creator'),
          imageWidth: Number(p.imageWidth || p.image_width) || 640,
          imageHeight: Number(p.imageHeight || p.image_height) || 480,
        }));
        if (mapped.length > 0) {
          setShots(mapped);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [shots.length]);

  // Mouse Parallax movement (Subtle, max 8-12px, desktop only, respects reduced-motion)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reducedMotionQuery.matches || window.innerWidth < 1200) {
      return;
    }

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let animFrameId: number;

    const onMouseMove = (e: MouseEvent) => {
      const halfW = window.innerWidth / 2;
      const halfH = window.innerHeight / 2;
      // Normalized coordinates: -1 to 1
      targetX = Math.max(-1, Math.min(1, (e.clientX - halfW) / halfW));
      targetY = Math.max(-1, Math.min(1, (e.clientY - halfH) / halfH));
    };

    const onMouseLeave = () => {
      targetX = 0;
      targetY = 0;
    };

    const updateParallax = () => {
      // Smooth lerp dampening
      currentX += (targetX - currentX) * 0.05;
      currentY += (targetY - currentY) * 0.05;

      // Maximum movement: 10px horizontally, 8px vertically in the opposite direction
      const leftMoveX = -currentX * 10;
      const leftMoveY = -currentY * 8;

      const rightMoveX = -currentX * 11;
      const rightMoveY = -currentY * 7;

      if (leftTrackRef.current) {
        leftTrackRef.current.style.setProperty('--parallax-x', `${leftMoveX.toFixed(2)}px`);
        leftTrackRef.current.style.setProperty('--parallax-y', `${leftMoveY.toFixed(2)}px`);
      }
      if (rightTrackRef.current) {
        rightTrackRef.current.style.setProperty('--parallax-x', `${rightMoveX.toFixed(2)}px`);
        rightTrackRef.current.style.setProperty('--parallax-y', `${rightMoveY.toFixed(2)}px`);
      }

      animFrameId = requestAnimationFrame(updateParallax);
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('mouseleave', onMouseLeave, { passive: true });
    animFrameId = requestAnimationFrame(updateParallax);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseleave', onMouseLeave);
      cancelAnimationFrame(animFrameId);
    };
  }, []);

  // Community shots or subtle abstract editorial fallbacks
  const leftItem1 = shots[0];
  const leftItem2 = shots[1];
  const leftItem3 = shots[2];

  const rightItem1 = shots[3];
  const rightItem2 = shots[4];
  const rightItem3 = shots[5];

  return (
    <div className="desktopSideDecor" aria-hidden="true">
      {/* Left side composition (organic staggered zigzag) */}
      <div className="sideDecorTrack sideDecorLeft" ref={leftTrackRef}>
        <div className="sideDecorItem">
          <div className="sideDecorFloat">
            {leftItem1 ? (
              <ShotCard shot={leftItem1} />
            ) : (
              <AbstractCard
                id={`${uniqueId}-ab1`}
                eyebrow="Curated"
                title="Motion Systems"
                badge="✦ 60fps"
                type="motion"
              />
            )}
          </div>
        </div>

        <div className="sideDecorItem">
          <div className="sideDecorFloat">
            {leftItem2 ? (
              <ShotCard shot={leftItem2} />
            ) : (
              <AbstractCard
                id={`${uniqueId}-ab2`}
                eyebrow="Archive"
                title="Spatial Composition"
                badge="Editorial"
                type="geometric"
              />
            )}
          </div>
        </div>

        <div className="sideDecorItem">
          <div className="sideDecorFloat">
            {leftItem3 ? (
              <ShotCard shot={leftItem3} />
            ) : (
              <AbstractCard
                id={`${uniqueId}-ab3`}
                eyebrow="Craft"
                title="Interactive Design"
                badge="Issue 04"
                type="waveform"
              />
            )}
          </div>
        </div>
      </div>

      {/* Center 1220px boundary spacer - guarantees decorative cards never overlap hero */}
      <div className="sideDecorSpacer" />

      {/* Right side composition (asymmetrical editorial balance) */}
      <div className="sideDecorTrack sideDecorRight" ref={rightTrackRef}>
        <div className="sideDecorItem">
          <div className="sideDecorFloat">
            {rightItem1 ? (
              <ShotCard shot={rightItem1} />
            ) : (
              <AbstractCard
                id={`${uniqueId}-ab4`}
                eyebrow="Selected"
                title="Visual Architecture"
                badge="Spotlight"
                type="concentric"
              />
            )}
          </div>
        </div>

        <div className="sideDecorItem">
          <div className="sideDecorFloat">
            {rightItem2 ? (
              <ShotCard shot={rightItem2} />
            ) : (
              <div className="sideDecorPillCard">
                <span className="sideDecorPillIcon">✦</span>
                <span className="sideDecorPillText">Skillshot Community</span>
              </div>
            )}
          </div>
        </div>

        <div className="sideDecorItem">
          <div className="sideDecorFloat">
            {rightItem3 ? (
              <ShotCard shot={rightItem3} />
            ) : (
              <AbstractCard
                id={`${uniqueId}-ab5`}
                eyebrow="Exploration"
                title="Tactile Surfaces"
                badge="Original"
                type="geometric"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Editorial Shot Card: Displays approved community Skillshot thumbnail and meta
 */
function ShotCard({ shot }: { shot: SideShotItem }) {
  return (
    <div className="sideDecorCard">
      <div className="sideDecorMedia">
        <img
          src={`/api/images/${shot.id}?variant=thumbnail`}
          alt=""
          loading="lazy"
          decoding="async"
          width={shot.imageWidth || 640}
          height={shot.imageHeight || 480}
        />
      </div>
      <div className="sideDecorMeta">
        {shot.category && <span className="sideDecorCategory">{shot.category}</span>}
        <span className="sideDecorTitle">{shot.title}</span>
        {shot.displayName && <span className="sideDecorAuthor">by {shot.displayName}</span>}
      </div>
    </div>
  );
}

/**
 * Abstract Editorial Card: Subtle geometric and typographic composition
 * Used as elegant editorial fallbacks when fewer approved community shots are available.
 */
function AbstractCard({
  id,
  eyebrow,
  title,
  badge,
  type,
}: {
  id: string;
  eyebrow: string;
  title: string;
  badge: string;
  type: 'motion' | 'geometric' | 'waveform' | 'concentric';
}) {
  return (
    <div className="sideDecorCard sideDecorAbstract">
      <div className="sideDecorAbstractHeader">
        <span>{eyebrow}</span>
        <span className="sideDecorAbstractGlyph">✦</span>
      </div>
      <div className="sideDecorAbstractGraphic">
        <GraphicPattern patternId={id} type={type} />
      </div>
      <div className="sideDecorAbstractFooter">
        <span>{title}</span>
        <span className="sideDecorAbstractBadge">{badge}</span>
      </div>
    </div>
  );
}

/**
 * Minimal editorial vector accents (warm, calm, non-garish)
 */
function GraphicPattern({ patternId, type }: { patternId: string; type: string }) {
  if (type === 'motion') {
    return (
      <svg viewBox="0 0 160 38" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M10 19C35 5 55 33 80 19C105 5 125 33 150 19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.25" />
        <circle cx="80" cy="19" r="3.5" fill="var(--accent, #ff5039)" fillOpacity="0.8" />
      </svg>
    );
  }
  if (type === 'concentric') {
    return (
      <svg viewBox="0 0 160 38" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="80" cy="19" r="14" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.16" />
        <circle cx="80" cy="19" r="8" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.28" />
        <circle cx="80" cy="19" r="2.5" fill="currentColor" fillOpacity="0.4" />
      </svg>
    );
  }
  if (type === 'waveform') {
    return (
      <svg viewBox="0 0 160 38" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <line x1="20" y1="19" x2="40" y2="19" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.2" strokeLinecap="round" />
        <line x1="50" y1="12" x2="50" y2="26" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.3" strokeLinecap="round" />
        <line x1="65" y1="8" x2="65" y2="30" stroke="var(--accent, #ff5039)" strokeWidth="1.5" strokeOpacity="0.6" strokeLinecap="round" />
        <line x1="80" y1="14" x2="80" y2="24" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.35" strokeLinecap="round" />
        <line x1="95" y1="6" x2="95" y2="32" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.3" strokeLinecap="round" />
        <line x1="110" y1="12" x2="110" y2="26" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.25" strokeLinecap="round" />
        <line x1="120" y1="19" x2="140" y2="19" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.2" strokeLinecap="round" />
      </svg>
    );
  }
  // Default subtle geometric pattern
  return (
    <svg viewBox="0 0 160 38" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <pattern id={patternId} width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="8" cy="8" r="1" fill="currentColor" fillOpacity="0.2" />
        </pattern>
      </defs>
      <rect width="160" height="38" fill={`url(#${patternId})`} />
      <rect x="52" y="10" width="56" height="18" rx="5" stroke="currentColor" strokeWidth="1" strokeOpacity="0.25" strokeDasharray="3 3" />
    </svg>
  );
}
