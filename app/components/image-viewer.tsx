'use client';

import { PointerEvent, useCallback, useEffect, useRef, useState } from 'react';

type Props = {
  src: string;
  alt: string;
  title: string;
  subtitle?: string;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
};

export default function ImageViewer({ src, alt, title, subtitle, onClose, onPrevious, onNext }: Props) {
  const dialog = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const pointerStart = useRef<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    if (!dialog.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    } else {
      dialog.current.requestFullscreen?.().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') onPrevious?.();
      if (event.key === 'ArrowRight') onNext?.();
      if (event.key === 'f' || event.key === 'F') toggleFullscreen();
      if (event.key === '+' || event.key === '=') setZoom(value => Math.min(3, value + .25));
      if (event.key === '-') setZoom(value => Math.max(1, value - .25));
      if (event.key === 'Tab' && dialog.current) {
        const items = [...dialog.current.querySelectorAll<HTMLElement>('button,[href],[tabindex]:not([tabindex="-1"])')].filter(item => !item.hasAttribute('disabled'));
        if (!items.length) return;
        const first = items[0]; const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, [onClose, onNext, onPrevious, toggleFullscreen]);

  function finishSwipe(event: PointerEvent<HTMLDivElement>) {
    if (pointerStart.current === null) return;
    const distance = event.clientX - pointerStart.current;
    if (distance > 65) onPrevious?.();
    if (distance < -65) onNext?.();
    pointerStart.current = null;
  }

  return <div className="viewerBackdrop" onClick={onClose}>
    <div className="imageViewer" role="dialog" aria-modal="true" aria-label={`Preview ${title}`} ref={dialog} onClick={event => event.stopPropagation()}>
      <header className="viewerHeader"><div><strong>{title}</strong>{subtitle && <span>{subtitle}</span>}</div><div className="viewerTools">
        <button type="button" onClick={() => setZoom(value => Math.max(1, value - .25))} disabled={zoom === 1} aria-label="Zoom out">−</button>
        <span aria-live="polite">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => setZoom(value => Math.min(3, value + .25))} disabled={zoom === 3} aria-label="Zoom in">+</button>
        <button type="button" onClick={() => setZoom(1)} disabled={zoom === 1}>Reset</button>
        <button type="button" className="viewerFullscreen" onClick={toggleFullscreen} aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'} title={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}>{isFullscreen ? '⤓' : '⤢'}</button>
        <button className="viewerClose" ref={closeButton} type="button" onClick={onClose} aria-label="Close preview">×</button>
      </div></header>
      <div className={`viewerStage ${zoom > 1 ? 'zoomed' : ''}`} onPointerDown={event => { pointerStart.current = event.clientX; }} onPointerUp={finishSwipe}>
        {onPrevious && <button className="viewerArrow previous" onClick={onPrevious} aria-label="Previous Skillshot">‹</button>}
        <img src={src} alt={alt} style={{ transform: `scale(${zoom})` }} onDoubleClick={() => setZoom(value => value === 1 ? 2 : 1)}/>
        {onNext && <button className="viewerArrow next" onClick={onNext} aria-label="Next Skillshot">›</button>}
      </div>
    </div>
  </div>;
}
