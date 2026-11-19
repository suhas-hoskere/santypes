// Santypes Procedural 3D Model Factory
// Generates recognizable, lightweight, high-fidelity 3D assets for robots, rockets, arrows, siege mechs, and drones
// 100% Procedural Three.js geometry — 0 external GLTF weight, 60fps smooth, full PBR materials

import * as THREE from 'three';

export interface ModelAnimationHandle {
  group: THREE.Group;
  update?: (delta: number, elapsed: number) => void;
  dispose: () => void;
}

/**
 * Creates an unmistakable 3D Bipedal Combat Robot with articulated limbs,
 * glowing sensor visor, chest power core, shoulder pauldrons, pulse rifle, and mecha boots.
 */
export function buildCombatRobot(options: {
  primaryColor?: number;
  accentColor?: number;
  glowColor?: number;
  scale?: number;
  weaponType?: 'rifle' | 'dualBlasters' | 'blade';
} = {}): ModelAnimationHandle {
  const group = new THREE.Group();
  const scale = options.scale ?? 1.0;
  const primHex = options.primaryColor ?? 0x334155;
  const accentHex = options.accentColor ?? 0xe11d48;
  const glowHex = options.glowColor ?? 0x00f0ff;

  const armorMat = new THREE.MeshStandardMaterial({
    color: primHex,
    metalness: 0.85,
    roughness: 0.25,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    metalness: 0.75,
    roughness: 0.3,
  });

  const darkJointMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.9,
    roughness: 0.2,
  });

  const glowMat = new THREE.MeshBasicMaterial({ color: glowHex });

  // --- 1. HEAD & SENSORS ---
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 2.1 * scale, 0);

  // Angular Head Chassis
  const headGeo = new THREE.BoxGeometry(0.55 * scale, 0.48 * scale, 0.58 * scale);
  const headMesh = new THREE.Mesh(headGeo, armorMat);
  headGroup.add(headMesh);

  // Brow Overhang
  const browGeo = new THREE.BoxGeometry(0.62 * scale, 0.12 * scale, 0.65 * scale);
  const browMesh = new THREE.Mesh(browGeo, accentMat);
  browMesh.position.set(0, 0.2 * scale, 0.04 * scale);
  headGroup.add(browMesh);

  // Glowing Horizontal Optic Visor (Eye of the Robot)
  const visorGeo = new THREE.BoxGeometry(0.48 * scale, 0.14 * scale, 0.12 * scale);
  const visorMesh = new THREE.Mesh(visorGeo, glowMat);
  visorMesh.position.set(0, 0.02 * scale, 0.28 * scale);
  headGroup.add(visorMesh);

  // Twin Side Ear Antennae / Comms Sensor Rods
  [-0.32, 0.32].forEach((xPos) => {
    const antGeo = new THREE.CylinderGeometry(0.025 * scale, 0.04 * scale, 0.45 * scale, 6);
    const ant = new THREE.Mesh(antGeo, darkJointMat);
    ant.position.set(xPos * scale, 0.25 * scale, -0.05 * scale);
    ant.rotation.z = xPos > 0 ? -0.35 : 0.35;
    headGroup.add(ant);
  });

  group.add(headGroup);

  // --- 2. NECK ACTUATOR ---
  const neckGeo = new THREE.CylinderGeometry(0.18 * scale, 0.22 * scale, 0.25 * scale, 8);
  const neck = new THREE.Mesh(neckGeo, darkJointMat);
  neck.position.set(0, 1.82 * scale, 0);
  group.add(neck);

  // --- 3. TORSO & POWER CORE ---
  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, 1.25 * scale, 0);

  // Heavy Upper Chest Armor
  const chestGeo = new THREE.BoxGeometry(1.2 * scale, 0.95 * scale, 0.85 * scale);
  const chestMesh = new THREE.Mesh(chestGeo, armorMat);
  torsoGroup.add(chestMesh);

  // Pectoral Plate Reinforcement
  const pectGeo = new THREE.BoxGeometry(1.0 * scale, 0.5 * scale, 0.2 * scale);
  const pectMesh = new THREE.Mesh(pectGeo, accentMat);
  pectMesh.position.set(0, 0.12 * scale, 0.42 * scale);
  torsoGroup.add(pectMesh);

  // Recessed Glowing Arc Reactor Power Core
  const coreGeo = new THREE.CylinderGeometry(0.16 * scale, 0.16 * scale, 0.15 * scale, 12);
  coreGeo.rotateX(Math.PI / 2);
  const coreMesh = new THREE.Mesh(coreGeo, glowMat);
  coreMesh.position.set(0, 0.1 * scale, 0.48 * scale);
  torsoGroup.add(coreMesh);

  // Backpack Battery Thrusters
  const packGeo = new THREE.BoxGeometry(0.85 * scale, 0.8 * scale, 0.4 * scale);
  const pack = new THREE.Mesh(packGeo, darkJointMat);
  pack.position.set(0, 0.05 * scale, -0.52 * scale);
  torsoGroup.add(pack);

  [-0.26, 0.26].forEach((xP) => {
    const ventGeo = new THREE.CylinderGeometry(0.08 * scale, 0.12 * scale, 0.25 * scale, 8);
    const vent = new THREE.Mesh(ventGeo, glowMat);
    vent.position.set(xP * scale, -0.35 * scale, -0.55 * scale);
    torsoGroup.add(vent);
  });

  group.add(torsoGroup);

  // --- 4. WAIST & PELVIS ---
  const waistGeo = new THREE.CylinderGeometry(0.3 * scale, 0.38 * scale, 0.35 * scale, 8);
  const waist = new THREE.Mesh(waistGeo, darkJointMat);
  waist.position.set(0, 0.65 * scale, 0);
  group.add(waist);

  const pelvisGeo = new THREE.BoxGeometry(0.85 * scale, 0.35 * scale, 0.65 * scale);
  const pelvis = new THREE.Mesh(pelvisGeo, armorMat);
  pelvis.position.set(0, 0.42 * scale, 0);
  group.add(pelvis);

  // --- 5. SHOULDERS & ARMS ---
  const leftArmGroup = new THREE.Group();
  const rightArmGroup = new THREE.Group();
  leftArmGroup.position.set(-0.75 * scale, 1.55 * scale, 0);
  rightArmGroup.position.set(0.75 * scale, 1.55 * scale, 0);

  [-1, 1].forEach((side) => {
    const armParent = side === -1 ? leftArmGroup : rightArmGroup;

    // Curved Pauldron Shoulder Pad
    const pauldronGeo = new THREE.BoxGeometry(0.48 * scale, 0.38 * scale, 0.58 * scale);
    const pauldron = new THREE.Mesh(pauldronGeo, accentMat);
    pauldron.position.set(side * 0.08 * scale, 0, 0);
    pauldron.rotation.z = side * -0.22;
    armParent.add(pauldron);

    // Upper Bicep Strut
    const bicepGeo = new THREE.BoxGeometry(0.24 * scale, 0.55 * scale, 0.28 * scale);
    const bicep = new THREE.Mesh(bicepGeo, darkJointMat);
    bicep.position.set(side * 0.04 * scale, -0.38 * scale, 0);
    armParent.add(bicep);

    // Elbow Servo
    const elbowGeo = new THREE.SphereGeometry(0.14 * scale, 8, 8);
    const elbow = new THREE.Mesh(elbowGeo, armorMat);
    elbow.position.set(side * 0.04 * scale, -0.68 * scale, 0);
    armParent.add(elbow);

    // Forearm Armored Gauntlet
    const foreGeo = new THREE.BoxGeometry(0.28 * scale, 0.65 * scale, 0.34 * scale);
    const fore = new THREE.Mesh(foreGeo, armorMat);
    fore.position.set(side * 0.04 * scale, -1.02 * scale, 0.1 * scale);
    armParent.add(fore);
  });

  // Weapon: Futuristic Cyber Pulse Rifle
  const rifleGroup = new THREE.Group();
  const receiverGeo = new THREE.BoxGeometry(0.22 * scale, 0.32 * scale, 1.1 * scale);
  const receiver = new THREE.Mesh(receiverGeo, darkJointMat);
  rifleGroup.add(receiver);

  const barrelGeo = new THREE.CylinderGeometry(0.06 * scale, 0.06 * scale, 0.95 * scale, 8);
  barrelGeo.rotateX(Math.PI / 2);
  const barrel = new THREE.Mesh(barrelGeo, armorMat);
  barrel.position.set(0, 0.04 * scale, 0.95 * scale);
  rifleGroup.add(barrel);

  const muzzleGeo = new THREE.CylinderGeometry(0.09 * scale, 0.09 * scale, 0.22 * scale, 8);
  muzzleGeo.rotateX(Math.PI / 2);
  const muzzle = new THREE.Mesh(muzzleGeo, glowMat);
  muzzle.position.set(0, 0.04 * scale, 1.45 * scale);
  rifleGroup.add(muzzle);

  rifleGroup.position.set(0.35 * scale, 0.55 * scale, 0.45 * scale);
  group.add(rifleGroup);

  group.add(leftArmGroup);
  group.add(rightArmGroup);

  // --- 6. LEGS & MECHA BOOTS ---
  const leftLegGroup = new THREE.Group();
  const rightLegGroup = new THREE.Group();
  leftLegGroup.position.set(-0.38 * scale, 0.35 * scale, 0);
  rightLegGroup.position.set(0.38 * scale, 0.35 * scale, 0);

  [-1, 1].forEach((side) => {
    const legParent = side === -1 ? leftLegGroup : rightLegGroup;

    // Thigh
    const thighGeo = new THREE.BoxGeometry(0.34 * scale, 0.72 * scale, 0.42 * scale);
    const thigh = new THREE.Mesh(thighGeo, darkJointMat);
    thigh.position.set(0, -0.38 * scale, 0);
    legParent.add(thigh);

    // Spiked Knee Armor Guard
    const kneeGeo = new THREE.BoxGeometry(0.38 * scale, 0.32 * scale, 0.3 * scale);
    const knee = new THREE.Mesh(kneeGeo, accentMat);
    knee.position.set(0, -0.74 * scale, 0.18 * scale);
    legParent.add(knee);

    // Lower Shin Greave
    const shinGeo = new THREE.BoxGeometry(0.36 * scale, 0.82 * scale, 0.46 * scale);
    const shin = new THREE.Mesh(shinGeo, armorMat);
    shin.position.set(0, -1.15 * scale, 0.02 * scale);
    legParent.add(shin);

    // Articulated Mecha Boot & Sole
    const bootGeo = new THREE.BoxGeometry(0.44 * scale, 0.28 * scale, 0.85 * scale);
    const boot = new THREE.Mesh(bootGeo, darkJointMat);
    boot.position.set(0, -1.62 * scale, 0.15 * scale);
    legParent.add(boot);

    const toeGeo = new THREE.BoxGeometry(0.4 * scale, 0.18 * scale, 0.32 * scale);
    const toe = new THREE.Mesh(toeGeo, accentMat);
    toe.position.set(0, -1.67 * scale, 0.52 * scale);
    legParent.add(toe);
  });

  group.add(leftLegGroup);
  group.add(rightLegGroup);

  return {
    group,
    update: (_delta: number, elapsed: number) => {
      // Natural humanoid robot walking stride animation
      const walkCycle = Math.sin(elapsed * 4.2);
      leftLegGroup.rotation.x = walkCycle * 0.45;
      rightLegGroup.rotation.x = -walkCycle * 0.45;

      leftArmGroup.rotation.x = -walkCycle * 0.35;
      rightArmGroup.rotation.x = walkCycle * 0.2;

      torsoGroup.position.y = (1.25 + Math.abs(Math.sin(elapsed * 8.4)) * 0.06) * scale;
      headGroup.rotation.y = Math.sin(elapsed * 1.8) * 0.12;
    },
    dispose: () => {
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    },
  };
}

