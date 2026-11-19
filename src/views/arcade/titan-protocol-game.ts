// 3D Titan Protocol Game — Cinematic Cyber Mech Boss Duel
// 100% Framework-Free Pure TypeScript with Three.js & CSS2DRenderer
// A Fast-Paced 1-on-1 Combat Duel: Interceptor Volleys, Perfect Parries, Stagger Breaks & Overdrive Combos

import * as THREE from 'three';
import { create3DGameFramework, Framework3DInstance, Label2DHandle } from '../../core/arcade-3d-framework.ts';
import {
  playParryClash,
  playBossStagger,
  playArcadeLaser,
  playArcadeExplosion,
  playArcadeDamage,
  playArcadePowerup,
  playArcadeCombo,
  playTactileClick,
  playWarningAlarm,
  playCriticalImpact,
  playFinishFanfare,
  playRailgunFire,
  playShieldParryDome,
  speakMechVoice,
  playBossOverdriveAlarm,
  playJetDash,
} from '../../utils/sound.ts';
import {
  GameInstanceHandle,
  ArcadeDifficulty,
  unlockArcadeTrophy,
  getActiveWeaponSkin,
} from './arcade-types.ts';
import {
  buildCombatRocket,
  buildPiercingArrow,
  buildAerialPredatorDrone,
  ModelAnimationHandle,
} from './procedural-models.ts';
import {
  createMetalPanelsTexture,
  createCitySkylineTexture,
  createCarbonFiberTexture,
  createAsphaltTexture,
} from '../../utils/procedural-textures.ts';

