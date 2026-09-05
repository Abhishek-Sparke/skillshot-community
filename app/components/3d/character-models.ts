import * as THREE from 'three';

/**
 * SKILLSHOT — ORIGINAL 3D CHARACTER SYSTEM
 *
 * 100% original, stylized collectible-figure aesthetic.
 * Clean geometric anatomy, articulated joints, materials optimized for
 * PBR and toon/rim-lighting in both Light and Dark mode.
 */

export interface CharacterRig {
  root: THREE.Group;
  category: 'SUPERHERO' | 'ANIME' | 'SCIFI' | 'CYBERPUNK' | 'FANTASY' | 'MECHA';
  name: string;
  title: string;
  head: THREE.Object3D;
  torso: THREE.Object3D;
  leftArm?: THREE.Object3D;
  rightArm?: THREE.Object3D;
  leftLeg?: THREE.Object3D;
  rightLeg?: THREE.Object3D;
  grappleAnchor?: THREE.Object3D;
  specialProps?: THREE.Object3D[];
  setPose: (time: number, cursor: { x: number; y: number }, actionProgress?: number) => void;
  updateMaterials: (isDark: boolean) => void;
}

// ---------------------------------------------------------------------------
// 1. SUPERHERO CHARACTER: "Aero-Strider" (Grapple / Web-swinger archetype)
// Original design: Sleek kinetic exo-suit, aerodynamic athletic silhouette,
// twin wrist grapple emitters, illuminated visor.
// ---------------------------------------------------------------------------
export function createSuperheroCharacter(): CharacterRig {
  const root = new THREE.Group();
  root.name = 'AeroStrider';

  // Base Materials
  const suitMat = new THREE.MeshStandardMaterial({
    color: 0x181a20,
    roughness: 0.35,
    metalness: 0.65,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0xff3b24, // Skillshot coral/crimson
    roughness: 0.3,
    metalness: 0.4,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.9,
    roughness: 0.1,
    metalness: 0.9,
  });
  const jointMat = new THREE.MeshStandardMaterial({
    color: 0x0d0e12,
    roughness: 0.6,
    metalness: 0.8,
  });

  // Torso / Chest
  const torso = new THREE.Group();
  const chestGeo = new THREE.BoxGeometry(1.1, 1.4, 0.7);
  const chest = new THREE.Mesh(chestGeo, suitMat);
  chest.position.y = 0;
  torso.add(chest);

  // Chest Armor Plate (Skillshot chevron accent)
  const plateGeo = new THREE.ConeGeometry(0.55, 0.9, 4);
  const plate = new THREE.Mesh(plateGeo, accentMat);
  plate.rotation.x = Math.PI;
  plate.rotation.y = Math.PI / 4;
  plate.position.set(0, 0.1, 0.38);
  torso.add(plate);

  // Belt / Pelvis
  const pelvisGeo = new THREE.BoxGeometry(0.85, 0.45, 0.6);
  const pelvis = new THREE.Mesh(pelvisGeo, suitMat);
  pelvis.position.y = -0.85;
  torso.add(pelvis);

  // Head & Visor
  const head = new THREE.Group();
  head.position.set(0, 1.05, 0);

  const headGeo = new THREE.SphereGeometry(0.48, 16, 16);
  headGeo.scale(0.88, 1.1, 0.95);
  const headMesh = new THREE.Mesh(headGeo, suitMat);
  head.add(headMesh);

  // Sleek Aerodynamic Visor
  const visorGeo = new THREE.BoxGeometry(0.68, 0.22, 0.35);
  const visor = new THREE.Mesh(visorGeo, visorMat);
  visor.position.set(0, 0.05, 0.32);
  visor.rotation.x = -0.08;
  head.add(visor);

  torso.add(head);

  // Arms
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.75, 0.55, 0);
  const leftShoulder = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), accentMat);
  leftArm.add(leftShoulder);
  const leftBicep = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.7, 10), suitMat);
  leftBicep.position.y = -0.42;
  leftArm.add(leftBicep);
  const leftForearm = new THREE.Group();
  leftForearm.position.y = -0.8;
  const leftForearmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.65, 10), suitMat);
  leftForearmMesh.position.y = -0.32;
  leftForearm.add(leftForearmMesh);
  // Grapple emitter on left wrist
  const grappleAnchor = new THREE.Group();
  grappleAnchor.position.set(0, -0.65, 0.12);
  const emitterMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.18, 8), visorMat);
  emitterMesh.rotation.x = Math.PI / 2;
  grappleAnchor.add(emitterMesh);
  leftForearm.add(grappleAnchor);
  leftArm.add(leftForearm);
  torso.add(leftArm);

  // Right Arm
  const rightArm = new THREE.Group();
  rightArm.position.set(0.75, 0.55, 0);
  const rightShoulder = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), accentMat);
  rightArm.add(rightShoulder);
  const rightBicep = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.7, 10), suitMat);
  rightBicep.position.y = -0.42;
  rightArm.add(rightBicep);
  const rightForearm = new THREE.Group();
  rightForearm.position.y = -0.8;
  const rightForearmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.65, 10), suitMat);
  rightForearmMesh.position.y = -0.32;
  rightForearm.add(rightForearmMesh);
  rightArm.add(rightForearm);
  torso.add(rightArm);

  // Legs
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.35, -1.05, 0);
  const leftThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.9, 10), suitMat);
  leftThigh.position.y = -0.45;
  leftLeg.add(leftThigh);
  const leftShin = new THREE.Group();
  leftShin.position.y = -0.9;
  const leftShinMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.9, 10), accentMat);
  leftShinMesh.position.y = -0.45;
  leftShin.add(leftShinMesh);
  leftLeg.add(leftShin);
  torso.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.35, -1.05, 0);
  const rightThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.9, 10), suitMat);
  rightThigh.position.y = -0.45;
  rightLeg.add(rightThigh);
  const rightShin = new THREE.Group();
  rightShin.position.y = -0.9;
  const rightShinMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.9, 10), accentMat);
  rightShinMesh.position.y = -0.45;
  rightShin.add(rightShinMesh);
  rightLeg.add(rightShin);
  torso.add(rightLeg);

  root.add(torso);

  return {
    root,
    category: 'SUPERHERO',
    name: 'Aero-Strider',
    title: 'Kinetic Grapple Hero',
    head,
    torso,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    grappleAnchor,
    setPose: (time, cursor, progress = 0) => {
      // Dynamic superhero swinging posture:
      // Lead arm extended towards grapple anchor point
      leftArm.rotation.x = -1.6 + Math.sin(time * 2) * 0.15;
      leftArm.rotation.z = -0.45;
      leftForearm.rotation.x = -0.25;

      // Trailing arm angled dynamically back
      rightArm.rotation.x = 0.85 + Math.cos(time * 2) * 0.2;
      rightArm.rotation.z = 0.6;
      rightForearm.rotation.x = 0.5;

      // Acrobat leg angles during pendulum swing
      leftLeg.rotation.x = 0.65 + Math.sin(time * 2.5) * 0.2;
      leftLeg.rotation.z = -0.2;
      rightLeg.rotation.x = -0.4 + Math.cos(time * 2.5) * 0.25;
      rightLeg.rotation.z = 0.25;

      // Torso lean into swing velocity
      torso.rotation.z = 0.25 + Math.sin(time * 1.8) * 0.15;
      torso.rotation.x = 0.35;

      // Head looks towards swing destination / cursor
      head.rotation.y = cursor.x * 0.35;
      head.rotation.x = -cursor.y * 0.25;
    },
    updateMaterials: (isDark) => {
      if (isDark) {
        suitMat.color.setHex(0x13151b);
        suitMat.roughness = 0.3;
        accentMat.color.setHex(0xff5533);
        visorMat.emissiveIntensity = 1.3;
      } else {
        suitMat.color.setHex(0x23262f);
        suitMat.roughness = 0.45;
        accentMat.color.setHex(0xe63925);
        visorMat.emissiveIntensity = 0.75;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// 2. ANIME WARRIOR: "Kaze-Blade" (Tactical Cyber-Ronin)
// Stylized anime proportions, long high-collar coat, floating kinetic sheath.
// ---------------------------------------------------------------------------
export function createAnimeWarrior(): CharacterRig {
  const root = new THREE.Group();
  root.name = 'KazeBlade';

  const coatMat = new THREE.MeshStandardMaterial({
    color: 0x161514,
    roughness: 0.6,
    metalness: 0.2,
  });
  const armorMat = new THREE.MeshStandardMaterial({
    color: 0xd8d4cb, // Warm ivory/silver
    roughness: 0.25,
    metalness: 0.8,
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0xff5039, // Skillshot coral glow
    emissive: 0xff3820,
    emissiveIntensity: 0.85,
    roughness: 0.2,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    roughness: 0.3,
    metalness: 0.9,
  });

  const torso = new THREE.Group();

  // Slender anime tactical torso
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.3, 0.55), coatMat);
  torso.add(chest);

  // High tactical collar
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.45, 0.5, 12, 1, true), coatMat);
  collar.position.y = 0.85;
  torso.add(collar);

  // Chest armor plate
  const cuirass = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.75, 0.12), armorMat);
  cuirass.position.set(0, 0.2, 0.3);
  torso.add(cuirass);

  // Long flowing coat tails
  const coatTails = new THREE.Group();
  const tailGeo = new THREE.BoxGeometry(0.85, 1.4, 0.08);
  const coatBack = new THREE.Mesh(tailGeo, coatMat);
  coatBack.position.set(0, -1.25, -0.28);
  coatBack.rotation.x = 0.12;
  coatTails.add(coatBack);
  torso.add(coatTails);

  // Head with anime stylized silhouette / visor
  const head = new THREE.Group();
  head.position.set(0, 1.05, 0);

  const faceMesh = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 16), armorMat);
  faceMesh.scale.set(0.8, 1.15, 0.9);
  head.add(faceMesh);

  // Angular stylized hair / crest
  const crest = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.8, 4), coatMat);
  crest.position.set(0, 0.45, -0.15);
  crest.rotation.x = -0.5;
  head.add(crest);

  // Sharp glowing eye-slit visor
  const eyeVisor = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 0.2), glowMat);
  eyeVisor.position.set(0, 0.06, 0.32);
  head.add(eyeVisor);

  torso.add(head);

  // Left Arm (holding sheath)
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.65, 0.5, 0);
  const lArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 1.1, 8), coatMat);
  lArmMesh.position.y = -0.55;
  leftArm.add(lArmMesh);
  torso.add(leftArm);

  // Right Arm (relaxed katana grip readiness)
  const rightArm = new THREE.Group();
  rightArm.position.set(0.65, 0.5, 0);
  const rArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 1.1, 8), coatMat);
  rArmMesh.position.y = -0.55;
  rightArm.add(rArmMesh);
  torso.add(rightArm);

  // Legs (armored greaves)
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.28, -1.0, 0);
  const lLegMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 1.6, 8), armorMat);
  lLegMesh.position.y = -0.8;
  leftLeg.add(lLegMesh);
  torso.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.28, -1.0, 0);
  const rLegMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 1.6, 8), armorMat);
  rLegMesh.position.y = -0.8;
  rightLeg.add(rLegMesh);
  torso.add(rightLeg);

  // Floating Kinetic Sheath prop
  const sheathGroup = new THREE.Group();
  sheathGroup.position.set(-0.7, -0.4, 0.2);
  sheathGroup.rotation.z = -0.45;
  sheathGroup.rotation.y = 0.3;

  const bladeSheath = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.8, 0.08), armorMat);
  sheathGroup.add(bladeSheath);

  const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8), goldMat);
  hilt.position.y = 1.05;
  sheathGroup.add(hilt);

  const energyEdge = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.5, 0.03), glowMat);
  energyEdge.position.set(0.05, 0.1, 0);
  sheathGroup.add(energyEdge);

  torso.add(sheathGroup);
  root.add(torso);

  return {
    root,
    category: 'ANIME',
    name: 'Kaze-Blade',
    title: 'Tactical Cyber-Ronin',
    head,
    torso,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    specialProps: [sheathGroup, coatTails],
    setPose: (time, cursor) => {
      // Subtle rhythmic breathing idle
      const breath = Math.sin(time * 1.5) * 0.04;
      torso.position.y = breath;

      // Coat tails flutter softly
      coatTails.rotation.x = 0.12 + Math.sin(time * 2.2) * 0.08;

      // Floating sheath micro-hover
      sheathGroup.position.y = -0.4 + Math.cos(time * 1.8) * 0.05;

      // Head & Torso track cursor position smoothly
      head.rotation.y = cursor.x * 0.45;
      head.rotation.x = -cursor.y * 0.3;
      torso.rotation.y = cursor.x * 0.18;
      torso.rotation.x = -cursor.y * 0.08;

      // Arms ready pose
      rightArm.rotation.x = 0.2 + cursor.y * 0.2;
      rightArm.rotation.z = 0.15;
      leftArm.rotation.x = -0.15;
      leftArm.rotation.z = -0.2;
    },
    updateMaterials: (isDark) => {
      if (isDark) {
        coatMat.color.setHex(0x100f0e);
        armorMat.color.setHex(0x3a3835);
        glowMat.emissiveIntensity = 1.2;
      } else {
        coatMat.color.setHex(0x282622);
        armorMat.color.setHex(0xe5e1d8);
        glowMat.emissiveIntensity = 0.8;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// 3. SCI-FI SCOUT: "Nova Sentinel"
// Sleek orbital explorer, twin micro-thrusters, floating sensor halo.
// ---------------------------------------------------------------------------
export function createSciFiScout(): CharacterRig {
  const root = new THREE.Group();
  root.name = 'NovaSentinel';

  const chassisMat = new THREE.MeshStandardMaterial({
    color: 0x22262e,
    roughness: 0.2,
    metalness: 0.85,
  });
  const haloMat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4, // Cyan pulse
    emissive: 0x0891b2,
    emissiveIntensity: 1.0,
    roughness: 0.1,
  });

  const torso = new THREE.Group();
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.8, 2), chassisMat);
  torso.add(core);

  // Twin thruster pods
  const leftThruster = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.9, 10), chassisMat);
  leftThruster.position.set(-0.8, 0.1, -0.35);
  torso.add(leftThruster);

  const rightThruster = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.9, 10), chassisMat);
  rightThruster.position.set(0.8, 0.1, -0.35);
  torso.add(rightThruster);

  // Head unit
  const head = new THREE.Group();
  head.position.set(0, 0.85, 0.15);
  const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.6), chassisMat);
  head.add(headMesh);

  const eyeOptic = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 12), haloMat);
  eyeOptic.position.set(0, 0, 0.32);
  head.add(eyeOptic);
  torso.add(head);

  // Floating sensor halo ring
  const haloGeo = new THREE.TorusGeometry(0.9, 0.04, 8, 32);
  const halo = new THREE.Mesh(haloGeo, haloMat);
  halo.rotation.x = Math.PI / 2;
  halo.position.y = 0.95;
  head.add(halo);

  root.add(torso);

  return {
    root,
    category: 'SCIFI',
    name: 'Nova Sentinel',
    title: 'Orbital Recon Scout',
    head,
    torso,
    specialProps: [halo, leftThruster, rightThruster],
    setPose: (time, cursor) => {
      // Gentle levitation float
      torso.position.y = Math.sin(time * 1.8) * 0.15;
      torso.position.x = Math.cos(time * 1.2) * 0.08;

      // Halo spin
      halo.rotation.z = time * 1.2;
      halo.rotation.x = Math.PI / 2 + Math.sin(time * 2) * 0.1;

      // Look at cursor
      head.rotation.y = cursor.x * 0.5;
      head.rotation.x = -cursor.y * 0.4;
      torso.rotation.y = cursor.x * 0.25;
    },
    updateMaterials: (isDark) => {
      if (isDark) {
        chassisMat.color.setHex(0x13171e);
        haloMat.emissiveIntensity = 1.4;
      } else {
        chassisMat.color.setHex(0x353a45);
        haloMat.emissiveIntensity = 0.8;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// 4. CYBERPUNK OPERATIVE: "Neon Phantom"
// Asymmetrical tactical coat, holographic wrist projection.
// ---------------------------------------------------------------------------
export function createCyberpunkRogue(): CharacterRig {
  const root = new THREE.Group();
  root.name = 'NeonPhantom';

  const leatherMat = new THREE.MeshStandardMaterial({
    color: 0x1f1d1a,
    roughness: 0.5,
    metalness: 0.3,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0x8a857d,
    roughness: 0.15,
    metalness: 0.9,
  });
  const neonMat = new THREE.MeshStandardMaterial({
    color: 0xff5039,
    emissive: 0xff3b24,
    emissiveIntensity: 0.9,
    roughness: 0.2,
  });

  const torso = new THREE.Group();
  const jacket = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.35, 0.65), leatherMat);
  torso.add(jacket);

  // Asymmetrical cybernetic arm on right
  const rightArm = new THREE.Group();
  rightArm.position.set(0.7, 0.5, 0);
  const rBicep = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.15, 0.7, 10), chromeMat);
  rBicep.position.y = -0.38;
  rightArm.add(rBicep);
  const rForearm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.7, 0.3), chromeMat);
  rForearm.position.y = -0.9;
  rightArm.add(rForearm);

  // Holographic projection disk
  const holoDisk = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.45, 16), neonMat);
  holoDisk.position.set(0, -1.2, 0.2);
  holoDisk.rotation.x = -Math.PI / 2;
  rightArm.add(holoDisk);
  torso.add(rightArm);

  // Left Arm (regular leather)
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.7, 0.5, 0);
  const lArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 1.1, 8), leatherMat);
  lArmMesh.position.y = -0.55;
  leftArm.add(lArmMesh);
  torso.add(leftArm);

  // Head with cyber-visor
  const head = new THREE.Group();
  head.position.set(0, 1.05, 0);
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 14), leatherMat);
  head.add(headMesh);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.16, 0.25), neonMat);
  visor.position.set(0, 0.05, 0.35);
  head.add(visor);
  torso.add(head);

  root.add(torso);

  return {
    root,
    category: 'CYBERPUNK',
    name: 'Neon Phantom',
    title: 'Covert Cyber Operative',
    head,
    torso,
    leftArm,
    rightArm,
    specialProps: [holoDisk],
    setPose: (time, cursor) => {
      torso.position.y = Math.sin(time * 1.6) * 0.03;
      holoDisk.rotation.z = time * 2.0;

      // Interactive arm raise toward cursor
      rightArm.rotation.x = -0.4 + cursor.y * 0.3;
      rightArm.rotation.y = -0.3 + cursor.x * 0.4;
      head.rotation.y = cursor.x * 0.4;
      head.rotation.x = -cursor.y * 0.3;
    },
    updateMaterials: (isDark) => {
      if (isDark) {
        leatherMat.color.setHex(0x141210);
        neonMat.emissiveIntensity = 1.3;
      } else {
        leatherMat.color.setHex(0x2e2b26);
        neonMat.emissiveIntensity = 0.8;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// 5. FANTASY MYSTIC: "Aether Mystic"
// Flowing runic mantle, concentric hovering glyph rings.
// ---------------------------------------------------------------------------
export function createFantasyMystic(): CharacterRig {
  const root = new THREE.Group();
  root.name = 'AetherMystic';

  const robeMat = new THREE.MeshStandardMaterial({
    color: 0x221f28,
    roughness: 0.7,
  });
  const runeMat = new THREE.MeshStandardMaterial({
    color: 0xa855f7, // Mystic purple
    emissive: 0x9333ea,
    emissiveIntensity: 0.9,
    roughness: 0.2,
  });

  const torso = new THREE.Group();
  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.85, 2.2, 12), robeMat);
  robe.position.y = -0.5;
  torso.add(robe);

  const head = new THREE.Group();
  head.position.set(0, 0.9, 0);
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.48, 12, 12), robeMat);
  head.add(hood);

  // Hidden face glowing rune
  const eyeRune = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), runeMat);
  eyeRune.position.set(0, 0, 0.28);
  head.add(eyeRune);
  torso.add(head);

  // Concentric floating runic rings
  const outerRing = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.035, 6, 24), runeMat);
  outerRing.rotation.x = Math.PI / 3;
  torso.add(outerRing);

  const innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.03, 6, 24), runeMat);
  innerRing.rotation.y = Math.PI / 4;
  torso.add(innerRing);

  root.add(torso);

  return {
    root,
    category: 'FANTASY',
    name: 'Aether Mystic',
    title: 'Runic Horizon Weft',
    head,
    torso,
    specialProps: [outerRing, innerRing],
    setPose: (time, cursor) => {
      torso.position.y = Math.sin(time * 1.4) * 0.12;
      outerRing.rotation.z = time * 0.8;
      innerRing.rotation.x = -time * 1.1;
      head.rotation.y = cursor.x * 0.35;
      head.rotation.x = -cursor.y * 0.25;
    },
    updateMaterials: (isDark) => {
      if (isDark) {
        robeMat.color.setHex(0x16131c);
        runeMat.emissiveIntensity = 1.3;
      } else {
        robeMat.color.setHex(0x35313d);
        runeMat.emissiveIntensity = 0.8;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// 6. MECHA ACE: "Mecha Ace"
// Angular wing binders, glowing chest reactor.
// ---------------------------------------------------------------------------
export function createMechaAce(): CharacterRig {
  const root = new THREE.Group();
  root.name = 'MechaAce';

  const armorMat = new THREE.MeshStandardMaterial({
    color: 0xd8dbe0,
    roughness: 0.2,
    metalness: 0.85,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x1a1c22,
    roughness: 0.4,
    metalness: 0.7,
  });
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x10b981, // Emerald reactor
    emissive: 0x059669,
    emissiveIntensity: 1.1,
    roughness: 0.1,
  });

  const torso = new THREE.Group();
  const chest = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.3, 0.8), armorMat);
  torso.add(chest);

  const reactor = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.1, 12), coreMat);
  reactor.rotation.x = Math.PI / 2;
  reactor.position.set(0, 0.1, 0.42);
  torso.add(reactor);

  // Angular Wing Binders
  const leftWing = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 0.6), darkMat);
  leftWing.position.set(-1.0, 0.6, -0.4);
  leftWing.rotation.z = -0.4;
  torso.add(leftWing);

  const rightWing = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 0.6), darkMat);
  rightWing.position.set(1.0, 0.6, -0.4);
  rightWing.rotation.z = 0.4;
  torso.add(rightWing);

  // Helmet
  const head = new THREE.Group();
  head.position.set(0, 1.05, 0);
  const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.6, 0.65), armorMat);
  head.add(helmet);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.15, 0.1), coreMat);
  visor.position.set(0, 0.05, 0.35);
  head.add(visor);
  torso.add(head);

  root.add(torso);

  return {
    root,
    category: 'MECHA',
    name: 'Mecha Ace',
    title: 'Orbital Strike Armament',
    head,
    torso,
    specialProps: [leftWing, rightWing, reactor],
    setPose: (time, cursor) => {
      torso.position.y = Math.sin(time * 2.0) * 0.08;
      leftWing.rotation.y = Math.sin(time * 1.5) * 0.1;
      rightWing.rotation.y = -Math.sin(time * 1.5) * 0.1;
      head.rotation.y = cursor.x * 0.35;
      head.rotation.x = -cursor.y * 0.3;
    },
    updateMaterials: (isDark) => {
      if (isDark) {
        armorMat.color.setHex(0x282b33);
        coreMat.emissiveIntensity = 1.4;
      } else {
        armorMat.color.setHex(0xe8ebf0);
        coreMat.emissiveIntensity = 0.85;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// STYLIZED GRAPPLING / WEB LINE GENERATOR
// Smooth dynamic curve rendered with cylindrical mesh between anchor & wrist
// ---------------------------------------------------------------------------
export function createGrappleLine(
  startPos: THREE.Vector3,
  endPos: THREE.Vector3,
  slack: number = 0
): THREE.Mesh {
  const midPoint = new THREE.Vector3().addVectors(startPos, endPos).multiplyScalar(0.5);
  // Add natural gravity / dynamic tension sag
  midPoint.y -= slack;

  const curve = new THREE.QuadraticBezierCurve3(startPos, midPoint, endPos);
  const lineGeo = new THREE.TubeGeometry(curve, 18, 0.025, 6, false);
  const lineMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.65,
    roughness: 0.3,
    metalness: 0.5,
  });

  return new THREE.Mesh(lineGeo, lineMat);
}