/**
 * Creates an unmistakable 3D High-Velocity Combat Rocket / Missile with
 * aerodynamic ogive nosecone, cylindrical propellant body, 4 cruciform stabilizer tail fins,
 * rocket exhaust nozzle, and glowing thruster fire.
 */
export function buildCombatRocket(options: {
  scale?: number;
  bodyColor?: number;
  finColor?: number;
  exhaustColor?: number;
} = {}): ModelAnimationHandle {
  const group = new THREE.Group();
  const scale = options.scale ?? 1.0;
  const bodyHex = options.bodyColor ?? 0xf1f5f9;
  const finHex = options.finColor ?? 0xe11d48;
  const fireHex = options.exhaustColor ?? 0xff5500;

  const bodyMat = new THREE.MeshStandardMaterial({
    color: bodyHex,
    metalness: 0.8,
    roughness: 0.2,
  });

  const finMat = new THREE.MeshStandardMaterial({
    color: finHex,
    metalness: 0.85,
    roughness: 0.25,
  });

  const nozzleMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.95,
    roughness: 0.15,
  });

  const flameMat = new THREE.MeshBasicMaterial({
    color: fireHex,
    transparent: true,
    opacity: 0.85,
  });

  const innerFlameMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.95,
  });

  // 1. Pointed Ogive Warhead Nosecone
  const noseGeo = new THREE.ConeGeometry(0.18 * scale, 0.68 * scale, 16);
  noseGeo.rotateX(Math.PI / 2);
  const noseMesh = new THREE.Mesh(noseGeo, finMat);
  noseMesh.position.set(0, 0, 1.15 * scale);
  group.add(noseMesh);

  // Radome Seeker Tip
  const tipGeo = new THREE.SphereGeometry(0.06 * scale, 8, 8);
  const tipMesh = new THREE.Mesh(tipGeo, nozzleMat);
  tipMesh.position.set(0, 0, 1.5 * scale);
  group.add(tipMesh);

  // 2. Main Cylindrical Rocket Fuselage
  const bodyGeo = new THREE.CylinderGeometry(0.18 * scale, 0.18 * scale, 1.65 * scale, 16);
  bodyGeo.rotateX(Math.PI / 2);
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.position.set(0, 0, 0.15 * scale);
  group.add(bodyMesh);

  // Decal Band / Hazard Stripe on Fuselage
  const stripeGeo = new THREE.CylinderGeometry(0.184 * scale, 0.184 * scale, 0.28 * scale, 16);
  stripeGeo.rotateX(Math.PI / 2);
  const stripeMesh = new THREE.Mesh(stripeGeo, finMat);
  stripeMesh.position.set(0, 0, 0.65 * scale);
  group.add(stripeMesh);

  // 3. Four Cruciform Stabilizer Tail Fins
  for (let f = 0; f < 4; f++) {
    const finAngle = (f * Math.PI) / 2;
    // Swept Trapezoidal Fin
    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0);
    finShape.lineTo(0.42 * scale, -0.25 * scale);
    finShape.lineTo(0.38 * scale, -0.65 * scale);
    finShape.lineTo(0, -0.55 * scale);
    finShape.closePath();

    const extrudeSettings = { depth: 0.025 * scale, bevelEnabled: false };
    const finGeo = new THREE.ExtrudeGeometry(finShape, extrudeSettings);
    const finMesh = new THREE.Mesh(finGeo, finMat);

    finMesh.rotation.y = Math.PI / 2;
    finMesh.rotation.z = finAngle;
    finMesh.position.set(0, 0, -0.35 * scale);
    group.add(finMesh);
  }

  // 4. Rocket Engine Nozzle Bell
  const nozzleGeo = new THREE.CylinderGeometry(0.12 * scale, 0.18 * scale, 0.35 * scale, 12);
  nozzleGeo.rotateX(Math.PI / 2);
  const nozzleMesh = new THREE.Mesh(nozzleGeo, nozzleMat);
  nozzleMesh.position.set(0, 0, -0.82 * scale);
  group.add(nozzleMesh);

  // 5. Blazing Rocket Exhaust Plume
  const flameGeo = new THREE.ConeGeometry(0.16 * scale, 0.95 * scale, 8);
  flameGeo.rotateX(-Math.PI / 2);
  const flameMesh = new THREE.Mesh(flameGeo, flameMat);
  flameMesh.position.set(0, 0, -1.45 * scale);
  group.add(flameMesh);

  const innerFlameGeo = new THREE.ConeGeometry(0.08 * scale, 0.55 * scale, 8);
  innerFlameGeo.rotateX(-Math.PI / 2);
  const innerFlameMesh = new THREE.Mesh(innerFlameGeo, innerFlameMat);
  innerFlameMesh.position.set(0, 0, -1.25 * scale);
  group.add(innerFlameMesh);

  return {
    group,
    update: (_delta: number, elapsed: number) => {
      // Rocket axial roll & thruster flame flicker
      group.rotation.z += 0.08;
      const flicker = 1.0 + Math.sin(elapsed * 35) * 0.18;
      flameMesh.scale.set(flicker, flicker, flicker * 1.1);
    },
    dispose: () => {
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    },
  };
}