export function startTitanProtocolGame(
  stageEl: HTMLElement,
  inputEl: HTMLInputElement,
  hudEl: HTMLElement,
  onEndCallback: (stats: { score: number; words: number; accuracy: number; maxCombo: number }) => void,
  difficulty: ArcadeDifficulty = 'elite'
): GameInstanceHandle {
  const MAX_BOSS_HP = difficulty === 'nightmare' ? 3400 : difficulty === 'cadet' ? 1800 : 2600;
  let bossHp = MAX_BOSS_HP;
  let bossStagger = 0; // 0 to 100 (stagger threshold)
  let playerHp = 100;
  let isPhase2 = difficulty === 'nightmare';

  let score = 0;
  let targetsDestroyed = 0;
  let totalKeystrokes = 0;
  let correctKeystrokes = 0;
  let currentStreak = 0;
  let maxStreak = 0;

  type BossCombatState = 'VOLLEY' | 'TELEGRAPH' | 'STAGGERED' | 'RECOVERING' | 'DEFEATED';
  let bossState: BossCombatState = 'VOLLEY';

  // Timers & Combat Variables
  let stateTime = 0;
  let attackTimer = 0;
  let attackDuration = 5.0;
  let activeDefenseWord = '';
  let activeComboIndex = 0;
  let staggerTimer = 0;
  let hitPauseTimer = 0; // Micro-freeze frame on perfect parry

  // Screen Impact Flash Overlay Element
  let flashEl = stageEl.querySelector<HTMLElement>('.arcade-impact-flash');
  if (!flashEl) {
    flashEl = document.createElement('div');
    flashEl.className = 'arcade-impact-flash';
    stageEl.appendChild(flashEl);
  }

  function triggerScreenFlash(type: 'parry' | 'perfect' | 'damage' | 'stagger'): void {
    if (!flashEl) return;
    flashEl.className = `arcade-impact-flash active-${type}`;
    setTimeout(() => {
      if (flashEl) flashEl.className = 'arcade-impact-flash';
    }, 140);
  }

  function spawnFloatingCombatText(text: string, type: 'normal' | 'crit' | 'parry' = 'normal', xPercent = 50, yPercent = 40): void {
    const el = document.createElement('div');
    el.className = `combat-dmg-float ${type}`;
    el.textContent = text;
    el.style.left = `${xPercent}%`;
    el.style.top = `${yPercent}%`;
    stageEl.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  // --- VOCABULARY MATRICES ---
  const VOLLEY_WORDS = [
    'ION', 'EMP', 'ARC', 'BOLT', 'FLUX', 'BEAM', 'PULSE', 'SPARK', 'CORE', 'WARP',
    'BURN', 'LOCK', 'RUSH', 'SURGE', 'VOLT', 'GRID', 'BLAST', 'SHARD', 'LASER', 'CELL',
  ];

  const DEFENSE_WORDS = [
    'PARRY', 'DEFLECT', 'BLOCK', 'DODGE', 'COUNTER', 'PHASE',
    'SHIELD', 'ROLL', 'REFLEX', 'ABSORB', 'REVERT', 'BARRIER',
  ];

  const BERSERK_DEFENSE_WORDS = [
    'HYPER PARRY', 'MATRIX SHIFT', 'VOLT DEFLECT', 'PLASMA REFLEX',
    'TITAN COUNTER', 'QUANTUM DODGE', 'OMEGA SHIELD', 'KINETIC REVERSE',
  ];

  const COMBO_CHAINS = [
    ['PLASMA CANNON', 'CIRCUIT BREAKER', 'VORTEX CRUSH', 'TITAN OBLIVION'],
    ['OVERCHARGE PULSE', 'NEURAL SURGE', 'ION BLUDGEON', 'SYSTEM PURGE'],
    ['LIGHTNING BLADE', 'HEAVY IMPACT', 'CORE OVERLOAD', 'SUPERNOVA RUSH'],
  ];
  let activeComboChain = COMBO_CHAINS[0];

  // Active Interceptor Threats State (Authentic Cruise Rockets & Aerial Drones)
  interface InterceptorDrone {
    mesh: THREE.Group;
    label: Label2DHandle;
    word: string;
    progress: number; // 0 to 1 (flies from boss to camera)
    speed: number;
    posOffset: THREE.Vector3;
    isDestroyed: boolean;
    animHandle?: ModelAnimationHandle;
    isRocket: boolean;
  }
  let activeDrones: InterceptorDrone[] = [];
  let droneSpawnTimer = 1.6;
  let dronesDefeatedInVolley = 0;

  // --- HUD INITIALIZATION ---
  hudEl.innerHTML = `
    <div class="arcade-hud-boss">
      <div class="boss-health-bar-container">
        <div class="boss-name-row">
          <span class="boss-title" id="boss-name-tag">NEXUS-9 // WAR MACHINE</span>
          <span class="boss-hp-val" id="boss-hp-display">${MAX_BOSS_HP} / ${MAX_BOSS_HP}</span>
        </div>
        <div class="boss-hp-track">
          <div class="boss-hp-fill" id="boss-hp-fill" style="width: 100%;"></div>
        </div>
        <div class="boss-stagger-track" title="Shoot drones and parry strikes to trigger Overdrive Stagger!">
          <div class="boss-stagger-fill" id="boss-stagger-fill" style="width: 0%;"></div>
        </div>
      </div>

      <div class="arcade-hud-pills">
        <span class="arcade-pill">Pilot HP: <strong id="player-hp-display" class="hud-accent">100%</strong></span>
        <span class="arcade-pill">Streak: <strong id="titan-streak" class="hud-combo">x0</strong></span>
        <span class="arcade-pill">Combat: <strong id="titan-timer" class="hud-timer">ENGAGE</strong></span>
        <span class="arcade-pill hud-game-tag" id="titan-phase-tag">Phase 1</span>
      </div>
    </div>
  `;

  // --- 3D FRAMEWORK SETUP ---
  const fw: Framework3DInstance = create3DGameFramework(stageEl, {
    fov: 60,
    camX: 0,
    camY: 2.4,
    camZ: 18.5,
    backgroundColor: 0x06040f,
    fogColor: 0x06040f,
    fogDensity: 0.0075,
    ambientColor: 0x160c2b,
    ambientIntensity: 0.85,
    keyColor: 0x38bdf8,
    keyIntensity: 2.8,
    fillColor: 0xa855f7,
    fillIntensity: 1.8,
    rimColor: 0xf43f5e,
    rimIntensity: 3.5,
    starColor: 0x818cf8,
    starSize: 0.9,
    starSpeed: 14,
    starCount: 90,
  });

  const { scene, camera, shakeCamera, create3DExplosion, fireLaserBeam, create2DLabel, updateFX, dispose } = fw;

  // --- PROCEDURAL TEXTURES & AAA COLOSSEUM ARENA ENVIRONMENT ---
  const metalPanelsTexture = createMetalPanelsTexture();
  metalPanelsTexture.repeat.set(12, 12);
  const carbonFiberTexture = createCarbonFiberTexture();
  const citySkylineTexture = createCitySkylineTexture();
  const { map: asphaltMap, roughnessMap: asphaltRoughness } = createAsphaltTexture();
  asphaltMap.repeat.set(16, 16);
  asphaltRoughness.repeat.set(16, 16);

  // Procedural Diagonal Industrial Hazard Caution Stripe Texture
  const hazCanvas = document.createElement('canvas');
  hazCanvas.width = 256;
  hazCanvas.height = 64;
  const hCtx = hazCanvas.getContext('2d');
  if (hCtx) {
    hCtx.fillStyle = '#0f172a';
    hCtx.fillRect(0, 0, 256, 64);
    hCtx.fillStyle = '#facc15';
    for (let x = -64; x < 320; x += 32) {
      hCtx.beginPath();
      hCtx.moveTo(x, 64);
      hCtx.lineTo(x + 16, 64);
      hCtx.lineTo(x + 48, 0);
      hCtx.lineTo(x + 32, 0);
      hCtx.closePath();
      hCtx.fill();
    }
  }
  const hazardStripeTex = new THREE.CanvasTexture(hazCanvas);
  hazardStripeTex.wrapS = THREE.RepeatWrapping;
  hazardStripeTex.wrapT = THREE.RepeatWrapping;
  hazardStripeTex.repeat.set(18, 1);

  // Soft Radial Sprite Texture for Ambient Steam & Spark Plumes
  const steamCanvas = document.createElement('canvas');
  steamCanvas.width = 64;
  steamCanvas.height = 64;
  const sCtx = steamCanvas.getContext('2d');
  if (sCtx) {
    const sGrad = sCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
    sGrad.addColorStop(0, 'rgba(200, 235, 255, 0.55)');
    sGrad.addColorStop(0.5, 'rgba(100, 180, 255, 0.15)');
    sGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    sCtx.fillStyle = sGrad;
    sCtx.fillRect(0, 0, 64, 64);
  }
  const steamSpriteTex = new THREE.CanvasTexture(steamCanvas);

  // 1. Panoramic Cyber City Skyline Cylinder Backdrop
  const skylineGeo = new THREE.CylinderGeometry(140, 140, 75, 32, 1, true);
  const skylineMat = new THREE.MeshBasicMaterial({
    map: citySkylineTexture,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.95,
  });
  const skylineMesh = new THREE.Mesh(skylineGeo, skylineMat);
  skylineMesh.position.set(0, 16, -10);
  scene.add(skylineMesh);

  // 2. Heavy Reinforced Colosseum Combat Platform
  const platformGeo = new THREE.CylinderGeometry(32, 34, 4, 48);
  const platformMat = new THREE.MeshStandardMaterial({
    map: metalPanelsTexture,
    roughness: 0.35,
    metalness: 0.88,
  });
  const platformMesh = new THREE.Mesh(platformGeo, platformMat);
  platformMesh.position.set(0, -6.5, -4);
  platformMesh.receiveShadow = true;
  scene.add(platformMesh);

  // Platform Upper Runway Deck (Dark PBR Industrial Asphalt & Steel)
  const deckGeo = new THREE.CircleGeometry(31.8, 48);
  deckGeo.rotateX(-Math.PI / 2);
  const deckMat = new THREE.MeshStandardMaterial({
    map: asphaltMap,
    roughnessMap: asphaltRoughness,
    roughness: 0.45,
    metalness: 0.72,
  });
  const deckMesh = new THREE.Mesh(deckGeo, deckMat);
  deckMesh.position.set(0, -4.48, -4);
  deckMesh.receiveShadow = true;
  scene.add(deckMesh);

  // Central Hydraulic Boss Launch Pedestal Dais
  const daisGeo = new THREE.CylinderGeometry(7.2, 8.2, 0.36, 8);
  const daisMat = new THREE.MeshStandardMaterial({
    map: metalPanelsTexture,
    color: 0x334155,
    metalness: 0.88,
    roughness: 0.25,
  });
  const daisMesh = new THREE.Mesh(daisGeo, daisMat);
  daisMesh.position.set(0, -4.3, -4);
  scene.add(daisMesh);

  const daisRimGeo = new THREE.CylinderGeometry(7.3, 7.35, 0.14, 24, 1, true);
  const daisRimMat = new THREE.MeshStandardMaterial({ map: hazardStripeTex, roughness: 0.35, metalness: 0.6 });
  const daisRimMesh = new THREE.Mesh(daisRimGeo, daisRimMat);
  daisRimMesh.position.set(0, -4.38, -4);
  scene.add(daisRimMesh);

  // Soft Grounded Contact Shadow Disc under Boss on Dais (zero shadow-map GPU overhead)
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const shCtx = shadowCanvas.getContext('2d');
  if (shCtx) {
    const shGrad = shCtx.createRadialGradient(64, 64, 10, 64, 64, 64);
    shGrad.addColorStop(0, 'rgba(2, 6, 23, 0.88)');
    shGrad.addColorStop(0.55, 'rgba(2, 6, 23, 0.48)');
    shGrad.addColorStop(1, 'rgba(2, 6, 23, 0)');
    shCtx.fillStyle = shGrad;
    shCtx.fillRect(0, 0, 128, 128);
  }
  const shadowDiscTex = new THREE.CanvasTexture(shadowCanvas);
  const bossShadowGeo = new THREE.CircleGeometry(5.6, 28);
  bossShadowGeo.rotateX(-Math.PI / 2);
  const bossShadowMat = new THREE.MeshBasicMaterial({
    map: shadowDiscTex,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const bossShadowMesh = new THREE.Mesh(bossShadowGeo, bossShadowMat);
  bossShadowMesh.position.set(0, -4.118, -4);
  scene.add(bossShadowMesh);

  // Hazard Perimeter Caution Ring (Diagonal Yellow & Black Stripes)
  const hazardRingGeo = new THREE.RingGeometry(29.8, 31.4, 48);
  hazardRingGeo.rotateX(-Math.PI / 2);
  const hazardRingMat = new THREE.MeshStandardMaterial({
    map: hazardStripeTex,
    metalness: 0.6,
    roughness: 0.35,
  });
  const hazardRingMesh = new THREE.Mesh(hazardRingGeo, hazardRingMat);
  hazardRingMesh.position.set(0, -4.46, -4);
  scene.add(hazardRingMesh);

  // Radial Energy Conduits leading from perimeter to central boss pedestal
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    const conduitGeo = new THREE.BoxGeometry(0.22, 0.04, 18);
    const conduitMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const conduit = new THREE.Mesh(conduitGeo, conduitMat);
    conduit.rotation.y = angle;
    conduit.position.set(Math.sin(angle) * 14, -4.45, -4 + Math.cos(angle) * 14);
    scene.add(conduit);
  }

  // 3. Four Massive Heavy Industrial Lattice Floodlight Gantry Towers (Cleanly outside Blast Wall)
  const towerAngles = [
    (123.75 * Math.PI) / 180,
    (236.25 * Math.PI) / 180,
    (56.25 * Math.PI) / 180,
    (303.75 * Math.PI) / 180,
  ];
  const towerRadius = 35.2;
  const towerGroup = new THREE.Group();
  const beamCanvas = document.createElement('canvas');
  beamCanvas.width = 64;
  beamCanvas.height = 128;
  const bCtx = beamCanvas.getContext('2d');
  if (bCtx) {
    const bGrad = bCtx.createLinearGradient(0, 0, 0, 128);
    bGrad.addColorStop(0, 'rgba(186, 230, 253, 0)');
    bGrad.addColorStop(0.08, 'rgba(186, 230, 253, 0.55)');
    bGrad.addColorStop(0.48, 'rgba(56, 189, 248, 0.18)');
    bGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    bCtx.fillStyle = bGrad;
    bCtx.fillRect(0, 0, 64, 128);
  }
  const beamFadeTex = new THREE.CanvasTexture(beamCanvas);

  const volBeamMat = new THREE.MeshBasicMaterial({
    map: beamFadeTex,
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.11,
    side: THREE.FrontSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const trussMat = new THREE.MeshStandardMaterial({ map: metalPanelsTexture, color: 0x475569, metalness: 0.85, roughness: 0.3 });
  const strutMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.35 });
  const lensMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe });
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

  towerAngles.forEach((angle) => {
    const tx = Math.sin(angle) * towerRadius;
    const tz = -4 + Math.cos(angle) * towerRadius;
    const tGroup = new THREE.Group();
    tGroup.position.set(tx, 0, tz);
    tGroup.lookAt(0, 0, -4);

    // Heavy Anchored Base Pedestal Plinth (cleanly outside rim wall, zero buttress collision)
    const footingGeo = new THREE.BoxGeometry(3.2, 2.0, 3.2);
    const footing = new THREE.Mesh(footingGeo, strutMat);
    footing.position.set(0, -3.5, 0);
    tGroup.add(footing);

    const collarBaseGeo = new THREE.BoxGeometry(2.2, 0.8, 2.2);
    const collarBase = new THREE.Mesh(collarBaseGeo, trussMat);
    collarBase.position.set(0, -2.2, 0);
    tGroup.add(collarBase);

    // 4-Pillar Skeletal Steel Uprights
    const colGeo = new THREE.BoxGeometry(0.28, 22.8, 0.28);
    [-0.72, 0.72].forEach((ox) => {
      [-0.62, 0.62].forEach((oz) => {
        const col = new THREE.Mesh(colGeo, trussMat);
        col.position.set(ox, 9.3, oz);
        tGroup.add(col);
      });
    });

    // Open Perimeter Girder Collars + Crisp Diagonal X-Bracing Bays
    const frontTieGeo = new THREE.BoxGeometry(1.72, 0.18, 0.18);
    const sideTieGeo = new THREE.BoxGeometry(0.18, 0.18, 1.52);
    const diagGeo = new THREE.BoxGeometry(0.11, 4.62, 0.11);
    const bayBaseYs = [-1.8, 2.6, 7.0, 11.4, 15.8];
    bayBaseYs.forEach((by) => {
      [-0.62, 0.62].forEach((fz) => {
        const tieFB = new THREE.Mesh(frontTieGeo, strutMat);
        tieFB.position.set(0, by, fz);
        tGroup.add(tieFB);

        const d1 = new THREE.Mesh(diagGeo, trussMat);
        d1.position.set(0, by + 2.2, fz);
        d1.rotation.z = 0.316;
        tGroup.add(d1);

        const d2 = new THREE.Mesh(diagGeo, trussMat);
        d2.position.set(0, by + 2.2, fz);
        d2.rotation.z = -0.316;
        tGroup.add(d2);
      });
      [-0.72, 0.72].forEach((sx) => {
        const tieSide = new THREE.Mesh(sideTieGeo, strutMat);
        tieSide.position.set(sx, by, 0);
        tGroup.add(tieSide);
      });
    });

    // Aligned Maintenance Service Catwalk Deck + Elevated Swivel Yoke Stanchions
    const deckTopGeo = new THREE.BoxGeometry(4.2, 0.36, 2.8);
    const deckTop = new THREE.Mesh(deckTopGeo, strutMat);
    deckTop.position.set(0, 20.6, 0);
    tGroup.add(deckTop);

    const railFrontGeo = new THREE.BoxGeometry(4.2, 0.1, 0.1);
    const railFront = new THREE.Mesh(railFrontGeo, trussMat);
    railFront.position.set(0, 21.15, 1.32);
    tGroup.add(railFront);

    const yokePostGeo = new THREE.BoxGeometry(0.32, 2.2, 0.44);
    [-1.95, 1.95].forEach((yx) => {
      const post = new THREE.Mesh(yokePostGeo, strutMat);
      post.position.set(yx, 21.75, 0.1);
      tGroup.add(post);
    });

    // Vertical Aircraft Warning Beacon Mast behind Housing (stays upright, never clips light box!)
    const spireGeo = new THREE.CylinderGeometry(0.05, 0.1, 2.8, 6);
    const spire = new THREE.Mesh(spireGeo, strutMat);
    spire.position.set(0, 22.1, -0.95);
    tGroup.add(spire);

    const beaconGeo = new THREE.SphereGeometry(0.28, 8, 8);
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(0, 23.6, -0.95);
    tGroup.add(beacon);

    // Pitched Floodlight Housing Elevated High Above Deck (+2.1m clearance -> Zero Clipping!)
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 22.7, 0.15);
    headGroup.rotation.x = 0.42; // Pitch cleanly down into combat dais without intersecting catwalk

    const headGeo = new THREE.BoxGeometry(3.6, 1.38, 1.85);
    const headMesh = new THREE.Mesh(headGeo, trussMat);
    headGroup.add(headMesh);

    // Flush Upper Glare Hood Visor
    const visorHoodGeo = new THREE.BoxGeometry(3.75, 0.16, 0.68);
    const visorHood = new THREE.Mesh(visorHoodGeo, strutMat);
    visorHood.position.set(0, 0.72, 1.05);
    headGroup.add(visorHood);

    const lampFrameGeo = new THREE.BoxGeometry(0.72, 0.92, 0.14);
    const lampLensGeo = new THREE.PlaneGeometry(0.58, 0.76);
    [-1.08, -0.36, 0.36, 1.08].forEach((lx) => {
      const frame = new THREE.Mesh(lampFrameGeo, strutMat);
      frame.position.set(lx, 0, 0.92);
      headGroup.add(frame);

      const lensMesh = new THREE.Mesh(lampLensGeo, lensMat);
      lensMesh.position.set(lx, 0, 1.01);
      headGroup.add(lensMesh);
    });

    // Subtle Soft-Fading Volumetric Beam Cone inside Lamp Hood
    const rayGeo = new THREE.CylinderGeometry(0.48, 5.4, 26, 20, 1, true);
    rayGeo.rotateX(-Math.PI / 2);
    rayGeo.translate(0, 0, 14.1);
    const rayMesh = new THREE.Mesh(rayGeo, volBeamMat);
    headGroup.add(rayMesh);

    tGroup.add(headGroup);
    towerGroup.add(tGroup);
  });
  scene.add(towerGroup);

  // Single Cool Overhead Arena Key Accent (replaces 4 costly per-pixel SpotLights)
  const arenaOverheadLight = new THREE.DirectionalLight(0x38bdf8, 1.35);
  arenaOverheadLight.position.set(0, 26, -2);
  scene.add(arenaOverheadLight);

  // 4. Segmented Perimeter Blast Wall Ring + Structural Buttresses
  const arenaWallGroup = new THREE.Group();
  const ringWallGeo = new THREE.CylinderGeometry(31.8, 32.6, 2.2, 32, 1, true);
  const ringWallMat = new THREE.MeshStandardMaterial({
    map: metalPanelsTexture,
    color: 0x334155,
    metalness: 0.85,
    roughness: 0.35,
    side: THREE.DoubleSide,
  });
  const ringWall = new THREE.Mesh(ringWallGeo, ringWallMat);
  ringWall.position.set(0, -3.4, -4);
  arenaWallGroup.add(ringWall);

  const wallTrimGeo = new THREE.CylinderGeometry(31.7, 31.75, 0.3, 32, 1, true);
  const wallTrimMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e, side: THREE.DoubleSide });
  const wallTrim = new THREE.Mesh(wallTrimGeo, wallTrimMat);
  wallTrim.position.set(0, -2.35, -4);
  arenaWallGroup.add(wallTrim);

  const barrierCount = 16;
  const barrierRadius = 31.2;
  for (let b = 0; b < barrierCount; b++) {
    const angle = (b / barrierCount) * Math.PI * 2;
    const bGeo = new THREE.BoxGeometry(1.4, 2.8, 1.8);
    const bMat = new THREE.MeshStandardMaterial({
      map: metalPanelsTexture,
      color: 0x475569,
      roughness: 0.35,
      metalness: 0.85,
    });
    const buttress = new THREE.Mesh(bGeo, bMat);
    buttress.position.set(Math.sin(angle) * barrierRadius, -3.1, -4 + Math.cos(angle) * barrierRadius);
    buttress.rotation.y = angle;
    arenaWallGroup.add(buttress);
  }
  scene.add(arenaWallGroup);

  // 5. Atmospheric Hydraulic Steam & Welding Ember Plumes around Boss Dais
  const STEAM_COUNT = 48;
  const steamGeo = new THREE.BufferGeometry();
  const steamPos = new Float32Array(STEAM_COUNT * 3);
  const steamSpeeds: number[] = [];
  for (let i = 0; i < STEAM_COUNT; i++) {
    const rad = 5.5 + Math.random() * 8.0;
    const theta = Math.random() * Math.PI * 2;
    steamPos[i * 3] = Math.cos(theta) * rad;
    steamPos[i * 3 + 1] = -4.2 + Math.random() * 8.5;
    steamPos[i * 3 + 2] = -4 + Math.sin(theta) * rad;
    steamSpeeds.push(1.2 + Math.random() * 2.2);
  }
  steamGeo.setAttribute('position', new THREE.BufferAttribute(steamPos, 3));
  const steamMat = new THREE.PointsMaterial({
    map: steamSpriteTex,
    color: 0x7dd3fc,
    size: 1.55,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const steamPoints = new THREE.Points(steamGeo, steamMat);
  scene.add(steamPoints);

  // --- PROCEDURAL 3D MECH CHASSIS (NEXUS-9) ---
  const bossGroup = new THREE.Group();
  bossGroup.position.set(0, 0, -4);

  // High-Detail Dark Gunmetal & Titanium Materials (Strong silhouette contrast)
  const armorMat = new THREE.MeshStandardMaterial({
    map: metalPanelsTexture,
    color: 0x3b4252,
    metalness: 0.82,
    roughness: 0.28,
  });

  const accentMetalMat = new THREE.MeshStandardMaterial({
    map: carbonFiberTexture,
    color: 0x1e293b,
    metalness: 0.88,
    roughness: 0.22,
  });

  const pauldronMat = new THREE.MeshStandardMaterial({
    map: metalPanelsTexture,
    color: 0xe11d48,
    metalness: 0.75,
    roughness: 0.25,
  });

  // 1. Sculpted Armored Core Torso, Collar & Hydraulic Legs
  const chestGeo = new THREE.BoxGeometry(4.4, 2.5, 2.6);
  const chestMesh = new THREE.Mesh(chestGeo, armorMat);
  chestMesh.position.set(0, 1.0, 0);
  bossGroup.add(chestMesh);

  // Angled Sternum Breastplate + Dual Glowing Radiator Louvers
  const breastplateGeo = new THREE.BoxGeometry(3.4, 1.7, 0.9);
  const breastplateMesh = new THREE.Mesh(breastplateGeo, accentMetalMat);
  breastplateMesh.position.set(0, 1.15, 1.25);
  breastplateMesh.rotation.x = -0.18;
  bossGroup.add(breastplateMesh);

  const ventMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  [-1.15, 1.15].forEach((vx) => {
    for (let r = 0; r < 3; r++) {
      const ventGeo = new THREE.BoxGeometry(0.65, 0.14, 0.18);
      const vent = new THREE.Mesh(ventGeo, ventMat);
      vent.position.set(vx, 1.4 - r * 0.3, 1.65);
      vent.rotation.z = vx > 0 ? -0.25 : 0.25;
      bossGroup.add(vent);
    }
  });

  // Heavy Collar Armor Cowls flanking head
  [-1.35, 1.35].forEach((cx) => {
    const collarGeo = new THREE.BoxGeometry(0.95, 0.65, 2.0);
    const collar = new THREE.Mesh(collarGeo, pauldronMat);
    collar.position.set(cx, 2.45, 0.1);
    collar.rotation.z = cx > 0 ? 0.25 : -0.25;
    bossGroup.add(collar);
  });

  // Twin Shoulder-Mounted Quad Missile Pod Launchers
  [-2.6, 2.6].forEach((mx) => {
    const podBoxGeo = new THREE.BoxGeometry(1.15, 1.0, 1.4);
    const podBox = new THREE.Mesh(podBoxGeo, accentMetalMat);
    podBox.position.set(mx, 2.75, -0.25);
    bossGroup.add(podBox);

    for (let row = -0.2; row <= 0.2; row += 0.4) {
      for (let col = -0.22; col <= 0.22; col += 0.44) {
        const tubeGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.25, 8);
        tubeGeo.rotateX(Math.PI / 2);
        const tubeMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0x991b1b, emissiveIntensity: 0.6 });
        const tube = new THREE.Mesh(tubeGeo, tubeMat);
        tube.position.set(mx + col, 2.75 + row, 0.45);
        bossGroup.add(tube);
      }
    }
  });

  // Hydraulic Waist, Hip Skirt Plates & Heavy Spiked Knees + Boots
  const waistGeo = new THREE.CylinderGeometry(1.05, 1.35, 1.5, 8);
  const waistMesh = new THREE.Mesh(waistGeo, accentMetalMat);
  waistMesh.position.set(0, -0.95, 0);
  bossGroup.add(waistMesh);

  [-1.55, 1.55].forEach((lx) => {
    // Hip Skirt Guard
    const skirtGeo = new THREE.BoxGeometry(1.1, 0.8, 1.55);
    const skirt = new THREE.Mesh(skirtGeo, pauldronMat);
    skirt.position.set(lx, -1.2, 0.1);
    skirt.rotation.z = lx > 0 ? -0.18 : 0.18;
    bossGroup.add(skirt);

    // Armored Thigh
    const thighGeo = new THREE.BoxGeometry(1.15, 1.65, 1.25);
    const thigh = new THREE.Mesh(thighGeo, armorMat);
    thigh.position.set(lx, -1.85, 0.15);
    bossGroup.add(thigh);

    // Protruding Angled Knee Cap Armor Spike
    const kneeGeo = new THREE.ConeGeometry(0.52, 1.05, 4);
    kneeGeo.rotateX(0.35);
    const knee = new THREE.Mesh(kneeGeo, pauldronMat);
    knee.position.set(lx, -2.35, 0.85);
    bossGroup.add(knee);

    // Lower Greave / Shin Armor
    const shinGeo = new THREE.BoxGeometry(1.32, 1.55, 1.5);
    const shin = new THREE.Mesh(shinGeo, accentMetalMat);
    shin.position.set(lx, -3.05, 0.15);
    bossGroup.add(shin);

    // Grounded Heavy Mecha Boot + Armored Toe Guard sitting FLUSH on Dais (y = -4.115)
    const bootGeo = new THREE.BoxGeometry(1.65, 0.56, 2.4);
    const boot = new THREE.Mesh(bootGeo, armorMat);
    boot.position.set(lx, -3.835, 0.52);
    bossGroup.add(boot);

    const toeGeo = new THREE.BoxGeometry(1.35, 0.34, 0.65);
    const toe = new THREE.Mesh(toeGeo, pauldronMat);
    toe.position.set(lx, -3.94, 1.52);
    bossGroup.add(toe);
  });

  // 2. Recessed Armored Core Turbine Reactor
  const housingRingGeo = new THREE.CylinderGeometry(1.25, 1.25, 0.5, 20);
  housingRingGeo.rotateX(Math.PI / 2);
  const housingRing = new THREE.Mesh(housingRingGeo, pauldronMat);
  housingRing.position.set(0, 1.15, 1.55);
  bossGroup.add(housingRing);

  const coreInnerGeo = new THREE.SphereGeometry(0.76, 16, 16);
  const coreMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const coreMesh = new THREE.Mesh(coreInnerGeo, coreMat);
  coreMesh.position.set(0, 1.15, 1.72);
  bossGroup.add(coreMesh);

  // Flush stationary armored turbine containment bezel (zero diagonal slice motion)
  const coreCageGeo = new THREE.TorusGeometry(1.02, 0.085, 12, 28);
  const coreCageMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.7,
    metalness: 0.95,
    roughness: 0.12,
  });
  const coreCageMesh = new THREE.Mesh(coreCageGeo, coreCageMat);
  coreCageMesh.position.set(0, 1.15, 1.76);
  bossGroup.add(coreCageMesh);

  const coreLight = new THREE.PointLight(0x38bdf8, 4.5, 26);
  coreLight.position.set(0, 1.15, 2.8);
  bossGroup.add(coreLight);

  // 3. Sculpted Samurai Mecha Helm, Sloped Brow & Dual Glowing Optics
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 3.15, 0.25);

  const helmGeo = new THREE.BoxGeometry(1.55, 1.25, 1.65);
  const helmMesh = new THREE.Mesh(helmGeo, armorMat);
  headGroup.add(helmMesh);

  // Sloped Forward Brow Overhang Cowl
  const browGeo = new THREE.BoxGeometry(1.75, 0.35, 1.85);
  const brow = new THREE.Mesh(browGeo, pauldronMat);
  brow.position.set(0, 0.52, 0.15);
  brow.rotation.x = 0.22;
  headGroup.add(brow);

  // Crown Swept-Back V-Fin Crest Horns
  const crestGeo = new THREE.ConeGeometry(0.24, 2.1, 4);
  crestGeo.rotateX(-0.35);
  const crestMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.92, roughness: 0.18 });
  const crestLeft = new THREE.Mesh(crestGeo, crestMat);
  crestLeft.position.set(-0.75, 1.15, 0.15);
  crestLeft.rotation.z = 0.58;
  headGroup.add(crestLeft);

  const crestRight = new THREE.Mesh(crestGeo, crestMat);
  crestRight.position.set(0.75, 1.15, 0.15);
  crestRight.rotation.z = -0.58;
  headGroup.add(crestRight);

  // Dark Recessed Visor Band + Twin Menacing Glowing Eyes
  const slitGeo = new THREE.BoxGeometry(1.35, 0.36, 0.15);
  const slit = new THREE.Mesh(slitGeo, accentMetalMat);
  slit.position.set(0, 0.08, 0.82);
  headGroup.add(slit);

  const visorMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  [-0.36, 0.36].forEach((ex) => {
    const eyeGeo = new THREE.BoxGeometry(0.42, 0.16, 0.12);
    const eye = new THREE.Mesh(eyeGeo, visorMat);
    eye.position.set(ex, 0.08, 0.88);
    eye.rotation.z = ex > 0 ? 0.16 : -0.16;
    headGroup.add(eye);
  });

  bossGroup.add(headGroup);

  // 4. Back Thruster Pods & Exhaust Flares
  const thrusterGroup = new THREE.Group();
  thrusterGroup.position.set(0, 0.6, -1.8);

  function createThrusterPod(isLeft: boolean): THREE.Mesh {
    const podGeo = new THREE.CylinderGeometry(0.5, 0.7, 2.8, 8);
    podGeo.rotateX(0.2);
    const podMesh = new THREE.Mesh(podGeo, accentMetalMat);
    podMesh.position.set(isLeft ? -1.8 : 1.8, 0, 0);
    return podMesh;
  }
  thrusterGroup.add(createThrusterPod(true));
  thrusterGroup.add(createThrusterPod(false));

  const thrusterGlowMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.8 });
  const flameLeftGeo = new THREE.ConeGeometry(0.45, 2.0, 8);
  flameLeftGeo.rotateX(-Math.PI / 2);
  const flameLeft = new THREE.Mesh(flameLeftGeo, thrusterGlowMat);
  flameLeft.position.set(-1.8, -1.4, -0.2);
  thrusterGroup.add(flameLeft);

  const flameRight = new THREE.Mesh(flameLeftGeo, thrusterGlowMat);
  flameRight.position.set(1.8, -1.4, -0.2);
  thrusterGroup.add(flameRight);

  bossGroup.add(thrusterGroup);

  // 5. Connected Articulated Arms & Faceted Plasma Glaive Swords
  function createArticulatedBladeArm(isLeft: boolean) {
    const armRoot = new THREE.Group();
    armRoot.position.set(isLeft ? -3.4 : 3.4, 1.55, 0);

    // Ball Shoulder Joint Actuator connecting cleanly to Torso (NO floating gap!)
    const jointGeo = new THREE.SphereGeometry(0.85, 12, 12);
    const joint = new THREE.Mesh(jointGeo, accentMetalMat);
    armRoot.add(joint);

    // Angled Crimson Layered Shoulder Pauldron Guard
    const shoulderGeo = new THREE.BoxGeometry(1.85, 1.45, 1.9);
    const shoulderMesh = new THREE.Mesh(shoulderGeo, pauldronMat);
    shoulderMesh.position.set(isLeft ? -0.8 : 0.8, 0.45, 0);
    shoulderMesh.rotation.z = isLeft ? 0.25 : -0.25;
    armRoot.add(shoulderMesh);

    // Bicep Hydraulic Piston Assembly
    const bicepGeo = new THREE.CylinderGeometry(0.42, 0.48, 2.7, 10);
    const bicepMesh = new THREE.Mesh(bicepGeo, armorMat);
    bicepMesh.position.set(isLeft ? -0.7 : 0.7, -1.4, 0);
    armRoot.add(bicepMesh);

    // Angled Elbow Shield Plate
    const elbowGeo = new THREE.BoxGeometry(0.9, 0.85, 1.1);
    const elbow = new THREE.Mesh(elbowGeo, pauldronMat);
    elbow.position.set(isLeft ? -0.7 : 0.7, -2.7, -0.2);
    armRoot.add(elbow);

    // Forearm Gauntlet & Sculpted Dual-Edge Plasma Glaive
    const bladeArmGroup = new THREE.Group();
    bladeArmGroup.position.set(isLeft ? -0.7 : 0.7, -2.7, 0);

    const gauntletGeo = new THREE.BoxGeometry(0.95, 1.5, 1.0);
    const gauntletMesh = new THREE.Mesh(gauntletGeo, accentMetalMat);
    gauntletMesh.position.y = -0.5;
    bladeArmGroup.add(gauntletMesh);

    // Metallic Hilt Handguard
    const hiltGeo = new THREE.BoxGeometry(1.3, 0.22, 0.55);
    const hilt = new THREE.Mesh(hiltGeo, armorMat);
    hilt.position.set(0, -1.25, 0.2);
    bladeArmGroup.add(hilt);

    // Faceted Razor Plasma Katana Blade with Dark Steel Spine (ZERO blurry outer aura column!)
    const bladeGeo = new THREE.BoxGeometry(0.18, 3.0, 0.46);
    const bladeMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const bladeMesh = new THREE.Mesh(bladeGeo, bladeMat);
    bladeMesh.position.set(0, -2.85, 0.25);
    bladeArmGroup.add(bladeMesh);

    const spineGeo = new THREE.BoxGeometry(0.22, 2.8, 0.16);
    const spineMesh = new THREE.Mesh(spineGeo, armorMat);
    spineMesh.position.set(0, -2.75, 0.18);
    bladeArmGroup.add(spineMesh);

    const tipGeo = new THREE.ConeGeometry(0.24, 0.9, 4);
    tipGeo.rotateX(Math.PI);
    tipGeo.rotateY(Math.PI / 4);
    const tip = new THREE.Mesh(tipGeo, bladeMat);
    tip.position.set(0, -4.75, 0.25);
    bladeArmGroup.add(tip);

    armRoot.add(bladeArmGroup);

    return { armRoot, bladeArmGroup, bladeMat, bladeMesh, shoulderMesh };
  }

  const leftArm = createArticulatedBladeArm(true);
  const rightArm = createArticulatedBladeArm(false);
  bossGroup.add(leftArm.armRoot);
  bossGroup.add(rightArm.armRoot);

  scene.add(bossGroup);

  // 7. Destructible Armor Plating System (Real Physics & Tumble Debris)
  interface DestructiblePlate {
    id: string;
    mesh: THREE.Object3D;
    parent: THREE.Object3D;
    triggerHp: number;
    hasDetached: boolean;
    velocity: THREE.Vector3;
    rotVelocity: THREE.Vector3;
  }

  const destructiblePlates: DestructiblePlate[] = [
    {
      id: 'leftShoulder',
      mesh: leftArm.shoulderMesh,
      parent: leftArm.armRoot,
      triggerHp: 2000,
      hasDetached: false,
      velocity: new THREE.Vector3(),
      rotVelocity: new THREE.Vector3(),
    },
    {
      id: 'rightShoulder',
      mesh: rightArm.shoulderMesh,
      parent: rightArm.armRoot,
      triggerHp: 1500,
      hasDetached: false,
      velocity: new THREE.Vector3(),
      rotVelocity: new THREE.Vector3(),
    },
    {
      id: 'breastplate',
      mesh: breastplateMesh,
      parent: bossGroup,
      triggerHp: 1000,
      hasDetached: false,
      velocity: new THREE.Vector3(),
      rotVelocity: new THREE.Vector3(),
    },
    {
      id: 'crestHorn',
      mesh: crestLeft,
      parent: headGroup,
      triggerHp: 500,
      hasDetached: false,
      velocity: new THREE.Vector3(),
      rotVelocity: new THREE.Vector3(),
    },
  ];

  const activeFlyingDebris: DestructiblePlate[] = [];

  function checkArmorPlateBreakage(): void {
    destructiblePlates.forEach((plate) => {
      if (!plate.hasDetached && bossHp <= plate.triggerHp) {
        plate.hasDetached = true;
        const worldPos = new THREE.Vector3();
        plate.mesh.getWorldPosition(worldPos);
        const worldQuat = new THREE.Quaternion();
        plate.mesh.getWorldQuaternion(worldQuat);

        plate.parent.remove(plate.mesh);
        scene.add(plate.mesh);
        plate.mesh.position.copy(worldPos);
        plate.mesh.quaternion.copy(worldQuat);

        plate.velocity = new THREE.Vector3(
          (Math.random() - 0.5) * 10,
          5 + Math.random() * 6,
          4 + Math.random() * 7
        );
        plate.rotVelocity = new THREE.Vector3(
          (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 8
        );

        activeFlyingDebris.push(plate);
        create3DExplosion(worldPos, new THREE.Color(0xf59e0b), 28);
        playCriticalImpact();
        shakeCamera(1.2);
        spawnFloatingCombatText('ARMOR FRACTURE!', 'crit', 28, 30);
      }
    });
  }

  // 8. Player 3D Weapon Viewmodel (High-Detail Tactical Plasma Railgun)
  const activeSkin = getActiveWeaponSkin();
  const weaponViewModel = new THREE.Group();
  camera.add(weaponViewModel);
  scene.add(camera);

  // Ergonomic FPS viewmodel placement + dedicated shoulder illumination light
  weaponViewModel.scale.set(0.62, 0.62, 0.62);
  weaponViewModel.position.set(0.36, -0.32, -0.78);
  weaponViewModel.rotation.set(-0.04, -0.08, 0.02);

  const vmLight = new THREE.PointLight(0xe0f2fe, 2.2, 4);
  vmLight.position.set(0.15, 0.25, -0.3);
  camera.add(vmLight);

  // Sleek Beveled Composite Body Housing + Side Coolant Louvers
  const receiverGeo = new THREE.BoxGeometry(0.15, 0.17, 1.05);
  const receiverMat = new THREE.MeshStandardMaterial({
    map: carbonFiberTexture,
    color: activeSkin.id === 'obsidian' ? 0x475569 : activeSkin.primaryColor,
    metalness: activeSkin.metalness,
    roughness: activeSkin.roughness,
    emissive: activeSkin.emissiveColor ? new THREE.Color(activeSkin.emissiveColor) : new THREE.Color(0x000000),
    emissiveIntensity: activeSkin.emissiveColor ? 0.45 : 0,
  });
  const receiverMesh = new THREE.Mesh(receiverGeo, receiverMat);
  weaponViewModel.add(receiverMesh);

  // Tapered Upper Forend Shroud & Angled Cyber Gauntlet Hand Grip
  const shroudGeo = new THREE.BoxGeometry(0.11, 0.09, 0.65);
  const shroudMesh = new THREE.Mesh(shroudGeo, receiverMat);
  shroudMesh.position.set(0, 0.08, -0.45);
  weaponViewModel.add(shroudMesh);

  const gripGeo = new THREE.BoxGeometry(0.1, 0.22, 0.14);
  const gripMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
  const gripMesh = new THREE.Mesh(gripGeo, gripMat);
  gripMesh.position.set(0, -0.15, -0.32);
  gripMesh.rotation.x = 0.28;
  weaponViewModel.add(gripMesh);

  const gauntletArmGeo = new THREE.BoxGeometry(0.14, 0.13, 0.48);
  const gauntletArmMat = new THREE.MeshStandardMaterial({ map: metalPanelsTexture, color: 0x334155, metalness: 0.8 });
  const gauntletArm = new THREE.Mesh(gauntletArmGeo, gauntletArmMat);
  gauntletArm.position.set(-0.14, -0.22, 0.02);
  gauntletArm.rotation.set(0.18, -0.35, -0.15);
  weaponViewModel.add(gauntletArm);

  // Side Radiator Heat-Sink Slots Facing Pilot Camera
  const ventGlowMat = new THREE.MeshBasicMaterial({ color: activeSkin.accentColor });
  for (let v = 0; v < 4; v++) {
    const slotGeo = new THREE.BoxGeometry(0.02, 0.06, 0.07);
    const slot = new THREE.Mesh(slotGeo, ventGlowMat);
    slot.position.set(-0.08, 0.02, -0.18 - v * 0.14);
    weaponViewModel.add(slot);
  }

  // Quad Electromagnetic Accelerator Rails
  const railMat = new THREE.MeshStandardMaterial({
    color: activeSkin.accentColor,
    metalness: 0.95,
    roughness: 0.15,
    emissive: activeSkin.accentColor,
    emissiveIntensity: 0.55,
  });
  const railOffsets = [
    [-0.065, 0.055],
    [0.065, 0.055],
    [-0.065, -0.055],
    [0.065, -0.055],
  ];
  railOffsets.forEach(([rx, ry]) => {
    const railGeo = new THREE.CylinderGeometry(0.015, 0.015, 1.35, 8);
    railGeo.rotateX(Math.PI / 2);
    const railMesh = new THREE.Mesh(railGeo, railMat);
    railMesh.position.set(rx, ry, -0.62);
    weaponViewModel.add(railMesh);
  });

  // Glowing Plasma Induction Coils
  const coilGeo = new THREE.TorusGeometry(0.095, 0.016, 8, 16);
  const coilMat = new THREE.MeshBasicMaterial({ color: activeSkin.accentColor });
  for (let c = 0; c < 4; c++) {
    const coil = new THREE.Mesh(coilGeo, coilMat);
    coil.position.set(0, 0, -0.32 - c * 0.22);
    weaponViewModel.add(coil);
  }

  // Open-Frame EOTech Holographic Reflex Sight (Translucent Cyan Optic + Floating Reticle)
  const sightPostGeo = new THREE.BoxGeometry(0.016, 0.1, 0.14);
  const sightPostL = new THREE.Mesh(sightPostGeo, receiverMat);
  sightPostL.position.set(-0.048, 0.135, 0.05);
  weaponViewModel.add(sightPostL);

  const sightPostR = new THREE.Mesh(sightPostGeo, receiverMat);
  sightPostR.position.set(0.048, 0.135, 0.05);
  weaponViewModel.add(sightPostR);

  const sightTopGeo = new THREE.BoxGeometry(0.112, 0.016, 0.14);
  const sightTop = new THREE.Mesh(sightTopGeo, receiverMat);
  sightTop.position.set(0, 0.188, 0.05);
  weaponViewModel.add(sightTop);

  const sightLensGeo = new THREE.PlaneGeometry(0.08, 0.075);
  const sightLensMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.24,
    side: THREE.DoubleSide,
  });
  const sightLens = new THREE.Mesh(sightLensGeo, sightLensMat);
  sightLens.position.set(0, 0.135, 0.02);
  weaponViewModel.add(sightLens);

  const reticleDotGeo = new THREE.RingGeometry(0.008, 0.014, 16);
  const reticleDotMat = new THREE.MeshBasicMaterial({ color: 0xff0044, side: THREE.DoubleSide });
  const reticleDot = new THREE.Mesh(reticleDotGeo, reticleDotMat);
  reticleDot.position.set(0, 0.135, 0.018);
  weaponViewModel.add(reticleDot);

  // Rear 5-Segment Digital Plasma Charge Telemetry Bar
  const chargeBars: THREE.Mesh[] = [];
  for (let b = 0; b < 5; b++) {
    const barGeo = new THREE.BoxGeometry(0.02, 0.028, 0.015);
    const barMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const bar = new THREE.Mesh(barGeo, barMat);
    bar.position.set(-0.048 + b * 0.024, 0.095, 0.52);
    weaponViewModel.add(bar);
    chargeBars.push(bar);
  }

  const turbineGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.14, 12);
  turbineGeo.rotateX(Math.PI / 2);
  const turbineMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.95, roughness: 0.15 });
  const turbineMesh = new THREE.Mesh(turbineGeo, turbineMat);
  turbineMesh.position.set(0, 0, 0.51);
  weaponViewModel.add(turbineMesh);

  const muzzleLight = new THREE.PointLight(0x38bdf8, 0, 9);
  muzzleLight.position.set(0, 0, -1.35);
  weaponViewModel.add(muzzleLight);

  const muzzleRingGeo = new THREE.RingGeometry(0.05, 0.24, 16);
  const muzzleRingMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
  });
  const muzzleRing = new THREE.Mesh(muzzleRingGeo, muzzleRingMat);
  muzzleRing.position.set(0, 0, -1.3);
  weaponViewModel.add(muzzleRing);

  // Physical High-Velocity 3D Razor Piercing Arrow Munitions System
  interface PlasmaBolt {
    handle: ModelAnimationHandle;
    targetPos: THREE.Vector3;
    velocity: THREE.Vector3;
    life: number;
  }
  const activeBolts: PlasmaBolt[] = [];

  function spawnPlasmaBolt(targetPos: THREE.Vector3, colorHex = 0x38bdf8): void {
    const startWorld = new THREE.Vector3();
    muzzleRing.getWorldPosition(startWorld);

    // Creates an authentic razor broadhead arrow with barbed blade, carbon shaft, and 3-vaned fletching feathers
    const arrowHandle = buildPiercingArrow({
      scale: 0.55,
      tipColor: colorHex,
      shaftColor: 0x1e293b,
      fletchColor: colorHex,
    });
    arrowHandle.group.position.copy(startWorld);
    arrowHandle.group.lookAt(targetPos);
    scene.add(arrowHandle.group);

    const dir = targetPos.clone().sub(startWorld).normalize();
    activeBolts.push({
      handle: arrowHandle,
      targetPos: targetPos.clone(),
      velocity: dir.multiplyScalar(125),
      life: 0.35,
    });
  }

  let weaponRecoilZ = 0;
  let muzzleFlashTimer = 0;

  function triggerWeaponRecoil(isHeavy = false): void {
    weaponRecoilZ = isHeavy ? 0.18 : 0.09;
    muzzleFlashTimer = 0.09;
    muzzleLight.intensity = isHeavy ? 6.5 : 3.5;
    muzzleLight.color.setHex(isPhase2 ? 0xf43f5e : 0x38bdf8);
    muzzleRingMat.color.setHex(isPhase2 ? 0xf43f5e : 0x38bdf8);
    muzzleRingMat.opacity = 0.95;
    muzzleRing.scale.set(isHeavy ? 1.6 : 1.0, isHeavy ? 1.6 : 1.0, 1.0);
    playRailgunFire();
  }

  // 9. 3D Energy Parry Shield Dome (Translucent Plasma, NO WIREFRAME!)
  const parryDomeGeo = new THREE.SphereGeometry(3.6, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const parryDomeMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.6,
    roughness: 0.1,
    metalness: 0.9,
    transparent: true,
    opacity: 0,
  });
  const parryDomeMesh = new THREE.Mesh(parryDomeGeo, parryDomeMat);
  parryDomeMesh.position.set(0, 1.2, 14.5);
  scene.add(parryDomeMesh);

  // 10. Main 3D Floating Combat Directive above Boss (Sleek Holographic, NO OPAQUE PILL!)
  const combatLabel = create2DLabel('SYSTEM LOCKED // SCANNING VECTOR...', {
    offsetY: 6.8,
    highlight: false,
    className: 'titan-directive',
  });
  combatLabel.labelObj.visible = false;
  bossGroup.add(combatLabel.labelObj);

  let isActive = true;
  let animationId: number | null = null;

  // --- VISUAL COLOR & STANCE MANAGER ---
  function setBossVisualPalette(colorHex: number, corePulse = 3.5): void {
    coreMat.color.setHex(colorHex);
    coreCageMat.color.setHex(colorHex);
    coreLight.color.setHex(colorHex);
    coreLight.intensity = corePulse;
    visorMat.color.setHex(colorHex);
    ventMat.color.setHex(colorHex);
    thrusterGlowMat.color.setHex(colorHex);
    leftArm.bladeMat.color.setHex(colorHex);
    rightArm.bladeMat.color.setHex(colorHex);
  }

  function updateHUD(): void {
    const hpFill = document.getElementById('boss-hp-fill');
    const hpVal = document.getElementById('boss-hp-display');
    const staggerFill = document.getElementById('boss-stagger-fill');
    const playerHpEl = document.getElementById('player-hp-display');
    const streakEl = document.getElementById('titan-streak');
    const timerEl = document.getElementById('titan-timer');
    const phaseTag = document.getElementById('titan-phase-tag');
    const nameTag = document.getElementById('boss-name-tag');

    const hpPercent = Math.max(0, (bossHp / MAX_BOSS_HP) * 100);
    if (hpFill) hpFill.style.width = `${hpPercent}%`;
    if (hpVal) hpVal.textContent = `${Math.max(0, Math.round(bossHp))} / ${MAX_BOSS_HP}`;
    if (staggerFill) staggerFill.style.width = `${Math.min(100, bossStagger)}%`;

    if (playerHpEl) {
      playerHpEl.textContent = `${Math.max(0, playerHp)}%`;
      playerHpEl.style.color = playerHp <= 30 ? '#ef4444' : 'var(--accent-cyan)';
    }
    if (streakEl) streakEl.textContent = `x${currentStreak}`;

    if (isPhase2) {
      if (phaseTag) {
        phaseTag.textContent = 'BERSERK MODE';
        phaseTag.style.color = '#f43f5e';
      }
      if (nameTag) {
        nameTag.textContent = 'NEXUS-9 // OVERDRIVE';
      }
    }

    if (timerEl) {
      if (bossState === 'TELEGRAPH') {
        timerEl.textContent = `${Math.max(0, attackTimer).toFixed(1)}s`;
        timerEl.style.color = attackTimer <= 1.8 ? '#ef4444' : '#f59e0b';
      } else if (bossState === 'STAGGERED') {
        timerEl.textContent = `OVERDRIVE: ${Math.max(0, staggerTimer).toFixed(1)}s`;
        timerEl.style.color = '#c084fc';
      } else if (bossState === 'VOLLEY') {
        timerEl.textContent = 'INTERCEPT';
        timerEl.style.color = 'var(--accent-cyan)';
      }
    }
  }

  // --- DRONE SPAWN & INTERCEPT SYSTEM ---
  function spawnInterceptorDrone(): void {
    if (activeDrones.length >= 2 || bossState !== 'VOLLEY') return;

    const droneGroup = new THREE.Group();
    const droneGlowHex = isPhase2 ? 0xf43f5e : 0x00f0ff;
    const isRocket = Math.random() > 0.45;

    let animHandle: ModelAnimationHandle;
    if (isRocket) {
      // Authentic 3D Combat Rocket with aerodynamic nosecone, 4 cruciform fins, and thruster exhaust plume
      animHandle = buildCombatRocket({
        scale: 0.85,
        bodyColor: 0x334155,
        finColor: isPhase2 ? 0xf43f5e : 0xe11d48,
        exhaustColor: 0xff5500,
      });
      // Point forward along travel path
      animHandle.group.lookAt(0, 0, 14);
      droneGroup.add(animHandle.group);
    } else {
      // Authentic 3D Stealth Aerial Predator Drone with swept wings, VTOL fans, and optic sensor
      animHandle = buildAerialPredatorDrone({
        scale: 0.82,
        bodyColor: 0x1e293b,
        glowColor: droneGlowHex,
      });
      droneGroup.add(animHandle.group);
    }

    // Pick unique short word not already active on screen
    const wordPool = VOLLEY_WORDS.filter((w) => !activeDrones.some((d) => d.word === w));
    const word = wordPool[Math.floor(Math.random() * wordPool.length)] ?? VOLLEY_WORDS[0];
    const label = create2DLabel(word, { offsetY: 1.15, className: 'drone' });
    droneGroup.add(label.labelObj);

    // Spawn on strictly opposite flanks in mid-arena sky (clear of floodlight gantry heads)
    const isLeft = activeDrones.length === 0 ? Math.random() > 0.5 : activeDrones[0].posOffset.x > 0;
    const startX = isLeft ? -11.5 : 11.5;
    const startY = (isLeft ? 1.5 : 2.35) + Math.random() * 0.7;
    const startZ = -16 - Math.random() * 4;
    droneGroup.position.set(startX, startY, startZ);

    scene.add(droneGroup);

    activeDrones.push({
      mesh: droneGroup,
      label,
      word,
      progress: 0,
      speed: difficulty === 'nightmare' ? 0.24 : difficulty === 'cadet' ? 0.12 : (isPhase2 ? 0.22 : 0.16),
      posOffset: new THREE.Vector3(startX, startY, startZ),
      isDestroyed: false,
      animHandle,
      isRocket,
    });

    // Update input placeholder to prime the typist
    inputEl.placeholder = isRocket
      ? `INTERCEPT ROCKET: "${word}"`
      : `INTERCEPT DRONE: "${word}"`;
  }

  function destroyDrone(drone: InterceptorDrone, hitByPlayer: boolean): void {
    drone.isDestroyed = true;
    const pos = drone.mesh.position.clone();

    if (hitByPlayer) {
      targetsDestroyed++;
      currentStreak++;
      if (currentStreak > maxStreak) maxStreak = currentStreak;
      score += 100 + currentStreak * 15;
      bossStagger += isPhase2 ? 22 : 30;

      playArcadeLaser();
      playArcadeExplosion();
      shakeCamera(0.45);
      triggerWeaponRecoil(true);

      // Fire tracer beam + physical 3D plasma slug from player muzzle to drone
      const boltHex = isPhase2 ? 0xf43f5e : 0x38bdf8;
      spawnPlasmaBolt(pos, boltHex);
      fireLaserBeam(new THREE.Vector3(0.4, -0.4, 17.5), pos, new THREE.Color(boltHex));
      create3DExplosion(pos, new THREE.Color(boltHex), 24);

      spawnFloatingCombatText(`+100`, 'normal', 50 + (pos.x * 3), 45);

      dronesDefeatedInVolley++;
      updateHUD();

      // Check if boss stagger threshold reached or volley wave cleared
      if (bossStagger >= 100) {
        transitionToStagger();
        return;
      } else if (dronesDefeatedInVolley >= 2) {
        transitionToTelegraph();
        return;
      }
    } else {
      // Drone reached player viewpoint - impact explosion
      playerHp -= 10;
      currentStreak = 0;
      playArcadeDamage();
      shakeCamera(1.2);
      triggerScreenFlash('damage');
      create3DExplosion(new THREE.Vector3(0, 0, 14), new THREE.Color(0xef4444), 30);
      spawnFloatingCombatText(`-10 HP`, 'crit', 50, 50);
      updateHUD();

      if (playerHp <= 0) {
        endGame(false);
        return;
      }

      transitionToTelegraph();
      return;
    }

    // Clean up Three.js objects
    drone.label.dispose();
    if (drone.animHandle) {
      drone.animHandle.dispose();
    }
    scene.remove(drone.mesh);
    drone.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material) (child.material as THREE.Material).dispose();
      }
    });

    activeDrones = activeDrones.filter((d) => d !== drone);
    if (activeDrones.length === 0 && bossState === 'VOLLEY') {
      droneSpawnTimer = 2.65; // Next drone arrives in ~0.35s for crisp tempo!
    }
    inputEl.placeholder = activeDrones[0]
      ? (activeDrones[0].isRocket ? `INTERCEPT ROCKET: "${activeDrones[0].word}"` : `INTERCEPT DRONE: "${activeDrones[0].word}"`)
      : 'SCANNING FOR INCOMING TARGET...';
  }

  function clearAllDrones(): void {
    activeDrones.forEach((d) => {
      d.label.dispose();
      if (d.animHandle) {
        d.animHandle.dispose();
      }
      scene.remove(d.mesh);
      d.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (child.material) (child.material as THREE.Material).dispose();
        }
      });
    });
    activeDrones = [];
  }

  // --- STATE TRANSITIONS ---

  function transitionToVolley(): void {
    bossState = 'VOLLEY';
    stateTime = 0;
    droneSpawnTimer = 1.6;
    dronesDefeatedInVolley = 0;
    clearAllDrones();

    inputEl.value = '';
    inputEl.placeholder = 'DRONE VOLLEY // TYPE TARGET CODES!';
    combatLabel.setError(false);
    combatLabel.setHighlight(false);
    combatLabel.labelObj.visible = false;

    setBossVisualPalette(isPhase2 ? 0xf43f5e : 0x38bdf8, 3.2);

    // Reset arm combat-guard pose & grounded stance on Dais
    bossGroup.position.set(0, 0, -4);
    bossGroup.rotation.x = 0;
    leftArm.armRoot.rotation.set(-0.38, 0, 0.25);
    rightArm.armRoot.rotation.set(-0.38, 0, -0.25);
    leftArm.bladeArmGroup.rotation.set(-0.68, 0, 0);
    rightArm.bladeArmGroup.rotation.set(-0.68, 0, 0);
    headGroup.rotation.set(0, 0, 0);

    // Spawn first drone immediately
    spawnInterceptorDrone();
  }

  function transitionToTelegraph(): void {
    bossState = 'TELEGRAPH';
    stateTime = 0;
    clearAllDrones();

    const pool = isPhase2 ? BERSERK_DEFENSE_WORDS : DEFENSE_WORDS;
    activeDefenseWord = pool[Math.floor(Math.random() * pool.length)];

    // Generous scalable parry window
    const baseDuration = difficulty === 'nightmare' ? 3.8 : difficulty === 'cadet' ? 6.2 : (isPhase2 ? 4.2 : 5.0);
    attackDuration = Number((baseDuration + activeDefenseWord.length * 0.36).toFixed(1));
    attackTimer = attackDuration;

    playWarningAlarm();
    triggerScreenFlash('parry');

    // Boss leaps forward directly towards camera in dramatic menacing telegraph stance
    bossGroup.position.set(0, 0.04, 2.5);
    bossGroup.rotation.x = 0;

    // Wind back twin plasma katanas high overhead
    leftArm.armRoot.rotation.set(-1.4, 0, 0.3);
    rightArm.armRoot.rotation.set(-1.4, 0, -0.3);
    leftArm.bladeArmGroup.rotation.set(-0.6, 0, 0);
    rightArm.bladeArmGroup.rotation.set(-0.6, 0, 0);

    setBossVisualPalette(0xf59e0b, 5.5); // Intense Warning Amber
    combatLabel.labelObj.visible = true;
    combatLabel.setError(true);
    combatLabel.setWordProgress(activeDefenseWord, 0, true);

    inputEl.value = '';
    inputEl.placeholder = `PARRY STRIKE: "${activeDefenseWord}" (${attackDuration}s)`;
    inputEl.focus();

    updateHUD();
  }

  function onSuccessfulParry(elapsed: number): void {
    targetsDestroyed++;
    currentStreak++;
    if (currentStreak > maxStreak) maxStreak = currentStreak;

    // Evaluate Perfect Parry threshold (<45% of available duration)
    const isPerfect = elapsed <= attackDuration * 0.45;

    if (isPerfect) {
      hitPauseTimer = 0.08; // 80ms slow-mo hit stop
      shakeCamera(1.1);
      playCriticalImpact();
      playParryClash();
      triggerScreenFlash('perfect');

      score += 250 + currentStreak * 25;
      bossStagger += isPhase2 ? 45 : 55;
      spawnFloatingCombatText('PERFECT PARRY! +500', 'crit', 28, 34);
    } else {
      shakeCamera(0.65);
      playParryClash();
      triggerScreenFlash('parry');

      score += 100 + currentStreak * 15;
      bossStagger += isPhase2 ? 28 : 36;
      spawnFloatingCombatText('DEFLECTED! +200', 'parry', 72, 36);
    }

    // Deploy 3D Energy Parry Shield Dome
    parryDomeMat.opacity = 0.92;
    parryDomeMat.color.setHex(isPerfect ? 0x4ade80 : 0x38bdf8);
    parryDomeMesh.scale.set(1.0, 1.0, 1.0);
    playShieldParryDome();

    // Clash flash in 3D right between camera and boss blades
    const clashPos = new THREE.Vector3(0, 2.0, 10);
    create3DExplosion(clashPos, new THREE.Color(isPerfect ? 0xfacc15 : 0x38bdf8), 32);
    fireLaserBeam(clashPos, bossGroup.position, new THREE.Color(isPerfect ? 0xfacc15 : 0x38bdf8));

    // Recoil boss backward from force of deflection
    bossGroup.position.z = -6.5;
    leftArm.armRoot.rotation.x = 0.9;
    rightArm.armRoot.rotation.x = 0.9;

    updateHUD();

    if (bossStagger >= 100) {
      transitionToStagger();
    } else {
      setTimeout(() => {
        if (isActive && bossState === 'TELEGRAPH') {
          transitionToVolley();
        }
      }, 450);
    }
  }

  // --- SONIC JET THRUSTER DASH EVASION ---
  function triggerJetThrusterDash(): void {
    playJetDash();
    shakeCamera(0.85);
    triggerScreenFlash('parry');

    const dashDir = Math.random() > 0.5 ? 1 : -1;
    camera.position.x = dashDir * 4.2;
    setTimeout(() => {
      camera.position.x = 0;
    }, 280);

    create3DExplosion(new THREE.Vector3(dashDir * 2.5, 0, 10), new THREE.Color(0x38bdf8), 24);
    spawnFloatingCombatText('💥 JET THRUSTER DODGE! +350', 'crit', 28, 22);

    score += 350;
    bossStagger += 40;
    updateHUD();

    bossGroup.position.z = -6.0;

    if (bossStagger >= 100) {
      transitionToStagger();
    } else {
      setTimeout(() => {
        if (isActive && bossState === 'TELEGRAPH') {
          transitionToVolley();
        }
      }, 420);
    }
  }

  function onFailedDefense(): void {
    currentStreak = 0;
    const dmg = isPhase2 ? 26 : 20;
    playerHp -= dmg;

    playArcadeDamage();
    shakeCamera(2.2);
    triggerScreenFlash('damage');

    // Downward cleave animation
    leftArm.armRoot.rotation.x = 1.5;
    rightArm.armRoot.rotation.x = 1.5;
    bossGroup.position.z = 6;

    spawnFloatingCombatText(`-${dmg} HP`, 'crit', 50, 48);
    updateHUD();

    if (playerHp <= 0) {
      endGame(false);
      return;
    }

    setTimeout(() => {
      if (isActive) transitionToVolley();
    }, 600);
  }

  function transitionToStagger(): void {
    bossState = 'STAGGERED';
    stateTime = 0;
    staggerTimer = 12.0; // 12 seconds vulnerability window
    bossStagger = 100;
    activeComboIndex = 0;
    activeComboChain = COMBO_CHAINS[Math.floor(Math.random() * COMBO_CHAINS.length)];

    playBossStagger();
    playCriticalImpact();
    speakMechVoice('Critical core breach. Defense offline.');
    shakeCamera(1.8);
    triggerScreenFlash('stagger');

    // Overdrive stagger shockwave burst
    create3DExplosion(bossGroup.position, new THREE.Color(0xa855f7), 60);

    // Boss hunches critically injured without sinking boots into the dais
    bossGroup.position.set(0, -0.18, -3.5);
    bossGroup.rotation.x = 0.14;
    headGroup.rotation.x = 0.65;
    leftArm.armRoot.rotation.set(0.6, 0, 0.75);
    rightArm.armRoot.rotation.set(0.6, 0, -0.75);
    leftArm.bladeArmGroup.rotation.set(-0.5, 0, 0);
    rightArm.bladeArmGroup.rotation.set(-0.5, 0, 0);

    setBossVisualPalette(0xa855f7, 5.0); // Staggered Neon Purple
    combatLabel.labelObj.visible = true;
    combatLabel.setError(false);
    combatLabel.setHighlight(true);
    promptNextComboWord();
    updateHUD();
  }

  function promptNextComboWord(): void {
    if (activeComboIndex >= activeComboChain.length) {
      activeComboChain = COMBO_CHAINS[Math.floor(Math.random() * COMBO_CHAINS.length)];
      activeComboIndex = 0;
    }
    const word = activeComboChain[activeComboIndex];
    inputEl.value = '';
    inputEl.placeholder = `OVERDRIVE COMBO: "${word}"`;
    combatLabel.setWordProgress(`${word}`, 0, true);
  }

  function onSuccessfulComboWord(): void {
    targetsDestroyed++;
    currentStreak++;
    if (currentStreak > maxStreak) maxStreak = currentStreak;

    const baseDmg = isPhase2 ? 480 : 420;
    bossHp -= baseDmg;
    score += 200 + currentStreak * 25;

    playArcadeLaser();
    playArcadeExplosion();
    playArcadeCombo();
    shakeCamera(0.9);
    triggerWeaponRecoil(true);
    checkArmorPlateBreakage();

    // Multi-beam plasma missile barrage hitting core
    const beamOrigin1 = new THREE.Vector3(-3.5, -2, 14);
    const beamOrigin2 = new THREE.Vector3(3.5, -2, 14);
    const targetCorePos = coreMesh.position.clone().add(bossGroup.position);

    fireLaserBeam(beamOrigin1, targetCorePos, new THREE.Color(0xf43f5e));
    fireLaserBeam(beamOrigin2, targetCorePos, new THREE.Color(0x38bdf8));
    spawnPlasmaBolt(targetCorePos, 0xfacc15);
    create3DExplosion(targetCorePos, new THREE.Color(0xf43f5e), 36);

    spawnFloatingCombatText(`-${baseDmg} CRIT!`, 'crit', Math.random() > 0.5 ? 68 : 32, 42);
    updateHUD();

    // Check Phase 2 Berserk Threshold
    if (!isPhase2 && bossHp <= MAX_BOSS_HP * 0.5) {
      isPhase2 = true;
      speakMechVoice('Warning. Berserk overdrive activated.');
      playArcadePowerup();
      playBossOverdriveAlarm();
      playWarningAlarm();
      shakeCamera(2.2);
      triggerScreenFlash('damage');
      spawnFloatingCombatText('WARNING: BERSERK OVERDRIVE ACTIVATED!', 'crit', 50, 18);
    }

    if (bossHp <= 0) {
      endGame(true);
      return;
    }

    activeComboIndex++;
    promptNextComboWord();
  }

  // --- KEYBOARD INPUT DISPATCHER ---

  let lastKeyWasBackspace = false;

  function processTypedInput(val: string, isBackspace: boolean): void {
    if (bossState === 'VOLLEY') {
      const trimmed = val.trim();
      // Auto-target ANY active drone matching full word or prefix (seamless multi-target engagement!)
      const exactMatch = activeDrones.find((d) => trimmed === d.word);
      if (exactMatch) {
        correctKeystrokes += trimmed.length;
        destroyDrone(exactMatch, true);
        inputEl.value = '';
        return;
      }

      let anyPrefixMatch = false;
      activeDrones.forEach((d) => {
        if (trimmed.length > 0 && d.word.startsWith(trimmed)) {
          anyPrefixMatch = true;
          d.label.setWordProgress(d.word, trimmed.length, true);
        } else {
          d.label.setWordProgress(d.word, 0, false);
        }
      });
      if (anyPrefixMatch && !isBackspace) {
        correctKeystrokes++;
        playTactileClick('key');
        triggerWeaponRecoil(false);
      }
    } else if (bossState === 'TELEGRAPH') {
      if (['DODGE', 'DASH', 'EVADE', 'ROLL'].includes(val.trim())) {
        triggerJetThrusterDash();
        inputEl.value = '';
        return;
      }

      if (val === activeDefenseWord) {
        correctKeystrokes += val.length;
        onSuccessfulParry(stateTime);
        return;
      }

      if (activeDefenseWord.startsWith(val)) {
        if (!isBackspace && val.length > 0) {
          correctKeystrokes++;
          playTactileClick('key');
          triggerWeaponRecoil(false);
        }
        combatLabel.setWordProgress(activeDefenseWord, val.length, true);
      } else {
        combatLabel.setWordProgress(activeDefenseWord, 0, true);
      }
    } else if (bossState === 'STAGGERED') {
      const expected = activeComboChain[activeComboIndex];
      if (!expected) return;

      if (val === expected) {
        correctKeystrokes += val.length;
        onSuccessfulComboWord();
        return;
      }

      if (expected.startsWith(val)) {
        if (!isBackspace && val.length > 0) {
          correctKeystrokes++;
          playTactileClick('key');
          triggerWeaponRecoil(false);
        }
        combatLabel.setError(false);
        combatLabel.setWordProgress(expected, val.length, true);
      } else {
        combatLabel.setError(val.length > 0);
        combatLabel.setWordProgress(expected, 0, true);
      }
    }
  }

  function handleTextInput(): void {
    if (!isActive) return;
    // Preserve typed Space characters between multi-word targets while cleaning accidental leading spaces
    const val = inputEl.value.trimStart().toUpperCase();
    const isBackspace = lastKeyWasBackspace;
    lastKeyWasBackspace = false;
    processTypedInput(val, isBackspace);
  }

  function handleInput(e: KeyboardEvent): void {
    if (!isActive) return;

    lastKeyWasBackspace = e.key === 'Backspace';
    const currentUpper = inputEl.value.trimStart().toUpperCase();
    const expectedCombo = bossState === 'STAGGERED' ? (activeComboChain[activeComboIndex] ?? '') : '';
    const expectsSpaceInTarget =
      (bossState === 'TELEGRAPH' && activeDefenseWord.includes(' ')) ||
      (bossState === 'STAGGERED' && expectedCombo.includes(' '));

    const isSubmitSpace =
      e.key === ' ' &&
      (!expectsSpaceInTarget ||
        ['DODGE', 'DASH', 'EVADE', 'ROLL', activeDefenseWord, expectedCombo].includes(currentUpper.trim()));

    if (e.key === 'Enter' || isSubmitSpace) {
      e.preventDefault();
      const val = inputEl.value.trim().toUpperCase();
      if (!val) return;

      if (bossState === 'VOLLEY') {
        const matchedDrone = activeDrones.find((d) => d.word === val);
        if (matchedDrone) {
          correctKeystrokes += val.length;
          destroyDrone(matchedDrone, true);
          inputEl.value = '';
        }
      } else if (bossState === 'TELEGRAPH') {
        if (['DODGE', 'DASH', 'EVADE', 'ROLL'].includes(val)) {
          triggerJetThrusterDash();
          inputEl.value = '';
        } else if (val === activeDefenseWord) {
          correctKeystrokes += val.length;
          onSuccessfulParry(stateTime);
        } else if (e.key === 'Enter') {
          onFailedDefense();
        }
      } else if (bossState === 'STAGGERED') {
        if (val === expectedCombo) {
          correctKeystrokes += val.length;
          onSuccessfulComboWord();
        }
      }
      return;
    }

    if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      totalKeystrokes++;
    }
  }

  function onStageClick(): void {
    if (isActive) inputEl.focus();
  }
  stageEl.addEventListener('click', onStageClick);

  inputEl.addEventListener('keydown', handleInput);
  inputEl.addEventListener('input', handleTextInput);
  inputEl.disabled = false;
  inputEl.value = '';
  inputEl.placeholder = 'Prepare for cyber combat...';
  inputEl.focus();

  // Initial State Mount
  transitionToVolley();
  speakMechVoice('Nexus 9 engaged. Commencing combat protocol.');

  // --- ANIMATION & PHYSICS TICK LOOP ---
  let lastFrameTime = performance.now();
  let hudUpdateAccum = 0;

  function animate(now: number): void {
    if (!isActive) return;
    const rawDelta = Math.min((now - lastFrameTime) / 1000, 0.1);
    lastFrameTime = now;

    // Micro hit-pause freeze frame for impactful parry feel
    if (hitPauseTimer > 0) {
      hitPauseTimer -= rawDelta;
      animationId = requestAnimationFrame(animate);
      return;
    }

    const delta = rawDelta;

    if (!fw.isPaused) {
      stateTime += delta;

      // 1. Grounded Stance & Subtle Core Scan + Grounded Shadow Tracking
      if (bossState !== 'STAGGERED') {
        chestMesh.rotation.y = Math.sin(now * 0.0016) * 0.08;
        headGroup.rotation.y = Math.sin(now * 0.0012) * 0.06;
      }
      bossShadowMesh.position.set(bossGroup.position.x, -4.118, bossGroup.position.z);
      const hoverFactor = Math.max(0.75, 1.0 - Math.max(0, bossGroup.position.y) * 0.2);
      bossShadowMesh.scale.setScalar(hoverFactor);
      bossShadowMat.opacity = 0.85 * hoverFactor;

      // 2. Update Weapon Viewmodel Recoil, Digital Charge Bars, Streak Heat & Muzzle Flash
      if (muzzleFlashTimer > 0) {
        muzzleFlashTimer -= delta;
        if (muzzleFlashTimer <= 0) {
          muzzleLight.intensity = 0;
          muzzleRingMat.opacity = 0;
        }
      }
      weaponRecoilZ = THREE.MathUtils.lerp(weaponRecoilZ, 0, 0.2);
      const swayX = Math.cos(now * 0.002) * 0.005;
      const swayY = Math.sin(now * 0.004) * 0.007;
      weaponViewModel.position.set(0.36 + swayX, -0.32 + swayY, -0.78 + weaponRecoilZ);
      turbineMesh.rotation.z += delta * (14 + Math.min(currentStreak, 15) * 1.2);

      const heatColor = isPhase2
        ? 0xf43f5e
        : currentStreak >= 12
          ? 0xf43f5e
          : currentStreak >= 6
            ? 0xf59e0b
            : activeSkin.accentColor;
      ventGlowMat.color.setHex(heatColor);
      coilMat.color.setHex(heatColor);
      railMat.emissive.setHex(heatColor);

      const litCount = Math.max(1, Math.min(5, Math.ceil((currentStreak + 1) / 3)));
      chargeBars.forEach((bar, idx) => {
        const barMat = bar.material as THREE.MeshBasicMaterial;
        barMat.color.setHex(idx < litCount ? heatColor : 0x1e293b);
      });

      // 2b. Update Physical 3D Flying Razor Piercing Arrow Munitions
      for (let i = activeBolts.length - 1; i >= 0; i--) {
        const bolt = activeBolts[i];
        bolt.life -= delta;
        bolt.handle.group.position.addScaledVector(bolt.velocity, delta);
        bolt.handle.update?.(delta, now * 0.001);
        if (bolt.life <= 0 || bolt.handle.group.position.distanceTo(bolt.targetPos) < 2.2) {
          scene.remove(bolt.handle.group);
          bolt.handle.dispose();
          activeBolts.splice(i, 1);
        }
      }

      // 2c. Animate Ambient Hydraulic Steam Plumes around Boss Dais
      const steamAttr = steamGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < STEAM_COUNT; i++) {
        let sy = steamAttr.getY(i) + steamSpeeds[i] * delta;
        if (sy > 4.5) sy = -4.2;
        steamAttr.setY(i, sy);
      }
      steamAttr.needsUpdate = true;

      // 3. Update Parry Energy Dome
      if (parryDomeMat.opacity > 0) {
        parryDomeMat.opacity = Math.max(0, parryDomeMat.opacity - delta * 2.8);
        parryDomeMesh.scale.addScalar(delta * 2.2);
      }

      // 4. Update flying detached armor debris
      for (let i = activeFlyingDebris.length - 1; i >= 0; i--) {
        const d = activeFlyingDebris[i];
        d.velocity.y -= delta * 18;
        d.mesh.position.addScaledVector(d.velocity, delta);
        d.mesh.rotation.x += d.rotVelocity.x * delta;
        d.mesh.rotation.y += d.rotVelocity.y * delta;
        d.mesh.rotation.z += d.rotVelocity.z * delta;

        if (d.mesh.position.y < -35 || d.mesh.position.z > 35) {
          scene.remove(d.mesh);
          activeFlyingDebris.splice(i, 1);
        }
      }

      // 5. Drone Interceptors Logic
      if (bossState === 'VOLLEY') {
        droneSpawnTimer += delta;
        if (droneSpawnTimer > 3.0 && activeDrones.length < 2) {
          droneSpawnTimer = 0;
          spawnInterceptorDrone();
        }

        for (let i = activeDrones.length - 1; i >= 0; i--) {
          const drone = activeDrones[i];
          drone.progress += delta * drone.speed;

          // Drone curved trajectory towards player camera (mid-sky flanking arcs)
          const targetEndX = drone.posOffset.x > 0 ? 3.5 : -3.5;
          const currX = THREE.MathUtils.lerp(drone.posOffset.x, targetEndX, drone.progress);
          const currZ = THREE.MathUtils.lerp(drone.posOffset.z, 14, drone.progress);
          const currY = drone.posOffset.y + Math.sin(drone.progress * Math.PI) * 0.85;

          drone.mesh.position.set(currX, currY, currZ);
          if (drone.animHandle?.update) {
            drone.animHandle.update(delta, now * 0.001);
          }
          drone.mesh.rotation.z = (drone.posOffset.x > 0 ? -0.25 : 0.25) * (1 - drone.progress);
          drone.mesh.rotation.y = (drone.posOffset.x > 0 ? -0.18 : 0.18) * (1 - drone.progress);
          drone.mesh.rotation.x = Math.sin(now * 0.003 + i) * 0.08;

          if (drone.progress >= 1.0) {
            destroyDrone(drone, false);
          }
        }
      } else if (bossState === 'TELEGRAPH') {
        attackTimer -= delta;
        hudUpdateAccum += delta;
        if (hudUpdateAccum >= 0.08) {
          hudUpdateAccum = 0;
          updateHUD();
        }

        // Arm wind-up vibration
        leftArm.armRoot.rotation.x = -1.4 + Math.sin(now * 0.03) * 0.08;
        rightArm.armRoot.rotation.x = -1.4 + Math.cos(now * 0.03) * 0.08;

        if (attackTimer <= 0) {
          onFailedDefense();
        }
      } else if (bossState === 'STAGGERED') {
        staggerTimer -= delta;
        hudUpdateAccum += delta;
        if (hudUpdateAccum >= 0.08) {
          hudUpdateAccum = 0;
          updateHUD();
        }

        // Staggered sparks erupting from core
        if (Math.random() < 0.25) {
          create3DExplosion(coreMesh.position.clone().add(bossGroup.position), new THREE.Color(0xa855f7), 6);
        }

        if (staggerTimer <= 0) {
          // Boss reboots
          bossStagger = 0;
          headGroup.rotation.x = 0;
          bossGroup.position.set(0, 0, -4);
          playArcadeCombo();
          triggerScreenFlash('parry');
          transitionToVolley();
          updateHUD();
        }
      }

      updateFX(delta);
    }

    animationId = requestAnimationFrame(animate);
  }

  animationId = requestAnimationFrame(animate);

  // --- GAME CONCLUSION ---
  function endGame(victory: boolean): void {
    stop();
    const diffMultiplier = difficulty === 'nightmare' ? 1.5 : difficulty === 'cadet' ? 0.85 : 1.0;
    const finalScore = Math.round((victory ? score + 1500 + playerHp * 20 : score) * diffMultiplier);
    const accuracy = totalKeystrokes > 0 ? Math.round((correctKeystrokes / totalKeystrokes) * 100) : 95;

    if (victory) {
      speakMechVoice('Combat matrix terminated. Target victorious.');
      playFinishFanfare();
      playArcadePowerup();
      create3DExplosion(bossGroup.position, new THREE.Color(0x38bdf8), 100);
      create3DExplosion(bossGroup.position, new THREE.Color(0xf43f5e), 100);
      create3DExplosion(bossGroup.position, new THREE.Color(0xfacc15), 100);

      if (difficulty === 'elite' || difficulty === 'nightmare') {
        unlockArcadeTrophy('nexusSlayer');
      }
    } else {
      speakMechVoice('Target terminated. Nexus 9 victorious.');
    }

    if (accuracy >= 98) {
      unlockArcadeTrophy('deadeyeSniper');
    }

    if (onEndCallback) {
      onEndCallback({
        score: finalScore,
        words: targetsDestroyed,
        accuracy: Math.min(100, Math.max(70, accuracy)),
        maxCombo: maxStreak,
      });
    }
  }

  // --- SAFE TEARDOWN ---
  function stop(): void {
    isActive = false;
    if (animationId) cancelAnimationFrame(animationId);
    inputEl.removeEventListener('keydown', handleInput);
    inputEl.removeEventListener('input', handleTextInput);
    stageEl.removeEventListener('click', onStageClick);

    clearAllDrones();
    combatLabel.dispose();

    if (flashEl && flashEl.parentNode) {
      flashEl.remove();
    }

    // Clean up Three.js Geometries & Materials
    camera.remove(weaponViewModel);
    camera.remove(vmLight);
    vmLight.dispose();
    scene.remove(parryDomeMesh);
    activeFlyingDebris.forEach((d) => scene.remove(d.mesh));
    activeBolts.forEach((b) => {
      scene.remove(b.handle.group);
      b.handle.dispose();
    });
    scene.remove(bossGroup);
    scene.remove(platformMesh);
    scene.remove(deckMesh);
    scene.remove(daisMesh);
    scene.remove(daisRimMesh);
    scene.remove(bossShadowMesh);
    scene.remove(hazardRingMesh);
    scene.remove(skylineMesh);
    scene.remove(towerGroup);
    scene.remove(arenaOverheadLight);
    scene.remove(arenaWallGroup);
    scene.remove(steamPoints);

    arenaOverheadLight.dispose();
    platformGeo.dispose();
    platformMat.dispose();
    deckGeo.dispose();
    deckMat.dispose();
    daisGeo.dispose();
    daisMat.dispose();
    daisRimGeo.dispose();
    daisRimMat.dispose();
    bossShadowGeo.dispose();
    bossShadowMat.dispose();
    shadowDiscTex.dispose();
    hazardRingGeo.dispose();
    hazardRingMat.dispose();
    skylineGeo.dispose();
    skylineMat.dispose();
    steamGeo.dispose();
    steamMat.dispose();
    hazardStripeTex.dispose();
    steamSpriteTex.dispose();
    asphaltMap.dispose();
    asphaltRoughness.dispose();
    metalPanelsTexture.dispose();
    carbonFiberTexture.dispose();
    citySkylineTexture.dispose();
    beamFadeTex.dispose();

    towerGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });

    bossGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });

    dispose();
  }

  return { stop, id: 'titanProtocol' };
}
