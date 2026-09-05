import * as THREE from 'three';

/**
 * Atmospheric lighting and environmental particle system.
 * Adapts dynamically between Lumen Light Mode (soft, warm, clean)
 * and Dark Mode (cinematic contrast, dramatic rim-light).
 */

export interface LightingEnvironment {
  ambientLight: THREE.AmbientLight;
  keyLight: THREE.DirectionalLight;
  rimLightLeft: THREE.DirectionalLight;
  rimLightRight: THREE.DirectionalLight;
  updateTheme: (isDark: boolean) => void;
}

export function createLightingEnvironment(scene: THREE.Scene): LightingEnvironment {
  // Ambient fill
  const ambientLight = new THREE.AmbientLight(0xfff8f0, 1.2);
  scene.add(ambientLight);

  // Key directional light (sunlight from top-right)
  const keyLight = new THREE.DirectionalLight(0xfffaf0, 2.2);
  keyLight.position.set(6, 12, 8);
  scene.add(keyLight);

  // Left rim light (creates sharp silhouette highlights on left character)
  const rimLightLeft = new THREE.DirectionalLight(0x38bdf8, 2.5); // Cyan edge highlight
  rimLightLeft.position.set(-10, 4, -4);
  scene.add(rimLightLeft);

  // Right rim light (creates warm glow on right character)
  const rimLightRight = new THREE.DirectionalLight(0xff5039, 2.0); // Coral edge highlight
  rimLightRight.position.set(10, 4, -4);
  scene.add(rimLightRight);

  const updateTheme = (isDark: boolean) => {
    if (isDark) {
      // Dark mode: dramatic contrast, deep shadows, punchy rim highlights
      ambientLight.color.setHex(0x191822);
      ambientLight.intensity = 0.8;

      keyLight.color.setHex(0xe0e7ff);
      keyLight.intensity = 1.6;

      rimLightLeft.color.setHex(0x38bdf8);
      rimLightLeft.intensity = 3.2;

      rimLightRight.color.setHex(0xff5c47);
      rimLightRight.intensity = 2.8;
    } else {
      // Light mode: soft editorial illumination, warm sunlight
      ambientLight.color.setHex(0xfaf6ef);
      ambientLight.intensity = 1.4;

      keyLight.color.setHex(0xfffaed);
      keyLight.intensity = 2.4;

      rimLightLeft.color.setHex(0x93c5fd);
      rimLightLeft.intensity = 1.2;

      rimLightRight.color.setHex(0xfca5a5);
      rimLightRight.intensity = 1.0;
    }
  };

  return {
    ambientLight,
    keyLight,
    rimLightLeft,
    rimLightRight,
    updateTheme,
  };
}

/**
 * Atmospheric Particle System:
 * Floating light particles, micro-dust motes, and soft embers
 * drifting subtly in the background margins.
 */
export function createAtmosphericParticles(count: number = 80): {
  points: THREE.Points;
  update: (time: number) => void;
  updateTheme: (isDark: boolean) => void;
} {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const initialY = new Float32Array(count);
  const speeds = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    // Distribute particles mainly in outer margins (left and right)
    const isLeft = Math.random() > 0.5;
    const x = isLeft ? -14 + Math.random() * 6 : 8 + Math.random() * 6;
    const y = -8 + Math.random() * 16;
    const z = -6 + Math.random() * 8;

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    initialY[i] = y;
    scales[i] = 0.5 + Math.random() * 1.5;
    speeds[i] = 0.2 + Math.random() * 0.4;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));

  // Canvas circle texture for soft round particles
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.6)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
  }
  const texture = new THREE.CanvasTexture(canvas);

  const material = new THREE.PointsMaterial({
    size: 0.28,
    map: texture,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    color: 0xffa07a,
  });

  const points = new THREE.Points(geometry, material);

  const update = (time: number) => {
    const pos = geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      // Subtle upward floating with gentle horizontal drift
      pos[i * 3 + 1] = initialY[i] + Math.sin(time * speeds[i] + i) * 1.5;
      pos[i * 3] += Math.sin(time * 0.5 + i) * 0.003;
    }
    geometry.attributes.position.needsUpdate = true;
  };

  const updateTheme = (isDark: boolean) => {
    if (isDark) {
      material.color.setHex(0x38bdf8); // Cyan embers in dark mode
      material.opacity = 0.55;
    } else {
      material.color.setHex(0xff7a59); // Warm coral dust in light mode
      material.opacity = 0.35;
    }
  };

  return {
    points,
    update,
    updateTheme,
  };
}