/**
 * Creates an unmistakable 3D Razor Piercing Arrow / Energy Bolt with
 * barbed triangular arrowhead, slender shaft, and 3-vaned feather fletching tail.
 */
export function buildPiercingArrow(options: {
  scale?: number;
  tipColor?: number;
  shaftColor?: number;
  fletchColor?: number;
} = {}): ModelAnimationHandle {
  const group = new THREE.Group();
  const scale = options.scale ?? 1.0;
  const tipHex = options.tipColor ?? 0x38bdf8;
  const shaftHex = options.shaftColor ?? 0x334155;
  const fletchHex = options.fletchColor ?? 0x0284c7;

  const tipMat = new THREE.MeshBasicMaterial({ color: tipHex });
  const shaftMat = new THREE.MeshStandardMaterial({
    color: shaftHex,
    metalness: 0.9,
    roughness: 0.2,
  });
  const fletchMat = new THREE.MeshStandardMaterial({
    color: fletchHex,
    metalness: 0.6,
    roughness: 0.4,
    side: THREE.DoubleSide,
  });

  // 1. Razor Broadhead Arrow Tip (Barbed Triangular Blade)
  const tipShape = new THREE.Shape();
  tipShape.moveTo(0, 0.42 * scale);
  tipShape.lineTo(0.18 * scale, -0.15 * scale);
  tipShape.lineTo(0.08 * scale, -0.05 * scale);
  tipShape.lineTo(-0.08 * scale, -0.05 * scale);
  tipShape.lineTo(-0.18 * scale, -0.15 * scale);
  tipShape.closePath();

  const tipGeo = new THREE.ExtrudeGeometry(tipShape, { depth: 0.02 * scale, bevelEnabled: false });
  tipGeo.rotateX(-Math.PI / 2);
  const tipMesh = new THREE.Mesh(tipGeo, tipMat);
  tipMesh.position.set(0, 0, 1.25 * scale);
  group.add(tipMesh);

  // 2. Slender Carbon Shaft
  const shaftGeo = new THREE.CylinderGeometry(0.035 * scale, 0.035 * scale, 2.4 * scale, 8);
  shaftGeo.rotateX(Math.PI / 2);
  const shaftMesh = new THREE.Mesh(shaftGeo, shaftMat);
  shaftMesh.position.set(0, 0, 0);
  group.add(shaftMesh);

  // 3. Three-Vane Parabolic Fletching (120° apart)
  for (let i = 0; i < 3; i++) {
    const angle = (i * Math.PI * 2) / 3;
    const fletchShape = new THREE.Shape();
    fletchShape.moveTo(0, 0);
    fletchShape.lineTo(0.16 * scale, 0.1 * scale);
    fletchShape.lineTo(0.15 * scale, 0.55 * scale);
    fletchShape.lineTo(0, 0.65 * scale);
    fletchShape.closePath();

    const fletchGeo = new THREE.ShapeGeometry(fletchShape);
    fletchGeo.rotateX(Math.PI / 2);
    const fletchMesh = new THREE.Mesh(fletchGeo, fletchMat);
    fletchMesh.rotation.z = angle;
    fletchMesh.position.set(0, 0, -1.18 * scale);
    group.add(fletchMesh);
  }

  // 4. Rear Nock
  const nockGeo = new THREE.CylinderGeometry(0.038 * scale, 0.03 * scale, 0.18 * scale, 8);
  nockGeo.rotateX(Math.PI / 2);
  const nockMesh = new THREE.Mesh(nockGeo, tipMat);
  nockMesh.position.set(0, 0, -1.26 * scale);
  group.add(nockMesh);

  return {
    group,
    update: (_delta: number, _elapsed: number) => {
      group.rotation.z += 0.12;
    },
    dispose: () => {
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    },
  };
}

