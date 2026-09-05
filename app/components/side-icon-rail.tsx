'use client';

import React from 'react';
import './side-icon-rail.css';

// ---------------------------------------------------------------------------
// CURATED MINIMAL MONOCHROME EDITORIAL GLYPHS (24x24 viewBox)
// Categorized across Photography, Creative Work, Tech, Gaming, Video,
// Music, Community, and Skillshot-Specific domains.
// ---------------------------------------------------------------------------

interface RailGlyph {
  id: string;
  name: string;
  category: string;
  svg: React.ReactNode;
  animation?: 'swayA' | 'swayB' | 'swayC' | 'spinSlow' | 'pulse' | 'bounce';
  opacity?: 'high' | 'mid' | 'low';
  size?: 'sm' | 'md' | 'lg';
  baseRotation?: number; // initial tilt
}

const GLYPH_ROSTER: RailGlyph[] = [
  // --- 1. PHOTOGRAPHY ---
  {
    id: 'camera',
    name: 'Camera',
    category: 'photography',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
        <circle cx="12" cy="13" r="3.5" />
      </svg>
    ),
    animation: 'swayA',
    opacity: 'high',
    size: 'md',
    baseRotation: 4,
  },
  {
    id: 'aperture',
    name: 'Aperture',
    category: 'photography',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <line x1="14.31" y1="8" x2="20.05" y2="17.94" />
        <line x1="9.69" y1="8" x2="21.17" y2="8" />
        <line x1="7.38" y1="12" x2="13.12" y2="2.06" />
        <line x1="9.69" y1="16" x2="3.95" y2="6.06" />
        <line x1="14.31" y1="16" x2="2.83" y2="16" />
        <line x1="16.62" y1="12" x2="10.88" y2="21.94" />
      </svg>
    ),
    animation: 'spinSlow', // Rare continuous slow 360 rotation
    opacity: 'high',
    size: 'lg',
  },
  {
    id: 'shutter',
    name: 'Shutter Focus',
    category: 'photography',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M3 8V5a2 2 0 0 1 2-2h3" />
        <path d="M16 3h3a2 2 0 0 1 2 2v3" />
        <path d="M21 16v3a2 2 0 0 1-2 2h-3" />
        <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
      </svg>
    ),
    animation: 'swayB',
    opacity: 'mid',
    size: 'md',
    baseRotation: -5,
  },
  {
    id: 'lens',
    name: 'Concentric Lens',
    category: 'photography',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      </svg>
    ),
    opacity: 'low',
    size: 'sm',
  },
  {
    id: 'photo-frame',
    name: 'Photo Frame',
    category: 'photography',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    ),
    animation: 'swayC',
    opacity: 'mid',
    size: 'md',
    baseRotation: 6,
  },

  // --- 2. CREATIVE WORK ---
  {
    id: 'paintbrush',
    name: 'Paintbrush',
    category: 'creative',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18.37 2.63 14 7l3 3 4.37-4.37a2.12 2.12 0 1 0-3-3Z" />
        <path d="M9 12l5 5-4 4c-1.5 1.5-4 1.5-5.5 0s-1.5-4 0-5.5l4-4Z" />
        <path d="M13 8l3 3" />
      </svg>
    ),
    animation: 'swayA',
    opacity: 'high',
    size: 'md',
    baseRotation: -8,
  },
  {
    id: 'pencil',
    name: 'Pencil',
    category: 'creative',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
      </svg>
    ),
    animation: 'swayB',
    opacity: 'mid',
    size: 'sm',
    baseRotation: 12,
  },
  {
    id: 'palette',
    name: 'Color Palette',
    category: 'creative',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a10 10 0 0 0-10 10c0 4.42 3.13 8 7 8 1 0 1.5-.5 1.5-1.5 0-.46-.17-.89-.47-1.22-.3-.33-.53-.76-.53-1.28 0-1.1.9-2 2-2h1.5c4.14 0 7.5-3.36 7.5-7.5A10 10 0 0 0 12 2z" />
        <circle cx="7" cy="8.5" r="1" fill="currentColor" />
        <circle cx="11.5" cy="6" r="1" fill="currentColor" />
        <circle cx="16" cy="8.5" r="1" fill="currentColor" />
        <circle cx="17.5" cy="13" r="1" fill="currentColor" />
      </svg>
    ),
    opacity: 'high',
    size: 'md',
    baseRotation: -4,
  },
  {
    id: 'grid',
    name: 'Design Grid',
    category: 'creative',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
    opacity: 'low',
    size: 'sm',
  },
  {
    id: 'crop',
    name: 'Crop Marks',
    category: 'creative',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2v14a2 2 0 0 0 2 2h14" />
        <path d="M18 22V8a2 2 0 0 0-2-2H2" />
      </svg>
    ),
    animation: 'swayC',
    opacity: 'mid',
    size: 'sm',
    baseRotation: 5,
  },
  {
    id: 'layers',
    name: 'Layers',
    category: 'creative',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 12 12 17 22 12" />
        <polyline points="2 17 12 22 22 17" />
      </svg>
    ),
    opacity: 'high',
    size: 'md',
  },
  {
    id: 'spark',
    name: 'Spark',
    category: 'creative',
    svg: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L13.8 8.2L20 10L13.8 11.8L12 18L10.2 11.8L4 10L10.2 8.2L12 2Z" />
      </svg>
    ),
    animation: 'pulse',
    opacity: 'high',
    size: 'md',
    baseRotation: 15,
  },
  {
    id: 'star-four',
    name: 'Editorial Star',
    category: 'creative',
    svg: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C12 7.5 16.5 12 24 12C16.5 12 12 16.5 12 24C12 16.5 7.5 12 0 12C7.5 12 12 7.5 12 0Z" />
      </svg>
    ),
    animation: 'swayB',
    opacity: 'mid',
    size: 'sm',
    baseRotation: -5,
  },

  // --- 3. TECHNOLOGY ---
  {
    id: 'code',
    name: 'Code Brackets',
    category: 'tech',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
    animation: 'swayA',
    opacity: 'high',
    size: 'md',
  },
  {
    id: 'terminal',
    name: 'Terminal Command',
    category: 'tech',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" y1="19" x2="20" y2="19" />
      </svg>
    ),
    opacity: 'mid',
    size: 'sm',
    baseRotation: 4,
  },
  {
    id: 'cursor',
    name: 'Cursor Pointer',
    category: 'tech',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
        <path d="m13 13 6 6" />
      </svg>
    ),
    animation: 'swayB',
    opacity: 'mid',
    size: 'md',
    baseRotation: -12,
  },
  {
    id: 'database',
    name: 'Database Cylinder',
    category: 'tech',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      </svg>
    ),
    opacity: 'low',
    size: 'sm',
  },
  {
    id: 'cloud',
    name: 'Cloud Node',
    category: 'tech',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
      </svg>
    ),
    opacity: 'mid',
    size: 'md',
  },
  {
    id: 'chip',
    name: 'AI Neural Core',
    category: 'tech',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <rect x="9" y="9" width="6" height="6" />
        <line x1="9" y1="1" x2="9" y2="4" />
        <line x1="15" y1="1" x2="15" y2="4" />
        <line x1="9" y1="20" x2="9" y2="23" />
        <line x1="15" y1="20" x2="15" y2="23" />
        <line x1="20" y1="9" x2="23" y2="9" />
        <line x1="20" y1="15" x2="23" y2="15" />
        <line x1="1" y1="9" x2="4" y2="9" />
        <line x1="1" y1="15" x2="4" y2="15" />
      </svg>
    ),
    animation: 'swayC',
    opacity: 'high',
    size: 'md',
    baseRotation: 6,
  },

  // --- 4. GAMING ---
  {
    id: 'controller',
    name: 'Game Controller',
    category: 'gaming',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="12" rx="6" />
        <path d="M6 12h4m-2-2v4" />
        <circle cx="16" cy="10" r="1" fill="currentColor" />
        <circle cx="18" cy="14" r="1" fill="currentColor" />
      </svg>
    ),
    animation: 'swayA',
    opacity: 'high',
    size: 'lg',
    baseRotation: -6,
  },
  {
    id: 'dpad',
    name: 'D-Pad Plus',
    category: 'gaming',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3z" />
      </svg>
    ),
    opacity: 'mid',
    size: 'sm',
    baseRotation: 8,
  },
  {
    id: 'pixel',
    name: 'Pixel Diamond',
    category: 'gaming',
    svg: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <rect x="10" y="2" width="4" height="4" />
        <rect x="6" y="6" width="4" height="4" />
        <rect x="14" y="6" width="4" height="4" />
        <rect x="2" y="10" width="4" height="4" />
        <rect x="18" y="10" width="4" height="4" />
        <rect x="6" y="14" width="4" height="4" />
        <rect x="14" y="14" width="4" height="4" />
        <rect x="10" y="18" width="4" height="4" />
      </svg>
    ),
    animation: 'pulse',
    opacity: 'low',
    size: 'sm',
  },
  {
    id: 'joystick',
    name: 'Arcade Stick',
    category: 'gaming',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="9" x2="12" y2="17" />
        <circle cx="12" cy="6" r="3" />
        <path d="M4 17h16a2 2 0 0 1 2 2v2H2v-2a2 2 0 0 1 2-2z" />
      </svg>
    ),
    animation: 'swayB',
    opacity: 'mid',
    size: 'md',
    baseRotation: -5,
  },

  // --- 5. VIDEO & MOTION ---
  {
    id: 'film',
    name: 'Film Strip',
    category: 'video',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <line x1="7" y1="4" x2="7" y2="20" />
        <line x1="17" y1="4" x2="17" y2="20" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <line x1="2" y1="8" x2="7" y2="8" />
        <line x1="2" y1="16" x2="7" y2="16" />
        <line x1="17" y1="8" x2="22" y2="8" />
        <line x1="17" y1="16" x2="22" y2="16" />
      </svg>
    ),
    animation: 'swayA',
    opacity: 'high',
    size: 'md',
    baseRotation: 7,
  },
  {
    id: 'play',
    name: 'Play Glyph',
    category: 'video',
    svg: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <polygon points="6 3 20 12 6 21 6 3" />
      </svg>
    ),
    opacity: 'mid',
    size: 'sm',
    baseRotation: -3,
  },
  {
    id: 'clapperboard',
    name: 'Clapperboard',
    category: 'video',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="8" width="20" height="13" rx="2" />
        <path d="M20.2 4.6 18 8H2l2.2-3.4a2 2 0 0 1 1.7-.6h12.6c.7 0 1.3.2 1.7.6z" />
        <line x1="7" y1="4" x2="9.5" y2="8" />
        <line x1="13" y1="4" x2="15.5" y2="8" />
      </svg>
    ),
    animation: 'swayC',
    opacity: 'high',
    size: 'md',
    baseRotation: -7,
  },
  {
    id: 'video-camera',
    name: 'Cinema Camera',
    category: 'video',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" />
      </svg>
    ),
    opacity: 'mid',
    size: 'md',
    baseRotation: 4,
  },

  // --- 6. MUSIC & AUDIO ---
  {
    id: 'music-note',
    name: 'Music Note',
    category: 'music',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    ),
    animation: 'swayB',
    opacity: 'high',
    size: 'md',
    baseRotation: -9,
  },
  {
    id: 'headphones',
    name: 'Studio Headphones',
    category: 'music',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
        <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
      </svg>
    ),
    opacity: 'high',
    size: 'md',
    baseRotation: 5,
  },
  {
    id: 'soundwave',
    name: 'Sound Waveform',
    category: 'music',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <line x1="2" y1="12" x2="2" y2="12" />
        <line x1="6" y1="8" x2="6" y2="16" />
        <line x1="10" y1="4" x2="10" y2="20" />
        <line x1="14" y1="7" x2="14" y2="17" />
        <line x1="18" y1="10" x2="18" y2="14" />
        <line x1="22" y1="12" x2="22" y2="12" />
      </svg>
    ),
    opacity: 'low',
    size: 'sm',
  },

  // --- 7. COMMUNITY ---
  {
    id: 'user',
    name: 'User Creator',
    category: 'community',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
    opacity: 'high',
    size: 'md',
  },
  {
    id: 'heart',
    name: 'Heart Like',
    category: 'community',
    svg: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
    animation: 'pulse',
    opacity: 'high',
    size: 'sm',
    baseRotation: 6,
  },
  {
    id: 'chat',
    name: 'Comment Bubble',
    category: 'community',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    animation: 'swayA',
    opacity: 'mid',
    size: 'md',
    baseRotation: -4,
  },
  {
    id: 'share',
    name: 'Share Out',
    category: 'community',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
    ),
    opacity: 'mid',
    size: 'sm',
    baseRotation: 10,
  },
  {
    id: 'bookmark',
    name: 'Bookmark Save',
    category: 'community',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
    ),
    animation: 'swayC',
    opacity: 'mid',
    size: 'sm',
    baseRotation: -6,
  },

  // --- 8. SKILLSHOT SPECIFIC ---
  {
    id: 'upload',
    name: 'Upload Action',
    category: 'skillshot',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    ),
    animation: 'bounce',
    opacity: 'high',
    size: 'md',
  },
  {
    id: 'award',
    name: 'Creator Trophy',
    category: 'skillshot',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9H4a2 2 0 0 1-2-2V5h4" />
        <path d="M18 9h2a2 2 0 0 0 2-2V5h-4" />
        <path d="M4 5h16v7a8 8 0 0 1-16 0V5z" />
        <path d="M12 17v4" />
        <path d="M8 21h8" />
      </svg>
    ),
    animation: 'swayA',
    opacity: 'high',
    size: 'md',
    baseRotation: -5,
  },
  {
    id: 'verified',
    name: 'Verified Badge',
    category: 'skillshot',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l2.4 2.8 3.7-.3 1.2 3.5 3.5 1.2-.3 3.7 2.8 2.4-2.8 2.4.3 3.7-3.5 1.2-1.2 3.5-3.7-.3L12 22l-2.4-2.8-3.7.3-1.2-3.5-3.5-1.2.3-3.7L2 12l2.8-2.4-.3-3.7 3.5-1.2 1.2-3.5 3.7.3L12 2z" />
        <polyline points="9 12 11 14 15 10" />
      </svg>
    ),
    animation: 'swayB',
    opacity: 'high',
    size: 'md',
    baseRotation: 6,
  },
  {
    id: 'trending',
    name: 'Trending Flame',
    category: 'skillshot',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
      </svg>
    ),
    animation: 'pulse',
    opacity: 'high',
    size: 'md',
    baseRotation: -3,
  },
  {
    id: 'geometric-diamond',
    name: 'Diamond Accent',
    category: 'creative',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <polygon points="12 2 22 12 12 22 2 12 12 2" />
      </svg>
    ),
    opacity: 'low',
    size: 'sm',
  },
];

