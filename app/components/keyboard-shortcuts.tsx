'use client';

import { useEffect, useState, useCallback } from 'react';

type Shortcut = {
  key: string;
  label: string;
  description: string;
  category: 'Navigation' | 'Actions' | 'General';
};

const SHORTCUTS: Shortcut[] = [
  { key: 'J / ↓', label: 'Next Shot', description: 'Navigate down to the next Skillshot in feed', category: 'Navigation' },
  { key: 'K / ↑', label: 'Previous Shot', description: 'Navigate up to the previous Skillshot in feed', category: 'Navigation' },
  { key: 'Cmd/Ctrl + K', label: 'Command Palette', description: 'Spotlight search across shots, creators, and quick actions', category: 'General' },
  { key: 'F', label: 'Cinema HUD Mode', description: 'Enter full-bleed viewfinder theater on shot detail', category: 'Actions' },
  { key: 'G', label: 'Rule-of-Thirds Grid', description: 'Toggle 3×3 composition grid in Cinema HUD mode', category: 'Actions' },
  { key: 'L', label: 'Like / Appreciate', description: 'Toggle appreciation reaction on the current shot', category: 'Actions' },
  { key: 'S', label: 'Save / Bookmark', description: 'Save shot to your private collection', category: 'Actions' },
  { key: 'C', label: 'Jump to Comments', description: 'Focus immediately into the comment discussion box', category: 'Actions' },
  { key: '?', label: 'Cheatsheet', description: 'Open or close this keyboard shortcuts guide', category: 'General' },
  { key: 'Esc', label: 'Dismiss', description: 'Close modals, viewer preview, or cheatsheet', category: 'General' },
];

export default function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);
  const [activeCardIndex, setActiveCardIndex] = useState(-1);

  const getCards = useCallback(() => {
    return Array.from(document.querySelectorAll<HTMLElement>('.discoveryCard, .post, .homeFreshCard, .portfolioCard, .dominantImageStage'));
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    const isEditing = target && (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable
    );

    if (e.key === '?' || (e.shiftKey && e.key === '/')) {
      if (!isEditing) {
        e.preventDefault();
        setOpen(prev => !prev);
        return;
      }
    }

    if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        setOpen(false);
        return;
      }
    }

    if (isEditing || e.ctrlKey || e.metaKey || e.altKey) return;

    // J or ArrowDown: Next card
    if (e.key === 'j' || e.key === 'J' || e.key === 'ArrowDown') {
      const cards = getCards();
      if (!cards.length) return;
      e.preventDefault();
      const nextIndex = Math.min(cards.length - 1, activeCardIndex + 1);
      setActiveCardIndex(nextIndex);
      const card = cards[nextIndex];
      card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card?.classList.add('keyboardActivePost');
      cards.forEach((c, idx) => { if (idx !== nextIndex) c.classList.remove('keyboardActivePost'); });
      return;
    }

    // K or ArrowUp: Previous card
    if (e.key === 'k' || e.key === 'K' || e.key === 'ArrowUp') {
      const cards = getCards();
      if (!cards.length) return;
      e.preventDefault();
      const prevIndex = Math.max(0, activeCardIndex - 1);
      setActiveCardIndex(prevIndex);
      const card = cards[prevIndex];
      card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card?.classList.add('keyboardActivePost');
      cards.forEach((c, idx) => { if (idx !== prevIndex) c.classList.remove('keyboardActivePost'); });
      return;
    }

    // L: Like
    if (e.key === 'l' || e.key === 'L') {
      const detailLike = document.querySelector<HTMLButtonElement>('.detailActionBar .likeButton, button.likeButton');
      if (detailLike) {
        e.preventDefault();
        detailLike.click();
        return;
      }
      const cards = getCards();
      const current = cards[activeCardIndex >= 0 ? activeCardIndex : 0];
      const cardLike = current?.querySelector<HTMLButtonElement>('button.likeButton, .postActions button');
      if (cardLike) {
        e.preventDefault();
        cardLike.click();
      }
      return;
    }

    // S: Save
    if (e.key === 's' || e.key === 'S') {
      const detailSave = document.querySelector<HTMLButtonElement>('.detailSaveButton, button.detailSaveButton');
      if (detailSave) {
        e.preventDefault();
        detailSave.click();
        return;
      }
      const cards = getCards();
      const current = cards[activeCardIndex >= 0 ? activeCardIndex : 0];
      const cardSave = current?.querySelector<HTMLButtonElement>('.portfolioSaveBtn, button.saveButton');
      if (cardSave) {
        e.preventDefault();
        cardSave.click();
      }
      return;
    }

    // C: Jump to Comments
    if (e.key === 'c' || e.key === 'C') {
      const commentInput = document.querySelector<HTMLTextAreaElement | HTMLInputElement>('#comments textarea, .commentBox textarea, textarea[name="body"]');
      if (commentInput) {
        e.preventDefault();
        commentInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        commentInput.focus();
      }
      return;
    }
  }, [open, activeCardIndex, getCards]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return <>
    {/* Floating Trigger Button */}
    <aside className="keyboardShortcutFloat" aria-label="Keyboard shortcuts helper">
      <button
        type="button"
        className="shortcutFloatBtn"
        onClick={() => setOpen(true)}
        title="Open keyboard shortcuts (?)"
        aria-label="Open keyboard shortcuts"
      >
        <span className="shortcutFloatIcon">⌨️</span>
        <span className="shortcutFloatText">Shortcuts</span>
        <kbd className="shortcutFloatKbd">?</kbd>
      </button>
    </aside>

    {/* Cheatsheet Modal */}
    {open && (
      <div className="shortcutModalOverlay" onClick={() => setOpen(false)} role="dialog" aria-modal="true" aria-labelledby="shortcutModalTitle">
        <div className="shortcutModalCard" onClick={e => e.stopPropagation()}>
          <header className="shortcutModalHeader">
            <div className="shortcutModalTitleWrap">
              <span className="shortcutModalIcon">⌨️</span>
              <div>
                <h2 id="shortcutModalTitle">Pro Keyboard Navigation</h2>
                <p>Lightning-fast desktop browsing for creators and visual artists.</p>
              </div>
            </div>
            <button
              type="button"
              className="shortcutModalClose"
              onClick={() => setOpen(false)}
              aria-label="Close shortcuts cheatsheet"
            >
              ✕
            </button>
          </header>

          <div className="shortcutList">
            {SHORTCUTS.map(sc => (
              <div key={sc.key} className="shortcutItem">
                <div className="shortcutKeyWrap">
                  <kbd className="shortcutKbd">{sc.key}</kbd>
                </div>
                <div className="shortcutMeta">
                  <strong>{sc.label}</strong>
                  <span>{sc.description}</span>
                </div>
                <span className="shortcutCategory">{sc.category}</span>
              </div>
            ))}
          </div>

          <footer className="shortcutModalFooter">
            <span>Tip: Press <kbd className="shortcutKbd">?</kbd> anywhere to toggle this cheatsheet</span>
            <button type="button" className="shortcutGotItBtn" onClick={() => setOpen(false)}>
              Got it
            </button>
          </footer>
        </div>
      </div>
    )}
  </>;
}