/**
 * Creates an unmistakable Heavy Armored Goliath Siege Mech / Battle Tank with
 * dual heavy caterpillar tracks, rotating sloped turret, twin heavy rail cannon barrels,
 * and glowing reactor core.
 */
export function buildGoliathSiegeTank(options: {
  scale?: number;
  armorColor?: number;
  glowColor?: number;
} = {}): ModelAnimationHandle {
  const group = new THREE.Group();
  const scale = options.scale ?? 1.0;
  const armorHex = options.armorColor ?? 0x334155;
  const glowHex = options.glowColor ?? 0xa855f7;

  const armorMat = new THREE.MeshStandardMaterial({
    color: armorHex,
    metalness: 0.9,
    roughness: 0.2,
  });

  const treadMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.95,
    roughness: 0.35,
  });

  const hazardMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.7,
    roughness: 0.3,
  });

  const glowMat = new THREE.MeshBasicMaterial({ color: glowHex });

  // 1. Dual Heavy Caterpillar Tread Units
  [-1.25, 1.25].forEach((tx) => {
    const treadUnit = new THREE.Group();
    treadUnit.position.set(tx * scale, 0.45 * scale, 0);

    const treadBeltGeo = new THREE.BoxGeometry(0.75 * scale, 0.85 * scale, 4.4 * scale);
    const treadBelt = new THREE.Mesh(treadBeltGeo, treadMat);
    treadUnit.add(treadBelt);

    // Tread Wheels
    for (let w = -1.8; w <= 1.8; w += 0.72) {
      const wheelGeo = new THREE.CylinderGeometry(0.38 * scale, 0.38 * scale, 0.78 * scale, 12);
      wheelGeo.rotateZ(Math.PI / 2);
      const wheel = new THREE.Mesh(wheelGeo, armorMat);
      wheel.position.set(0, -0.05 * scale, w * scale);
      treadUnit.add(wheel);
    }

    // Armored Mudguards
    const guardGeo = new THREE.BoxGeometry(0.85 * scale, 0.18 * scale, 4.6 * scale);
    const guard = new THREE.Mesh(guardGeo, armorMat);
    guard.position.set(0, 0.45 * scale, 0);
    treadUnit.add(guard);

    group.add(treadUnit);
  });

  // 2. Main Tank Chassis Hull
  const hullGeo = new THREE.BoxGeometry(2.0 * scale, 0.95 * scale, 3.8 * scale);
  const hull = new THREE.Mesh(hullGeo, armorMat);
  hull.position.set(0, 0.8 * scale, 0);
  group.add(hull);

  // Front Heavy Bulldozer / Ram Blade
  const ramGeo = new THREE.BoxGeometry(3.1 * scale, 0.75 * scale, 0.35 * scale);
  const ram = new THREE.Mesh(ramGeo, hazardMat);
  ram.position.set(0, 0.45 * scale, 2.05 * scale);
  group.add(ram);

  // 3. Rotating Fortress Heavy Turret
  const turretGroup = new THREE.Group();
  turretGroup.position.set(0, 1.45 * scale, -0.2 * scale);

  const turretBaseGeo = new THREE.CylinderGeometry(1.1 * scale, 1.25 * scale, 0.45 * scale, 16);
  const turretBase = new THREE.Mesh(turretBaseGeo, treadMat);
  turretGroup.add(turretBase);

  const turretHullGeo = new THREE.BoxGeometry(2.2 * scale, 0.9 * scale, 2.5 * scale);
  const turretHull = new THREE.Mesh(turretHullGeo, armorMat);
  turretHull.position.set(0, 0.5 * scale, 0);
  turretGroup.add(turretHull);

  // Turret Sloped Armor Cheeks
  [-1.0, 1.0].forEach((side) => {
    const cheekGeo = new THREE.BoxGeometry(0.35 * scale, 0.75 * scale, 1.8 * scale);
    const cheek = new THREE.Mesh(cheekGeo, hazardMat);
    cheek.position.set(side * 1.15 * scale, 0.45 * scale, 0.1 * scale);
    cheek.rotation.y = side * 0.18;
    turretGroup.add(cheek);
  });

  // Twin Long Heavy Railgun Barrels
  [-0.45, 0.45].forEach((bx) => {
    const barrelGeo = new THREE.CylinderGeometry(0.14 * scale, 0.18 * scale, 3.4 * scale, 12);
    barrelGeo.rotateX(Math.PI / 2);
    const barrel = new THREE.Mesh(barrelGeo, treadMat);
    barrel.position.set(bx * scale, 0.5 * scale, 2.4 * scale);
    turretGroup.add(barrel);

    // Slotted Muzzle Brakes
    const muzzleGeo = new THREE.BoxGeometry(0.38 * scale, 0.38 * scale, 0.45 * scale);
    const muzzle = new THREE.Mesh(muzzleGeo, glowMat);
    muzzle.position.set(bx * scale, 0.5 * scale, 4.15 * scale);
    turretGroup.add(muzzle);
  });

  // Top Commander Cupola & Radar Dish
  const cupolaGeo = new THREE.CylinderGeometry(0.35 * scale, 0.4 * scale, 0.35 * scale, 12);
  const cupola = new THREE.Mesh(cupolaGeo, armorMat);
  cupola.position.set(-0.55 * scale, 1.1 * scale, -0.35 * scale);
  turretGroup.add(cupola);

  const radarGeo = new THREE.SphereGeometry(0.4 * scale, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  radarGeo.rotateX(-0.4);
  const radar = new THREE.Mesh(radarGeo, glowMat);
  radar.position.set(0.55 * scale, 1.25 * scale, -0.45 * scale);
  turretGroup.add(radar);

  // Glowing Plasma Reactor Exhaust on Rear
  const reactorGeo = new THREE.SphereGeometry(0.35 * scale, 12, 12);
  const reactor = new THREE.Mesh(reactorGeo, glowMat);
  reactor.position.set(0, 0.5 * scale, -1.35 * scale);
  turretGroup.add(reactor);

  group.add(turretGroup);

  return {
    group,
    update: (_delta: number, elapsed: number) => {
      // Slow ominous turret sweep and radar rotation
      turretGroup.rotation.y = Math.sin(elapsed * 0.8) * 0.22;
      radar.rotation.y += 0.05;
    },
    dispose: () => {
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    },
  };
}

