'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  createSuperheroCharacter,
  createAnimeWarrior,
  createSciFiScout,
  createCyberpunkRogue,
  createFantasyMystic,
  createMechaAce,
  createGrappleLine,
  type CharacterRig,
} from './character-models';
import { createLightingEnvironment, createAtmosphericParticles } from './environment-system';
import './immersive-3d-scene.css';

export default function Immersive3DScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeRightName, setActiveRightName] = useState('Kaze-Blade');
  const [isSwinging, setIsSwinging] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check desktop breakpoint & reduced motion preferences
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion || window.innerWidth < 1200) {
      return;
    }

    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let width = container.clientWidth || window.innerWidth;
    let height = container.clientHeight || 980;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 0, 16);

    // 2. WebGL Renderer with alpha transparency and low power preference
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

    // 3. Environment: Theme-Aware Lighting & Floating Particles
    const lighting = createLightingEnvironment(scene);
    const particles = createAtmosphericParticles(75);
    scene.add(particles.points);

    // Initial theme check
    const isInitialDark = document.documentElement.dataset.theme === 'dark';
    lighting.updateTheme(isInitialDark);
    particles.updateTheme(isInitialDark);

    // Theme observer for real-time dark/light mode toggling
    const themeObserver = new MutationObserver(() => {
      const isDark = document.documentElement.dataset.theme === 'dark';
      lighting.updateTheme(isDark);
      particles.updateTheme(isDark);
      superhero.updateMaterials(isDark);
      rightCharacters.forEach(c => c.updateMaterials(isDark));
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    // 4. Character Roster Setup
    // Left: Superhero (Aero-Strider with grappling line)
    const superhero = createSuperheroCharacter();
    scene.add(superhero.root);
    superhero.root.visible = false;
    superhero.updateMaterials(isInitialDark);

    // Right Character Pool
    const rightCharacters: CharacterRig[] = [
      createAnimeWarrior(),   // Kaze-Blade (Tactical Ronin)
      createSciFiScout(),      // Nova Sentinel (Orbital Scout)
      createCyberpunkRogue(),  // Neon Phantom (Cyber Operative)
      createFantasyMystic(),   // Aether Mystic (Runic Horizon)
      createMechaAce(),        // Mecha Ace (Orbital Wing)
    ];

    rightCharacters.forEach(c => {
      scene.add(c.root);
      c.root.visible = false;
      c.updateMaterials(isInitialDark);
    });

    let currentRightIndex = 0;
    let rightCharacter = rightCharacters[currentRightIndex];
    rightCharacter.root.visible = true;
    rightCharacter.root.position.set(13, -0.6, 0); // Start off-screen right
    let rightTargetX = 8.6; // Settled margin position
    let rightCurrentX = 13;

    // Grapple / Web line mesh reference
    let grappleMesh: THREE.Mesh | null = null;
    const grappleAnchorPoint = new THREE.Vector3(-8.5, 11, -1.5);

    // 5. State & Cinematic Sequences
    let swingProgress = 0; // 0 to 1
    let swingActive = false;
    let swingStartTime = 0;
    const SWING_DURATION = 3.8; // seconds

    // Mouse tracking & Lerp
    const cursor = { x: 0, y: 0, targetX: 0, targetY: 0 };
    const onMouseMove = (e: MouseEvent) => {
      const halfW = window.innerWidth / 2;
      const halfH = window.innerHeight / 2;
      cursor.targetX = Math.max(-1, Math.min(1, (e.clientX - halfW) / halfW));
      cursor.targetY = Math.max(-1, Math.min(1, (e.clientY - halfH) / halfH));
    };
    window.addEventListener('mousemove', onMouseMove, { passive: true });

    // Scroll reaction tracking
    let scrollY = 0;
    const onScroll = () => {
      scrollY = window.scrollY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    // Function to trigger the Left Superhero Swinging Sequence
    const triggerSwingSequence = () => {
      if (swingActive) return;
      swingActive = true;
      swingProgress = 0;
      swingStartTime = performance.now() / 1000;
      superhero.root.visible = true;
      setIsSwinging(true);
    };

    // First entrance after short initial page load delay
    const initialSwingTimer = setTimeout(() => {
      triggerSwingSequence();
    }, 1200);

    // Periodic spaced interval (every 28 seconds - subtle easter egg)
    const periodicSwingInterval = setInterval(() => {
      triggerSwingSequence();
    }, 28000);

    // Rotate Right character every 32 seconds
    const rotateRightCharacter = () => {
      // Animate current character out to right
      rightTargetX = 14;
      setTimeout(() => {
        rightCharacter.root.visible = false;
        currentRightIndex = (currentRightIndex + 1) % rightCharacters.length;
        rightCharacter = rightCharacters[currentRightIndex];
        setActiveRightName(rightCharacter.name);
        rightCharacter.root.visible = true;
        rightCurrentX = 14;
        rightCharacter.root.position.x = 14;
        rightTargetX = 8.6; // Slide into right margin
      }, 900);
    };
    const periodicRotateInterval = setInterval(rotateRightCharacter, 32000);

    // 6. Animation Loop
    let animFrameId: number;
    let isPaused = false;

    const onVisibilityChange = () => {
      isPaused = document.hidden;
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const onResize = () => {
      if (!container) return;
      width = container.clientWidth || window.innerWidth;
      height = container.clientHeight || 980;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);

      // Adjust camera distance for wide screens
      if (width >= 1920) {
        camera.position.z = 15;
        rightTargetX = 9.8;
      } else if (width >= 1440) {
        camera.position.z = 16;
        rightTargetX = 8.8;
      } else {
        camera.position.z = 17;
        rightTargetX = 8.2;
      }
    };
    window.addEventListener('resize', onResize);
    onResize();

    const clock = new THREE.Clock();

    const render = () => {
      animFrameId = requestAnimationFrame(render);
      if (isPaused) return;

      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      // Smooth cursor lerp
      cursor.x += (cursor.targetX - cursor.x) * 0.06;
      cursor.y += (cursor.targetY - cursor.y) * 0.06;

      // Update atmospheric particles
      particles.update(time);

      // Scroll effect: subtle vertical camera drift
      camera.position.y = -Math.min(scrollY * 0.003, 3);

      // ---------------------------------------------------------------------
      // LEFT SIDE: Superhero Grapple Swing Choreography
      // ---------------------------------------------------------------------
      if (swingActive) {
        const elapsed = time - swingStartTime;
        swingProgress = elapsed / SWING_DURATION;

        if (swingProgress >= 1) {
          // Swing finished - exit
          swingActive = false;
          superhero.root.visible = false;
          setIsSwinging(false);
          if (grappleMesh) {
            scene.remove(grappleMesh);
            grappleMesh.geometry.dispose();
            grappleMesh = null;
          }
        } else {
          // Pendulum swing path from top-left across outer margin
          // x: from -14 to -7.5 and back to -13
          // y: from 6 down to -1.5 and up to 5
          const t = swingProgress;
          const swingArc = Math.sin(t * Math.PI); // 0 -> 1 -> 0

          const heroX = -13 + t * 4.5 - Math.sin(t * Math.PI * 1.5) * 1.2;
          const heroY = 6 - swingArc * 7.5;
          const heroZ = -2 + Math.sin(t * Math.PI) * 2.2;

          superhero.root.position.set(heroX, heroY, heroZ);
          superhero.root.rotation.y = 0.4 - t * 0.8;
          superhero.setPose(time * 3, cursor, swingProgress);

          // Update dynamic grapple line from wrist emitter to anchor point
          if (grappleMesh) {
            scene.remove(grappleMesh);
            grappleMesh.geometry.dispose();
          }

          if (t > 0.05 && t < 0.88) {
            const wristPos = new THREE.Vector3();
            superhero.grappleAnchor?.getWorldPosition(wristPos);

            // Dynamic tension slack based on swing arc
            const slack = (1 - swingArc) * 0.25;
            grappleMesh = createGrappleLine(grappleAnchorPoint, wristPos, slack);
            scene.add(grappleMesh);
          }
        }
      }

      // ---------------------------------------------------------------------
      // RIGHT SIDE: Anime / Cyberpunk Character Stance & Cursor Tracking
      // ---------------------------------------------------------------------
      // Slide into position with smooth easing
      rightCurrentX += (rightTargetX - rightCurrentX) * 0.04;
      rightCharacter.root.position.x = rightCurrentX;
      rightCharacter.root.position.y = -0.6 + Math.sin(time * 1.5) * 0.06;
      rightCharacter.root.position.z = 0;

      // Rotate subtly towards center of screen
      rightCharacter.root.rotation.y = -0.35 + cursor.x * 0.15;
      rightCharacter.setPose(time, cursor);

      // Render Three.js scene
      renderer.render(scene, camera);
    };

    render();

    // 7. Cleanup
    return () => {
      cancelAnimationFrame(animFrameId);
      clearTimeout(initialSwingTimer);
      clearInterval(periodicSwingInterval);
      clearInterval(periodicRotateInterval);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      themeObserver.disconnect();

      if (grappleMesh) {
        scene.remove(grappleMesh);
        grappleMesh.geometry.dispose();
      }

      renderer.dispose();
    };
  }, []);

  return (
    <div className="immersive3DLayer" ref={containerRef} aria-hidden="true">
      <canvas className="immersive3DCanvas" ref={canvasRef} />

      {/* Subtle indicator pill in bottom-right margin displaying active character */}
      <div className="characterAuraBadge" title="Skillshot 3D Creative Universe">
        <span className="auraDot" />
        <span className="auraText">{isSwinging ? 'Aero-Strider • Grapple' : activeRightName}</span>
      </div>
    </div>
  );
}