// Left rail order (curated for visual rhythm and domain interleaving)
const LEFT_GLYPH_SEQUENCE = [
  ...GLYPH_ROSTER,
];

// Right rail order (alternative deterministic sequence for asymmetrical balance)
const RIGHT_GLYPH_SEQUENCE = [
  ...GLYPH_ROSTER.slice(14),
  ...GLYPH_ROSTER.slice(0, 14),
];

export interface SideIconRailProps {
  side: 'left' | 'right';
  className?: string;
}

export function SideIconRail({ side, className = '' }: SideIconRailProps) {
  const sequence = side === 'left' ? LEFT_GLYPH_SEQUENCE : RIGHT_GLYPH_SEQUENCE;

  return (
    <aside
      className={`sideIconRail sideIconRail--${side} ${className}`}
      aria-hidden="true"
      role="presentation"
    >
      <div className="sideIconRail__inner">
        {/* Continuous animation track containing duplicated identical sequence */}
        <div className={`sideIconRail__track sideIconRail__track--${side}`}>
          {/* Sequence 1 */}
          <div className="sideIconRail__segment">
            {sequence.map((glyph, index) => (
              <RailIconCell key={`seg1-${glyph.id}-${index}`} glyph={glyph} index={index} />
            ))}
          </div>

          {/* Sequence 2 (Identical duplicate creates mathematical 0ms-jump loop) */}
          <div className="sideIconRail__segment" aria-hidden="true">
            {sequence.map((glyph, index) => (
              <RailIconCell key={`seg2-${glyph.id}-${index}`} glyph={glyph} index={index} />
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

function RailIconCell({ glyph, index }: { glyph: RailGlyph; index: number }) {
  const animClass = glyph.animation ? `anim-${glyph.animation}` : 'anim-swayA';
  const opacityClass = glyph.opacity ? `op-${glyph.opacity}` : 'op-mid';
  const sizeClass = glyph.size ? `size-${glyph.size}` : 'size-md';

  // Stagger animation delays deterministically based on index so icons sway out-of-phase
  const animDelay = `${((index * 0.37) % 4.5).toFixed(2)}s`;
  const animDuration = `${(7 + ((index * 0.61) % 6)).toFixed(2)}s`;

  return (
    <div className={`sideIconCell ${opacityClass} ${sizeClass}`}>
      <div
        className={`sideIconWrapper ${animClass}`}
        style={{
          transform: glyph.baseRotation ? `rotate(${glyph.baseRotation}deg)` : undefined,
          animationDelay: animDelay,
          animationDuration: animDuration,
        }}
        title={glyph.name}
      >
        {glyph.svg}
      </div>
    </div>
  );
}

export default SideIconRail;