/**
 * Creates an unmistakable 3D High-Tech Aerial Predator Drone with
 * swept delta wings, ducted VTOL fans, nose sensor ball, and jet thruster exhaust.
 */
export function buildAerialPredatorDrone(options: {
  scale?: number;
  bodyColor?: number;
  glowColor?: number;
} = {}): ModelAnimationHandle {
  const group = new THREE.Group();
  const scale = options.scale ?? 1.0;
  const bodyHex = options.bodyColor ?? 0x1e293b;
  const glowHex = options.glowColor ?? 0x38bdf8;

  const bodyMat = new THREE.MeshStandardMaterial({
    color: bodyHex,
    metalness: 0.9,
    roughness: 0.22,
  });

  const glowMat = new THREE.MeshBasicMaterial({ color: glowHex });

  // 1. Tapered Stealth Fuselage
  const fuseGeo = new THREE.BoxGeometry(0.85 * scale, 0.38 * scale, 2.6 * scale);
  const fuse = new THREE.Mesh(fuseGeo, bodyMat);
  group.add(fuse);

  // Sloped Nose Canopy
  const noseGeo = new THREE.ConeGeometry(0.42 * scale, 1.1 * scale, 4);
  noseGeo.rotateX(Math.PI / 2);
  const nose = new THREE.Mesh(noseGeo, bodyMat);
  nose.position.set(0, 0, 1.8 * scale);
  group.add(nose);

  // Forward Multi-Spectrum Optic Sensor Ball
  const opticGeo = new THREE.SphereGeometry(0.18 * scale, 12, 12);
  const optic = new THREE.Mesh(opticGeo, glowMat);
  optic.position.set(0, -0.15 * scale, 1.7 * scale);
  group.add(optic);

  // 2. Swept Delta Wings with Wingtip Winglets
  [-1, 1].forEach((side) => {
    const wingGeo = new THREE.BoxGeometry(1.8 * scale, 0.06 * scale, 0.95 * scale);
    const wing = new THREE.Mesh(wingGeo, bodyMat);
    wing.position.set(side * 1.25 * scale, 0.05 * scale, -0.15 * scale);
    wing.rotation.y = side * -0.35;
    group.add(wing);

    // Ducted VTOL Rotor Ring Cowl
    const cowlGeo = new THREE.TorusGeometry(0.38 * scale, 0.06 * scale, 8, 16);
    cowlGeo.rotateX(Math.PI / 2);
    const cowl = new THREE.Mesh(cowlGeo, bodyMat);
    cowl.position.set(side * 1.65 * scale, 0.08 * scale, -0.25 * scale);
    group.add(cowl);

    const fanHubGeo = new THREE.CylinderGeometry(0.16 * scale, 0.16 * scale, 0.08 * scale, 12);
    const fanHub = new THREE.Mesh(fanHubGeo, glowMat);
    fanHub.position.set(side * 1.65 * scale, 0.08 * scale, -0.25 * scale);
    group.add(fanHub);

    // Underslung Micro-Missile
    const missileGeo = new THREE.CylinderGeometry(0.06 * scale, 0.06 * scale, 0.7 * scale, 8);
    missileGeo.rotateX(Math.PI / 2);
    const missile = new THREE.Mesh(missileGeo, glowMat);
    missile.position.set(side * 0.95 * scale, -0.18 * scale, 0.1 * scale);
    group.add(missile);
  });

  // 3. Rear Jet Engine Exhaust Thruster
  const exhaustGeo = new THREE.CylinderGeometry(0.22 * scale, 0.28 * scale, 0.45 * scale, 12);
  exhaustGeo.rotateX(Math.PI / 2);
  const exhaust = new THREE.Mesh(exhaustGeo, glowMat);
  exhaust.position.set(0, 0.05 * scale, -1.45 * scale);
  group.add(exhaust);

  return {
    group,
    update: (_delta: number, elapsed: number) => {
      // Banking flight oscillation
      group.rotation.z = Math.sin(elapsed * 2.5) * 0.18;
      group.rotation.y = Math.sin(elapsed * 1.8) * 0.12;
      group.position.y += Math.sin(elapsed * 3.2) * 0.008;
    },
    dispose: () => {
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    },
  };
}
