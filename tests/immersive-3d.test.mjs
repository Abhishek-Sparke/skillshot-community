import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('3D character models and grapple system define valid original rigs', async () => {
  const file = await read('app/components/3d/character-models.ts');
  assert.match(file, /export function createSuperheroCharacter/);
  assert.match(file, /export function createAnimeWarrior/);
  assert.match(file, /export function createSciFiScout/);
  assert.match(file, /export function createCyberpunkRogue/);
  assert.match(file, /export function createFantasyMystic/);
  assert.match(file, /export function createMechaAce/);
  assert.match(file, /export function createGrappleLine/);

  // Original character names
  assert.match(file, /name:\s*'Aero-Strider'/);
  assert.match(file, /name:\s*'Kaze-Blade'/);
  assert.match(file, /name:\s*'Nova Sentinel'/);
  assert.match(file, /name:\s*'Neon Phantom'/);
  assert.match(file, /name:\s*'Aether Mystic'/);
  assert.match(file, /name:\s*'Mecha Ace'/);
});

test('3D environment system exports lighting and particle controllers', async () => {
  const file = await read('app/components/3d/environment-system.ts');
  assert.match(file, /export function createLightingEnvironment/);
  assert.match(file, /export function createAtmosphericParticles/);
  assert.match(file, /updateTheme/);
});

test('3D scene component complies with accessibility and responsive constraints', async () => {
  const file = await read('app/components/3d/immersive-3d-scene.tsx');
  assert.match(file, /className="immersive3DLayer"/);
  assert.match(file, /aria-hidden="true"/);
  assert.match(file, /prefers-reduced-motion/);
  assert.match(file, /innerWidth < 1200/);
  assert.match(file, /pointerPreference|powerPreference/);
});

test('3D scene CSS enforces mobile exclusion and desktop breakpoints', async () => {
  const css = await read('app/components/3d/immersive-3d-scene.css');
  // Hidden by default (< 1200px)
  assert.match(css, /\.immersive3DLayer\s*\{\s*display:\s*none\s*!important;\s*\}/);

  // Desktop breakpoints
  assert.match(css, /@media\s*\(min-width:\s*1200px\)/);
  assert.match(css, /@media\s*\(min-width:\s*1440px\)/);
  assert.match(css, /@media\s*\(min-width:\s*1920px\)/);

  // Non-intrusive layering
  assert.match(css, /pointer-events:\s*none/);
  assert.match(css, /z-index:\s*1/);

  // Prefers reduced motion
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test('homepage mounts Immersive3DScene cleanly behind hero content', async () => {
  const page = await read('app/page.tsx');
  assert.match(page, /import Immersive3DScene from '\.\/components\/3d\/immersive-3d-scene'/);
  assert.match(page, /<Immersive3DScene\s*\/>/);
  assert.match(page, /<section className="hero shell">/);
});
