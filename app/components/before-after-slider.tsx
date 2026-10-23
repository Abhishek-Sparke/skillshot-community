'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export interface BeforeAfterSliderProps {
  beforeImage: string;
  afterImage: string;
  beforeLabel?: string;
  afterLabel?: string;
  alt?: string;
  className?: string;
  initialPosition?: number; // 0 to 100
  aspectRatio?: string; // e.g. "16 / 9" or "4 / 3"
}

export default function BeforeAfterSlider({
  beforeImage,
  afterImage,
  beforeLabel = 'Before',
  afterLabel = 'After',
  alt = 'Before and After visual comparison',
  className = '',
  initialPosition = 50,
  aspectRatio = '16 / 10',
}: BeforeAfterSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    handleMove(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    handleMove(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture already lost
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setSliderPosition(pos => Math.max(0, pos - 5));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setSliderPosition(pos => Math.min(100, pos + 5));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setSliderPosition(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setSliderPosition(100);
    }
  };

  // Prevent unwanted selection during drag
  useEffect(() => {
    if (isDragging) {
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.userSelect = '';
    }
    return () => {
      document.body.style.userSelect = '';
    };
  }, [isDragging]);

  return (
    <div
      ref={containerRef}
      className={`beforeAfterContainer ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio,
        overflow: 'hidden',
        borderRadius: 'var(--radius, 14px)',
        cursor: 'ew-resize',
        backgroundColor: 'var(--surface, #141416)',
        boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
        touchAction: 'none',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      tabIndex={0}
      role="slider"
      aria-label="Visual comparison slider"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(sliderPosition)}
      onKeyDown={handleKeyDown}
    >
      {/* 1. After (Base / Right / Bottom layer) Image */}
      <img
        src={afterImage}
        alt={`${alt} (${afterLabel})`}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          pointerEvents: 'none',
        }}
      />

      {/* 2. Before (Top / Left clipped layer) Image */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`,
          pointerEvents: 'none',
        }}
      >
        <img
          src={beforeImage}
          alt={`${alt} (${beforeLabel})`}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* 3. Badges */}
      <div
        style={{
          position: 'absolute',
          top: 14,
          left: 14,
          padding: '4px 10px',
          borderRadius: 8,
          fontSize: '0.78rem',
          fontWeight: 600,
          color: '#ffffff',
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          pointerEvents: 'none',
          userSelect: 'none',
          opacity: sliderPosition > 10 ? 1 : 0,
          transition: 'opacity 0.2s ease',
        }}
      >
        {beforeLabel}
      </div>

      <div
        style={{
          position: 'absolute',
          top: 14,
          right: 14,
          padding: '4px 10px',
          borderRadius: 8,
          fontSize: '0.78rem',
          fontWeight: 600,
          color: '#ffffff',
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          pointerEvents: 'none',
          userSelect: 'none',
          opacity: sliderPosition < 90 ? 1 : 0,
          transition: 'opacity 0.2s ease',
        }}
      >
        {afterLabel}
      </div>

      {/* 4. Draggable Divider Handle */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${sliderPosition}%`,
          width: 3,
          backgroundColor: '#ffffff',
          boxShadow: '0 0 10px rgba(0,0,0,0.5)',
          transform: 'translateX(-50%)',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 36,
            height: 36,
            borderRadius: '50%',
            backgroundColor: '#ffffff',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#121214',
            fontSize: '14px',
            fontWeight: 800,
            border: '2px solid rgba(0,0,0,0.1)',
            transition: 'transform 0.15s ease',
            scale: isDragging ? 1.12 : 1,
          }}
        >
          ‹›
        </div>
      </div>
    </div>
  );
}
