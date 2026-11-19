// Cyber Extraction — AAA 3D Tactical Perimeter Defense & Wave Survival Shooter
// 100% Framework-Free Pure TypeScript with Three.js & CSS2DRenderer
// Features: 3D Dual Rotary Minigun Turret with Barrel Spin & Shell Ejection,
// Multiple Hostile Classes (Skimmers, Stalkers, Goliaths), Tactical Killstreaks (Mortar, Orbital Beam, EMP Nuke),
// Procedural Metal & Asphalt Textures, Dynamic Searchlights & Extraction Dropship

import * as THREE from 'three';
import { create3DGameFramework, Framework3DInstance, Label2DHandle } from '../../core/arcade-3d-framework.ts';
import {
  playTactileClick,
  playFinishFanfare,
  playMinigunBurst,
  playArtilleryShell,
  playNukeDetonation,
  playArcadeExplosion,
  playArcadeDamage,
  playArcadePowerup,
  speakMechVoice,
  playRadarPing,
  playStratagemBeacon,
} from '../../utils/sound.ts';
import {
  createMetalPanelsTexture,
  createAsphaltTexture,
  createCitySkylineTexture,
} from '../../utils/procedural-textures.ts';
import {
  GameInstanceHandle,
  ArcadeDifficulty,
  unlockArcadeTrophy,
  getActiveWeaponSkin,
} from './arcade-types.ts';
import {
  buildCombatRobot,
  buildAerialPredatorDrone,
  buildGoliathSiegeTank,
  buildCombatRocket,
  ModelAnimationHandle,
} from './procedural-models.ts';

