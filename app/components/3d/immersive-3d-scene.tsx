'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  createSuperheroCharacter,
  createAnimeWarrior,
  createSciFiScout,
  createCyberpunkRogue,
  createFantasyMystic,
  createMechaAce,
  createGamingCharacter,
  createGrappleLine,
  type CharacterRig,
} from './character-models';
import { createLightingEnvironment, createAtmosphericParticles } from './environment-system';
import {
  ChoreographyDirector,
  getEntrancePosition,
  getExitPosition,
  getAnimationOpacity,
} from './choreography-director';
import './immersive-3d-scene.css';

const ROSTER_NAMES = [
  'Kaze-Blade',
  'Nova Sentinel',
  'Neon Phantom',
  'Aether Mystic',
  'Mecha Ace',
  'Volt Runner',
] as const;

export default function Immersive3DScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [activeRightName, setActiveRightName] = useState<string>('Kaze-Blade');
  const [isSwinging, setIsSwinging] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  // References to communicate with WebGL loop
  const triggerSwingRef = useRef<(() => void) | null>(null);
  const selectCharacterRef = useRef<((index: number) => void) | null>(null);

  // Monitor media queries (desktop width & reduced-motion preferences)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreferences = () => {
      setIsReducedMotion(mediaMotion.matches);
      setIsDesktop(window.innerWidth >= 1200);
    };

    updatePreferences();
    mediaMotion.addEventListener('change', updatePreferences);
    window.addEventListener('resize', updatePreferences);

    return () => {
      mediaMotion.removeEventListener('change', updatePreferences);
      window.removeEventListener('resize', updatePreferences);
    };
  }, []);

  // WebGL 3D Scene Initialization
  useEffect(() => {
    if (typeof window === 'undefined' || !isDesktop || isReducedMotion) return;

    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let width = container.clientWidth || window.innerWidth;
    let height = container.clientHeight || 980;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 0, 16);

    // 2. WebGL Renderer with alpha transparency
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    // 3. Theme-Aware Lighting & Atmospheric Particles
    const lighting = createLightingEnvironment(scene);
    const initialIsFullExp = width >= 1440;
    const particles = createAtmosphericParticles(initialIsFullExp ? 80 : 35);
    scene.add(particles.points);

    // Initial theme check
    const isInitialDark = document.documentElement.dataset.theme === 'dark';
    lighting.updateTheme(isInitialDark);
    particles.updateTheme(isInitialDark);

    // 4. Character Factories & Lazy Creation Cache
    const characterFactories = [
      createAnimeWarrior,    // 0: Kaze-Blade (Tactical Ronin)
      createSciFiScout,      // 1: Nova Sentinel (Orbital Scout)
      createCyberpunkRogue,  // 2: Neon Phantom (Cyber Operative)
      createFantasyMystic,   // 3: Aether Mystic (Runic Horizon)
      createMechaAce,        // 4: Mecha Ace (Orbital Wing)
      createGamingCharacter, // 5: Volt Runner (Hyper-Drive Speedster)
    ];

    const characterCache = new Map<number, CharacterRig>();
    const getOrCreateCharacter = (index: number): CharacterRig => {
      let rig = characterCache.get(index);
      if (!rig) {
        rig = characterFactories[index]();
        scene.add(rig.root);
        rig.root.visible = false;
        const currentDark = document.documentElement.dataset.theme === 'dark';
        rig.updateMaterials(currentDark);
        characterCache.set(index, rig);
      }
      return rig;
    };

    // Left Superhero (Aero-Strider with grapple swing)
    const superhero = createSuperheroCharacter();
    scene.add(superhero.root);
    superhero.root.visible = false;
    superhero.updateMaterials(isInitialDark);

    // Theme observer for real-time dark/light mode toggling
    const themeObserver = new MutationObserver(() => {
      const isDark = document.documentElement.dataset.theme === 'dark';
      lighting.updateTheme(isDark);
      particles.updateTheme(isDark);
      superhero.updateMaterials(isDark);
      characterCache.forEach(c => c.updateMaterials(isDark));
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    // 5. Choreography Director
    let rightBaseX = width >= 1920 ? 9.8 : width >= 1440 ? 8.8 : 8.2;
    const director = new ChoreographyDirector(characterFactories.length, initialIsFullExp);

    director.onCharacterEnter((slot) => {
      const rig = getOrCreateCharacter(slot.characterIndex);
      rig.root.visible = true;
      setActiveRightName(rig.name);
    });

    director.onCharacterExit((slot) => {
      const rig = characterCache.get(slot.characterIndex);
      if (rig) {
        rig.root.visible = false;
      }
      const activeIdx = director.getActiveCharacterIndex();
      if (activeIdx !== null) {
        setActiveRightName(ROSTER_NAMES[activeIdx]);
      }
    });

    // Allow user to select a character manually from the preview menu
    selectCharacterRef.current = (index: number) => {
      director.forceExitAll();
      setTimeout(() => {
        director.forceEntrance(index, performance.now() / 1000);
        const rig = getOrCreateCharacter(index);
        setActiveRightName(rig.name);
      }, 300);
    };

    // 6. Superhero Grapple Swing State
    let swingProgress = 0;
    let swingActive = false;
    let swingStartTime = 0;
    const SWING_DURATION = 3.8;
    let grappleMesh: THREE.Mesh | null = null;
    const grappleAnchorPoint = new THREE.Vector3(-8.5, 11, -1.5);

    const triggerSwingSequence = () => {
      if (swingActive) return;
      swingActive = true;
      swingProgress = 0;
      swingStartTime = performance.now() / 1000;
      superhero.root.visible = true;
      setIsSwinging(true);
    };
    triggerSwingRef.current = triggerSwingSequence;

    // Initial swing delay after initial page load
    const initialSwingTimer = setTimeout(() => {
      triggerSwingSequence();
    }, 1200);

    // Periodic spaced interval (every ~35s)
    const periodicSwingInterval = setInterval(() => {
      triggerSwingSequence();
    }, 35000);

    // 7. Mouse tracking & Lerp
    const cursor = { x: 0, y: 0, targetX: 0, targetY: 0 };
    const onMouseMove = (e: MouseEvent) => {
      const halfW = window.innerWidth / 2;
      const halfH = window.innerHeight / 2;
      cursor.targetX = Math.max(-1, Math.min(1, (e.clientX - halfW) / halfW));
      cursor.targetY = Math.max(-1, Math.min(1, (e.clientY - halfH) / halfH));
    };
    window.addEventListener('mousemove', onMouseMove, { passive: true });

    // Scroll tracking
    let scrollY = 0;
    const onScroll = () => {
      scrollY = window.scrollY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    // 8. IntersectionObserver to pause when off-screen
    let isIntersecting = true;
    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        isIntersecting = entries[0]?.isIntersecting ?? true;
      },
      { root: null, threshold: 0.05 }
    );
    intersectionObserver.observe(container);

    // 9. Resize Handling & Breakpoint Tier Scaling
    const onResize = () => {
      if (!container) return;
      width = container.clientWidth || window.innerWidth;
      height = container.clientHeight || 980;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);

      const isFull = width >= 1440;
      director.updateBreakpoint(isFull);
      particles.setParticleCount(isFull ? 80 : 35);

      if (width >= 1920) {
        camera.position.z = 15;
        rightBaseX = 9.8;
      } else if (width >= 1440) {
        camera.position.z = 16;
        rightBaseX = 8.8;
      } else {
        camera.position.z = 17;
        rightBaseX = 8.2;
      }
    };
    window.addEventListener('resize', onResize);
    onResize();

    // 10. Animation Loop
    let animFrameId: number;
    let isPaused = false;
    const onVisibilityChange = () => {
      isPaused = document.hidden;
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const clock = new THREE.Clock();
    const tempScreenPos = new THREE.Vector3();

    const render = () => {
      animFrameId = requestAnimationFrame(render);
      if (isPaused || !isIntersecting) return;

      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      // Smooth cursor lerp
      cursor.x += (cursor.targetX - cursor.x) * 0.06;
      cursor.y += (cursor.targetY - cursor.y) * 0.06;

      // Update atmospheric particles
      particles.update(time);

      // Section scroll awareness
      director.updateScrollStage(scrollY);
      if (scrollY < 450) {
        camera.position.y = -Math.min(scrollY * 0.003, 1.5);
      } else if (scrollY < 1200) {
        camera.position.y = -1.5 - (scrollY - 450) * 0.002;
      }

      // Tick choreography director
      const activeSlots = director.tick(time, delta);

      // Update right-side characters driven by director slots
      for (const slot of activeSlots) {
        const rig = getOrCreateCharacter(slot.characterIndex);
        let pos: [number, number, number];

        if (slot.phase === 'entering') {
          pos = getEntrancePosition(slot.entrance, slot.progress, rightBaseX, -0.6);
        } else if (slot.phase === 'exiting') {
          pos = getExitPosition(slot.exit, slot.progress, rightBaseX, -0.6);
        } else {
          pos = [rightBaseX, -0.6 + Math.sin(time * 1.5) * 0.06, 0];
        }

        // Community section scroll adjustment: step slightly closer to edge
        if (scrollY >= 450 && scrollY < 1200) {
          pos[0] += 1.2;
        }

        rig.root.position.set(pos[0], pos[1], pos[2]);

        const opacity = getAnimationOpacity(slot.phase, slot.progress, slot.entrance, slot.exit);
        rig.root.visible = opacity > 0.02;

        // Screen-space cursor proximity detection
        tempScreenPos.set(pos[0], pos[1], pos[2]);
        tempScreenPos.project(camera);
        const distToCursor = Math.hypot(cursor.x - tempScreenPos.x, cursor.y - tempScreenPos.y);
        const proximity = Math.max(0, 1 - distToCursor / 0.55);

        // Responsive head/torso tracking + subtle cursor proximity reaction
        rig.root.rotation.y = -0.35 + cursor.x * (0.15 + proximity * 0.15);
        if (proximity > 0) {
          rig.root.rotation.z = (cursor.x > tempScreenPos.x ? -1 : 1) * proximity * 0.07;
        } else {
          rig.root.rotation.z = 0;
        }

        rig.setPose(time, cursor);
      }

      // Left superhero grapple swing
      if (swingActive) {
        const elapsed = time - swingStartTime;
        swingProgress = elapsed / SWING_DURATION;

        if (swingProgress >= 1) {
          swingActive = false;
          superhero.root.visible = false;
          setIsSwinging(false);
          if (grappleMesh) {
            scene.remove(grappleMesh);
            grappleMesh.geometry.dispose();
            grappleMesh = null;
          }
        } else {
          const t = swingProgress;
          const swingArc = Math.sin(t * Math.PI);

          const heroX = -13 + t * 4.5 - Math.sin(t * Math.PI * 1.5) * 1.2;
          const heroY = 6 - swingArc * 7.5;
          const heroZ = -2 + Math.sin(t * Math.PI) * 2.2;

          superhero.root.position.set(heroX, heroY, heroZ);
          superhero.root.rotation.y = 0.4 - t * 0.8;
          superhero.setPose(time * 3, cursor, swingProgress);

          if (grappleMesh) {
            scene.remove(grappleMesh);
            grappleMesh.geometry.dispose();
          }

          if (t > 0.05 && t < 0.88) {
            const wristPos = new THREE.Vector3();
            superhero.grappleAnchor?.getWorldPosition(wristPos);

            const slack = (1 - swingArc) * 0.25;
            grappleMesh = createGrappleLine(grappleAnchorPoint, wristPos, slack);
            scene.add(grappleMesh);
          }
        }
      }

      renderer.render(scene, camera);
    };

    render();

    // 11. Cleanup
    return () => {
      cancelAnimationFrame(animFrameId);
      clearTimeout(initialSwingTimer);
      clearInterval(periodicSwingInterval);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      themeObserver.disconnect();
      intersectionObserver.disconnect();

      if (grappleMesh) {
        scene.remove(grappleMesh);
        grappleMesh.geometry.dispose();
      }

      renderer.dispose();
    };
  }, [isDesktop, isReducedMotion]);

  const handleReplaySwing = useCallback(() => {
    triggerSwingRef.current?.();
  }, []);

  const handleSelectCharacter = useCallback((idx: number) => {
    selectCharacterRef.current?.(idx);
    setMenuOpen(false);
  }, []);

  if (!isDesktop) {
    return null;
  }

  return (
    <div className="immersive3DLayer" ref={containerRef} aria-hidden="true">
      {/* 3D WebGL Canvas */}
      {!isReducedMotion && <canvas className="immersive3DCanvas" ref={canvasRef} />}

      {/* Reduced-motion static editorial fallback */}
      {isReducedMotion && (
        <div className="immersive3DReducedMotion">
          <div className="reducedMotionGlowLeft" />
          <div className="reducedMotionGlowRight" />
          <svg className="reducedMotionSilhouette" viewBox="0 0 100 160" fill="currentColor">
            <path d="M50 15 C40 15 35 25 35 35 C35 48 42 55 50 55 C58 55 65 48 65 35 C65 25 60 15 50 15 Z M30 65 L70 65 L65 125 L35 125 Z M38 125 L32 155 L44 155 L47 125 Z M62 125 L68 155 L56 155 L53 125 Z" />
          </svg>
        </div>
      )}

      {/* Subtle indicator pill in bottom-right margin */}
      <div className="characterAuraWrap">
        <button
          type="button"
          className="characterAuraBadge"
          onClick={() => setMenuOpen(prev => !prev)}
          title="Skillshot 3D Creative Universe — Click to preview characters"
          aria-expanded={menuOpen}
        >
          <span className="auraDot" />
          <span className="auraText">
            {isReducedMotion
              ? 'Skillshot • Creative Universe'
              : isSwinging
              ? 'Aero-Strider • Grapple'
              : activeRightName}
          </span>
          <span className="auraChevron">{menuOpen ? '▴' : '▾'}</span>
        </button>

        {menuOpen && (
          <div className="characterPreviewMenu" role="menu">
            <div className="characterMenuHead">
              <span className="characterMenuEyebrow">CREATOR ENERGY</span>
              {!isReducedMotion && (
                <button
                  type="button"
                  className="triggerSwingButton"
                  onClick={handleReplaySwing}
                  title="Launch superhero grapple swing"
                >
                  ⚡ Swing Grapple
                </button>
              )}
            </div>
            <div className="characterMenuList">
              {ROSTER_NAMES.map((name, i) => (
                <button
                  key={name}
                  type="button"
                  className={`characterMenuItem ${activeRightName === name ? 'active' : ''}`}
                  onClick={() => handleSelectCharacter(i)}
                >
                  <span className="menuItemIcon">✦</span>
                  <span className="menuItemName">{name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
