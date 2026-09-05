import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('desktop side animations component matches accessibility and structure requirements', async () => {
  const tsx = await read('app/components/desktop-side-animations.tsx');
  assert.match(tsx, /className="desktopSideDecor"/);
  assert.match(tsx, /aria-hidden="true"/);
  assert.match(tsx, /sideDecorSpacer/);
  assert.match(tsx, /sideDecorLeft/);
  assert.match(tsx, /sideDecorRight/);
  assert.match(tsx, /prefers-reduced-motion/);
  assert.match(tsx, /innerWidth < 1200/);
  assert.match(tsx, /requestAnimationFrame/);
});

test('desktop side animations CSS enforces breakpoints, reduced-motion, and dark theme', async () => {
  const css = await read('app/components/desktop-side-animations.css');

  // Hidden by default (< 1200px)
  assert.match(css, /\.desktopSideDecor\s*\{\s*display:\s*none\s*!important;\s*\}/);

  // Desktop breakpoints
  assert.match(css, /@media\s*\(min-width:\s*1200px\)/);
  assert.match(css, /@media\s*\(min-width:\s*1440px\)/);
  assert.match(css, /@media\s*\(min-width:\s*1920px\)/);

  // Non-intrusive pointer-events
  assert.match(css, /pointer-events:\s*none/);

  // Dark mode compatibility
  assert.match(css, /:root\[data-theme=dark\]/);

  // Prefers reduced motion
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /animation:\s*none\s*!important/);

  // Smooth floating and entrance animations
  assert.match(css, /@keyframes\s+floatSubtle/);
  assert.match(css, /@keyframes\s+sideDecorEnter/);
});

test('homepage integrates side animations without changing hero, feed, or navbar', async () => {
  const page = await read('app/page.tsx');
  assert.match(page, /<PublicNavbar returnTo="\/"\/>/);
  assert.match(page, /<DesktopSideAnimations/);
  assert.match(page, /<section className="hero shell">/);
  assert.match(page, /<section className="feed shell" id="explore">/);
  assert.match(page, /<Suspense fallback={<HomeFreshSkeleton\/>/);
});