export function startCyberExtractionGame(
  stageEl: HTMLElement,
  inputEl: HTMLInputElement,
  hudEl: HTMLElement,
  onEndCallback: (stats: { score: number; words: number; accuracy: number; maxCombo: number }) => void,
  difficulty: ArcadeDifficulty = 'elite'
): GameInstanceHandle {
  const EVAC_DURATION = difficulty === 'nightmare' ? 75 : difficulty === 'cadet' ? 45 : 60;
  let remainingEvacTime = EVAC_DURATION;
  let barricadeHp = 100;
  let score = 0;
  let hostilesEliminated = 0;
  let totalKeystrokes = 0;
  let correctKeystrokes = 0;
  let currentStreak = 0;
  let maxStreak = 0;
  let isGameEnded = false;

  // Killstreak Tracker
  let killstreakCount = 0;

  // --- VOCABULARY ARRAYS ---
  const SKIMMER_WORDS = [
    'ION', 'EMP', 'ARC', 'FLUX', 'BOLT', 'CELL', 'GRID', 'BEAM', 'BYTE', 'NEXUS',
    'PULSE', 'LOCK', 'RUSH', 'SURGE', 'VOLT', 'WASP', 'DART', 'HAWK', 'BYTE', 'CORE',
  ];

  const STALKER_WORDS = [
    'BREACH', 'STALKER', 'HUNTER', 'VECTOR', 'CIPHER', 'MATRIX', 'REAPER', 'SHADOW',
    'RAVAGER', 'STRIKER', 'SHREDDER', 'COMBAT', 'ASSAULT', 'TACTIC', 'CYBER', 'PHANTOM',
  ];

  const GOLIATH_WORDS = [
    'JUGGERNAUT', 'DREADNOUGHT', 'ANNIHILATOR', 'DEVASTATOR', 'OBLIVION',
    'SUPERMASS', 'TITANCLASH', 'WARHAMMER', 'COLOSSUS', 'CENTURION',
  ];

  // --- HUD INITIALIZATION ---
  hudEl.innerHTML = `
    <div class="arcade-hud-pills">
      <span class="arcade-pill">Evac ETA: <strong id="evac-timer" class="hud-timer" style="color:#38bdf8;">${EVAC_DURATION}s</strong></span>
      <span class="arcade-pill">Perimeter: <strong id="evac-hp" class="hud-accent" style="color:#4ade80;">100%</strong></span>
      <span class="arcade-pill">Kills: <strong id="evac-kills" class="hud-accent">0</strong></span>
      <span class="arcade-pill">Killstreak: <strong id="evac-streak" class="hud-combo">x0</strong></span>
      <span class="arcade-pill hud-game-tag" style="color:#38bdf8;">Zone Extraction</span>
    </div>
  `;

  // Tactical Sonar Radar Overlay HUD
  const radarWrap = document.createElement('div');
  radarWrap.id = 'extraction-radar-hud';
  radarWrap.style.position = 'absolute';
  radarWrap.style.top = '16px';
  radarWrap.style.left = '16px';
  radarWrap.style.width = '110px';
  radarWrap.style.height = '110px';
  radarWrap.style.borderRadius = '50%';
  radarWrap.style.background = 'radial-gradient(circle, rgba(15,23,42,0.85) 0%, rgba(5,4,10,0.95) 100%)';
  radarWrap.style.border = '1px solid rgba(56,189,248,0.4)';
  radarWrap.style.boxShadow = '0 0 15px rgba(56,189,248,0.2)';
  radarWrap.style.pointerEvents = 'none';
  radarWrap.style.zIndex = '20';
  radarWrap.innerHTML = `
    <canvas width="110" height="110" id="radar-canvas" style="display:block;border-radius:50%;"></canvas>
    <div style="position:absolute;bottom:-18px;left:0;width:100%;text-align:center;font-family:'JetBrains Mono',monospace;font-size:9px;color:#38bdf8;letter-spacing:1px;font-weight:700;">SONAR // 120M</div>
  `;
  stageEl.appendChild(radarWrap);
  const radarCanvas = radarWrap.querySelector('#radar-canvas') as HTMLCanvasElement;
  const radarCtx = radarCanvas ? radarCanvas.getContext('2d') : null;

  // --- 3D SCENE & FRAMEWORK SETUP (Elevated Tactical Over-The-Shoulder Gunner View) ---
  const fw: Framework3DInstance = create3DGameFramework(stageEl, {
    fov: 64,
    camX: 0,
    camY: 4.6,
    camZ: 15.6,
    camRotX: -0.18,
    backgroundColor: 0x05040a,
    fogColor: 0x05040a,
    fogDensity: 0.0085,
    ambientColor: 0x1e293b,
    ambientIntensity: 1.0,
    keyColor: 0x38bdf8,
    keyIntensity: 2.8,
    fillColor: 0xf59e0b,
    fillIntensity: 1.8,
    rimColor: 0xa855f7,
    rimIntensity: 2.8,
    starColor: 0x38bdf8,
    starSize: 0.7,
    starSpeed: 8,
  });

  const { scene, shakeCamera, create3DExplosion, fireLaserBeam, create2DLabel, updateFX, dispose } = fw;

  // --- PROCEDURAL TEXTURES ---
  const metalPanelsTexture = createMetalPanelsTexture();
  metalPanelsTexture.repeat.set(6, 6);

  const { map: asphaltMap, roughnessMap: asphaltRoughness } = createAsphaltTexture();
  asphaltMap.repeat.set(8, 8);

  const citySkylineTexture = createCitySkylineTexture();

  // Distant Cyber City Skybox
  const skyGeo = new THREE.CylinderGeometry(150, 150, 70, 32, 1, true);
  const skyMat = new THREE.MeshBasicMaterial({
    map: citySkylineTexture,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.85,
  });
  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  skyMesh.position.set(0, 20, -30);
  scene.add(skyMesh);

  // Fortified LZ Ground Plane
  const groundGeo = new THREE.PlaneGeometry(160, 160);
  groundGeo.rotateX(-Math.PI / 2);
  const groundMat = new THREE.MeshStandardMaterial({
    map: asphaltMap,
    roughnessMap: asphaltRoughness,
    roughness: 0.45,
    metalness: 0.6,
  });
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.position.y = -0.05;
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

  // Fortified Perimeter Barricades with Hazard Stripes
  const barricadesGroup = new THREE.Group();
  const barricadeGeo = new THREE.BoxGeometry(4.2, 1.4, 0.8);
  const barricadeMat = new THREE.MeshStandardMaterial({
    map: metalPanelsTexture,
    roughness: 0.35,
    metalness: 0.85,
  });

  [-10, -5, 0, 5, 10].forEach((bx) => {
    const bMesh = new THREE.Mesh(barricadeGeo, barricadeMat);
    bMesh.position.set(bx, 0.7, 7.5);
    bMesh.castShadow = true;
    bMesh.receiveShadow = true;
    barricadesGroup.add(bMesh);

    // Glowing Neon Hazard Crest
    const crestGeo = new THREE.BoxGeometry(4.2, 0.12, 0.82);
    const crestMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const crestMesh = new THREE.Mesh(crestGeo, crestMat);
    crestMesh.position.set(bx, 1.42, 7.5);
    barricadesGroup.add(crestMesh);
  });
  scene.add(barricadesGroup);

  // Perimeter Energy Fence Pylons
  [-12, 12].forEach((px) => {
    const pylonGeo = new THREE.CylinderGeometry(0.35, 0.45, 7.5, 8);
    const pylonMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.2 });
    const pylon = new THREE.Mesh(pylonGeo, pylonMat);
    pylon.position.set(px, 3.75, 7.5);
    scene.add(pylon);

    const beaconLight = new THREE.PointLight(0x38bdf8, 3.0, 14);
    beaconLight.position.set(px, 7.2, 7.5);
    scene.add(beaconLight);
  });

  // Hovering Extraction Dropship (Sleek VTOL Gunship Overhead)
  const dropshipGroup = new THREE.Group();
  dropshipGroup.position.set(0, 18.5, -30);

  const hullGeo = new THREE.BoxGeometry(8.2, 2.6, 15.0);
  const hullMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    map: metalPanelsTexture,
    metalness: 0.85,
    roughness: 0.25,
  });
  const dropshipHull = new THREE.Mesh(hullGeo, hullMat);
  dropshipGroup.add(dropshipHull);

  // Angled Dropship Swept Wings & Illuminated Cockpit Canopy
  const dsWingGeo = new THREE.BoxGeometry(19.0, 0.35, 4.2);
  const dsWing = new THREE.Mesh(dsWingGeo, hullMat);
  dsWing.position.set(0, 0.4, -1.5);
  dropshipGroup.add(dsWing);

  const cockpitGeo = new THREE.BoxGeometry(3.6, 1.2, 2.8);
  const cockpitMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.7, metalness: 0.9, roughness: 0.1 });
  const cockpit = new THREE.Mesh(cockpitGeo, cockpitMat);
  cockpit.position.set(0, -0.2, 7.6);
  dropshipGroup.add(cockpit);

  // VTOL Thruster Pods (4 wing-tip nacelles)
  const thrusterPlumes: THREE.Mesh[] = [];
  [
    [-8.5, 0.2, -1.5],
    [8.5, 0.2, -1.5],
    [-4.8, -0.4, -6.0],
    [4.8, -0.4, -6.0],
  ].forEach(([tx, ty, tz]) => {
    const nacelleGeo = new THREE.CylinderGeometry(0.8, 0.95, 2.6, 12);
    const nacelle = new THREE.Mesh(nacelleGeo, hullMat);
    nacelle.position.set(tx, ty, tz);
    dropshipGroup.add(nacelle);

    const plumeGeo = new THREE.ConeGeometry(0.65, 2.2, 10);
    plumeGeo.rotateX(Math.PI);
    const plumeMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.65 });
    const plume = new THREE.Mesh(plumeGeo, plumeMat);
    plume.position.set(tx, ty - 2.1, tz);
    dropshipGroup.add(plume);
    thrusterPlumes.push(plume);
  });
  scene.add(dropshipGroup);

  // --- PLAYER 3D HEAVY ROTARY MINIGUN TURRET (Over-the-Shoulder Offset so View is Crystal Clear!) ---
  const turretMount = new THREE.Group();
  turretMount.position.set(1.6, 1.45, 10.6);

  // Turret Stand Pylon
  const mountPylonGeo = new THREE.CylinderGeometry(0.45, 0.65, 2.0, 12);
  const mountPylonMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.25 });
  const mountPylon = new THREE.Mesh(mountPylonGeo, mountPylonMat);
  mountPylon.position.set(0, -1.0, 0);
  turretMount.add(mountPylon);

  // Articulated Swivel Head (Aims towards targeted enemy)
  const turretSwivel = new THREE.Group();
  turretMount.add(turretSwivel);

  // Sleek Compact Heavy Rotary Gun Housing
  const activeSkin = getActiveWeaponSkin();
  const gunHousingGeo = new THREE.BoxGeometry(0.95, 0.72, 1.8);
  const gunHousingMat = new THREE.MeshStandardMaterial({
    color: activeSkin.id === 'obsidian' ? 0x64748b : activeSkin.primaryColor,
    map: metalPanelsTexture,
    metalness: activeSkin.metalness,
    roughness: activeSkin.roughness,
    emissive: activeSkin.emissiveColor ? new THREE.Color(activeSkin.emissiveColor) : new THREE.Color(0x000000),
    emissiveIntensity: activeSkin.emissiveColor ? 0.4 : 0,
  });
  const gunHousing = new THREE.Mesh(gunHousingGeo, gunHousingMat);
  gunHousing.position.set(0, 0.35, 0);
  turretSwivel.add(gunHousing);

  // Holographic Ammo Sight Readout on Top
  const turretSightGeo = new THREE.BoxGeometry(0.45, 0.22, 0.35);
  const turretSightMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.75 });
  const turretSight = new THREE.Mesh(turretSightGeo, turretSightMat);
  turretSight.position.set(0, 0.82, -0.2);
  turretSwivel.add(turretSight);

  // Dual Rotary Barrel Clusters (Gatling Barrels)
  const barrelCluster = new THREE.Group();
  barrelCluster.position.set(0, 0.4, -1.4);

  const barrelCount = 6;
  const barrelMat = new THREE.MeshStandardMaterial({
    color: activeSkin.accentColor,
    metalness: activeSkin.metalness,
    roughness: 0.15,
  });
  for (let b = 0; b < barrelCount; b++) {
    const angle = (b / barrelCount) * Math.PI * 2;
    const bGeo = new THREE.CylinderGeometry(0.065, 0.065, 2.8, 8);
    bGeo.rotateX(Math.PI / 2);
    const bMesh = new THREE.Mesh(bGeo, barrelMat);
    bMesh.position.set(Math.sin(angle) * 0.32, Math.cos(angle) * 0.32, -1.2);
    barrelCluster.add(bMesh);
  }
  turretSwivel.add(barrelCluster);

  // Dual Muzzle Flash Point Light & Flares
  const turretMuzzleLight = new THREE.PointLight(0x38bdf8, 0, 12);
  turretMuzzleLight.position.set(0, 0.4, -3.2);
  turretSwivel.add(turretMuzzleLight);

  const muzzleFlareGeo = new THREE.RingGeometry(0.1, 0.45, 12);
  const muzzleFlareMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
  });
  const muzzleFlare = new THREE.Mesh(muzzleFlareGeo, muzzleFlareMat);
  muzzleFlare.position.set(0, 0.4, -3.15);
  turretSwivel.add(muzzleFlare);

  scene.add(turretMount);

  // --- EJECTING BRASS SHELL CASINGS SYSTEM ---
  const SHELL_COUNT = 36;
  const shellGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.16, 6);
  const shellMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.95, roughness: 0.15 });
  const shellPool: { mesh: THREE.Mesh; vel: THREE.Vector3; rotVel: THREE.Vector3; life: number }[] = [];

  for (let i = 0; i < SHELL_COUNT; i++) {
    const sMesh = new THREE.Mesh(shellGeo, shellMat);
    sMesh.position.set(0, -100, 0);
    scene.add(sMesh);
    shellPool.push({
      mesh: sMesh,
      vel: new THREE.Vector3(),
      rotVel: new THREE.Vector3(),
      life: 0,
    });
  }

  let shellIdx = 0;
  function ejectShellCasing(): void {
    const s = shellPool[shellIdx % SHELL_COUNT];
    shellIdx++;
    s.mesh.position.set(
      turretMount.position.x + 0.6,
      turretMount.position.y + 0.3,
      turretMount.position.z - 0.2
    );
    s.vel.set(
      2.5 + Math.random() * 2.0,
      2.2 + Math.random() * 1.5,
      (Math.random() - 0.5) * 1.5
    );
    s.rotVel.set(Math.random() * 15, Math.random() * 15, Math.random() * 15);
    s.life = 1.4;
  }

  // --- HOSTILE ENEMIES MANAGEMENT ---
  type EnemyType = 'skimmer' | 'stalker' | 'goliath';

  interface HostileEntity {
    type: EnemyType;
    group: THREE.Group;
    label: Label2DHandle;
    fullWord: string;
    remainingWord: string;
    speed: number;
    startPos: THREE.Vector3;
    targetPos: THREE.Vector3;
    progress: number; // 0 to 1
    maxHp: number;
    currentHp: number;
    isEliminated: boolean;
    animHandle?: ModelAnimationHandle;
  }

  interface ActiveMortarRocket {
    handle: ModelAnimationHandle;
    origin: THREE.Vector3;
    target: THREE.Vector3;
    progress: number;
    speed: number;
  }

  let activeHostiles: HostileEntity[] = [];
  let activeRockets: ActiveMortarRocket[] = [];
  let enemySpawnTimer = 0;

  function spawnHostileWave(): void {
    if (activeHostiles.length >= 4 || isGameEnded) return;

    // Pick enemy class based on probability
    const rand = Math.random();
    let type: EnemyType = 'skimmer';
    let wordList = SKIMMER_WORDS;
    let baseSpeed = difficulty === 'nightmare' ? 0.045 : difficulty === 'cadet' ? 0.024 : 0.034;
    let hp = 1;

    if (rand > 0.65) {
      type = 'stalker';
      wordList = STALKER_WORDS;
      baseSpeed = difficulty === 'nightmare' ? 0.035 : difficulty === 'cadet' ? 0.018 : 0.025;
      hp = 1;
    } else if (rand > 0.45 && difficulty !== 'cadet') {
      type = 'goliath';
      wordList = GOLIATH_WORDS;
      baseSpeed = difficulty === 'nightmare' ? 0.022 : 0.015;
      hp = 2; // Armored tank
    }

    const word = wordList[Math.floor(Math.random() * wordList.length)];
    const group = new THREE.Group();

    // 3D Procedural Model based on hostile archetype — Genuine Mechas, Drones & Tanks!
    let animHandle: ModelAnimationHandle | undefined;
    if (type === 'skimmer') {
      // Sleek swept-wing delta UAV predator drone with ducted VTOL fans and jet thrusters
      animHandle = buildAerialPredatorDrone({
        scale: 0.9,
        bodyColor: 0x1e293b,
        glowColor: 0x38bdf8,
      });
      group.add(animHandle.group);
    } else if (type === 'stalker') {
      // Articulated bipedal combat mecha robot with glowing sensor visor, pauldrons, pulse rifle, and mecha boots
      animHandle = buildCombatRobot({
        scale: 0.95,
        primaryColor: 0x334155,
        accentColor: 0xef4444,
        glowColor: 0xfacc15,
        weaponType: 'rifle',
      });
      group.add(animHandle.group);
    } else {
      // Heavy armored Goliath siege tank with dual caterpillar tracks, rotating fortress turret, and twin railguns
      animHandle = buildGoliathSiegeTank({
        scale: 0.82,
        armorColor: 0x1e293b,
        glowColor: 0xa855f7,
      });
      group.add(animHandle.group);
    }

    // Spawn coordinate along outer perimeter
    const spawnAngle = (Math.random() - 0.5) * 1.8;
    const startX = Math.sin(spawnAngle) * 32;
    const startZ = -45 - Math.random() * 25;
    const startY = type === 'skimmer' ? 4.5 + Math.random() * 3 : 0.5;

    const startPos = new THREE.Vector3(startX, startY, startZ);
    const targetPos = new THREE.Vector3(startX * 0.25, 0.5, 7.0); // Barricade impact vector

    group.position.copy(startPos);
    scene.add(group);

    const label = create2DLabel(word, {
      offsetY: type === 'goliath' ? 3.4 : 2.2,
      className: `hostile-${type}`,
    });
    group.add(label.labelObj);

    activeHostiles.push({
      type,
      group,
      label,
      fullWord: word,
      remainingWord: word,
      speed: baseSpeed,
      startPos,
      targetPos,
      progress: 0,
      maxHp: hp,
      currentHp: hp,
      isEliminated: false,
      animHandle,
    });

    if (activeHostiles.length === 1) {
      inputEl.placeholder = `ENGAGE HOSTILE: "${activeHostiles[0].remainingWord}"`;
    }
  }

  function eliminateHostile(hostile: HostileEntity, destroyedByPlayer: boolean): void {
    if (hostile.isEliminated) return;
    hostile.isEliminated = true;

    const pos = hostile.group.position.clone();

    if (destroyedByPlayer) {
      hostilesEliminated++;
      currentStreak++;
      killstreakCount++;
      if (currentStreak > maxStreak) maxStreak = currentStreak;

      const pts = hostile.type === 'goliath' ? 350 : hostile.type === 'stalker' ? 200 : 120;
      score += pts + currentStreak * 15;

      playArcadeExplosion();
      shakeCamera(hostile.type === 'goliath' ? 0.9 : 0.45);
      create3DExplosion(pos, new THREE.Color(hostile.type === 'goliath' ? 0xa855f7 : 0xf43f5e), 32);

      // Check Tactical Killstreaks & Stratagems (Helldivers 2 style)
      if (killstreakCount === 3 && !isSentryDroneActive) {
        deploySentryDroneStratagem();
      } else if (killstreakCount === 6) {
        triggerMortarBarrage();
      } else if (killstreakCount === 10) {
        triggerOrbitalAirstrike();
      } else if (killstreakCount === 15) {
        triggerTacticalNuke();
        killstreakCount = 0; // Reset streak loop
      }
    } else {
      // Enemy breached barricade
      barricadeHp -= hostile.type === 'goliath' ? 35 : 18;
      currentStreak = 0;
      killstreakCount = 0;
      playArcadeDamage();
      shakeCamera(1.4);
      create3DExplosion(pos, new THREE.Color(0xef4444), 45);

      if (barricadeHp <= 0) {
        endGame(false);
        return;
      }
    }

    updateHUD();

    // Clean up Three.js objects
    hostile.label.dispose();
    if (hostile.animHandle) {
      hostile.animHandle.dispose();
    }
    scene.remove(hostile.group);
    hostile.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material) (child.material as THREE.Material).dispose();
      }
    });

    activeHostiles = activeHostiles.filter((h) => h !== hostile);

    if (activeHostiles[0]) {
      inputEl.placeholder = `ENGAGE HOSTILE: "${activeHostiles[0].remainingWord}"`;
    } else {
      inputEl.placeholder = 'PERIMETER SECURE // SCANNING SECTOR...';
    }
  }

  // --- AUTOMATED SENTRY DRONE COMPANION (HELLDIVERS 2 STRATAGEM) ---
  let isSentryDroneActive = false;
  let sentryDroneGroup: THREE.Group | null = null;
  let sentryRotorL: THREE.Mesh | null = null;
  let sentryRotorR: THREE.Mesh | null = null;
  let sentryFireCooldown = 0;
  let sentryLife = 28.0;
  let stratagemBadgeEl: HTMLElement | null = null;

  function deploySentryDroneStratagem(): void {
    if (isSentryDroneActive || isGameEnded) return;
    isSentryDroneActive = true;
    sentryLife = 28.0;
    playStratagemBeacon();
    speakMechVoice('Stratagem deployed! Automated Sentry Drone on station!');

    const droneGrp = new THREE.Group();

    // Central chassis
    const bodyGeo = new THREE.BoxGeometry(1.2, 0.45, 1.2);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.9,
      roughness: 0.2,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    droneGrp.add(body);

    // Glowing core reactor
    const coreGeo = new THREE.SphereGeometry(0.3, 12, 12);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.y = 0.1;
    droneGrp.add(core);

    // Twin Rotors / Thrusters (Translucent Motion-Blur Rotor Discs, NO WIREFRAME)
    const rotorGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.04, 16);
    const rotorMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.45,
      roughness: 0.2,
      metalness: 0.85,
    });

    sentryRotorL = new THREE.Mesh(rotorGeo, rotorMat);
    sentryRotorL.position.set(-0.95, 0.25, 0);
    droneGrp.add(sentryRotorL);

    sentryRotorR = new THREE.Mesh(rotorGeo, rotorMat);
    sentryRotorR.position.set(0.95, 0.25, 0);
    droneGrp.add(sentryRotorR);

    // Dual mini laser cannons underneath
    [-0.35, 0.35].forEach((cx) => {
      const barrelGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.7, 8);
      barrelGeo.rotateX(Math.PI / 2);
      const barrelMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9 });
      const barrel = new THREE.Mesh(barrelGeo, barrelMat);
      barrel.position.set(cx, -0.22, 0.35);
      droneGrp.add(barrel);
    });

    // Spotlight pointing toward hostiles
    const spot = new THREE.SpotLight(0x00f0ff, 3.5, 35, Math.PI / 5, 0.4);
    spot.position.set(0, -0.1, 0.3);
    spot.target.position.set(0, 0, -25);
    droneGrp.add(spot);
    droneGrp.add(spot.target);

    // Position drone hovering beside player's turret
    droneGrp.position.set(4.5, 4.2, 8.5);
    sentryDroneGroup = droneGrp;
    scene.add(droneGrp);

    // Spawn orbital beacon beam on arrival
    fireLaserBeam(new THREE.Vector3(4.5, 45, 8.5), new THREE.Vector3(4.5, 0, 8.5), new THREE.Color(0x00f0ff));

    // UI Pill on stage
    stratagemBadgeEl = document.createElement('div');
    stratagemBadgeEl.className = 'stratagem-callout';
    stratagemBadgeEl.innerHTML = `<span>🤖</span><strong>STRATAGEM: SENTRY DRONE ACTIVE</strong>`;
    stageEl.appendChild(stratagemBadgeEl);
  }

  function dismissSentryDrone(): void {
    if (!isSentryDroneActive) return;
    isSentryDroneActive = false;
    if (stratagemBadgeEl) {
      stratagemBadgeEl.remove();
      stratagemBadgeEl = null;
    }
    if (sentryDroneGroup) {
      scene.remove(sentryDroneGroup);
      sentryDroneGroup = null;
    }
  }

  // --- TACTICAL KILLSTREAKS ---
  function triggerMortarBarrage(): void {
    playArtilleryShell();
    speakMechVoice('Mortar strike inbound. Heavy precision rockets plunging.');
    shakeCamera(1.2);

    for (let m = 0; m < 3; m++) {
      setTimeout(() => {
        if (isGameEnded) return;
        const targetPos = activeHostiles[m % Math.max(1, activeHostiles.length)]
          ? activeHostiles[m % Math.max(1, activeHostiles.length)].group.position.clone()
          : new THREE.Vector3((Math.random() - 0.5) * 24, 0.5, -15 - Math.random() * 20);

        const rocketHandle = buildCombatRocket({
          scale: 0.85,
          bodyColor: 0x1e293b,
          finColor: 0xe11d48,
          exhaustColor: 0xff5500,
        });

        // Plunge down from upper sky towards hostile
        const startPos = new THREE.Vector3(
          targetPos.x + (Math.random() - 0.5) * 6,
          36,
          targetPos.z - 8
        );
        rocketHandle.group.position.copy(startPos);
        rocketHandle.group.lookAt(targetPos);
        scene.add(rocketHandle.group);

        activeRockets.push({
          handle: rocketHandle,
          origin: startPos,
          target: targetPos,
          progress: 0,
          speed: 1.85,
        });
      }, m * 280);
    }
  }

  function triggerOrbitalAirstrike(): void {
    playArtilleryShell();
    speakMechVoice('Orbital strike confirmed.');
    shakeCamera(1.8);

    const beamOrigin = new THREE.Vector3(0, 45, -25);
    const beamTarget = new THREE.Vector3(0, 0, -25);
    fireLaserBeam(beamOrigin, beamTarget, new THREE.Color(0x38bdf8));
    create3DExplosion(beamTarget, new THREE.Color(0x38bdf8), 70);

    // Wipe all ground stalkers and skimmers
    const toClear = activeHostiles.slice(0, 2);
    toClear.forEach((h) => eliminateHostile(h, true));
  }

  function triggerTacticalNuke(): void {
    playNukeDetonation();
    speakMechVoice('Tactical EMP unleashed. Clean sweep.');
    shakeCamera(2.5);
    unlockArcadeTrophy('empOverkill');

    create3DExplosion(new THREE.Vector3(0, 4, -20), new THREE.Color(0x38bdf8), 120);
    create3DExplosion(new THREE.Vector3(0, 4, -20), new THREE.Color(0xffffff), 80);

    // Clean sweep all active enemies on screen!
    const all = [...activeHostiles];
    all.forEach((h) => eliminateHostile(h, true));
  }

  function updateHUD(): void {
    const timerEl = document.getElementById('evac-timer');
    const hpEl = document.getElementById('evac-hp');
    const killsEl = document.getElementById('evac-kills');
    const streakEl = document.getElementById('evac-streak');

    if (timerEl) {
      timerEl.textContent = `${Math.max(0, Math.ceil(remainingEvacTime))}s`;
      timerEl.style.color = remainingEvacTime <= 15 ? '#ef4444' : '#38bdf8';
    }
    if (hpEl) {
      hpEl.textContent = `${Math.max(0, Math.round(barricadeHp))}%`;
      hpEl.style.color = barricadeHp <= 30 ? '#ef4444' : '#4ade80';
    }
    if (killsEl) killsEl.textContent = String(hostilesEliminated);
    if (streakEl) streakEl.textContent = `x${currentStreak}`;
  }

  // --- KEYBOARD ENGINE ---
  let recoilKick = 0;
  let muzzleTimer = 0;

  function handleInput(e: KeyboardEvent): void {
    if (isGameEnded) return;

    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      const val = inputEl.value.trim().toUpperCase();
      const target = activeHostiles.find((h) => h.remainingWord === val || h.fullWord === val);
      if (target) {
        correctKeystrokes += val.length;
        playMinigunBurst();
        triggerGunfire();
        eliminateHostile(target, true);
        inputEl.value = '';
      }
      return;
    }

    if (e.key === 'Backspace' || (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey)) {
      if (e.key !== 'Backspace') totalKeystrokes++;

      requestAnimationFrame(() => {
        const val = inputEl.value.trim().toUpperCase();
        const target = activeHostiles[0];

        if (target) {
          if (val === target.remainingWord) {
            correctKeystrokes += val.length;
            playMinigunBurst();
            triggerGunfire();
            eliminateHostile(target, true);
            inputEl.value = '';
            return;
          }

          if (target.remainingWord.startsWith(val)) {
            if (e.key !== 'Backspace') {
              correctKeystrokes++;
              playTactileClick('key');
              triggerGunfire();
            }
            target.label.setWordProgress(target.remainingWord, val.length, true);
          } else {
            target.label.setWordProgress(target.remainingWord, 0, false);
          }
        }
      });
    }
  }

  function triggerGunfire(): void {
    recoilKick = 0.28;
    muzzleTimer = 0.08;
    turretMuzzleLight.intensity = 5.5;
    muzzleFlareMat.opacity = 0.9;
    barrelCluster.rotation.z += 1.4;
    ejectShellCasing();
  }

  function onStageClick(): void {
    if (!isGameEnded) inputEl.focus();
  }
  stageEl.addEventListener('click', onStageClick);

  inputEl.addEventListener('keydown', handleInput);
  inputEl.disabled = false;
  inputEl.value = '';
  inputEl.placeholder = 'PERIMETER DEFENSE // TYPE TARGET CODES!';
  inputEl.focus();

  // Initial Voice Dispatch + Immediate First Hostile Contact
  speakMechVoice('Extraction protocol initiated. Hold the perimeter.');
  spawnHostileWave();

  // --- ANIMATION LOOP ---
  let lastFrameTime = performance.now();
  let animationId: number | null = null;

  function animate(now: number): void {
    if (isGameEnded) return;
    const rawDelta = Math.min((now - lastFrameTime) / 1000, 0.1);
    lastFrameTime = now;

    if (!fw.isPaused) {
      const delta = rawDelta;
      remainingEvacTime -= delta;
      updateHUD();

      // Check Evacuation Victory Condition
      if (remainingEvacTime <= 0) {
        endGame(true);
        return;
      }

      // 1. Spawning Hostile Waves
      enemySpawnTimer += delta;
      const spawnInterval = difficulty === 'nightmare' ? 2.2 : difficulty === 'cadet' ? 3.8 : 3.0;
      if (enemySpawnTimer >= spawnInterval) {
        enemySpawnTimer = 0;
        spawnHostileWave();
      }

      // 2. Animate Hostiles towards Barricade
      for (let i = activeHostiles.length - 1; i >= 0; i--) {
        const hostile = activeHostiles[i];
        hostile.progress += delta * hostile.speed;

        hostile.group.position.lerpVectors(hostile.startPos, hostile.targetPos, hostile.progress);
        if (hostile.animHandle?.update) {
          hostile.animHandle.update(delta, now * 0.001);
        } else {
          hostile.group.position.y += Math.sin(now * 0.005 + i) * 0.15; // Hover/stride bob
        }

        // Orient hostile facing player
        hostile.group.lookAt(turretMount.position.x, hostile.group.position.y, turretMount.position.z);

        if (hostile.progress >= 1.0) {
          eliminateHostile(hostile, false);
        }
      }

      // 2b. Animate Incoming 3D Mortar Rockets
      for (let r = activeRockets.length - 1; r >= 0; r--) {
        const rkt = activeRockets[r];
        rkt.progress += delta * rkt.speed;
        rkt.handle.update?.(delta, now * 0.001);

        rkt.handle.group.position.lerpVectors(rkt.origin, rkt.target, rkt.progress);

        if (rkt.progress >= 1.0) {
          create3DExplosion(rkt.target, new THREE.Color(0xf59e0b), 55);
          create3DExplosion(rkt.target, new THREE.Color(0xff4400), 40);
          shakeCamera(1.1);
          playArcadeExplosion();

          if (activeHostiles[0]) {
            eliminateHostile(activeHostiles[0], true);
          }

          rkt.handle.dispose();
          scene.remove(rkt.handle.group);
          activeRockets.splice(r, 1);
        }
      }

      // 3. Aim Turret towards Leading Hostile
      if (activeHostiles[0]) {
        const targetHostilePos = activeHostiles[0].group.position;
        turretSwivel.lookAt(targetHostilePos.x, targetHostilePos.y + 0.4, targetHostilePos.z);
      }

      // 4. Animate Turret Recoil & Muzzle Light
      if (muzzleTimer > 0) {
        muzzleTimer -= delta;
        if (muzzleTimer <= 0) {
          turretMuzzleLight.intensity = 0;
          muzzleFlareMat.opacity = 0;
        }
      }
      recoilKick = THREE.MathUtils.lerp(recoilKick, 0, 0.2);
      gunHousing.position.z = recoilKick;

      // 5. Animate Flying Shell Casings
      shellPool.forEach((s) => {
        if (s.life > 0) {
          s.life -= delta;
          s.vel.y -= delta * 12; // Gravity
          s.mesh.position.addScaledVector(s.vel, delta);
          s.mesh.rotation.x += s.rotVel.x * delta;
          s.mesh.rotation.y += s.rotVel.y * delta;
        } else {
          s.mesh.position.set(0, -100, 0);
        }
      });

      // 6. Dropship Hover Vibration
      dropshipGroup.position.y = 16 + Math.sin(now * 0.002) * 0.6;
      thrusterPlumes.forEach((p) => {
        p.scale.set(1.0, 1.0 + Math.sin(now * 0.02) * 0.2, 1.0);
      });

      // 7. Tactical Sonar Radar Render
      if (radarCtx) {
        radarCtx.clearRect(0, 0, 110, 110);
        const cx = 55;
        const cy = 55;

        // Concentric range circles
        radarCtx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
        radarCtx.lineWidth = 1;
        radarCtx.beginPath();
        radarCtx.arc(cx, cy, 48, 0, Math.PI * 2);
        radarCtx.arc(cx, cy, 32, 0, Math.PI * 2);
        radarCtx.arc(cx, cy, 16, 0, Math.PI * 2);
        radarCtx.stroke();

        // Crosshairs
        radarCtx.beginPath();
        radarCtx.moveTo(cx, 7);
        radarCtx.lineTo(cx, 103);
        radarCtx.moveTo(7, cy);
        radarCtx.lineTo(103, cy);
        radarCtx.stroke();

        // Rotating radar sweep beam
        const sweepAngle = (now * 0.0022) % (Math.PI * 2);
        const sweepX = cx + Math.cos(sweepAngle) * 48;
        const sweepY = cy + Math.sin(sweepAngle) * 48;
        radarCtx.strokeStyle = 'rgba(74, 222, 128, 0.75)';
        radarCtx.lineWidth = 1.5;
        radarCtx.beginPath();
        radarCtx.moveTo(cx, cy);
        radarCtx.lineTo(sweepX, sweepY);
        radarCtx.stroke();

        // Sweep ping audio
        if (Math.abs(sweepAngle - 0.05) < 0.035) {
          playRadarPing();
        }

        // Center Turret Pip (Cyan)
        radarCtx.fillStyle = '#38bdf8';
        radarCtx.beginPath();
        radarCtx.arc(cx, cy, 3, 0, Math.PI * 2);
        radarCtx.fill();

        // Hostile Blips (Red/Amber)
        activeHostiles.forEach((h) => {
          if (h.isEliminated) return;
          const hPos = h.group.position;
          const rx = cx + (hPos.x / 35) * 44;
          const rz = cy + ((hPos.z - 7) / 75) * 44;

          if (rx >= 8 && rx <= 102 && rz >= 8 && rz <= 102) {
            const blipColor = h.type === 'goliath' ? '#f59e0b' : '#ef4444';
            radarCtx.fillStyle = blipColor;
            radarCtx.shadowColor = blipColor;
            radarCtx.shadowBlur = 6;
            radarCtx.beginPath();
            radarCtx.arc(rx, rz, h.type === 'goliath' ? 3.5 : 2.5, 0, Math.PI * 2);
            radarCtx.fill();
            radarCtx.shadowBlur = 0;
          }
        });
      }

      // 8. Automated Sentry Drone Companion (Stratagem)
      if (isSentryDroneActive && sentryDroneGroup) {
        sentryLife -= delta;
        if (sentryLife <= 0) {
          dismissSentryDrone();
        } else {
          if (sentryRotorL) sentryRotorL.rotation.y += delta * 32;
          if (sentryRotorR) sentryRotorR.rotation.y += delta * 32;

          sentryDroneGroup.position.y = 4.2 + Math.sin(now * 0.005) * 0.25;

          sentryFireCooldown -= delta;
          if (sentryFireCooldown <= 0 && activeHostiles.length > 0) {
            sentryFireCooldown = 1.35;
            const targetHostile = activeHostiles[0];
            const origin = sentryDroneGroup.position.clone().add(new THREE.Vector3(0, -0.2, 0.4));
            const targetPos = targetHostile.group.position.clone().add(new THREE.Vector3(0, 1.0, 0));
            fireLaserBeam(origin, targetPos, new THREE.Color(0x00f0ff));
            create3DExplosion(targetPos, new THREE.Color(0x00f0ff), 10);
            playMinigunBurst();

            targetHostile.currentHp -= 1;
            if (targetHostile.currentHp <= 0) {
              eliminateHostile(targetHostile, true);
            }
          }
        }
      }

      updateFX(delta);
    }

    animationId = requestAnimationFrame(animate);
  }

  animationId = requestAnimationFrame(animate);

  // --- GAME CONCLUSION ---
  function endGame(victory: boolean): void {
    if (isGameEnded) return;
    isGameEnded = true;

    stop();

    const diffMultiplier = difficulty === 'nightmare' ? 1.6 : difficulty === 'cadet' ? 0.85 : 1.2;
    const finalScore = Math.round((victory ? score + 2000 + barricadeHp * 25 : score) * diffMultiplier);
    const accuracy = totalKeystrokes > 0 ? Math.round((correctKeystrokes / totalKeystrokes) * 100) : 95;

    if (victory) {
      playFinishFanfare();
      playArcadePowerup();
      speakMechVoice('Dropship in position. Evacuation complete. Outstanding work.');
      create3DExplosion(dropshipGroup.position, new THREE.Color(0x38bdf8), 100);
      create3DExplosion(dropshipGroup.position, new THREE.Color(0x4ade80), 100);
      if (barricadeHp >= 80) {
        unlockArcadeTrophy('perimeterGuardian');
      }
    } else {
      speakMechVoice('Perimeter breached. Operative MIA.');
    }

    if (accuracy >= 98) {
      unlockArcadeTrophy('deadeyeSniper');
    }

    if (onEndCallback) {
      onEndCallback({
        score: finalScore,
        words: hostilesEliminated,
        accuracy: Math.min(100, Math.max(70, accuracy)),
        maxCombo: maxStreak,
      });
    }
  }

  // --- CLEAN TEARDOWN ---
  function stop(): void {
    isGameEnded = true;
    if (animationId) cancelAnimationFrame(animationId);
    inputEl.removeEventListener('keydown', handleInput);
    stageEl.removeEventListener('click', onStageClick);
    radarWrap.remove();
    dismissSentryDrone();

    activeHostiles.forEach((h) => {
      h.label.dispose();
      if (h.animHandle) {
        h.animHandle.dispose();
      }
      scene.remove(h.group);
    });
    activeHostiles = [];

    activeRockets.forEach((r) => {
      r.handle.dispose();
      scene.remove(r.handle.group);
    });
    activeRockets = [];

    scene.remove(turretMount);
    scene.remove(barricadesGroup);
    scene.remove(groundMesh);
    scene.remove(skyMesh);
    scene.remove(dropshipGroup);
    shellPool.forEach((s) => scene.remove(s.mesh));

    groundGeo.dispose();
    groundMat.dispose();
    skyGeo.dispose();
    skyMat.dispose();
    asphaltMap.dispose();
    asphaltRoughness.dispose();
    metalPanelsTexture.dispose();
    citySkylineTexture.dispose();

    dispose();
  }

  return { stop, id: 'cyberExtraction' };
}
