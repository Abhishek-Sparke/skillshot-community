'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { applyTheme } from './theme-controller';
import type { Theme } from '../../lib/settings-policy';

type CommandItem = {
  id: string;
  category: 'Navigation' | 'Theme' | 'Explore' | 'Action' | 'Post';
  label: string;
  sublabel?: string;
  icon: string;
  action: () => void;
};

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [postResults, setPostResults] = useState<Array<{ id: string; title: string; author: string; category: string }>>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const closePalette = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setSelectedIndex(0);
    setPostResults([]);
  }, []);

  const navigate = useCallback((url: string) => {
    closePalette();
    router.push(url);
  }, [closePalette, router]);

  const selectTheme = useCallback((theme: Theme) => {
    applyTheme(theme);
    closePalette();
  }, [closePalette]);

  // Global keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsOpen(prev => !prev);
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        closePalette();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closePalette]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const trimmedQuery = query.trim();

  // Debounced search for live posts
  useEffect(() => {
    if (!isOpen || !trimmedQuery) return;
    let active = true;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/posts?limit=5&q=${encodeURIComponent(trimmedQuery)}`);
        if (res.ok && active) {
          const data = await res.json();
          setPostResults((data.posts || []).map((p: { id: string; title: string; author: string; category: string }) => ({
            id: p.id,
            title: p.title,
            author: p.author,
            category: p.category,
          })));
        }
      } catch {
        /* ignore */
      } finally {
        if (active) setSearching(false);
      }
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [trimmedQuery, isOpen]);

  const baseItems: CommandItem[] = [
    { id: 'upload', category: 'Action', label: 'Share a Skillshot', sublabel: 'Upload virtual photography or 3D art', icon: '📸', action: () => navigate('/upload') },
    { id: 'community', category: 'Navigation', label: 'Explore Community', sublabel: 'Discover latest shots & creators', icon: '🧭', action: () => navigate('/community') },
    { id: 'discussions', category: 'Navigation', label: 'Discussions & Forums', sublabel: 'Talk games, photo mode & gear', icon: '💬', action: () => navigate('/discussions') },
    { id: 'saved', category: 'Navigation', label: 'Saved Collection', sublabel: 'Your bookmarked Skillshots', icon: '🔖', action: () => navigate('/saved') },
    { id: 'profile', category: 'Navigation', label: 'My Profile & Showcase', sublabel: 'View rank, milestones & showcase', icon: '👤', action: () => navigate('/profile') },
    { id: 'settings', category: 'Navigation', label: 'Settings & Privacy', sublabel: 'Appearance, notifications, account', icon: '⚙️', action: () => navigate('/settings') },
    { id: 'theme-cyberpunk', category: 'Theme', label: 'Switch to Cyberpunk Neon Theme', sublabel: 'Electric cyan & obsidian noir', icon: '⚡', action: () => selectTheme('cyberpunk') },
    { id: 'theme-spooky', category: 'Theme', label: 'Switch to Spooky Halloween Theme', sublabel: 'Deep purple & pumpkin orange', icon: '🎃', action: () => selectTheme('halloween') },
    { id: 'theme-dark', category: 'Theme', label: 'Switch to Sleek Dark Theme', sublabel: 'Default dark mode', icon: '🌙', action: () => selectTheme('dark') },
    { id: 'theme-light', category: 'Theme', label: 'Switch to Light Theme', sublabel: 'Editorial paper appearance', icon: '☀️', action: () => selectTheme('light') },
    { id: 'explore-gaming', category: 'Explore', label: 'Gaming Photography', sublabel: 'Cyberpunk, Elden Ring, Forza, Tsushima', icon: '🎮', action: () => navigate('/search?category=Gaming') },
    { id: 'explore-photography', category: 'Explore', label: 'Virtual Photography & Ansel', sublabel: 'Lighting, framing, color grading', icon: '📷', action: () => navigate('/search?category=Photography') },
    { id: 'explore-3d', category: 'Explore', label: 'Design & 3D Artwork', sublabel: 'Blender, Unreal Engine, shaders', icon: '🎨', action: () => navigate('/search?category=Design') },
  ];

  const filteredBaseItems = query.trim()
    ? baseItems.filter(item =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        item.sublabel?.toLowerCase().includes(query.toLowerCase()) ||
        item.category.toLowerCase().includes(query.toLowerCase())
      )
    : baseItems;

  const postItems: CommandItem[] = trimmedQuery ? postResults.map(p => ({
    id: `post-${p.id}`,
    category: 'Post',
    label: p.title,
    sublabel: `by ${p.author} · #${p.category}`,
    icon: '🖼️',
    action: () => navigate(`/shots/${p.id}`),
  })) : [];

  const allItems = [...postItems, ...filteredBaseItems];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(1, allItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + allItems.length) % Math.max(1, allItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allItems[selectedIndex]) {
        allItems[selectedIndex].action();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="cmdPaletteOverlay" onClick={closePalette} role="dialog" aria-modal="true" aria-label="Command Palette">
      <div className="cmdPaletteDialog" onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="cmdSearchHeader">
          <span className="cmdSearchIcon" aria-hidden="true">⌕</span>
          <input
            ref={inputRef}
            type="text"
            className="cmdSearchInput"
            placeholder="Search Skillshot or jump to (e.g. Cyberpunk, Upload, Gaming)..."
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            aria-label="Command search"
          />
          {query && (
            <button type="button" className="cmdClearBtn" onClick={() => setQuery('')} aria-label="Clear search">
              ✕
            </button>
          )}
          <span className="cmdKbdHint"><kbd>Esc</kbd></span>
        </div>

        <div className="cmdResultsContainer" role="listbox">
          {searching && <div className="cmdLoadingBar">Searching Skillshots…</div>}
          {allItems.length === 0 ? (
            <div className="cmdEmptyState">
              <span>✦</span>
              <p>No results found for &ldquo;{query}&rdquo;</p>
            </div>
          ) : (
            allItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  role="option"
                  aria-selected={isSelected}
                  className={`cmdItem ${isSelected ? 'selected' : ''}`}
                  onClick={() => item.action()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <span className="cmdItemIcon">{item.icon}</span>
                  <div className="cmdItemMeta">
                    <span className="cmdItemLabel">{item.label}</span>
                    {item.sublabel && <span className="cmdItemSublabel">{item.sublabel}</span>}
                  </div>
                  <span className="cmdItemCategory">{item.category}</span>
                </div>
              );
            })
          )}
        </div>

        <div className="cmdFooter">
          <span>Use <kbd>↑</kbd> <kbd>↓</kbd> to navigate</span>
          <span>Press <kbd>↵</kbd> to select</span>
          <span>Press <kbd>Esc</kbd> to close</span>
        </div>
      </div>
    </div>
  );
}
