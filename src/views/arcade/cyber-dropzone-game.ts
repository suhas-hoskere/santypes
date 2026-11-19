// Cyber Dropzone — AAA 3D Tactical Battle Royale & Airdrop Infiltration Shooter
// 100% Framework-Free Pure TypeScript with Three.js & CSS2DRenderer
// Features: 3D Tactical Assault Carbine Viewmodel with holographic sight, spring recoil & shell ejection,
// Shrinking Electric Storm Safe Zone Ring, Airdrop Crates with Volumetric Red Smoke,
// Humanoid 3D Operators (Snipers, Strikers, Juggernaut Boss) with Laser Sights,
// Real-time 50-Player Alive Counter, Dynamic Battle Kill Feed, and the Iconic "BOOYAH!" Victory Royale.

import * as THREE from 'three';
import { create3DGameFramework, Framework3DInstance, Label2DHandle } from '../../core/arcade-3d-framework.ts';
import {
  playTactileClick,
  playSniperRifle,
  playAssaultRifleBurst,
  playSafeZoneSiren,
  playAirdropLanding,
  playBooyahFanfare,
  playArcadeExplosion,
  playArcadeDamage,
  playArcadePowerup,
  speakMechVoice,
  playWindRush,
  playParachuteSnap,
  playScopeClick,
  playLootPickup,
} from '../../utils/sound.ts';
import {
  createAsphaltTexture,
  createMetalPanelsTexture,
  createCitySkylineTexture,
  createCorrugatedContainerTexture,
} from '../../utils/procedural-textures.ts';
import {
  GameInstanceHandle,
  ArcadeDifficulty,
  unlockArcadeTrophy,
  getActiveWeaponSkin,
} from './arcade-types.ts';
import {
  buildCombatRobot,
  buildCombatRocket,
  ModelAnimationHandle,
} from './procedural-models.ts';
import { escapeHTML } from '../../utils/html.ts';

interface EnemyCombatant {
  mesh: THREE.Group;
  type: 'sniper' | 'striker' | 'boss';
  word: string;
  maxHp: number;
  currentHp: number;
  labelHandle: Label2DHandle;
  attackTimer: number;
  maxAttackTimer: number;
  laserBeam: THREE.Line;
  laserLight: THREE.PointLight;
  isDead: boolean;
  basePosition: THREE.Vector3;
  animHandle?: ModelAnimationHandle;
}

interface DroppingAirstrikeRocket {
  handle: ModelAnimationHandle;
  origin: THREE.Vector3;
  target: THREE.Vector3;
  progress: number;
  speed: number;
  onImpact?: () => void;
}

interface ShellCasing {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  rotVelocity: THREE.Vector3;
  life: number;
}

interface AirdropCrate {
  mesh: THREE.Group;
  smokeMesh: THREE.Points;
  word: string;
  benefit: 'armor' | 'medkit' | 'airstrike';
  labelHandle: Label2DHandle;
  hasLanded: boolean;
  isClaimed: boolean;
  fallSpeed: number;
}

interface LootDrop {
  group: THREE.Group;
  word: string;
  type: 'medkit' | 'armor' | 'ammo';
  labelHandle: Label2DHandle;
  life: number;
}

export function startCyberDropzoneGame(
  stageEl: HTMLElement,
  inputEl: HTMLInputElement,
  hudEl: HTMLElement,
  onEndCallback: (stats: { score: number; words: number; accuracy: number; maxCombo: number }) => void,
  difficulty: ArcadeDifficulty = 'elite'
): GameInstanceHandle {
  // Pacing & Lobby Sizing based on difficulty
  const INITIAL_ALIVE = difficulty === 'nightmare' ? 60 : difficulty === 'cadet' ? 35 : 50;
  let aliveCount = INITIAL_ALIVE;
  let killCount = 0;
  let playerHp = 100;
  let playerArmor = 50;
  let score = 0;
  let totalKeystrokes = 0;
  let correctKeystrokes = 0;
  let currentStreak = 0;
  let maxStreak = 0;
  let isGameEnded = false;
  let isBooyah = false;

  // Tactical ADS (Aim Down Sights) State
  let isAdsActive = false;
  let currentAdsBlend = 0; // 0 = hipfire, 1 = ADS

  // Multi-Kill Announcer State
  let multiKillCount = 0;
  let lastKillTimestamp = 0;

  // Storm Zone Mechanics
  const STORM_PHASE_TIMES = difficulty === 'nightmare' ? [18, 36, 54] : difficulty === 'cadet' ? [28, 56, 84] : [24, 48, 72];
  const STORM_RADII = [52, 34, 18, 8];
  let currentStormPhase = 0;
  let stormTimer = STORM_PHASE_TIMES[0];
  let stormRadius = STORM_RADII[0];
  let targetStormRadius = STORM_RADII[0];

  // Active Combat Entities
  const activeEnemies: EnemyCombatant[] = [];
  const activeCasings: ShellCasing[] = [];
  const activeLootDrops: LootDrop[] = [];
  const activeAirstrikeRockets: DroppingAirstrikeRocket[] = [];
  let currentAirdrop: AirdropCrate | null = null;
  let nextAirdropTimer = difficulty === 'nightmare' ? 22 : 18;

  // Weapon Viewmodel State
  let weaponRecoilZ = 0;
  let weaponRecoilRotX = 0;
  let muzzleFlashTime = 0;

  // Killfeed Messages Buffer
  const killfeedMessages: { killer: string; victim: string; weapon: string; isPlayer: boolean; time: number }[] = [];

  // Vocabulary Banks
  const SNIPER_WORDS = [
    'SCOPE', 'VIPER', 'RADAR', 'FALCON', 'LASER', 'BULLET', 'TRIGGER', 'APEX',
    'DEADEYE', 'OPTIC', 'PERCH', 'HAWK', 'EAGLE', 'STEALTH', 'SNIPER',
  ];

  const STRIKER_WORDS = [
    'TACTICAL', 'ASSAULT', 'CROSSFIRE', 'HEADSHOT', 'PHANTOM', 'WARZONE',
    'SKIRMISHER', 'ENFORCER', 'COMMANDO', 'VANGUARD', 'GUNSLINGER', 'BARRAGE',
  ];

  const BOSS_PHRASES = [
    ['TITAN_ARMOR', 'SHIELD_CORE', 'APEX_PREDATOR'],
    ['OMEGA_SQUAD', 'IRON_CLAD', 'FINAL_SHOWDOWN'],
    ['CYBER_WARLORD', 'NANITE_WALL', 'BOOYAH_VICTORY'],
  ][difficulty === 'nightmare' ? 2 : difficulty === 'cadet' ? 0 : 1];
  let bossPhaseIndex = 0;

  const AIRDROP_WORDS = ['MEDKIT', 'ARMOR3', 'AIRSTRIKE', 'ADRENALINE', 'SUPPLY'];

  const BOT_NAMES = [
    'Ghost_99', 'Cobra_X', 'Viper_07', 'Shadow_4', 'Recon_Elite', 'Blaze_K',
    'Falcon_12', 'Havoc_9', 'Predator_X', 'Rogue_One', 'Slayer_88', 'Alpha_Dog',
  ];
  const BOT_WEAPONS = ['M4A1', 'AWM', 'MP40', 'SCAR', 'Kar98k', 'Desert Eagle', 'Groza', 'AK47'];

  let isStopped = false;
  const pendingTimeouts = new Set<ReturnType<typeof setTimeout>>();
  function scheduleGameTimeout(fn: () => void, ms: number): void {
    const tid = setTimeout(() => {
      pendingTimeouts.delete(tid);
      if (!isStopped) fn();
    }, ms);
    pendingTimeouts.add(tid);
  }

  // --- HUD INITIALIZATION ---
  hudEl.innerHTML = `
    <div class="arcade-hud-pills" style="position:relative;">
      <span class="arcade-pill" style="border-color:#eab308;background:rgba(234,179,8,0.12);">
        <strong id="dropzone-alive" style="color:#eab308;font-size:14px;font-weight:900;">🔥 ${aliveCount} ALIVE</strong>
      </span>
      <span class="arcade-pill">
        Kills: <strong id="dropzone-kills" class="hud-accent" style="color:#f59e0b;">0</strong>
      </span>
      <span class="arcade-pill">
        HP: <strong id="dropzone-hp" style="color:#4ade80;">100%</strong>
      </span>
      <span class="arcade-pill">
        Armor: <strong id="dropzone-armor" style="color:#38bdf8;">${playerArmor}%</strong>
      </span>
      <span class="arcade-pill">
        Safe Zone: <strong id="dropzone-storm" style="color:#00f0ff;">${Math.ceil(stormTimer)}s</strong>
      </span>
      <button class="arcade-pill" id="dropzone-btn-ads" style="cursor:pointer;border-color:rgba(255,255,255,0.2);background:rgba(255,255,255,0.06);" title="Toggle ADS Tactical Scope [Shift / Right Click]">
        🎯 ADS: OFF
      </button>
      <span class="arcade-pill hud-game-tag" style="color:#eab308;font-weight:800;">Free Fire Royale</span>
    </div>
  `;

  // Tactical Live Killfeed & Booyah Banner Overlays on Stage
  const killfeedOverlay = document.createElement('div');
  killfeedOverlay.id = 'dropzone-killfeed';
  killfeedOverlay.style.position = 'absolute';
  killfeedOverlay.style.top = '16px';
  killfeedOverlay.style.right = '16px';
  killfeedOverlay.style.display = 'flex';
  killfeedOverlay.style.flexDirection = 'column';
  killfeedOverlay.style.gap = '6px';
  killfeedOverlay.style.pointerEvents = 'none';
  killfeedOverlay.style.zIndex = '25';
  killfeedOverlay.style.fontFamily = "'JetBrains Mono', monospace";
  killfeedOverlay.style.fontSize = '11px';
  stageEl.appendChild(killfeedOverlay);

  const booyahBanner = document.createElement('div');
  booyahBanner.id = 'dropzone-booyah-banner';
  booyahBanner.style.position = 'absolute';
  booyahBanner.style.top = '0';
  booyahBanner.style.left = '0';
  booyahBanner.style.width = '100%';
  booyahBanner.style.height = '100%';
  booyahBanner.style.display = 'none';
  booyahBanner.style.flexDirection = 'column';
  booyahBanner.style.alignItems = 'center';
  booyahBanner.style.justifyContent = 'center';
  booyahBanner.style.background = 'radial-gradient(circle at center, rgba(234, 179, 8, 0.4) 0%, rgba(5, 4, 10, 0.88) 75%)';
  booyahBanner.style.zIndex = '35';
  booyahBanner.style.pointerEvents = 'none';
  booyahBanner.innerHTML = `
    <div style="text-align:center;animation:pulse 1.2s infinite alternate;">
      <div style="font-family:'JetBrains Mono',monospace;font-size:64px;font-weight:900;letter-spacing:12px;color:#facc15;text-shadow:0 0 35px #facc15, 0 0 70px rgba(234,179,8,0.7);margin-bottom:6px;">
        BOOYAH!
      </div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:20px;font-weight:800;letter-spacing:6px;color:#ffffff;text-shadow:0 2px 10px rgba(0,0,0,0.8);background:rgba(0,0,0,0.6);padding:6px 20px;border-radius:8px;border:1px solid #eab308;display:inline-block;">
        #1 / ${INITIAL_ALIVE} // APEX CHAMPION
      </div>
    </div>
  `;
  stageEl.appendChild(booyahBanner);

  // Tactical Compass Ribbon (Battle Royale Navigation)
  const compassRibbon = document.createElement('div');
  compassRibbon.id = 'dropzone-compass';
  compassRibbon.style.position = 'absolute';
  compassRibbon.style.top = '14px';
  compassRibbon.style.left = '50%';
  compassRibbon.style.transform = 'translateX(-50%)';
  compassRibbon.style.background = 'rgba(5, 4, 10, 0.85)';
  compassRibbon.style.border = '1px solid rgba(234, 179, 8, 0.4)';
  compassRibbon.style.borderRadius = '6px';
  compassRibbon.style.padding = '4px 16px';
  compassRibbon.style.fontFamily = "'JetBrains Mono', monospace";
  compassRibbon.style.fontSize = '11px';
  compassRibbon.style.color = '#fef08a';
  compassRibbon.style.letterSpacing = '2px';
  compassRibbon.style.pointerEvents = 'none';
  compassRibbon.style.zIndex = '22';
  compassRibbon.style.boxShadow = '0 4px 14px rgba(0,0,0,0.6)';
  compassRibbon.innerHTML = `<span style="color:#eab308;font-weight:900;">▼</span> 180° S // DROPZONE SECTOR-07`;
  stageEl.appendChild(compassRibbon);

  // Directional Threat Damage Flash
  const threatVignette = document.createElement('div');
  threatVignette.id = 'dropzone-threat-vignette';
  threatVignette.style.position = 'absolute';
  threatVignette.style.top = '0';
  threatVignette.style.left = '0';
  threatVignette.style.width = '100%';
  threatVignette.style.height = '100%';
  threatVignette.style.boxShadow = 'inset 0 0 0px rgba(239, 68, 68, 0)';
  threatVignette.style.pointerEvents = 'none';
  threatVignette.style.transition = 'box-shadow 0.15s ease';
  threatVignette.style.zIndex = '18';
  stageEl.appendChild(threatVignette);

  // Tactical ADS Scope Reticle Overlay
  const adsScopeOverlay = document.createElement('div');
  adsScopeOverlay.className = 'dropzone-ads-scope';
  adsScopeOverlay.innerHTML = `
    <div class="scope-crosshair-ring">
      <div class="scope-center-dot"></div>
      <div class="scope-hash-h"></div>
      <div class="scope-hash-v"></div>
      <div class="scope-rangefinder">4.0X TACTICAL // 280M</div>
    </div>
  `;
  stageEl.appendChild(adsScopeOverlay);

  function toggleAds(force?: boolean): void {
    isAdsActive = force !== undefined ? force : !isAdsActive;
    playScopeClick();
    if (isAdsActive) {
      adsScopeOverlay.classList.add('active');
    } else {
      adsScopeOverlay.classList.remove('active');
    }
    const adsBtn = hudEl.querySelector('#dropzone-btn-ads') as HTMLElement;
    if (adsBtn) {
      adsBtn.innerText = isAdsActive ? '🎯 ADS: ON' : '🎯 ADS: OFF';
      adsBtn.style.borderColor = isAdsActive ? '#00f0ff' : 'rgba(255,255,255,0.2)';
      adsBtn.style.color = isAdsActive ? '#00f0ff' : '#ffffff';
    }
  }

  const adsHudBtn = hudEl.querySelector('#dropzone-btn-ads');
  if (adsHudBtn) adsHudBtn.addEventListener('click', () => toggleAds());

  const onContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
    toggleAds();
  };
  stageEl.addEventListener('contextmenu', onContextMenu);

  const onAdsKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'KeyZ') {
      e.preventDefault();
      toggleAds();
    }
  };
  window.addEventListener('keydown', onAdsKeyDown);

  // Floating Combat Damage Numbers in 3D Screen Space
  function spawnCombatDamageFloat(worldPos: THREE.Vector3, text: string, type: 'crit' | 'headshot' | 'heal' = 'crit'): void {
    const p = worldPos.clone().project(camera);
    const x = ((p.x + 1) * stageEl.clientWidth) / 2;
    const y = ((-p.y + 1) * stageEl.clientHeight) / 2;
    const el = document.createElement('div');
    el.className = `combat-dmg-float ${type === 'crit' || type === 'headshot' ? 'crit' : 'parry'}`;
    el.style.left = `${Math.max(40, Math.min(stageEl.clientWidth - 120, x))}px`;
    el.style.top = `${Math.max(40, Math.min(stageEl.clientHeight - 80, y))}px`;
    el.textContent = text;
    stageEl.appendChild(el);
    scheduleGameTimeout(() => el.remove(), 900);
  }

  // Multi-Kill Announcement Banners
  function showMultiKillBanner(title: string): void {
    const oldBanner = stageEl.querySelector('.combat-multikill-banner');
    if (oldBanner) oldBanner.remove();

    const banner = document.createElement('div');
    banner.className = 'combat-multikill-banner';
    const titleSpan = document.createElement('span');
    titleSpan.textContent = title;
    banner.appendChild(titleSpan);
    stageEl.appendChild(banner);
    scheduleGameTimeout(() => banner.remove(), 2100);
  }

  // Procedural 3D Tactical Loot Crate Drop
  function spawnLootDrop(pos: THREE.Vector3): void {
    const types: ('medkit' | 'armor' | 'ammo')[] = ['medkit', 'armor', 'ammo'];
    const type = types[Math.floor(Math.random() * types.length)];
    const word = type === 'medkit' ? 'MEDKIT' : type === 'armor' ? 'ARMOR' : 'AMMO';

    const group = new THREE.Group();
    group.position.copy(pos);
    group.position.y = 0.5;

    const color = type === 'medkit' ? 0x22c55e : type === 'armor' ? 0x38bdf8 : 0xfacc15;
    const boxGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const boxMat = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.8,
      roughness: 0.2,
      emissive: color,
      emissiveIntensity: 0.4,
    });
    const boxMesh = new THREE.Mesh(boxGeo, boxMat);
    group.add(boxMesh);

    // Rotating glowing energy beacon ring (Solid PBR, NO WIREFRAME)
    const haloGeo = new THREE.TorusGeometry(0.55, 0.035, 8, 24);
    haloGeo.rotateX(Math.PI / 2);
    const haloMat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.85,
      metalness: 0.9,
    });
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    haloMesh.position.y = 0.9;
    group.add(haloMesh);

    scene.add(group);

    const labelHandle = create2DLabel(word, {
      offsetY: 1.6,
      className: 'dropzone-loot-label',
    });
    const labelColor = type === 'medkit' ? '#4ade80' : type === 'armor' ? '#38bdf8' : '#facc15';
    const badgeText = type === 'medkit' ? '+35 HP' : type === 'armor' ? '+25 ARMOR' : '+150 SCORE';
    labelHandle.element.innerHTML = `
      <div style="background:rgba(5,4,10,0.92);border:1.5px solid ${labelColor};border-radius:6px;padding:2px 8px;text-align:center;box-shadow:0 0 14px ${labelColor};">
        <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:${labelColor};font-weight:900;">${escapeHTML(badgeText)}</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:900;color:#fff;">${escapeHTML(word)}</div>
      </div>
    `;
    group.add(labelHandle.labelObj);

    activeLootDrops.push({
      group,
      word,
      type,
      labelHandle,
      life: 14.0,
    });
  }

  function claimLootDrop(loot: LootDrop): void {
    playLootPickup();
    loot.labelHandle.dispose();
    scene.remove(loot.group);

    if (loot.type === 'medkit') {
      playerHp = Math.min(100, playerHp + 35);
      spawnCombatDamageFloat(loot.group.position, '💚 +35 HP RECOVERED', 'heal');
    } else if (loot.type === 'armor') {
      playerArmor = Math.min(100, playerArmor + 25);
      spawnCombatDamageFloat(loot.group.position, '🛡️ +25 ARMOR EQUIPPED', 'heal');
    } else {
      score += 150;
      playAssaultRifleBurst();
      spawnCombatDamageFloat(loot.group.position, '⚡ +150 AMMO SCORE', 'crit');
    }

    const idx = activeLootDrops.indexOf(loot);
    if (idx !== -1) activeLootDrops.splice(idx, 1);
  }

  // --- 3D SCENE & FRAMEWORK SETUP ---
  const fw: Framework3DInstance = create3DGameFramework(stageEl, {
    fov: 65,
    camX: 0,
    camY: 75.0,
    camZ: 24.0,
    camRotX: -0.75,
    backgroundColor: 0x05040a,
    fogColor: 0x080614,
    fogDensity: 0.012,
    ambientColor: 0x0f172a,
    ambientIntensity: 0.9,
    keyColor: 0xeab308,
    keyIntensity: 2.8,
    fillColor: 0x38bdf8,
    fillIntensity: 1.8,
    rimColor: 0xf43f5e,
    rimIntensity: 2.5,
    starColor: 0xeab308,
    starSize: 0.6,
    starSpeed: 6,
    manualCameraControl: true,
  });

  const { scene, camera, shakeCamera, create3DExplosion, create2DLabel, updateFX, dispose } = fw;

  // Cinematic Free Fire Airdrop Skyfall State
  let isSkyfall = true;
  let skyfallAltitude = 75;
  let parachuteDeployed = false;
  let skyfallTargetRotX = -0.75;

  playWindRush();
  camera.position.set(0, skyfallAltitude, 24);
  camera.rotation.x = skyfallTargetRotX;
  compassRibbon.innerHTML = `<span style="color:#eab308;font-weight:900;">✈️</span> AIRDROP SKYFALL // ALTITUDE: 750M`;

  // --- PROCEDURAL TEXTURES & RUNWAY GROUND ---
  const { map: asphaltMap, roughnessMap: asphaltRoughness } = createAsphaltTexture();
  asphaltMap.repeat.set(12, 12);
  const containerTexOrange = createCorrugatedContainerTexture('#c2410c');
  const containerTexNavy = createCorrugatedContainerTexture('#1e3a5f');
  const containerTexOlive = createCorrugatedContainerTexture('#2d4a22');
  const metalPlatesTex = createMetalPanelsTexture();
  const citySkylineTex = createCitySkylineTexture();

  // Distant Cyber City Skybox
  const skyGeo = new THREE.CylinderGeometry(140, 140, 65, 32, 1, true);
  const skyMat = new THREE.MeshBasicMaterial({
    map: citySkylineTex,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.88,
  });
  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  skyMesh.position.set(0, 18, -25);
  scene.add(skyMesh);

  // Asphalt Runway Ground
  const groundGeo = new THREE.PlaneGeometry(120, 120, 1, 1);
  const groundMat = new THREE.MeshStandardMaterial({
    map: asphaltMap,
    roughnessMap: asphaltRoughness,
    roughness: 0.65,
    metalness: 0.2,
  });
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.y = 0;
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

  // Runway Yellow Caution Markings
  const markingMat = new THREE.MeshBasicMaterial({ color: 0xeab308, transparent: true, opacity: 0.75 });
  for (let z = -45; z <= 15; z += 12) {
    const markGeo = new THREE.PlaneGeometry(1.2, 5.0);
    const markMesh = new THREE.Mesh(markGeo, markingMat);
    markMesh.rotation.x = -Math.PI / 2;
    markMesh.position.set(0, 0.02, z);
    scene.add(markMesh);
  }

  // --- 3D ENVIRONMENT ASSETS: SHIPPING CONTAINERS & WATCHTOWERS ---
  function buildShippingContainer(x: number, y: number, z: number, rotY = 0, tex = containerTexOrange): THREE.Group {
    const grp = new THREE.Group();
    const bodyGeo = new THREE.BoxGeometry(4.8, 3.2, 9.5);
    const bodyMat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.5,
      metalness: 0.5,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    body.receiveShadow = true;
    grp.add(body);

    // Corner casting blocks
    const cornerMat = new THREE.MeshStandardMaterial({ color: 0x111116, metalness: 0.8 });
    const cornerGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const offsets = [
      [-2.4, -1.6, -4.75], [2.4, -1.6, -4.75], [-2.4, 1.6, -4.75], [2.4, 1.6, -4.75],
      [-2.4, -1.6, 4.75], [2.4, -1.6, 4.75], [-2.4, 1.6, 4.75], [2.4, 1.6, 4.75],
    ];
    offsets.forEach(([cx, cy, cz]) => {
      const c = new THREE.Mesh(cornerGeo, cornerMat);
      c.position.set(cx, cy, cz);
      grp.add(c);
    });

    grp.position.set(x, y + 1.6, z);
    grp.rotation.y = rotY;
    scene.add(grp);
    return grp;
  }

  // Flank Container Stacks (Creating a dynamic tactical urban canyon)
  buildShippingContainer(-16, 0, -8, 0.15, containerTexOrange);
  buildShippingContainer(-16, 3.2, -8, 0.15, containerTexNavy);
  buildShippingContainer(-22, 0, -2, -0.2, containerTexOlive);
  buildShippingContainer(16, 0, -10, -0.2, containerTexNavy);
  buildShippingContainer(16, 3.2, -10, -0.2, containerTexOrange);
  buildShippingContainer(22, 0, -4, 0.1, containerTexOlive);
  buildShippingContainer(-8, 0, -32, 0.4, containerTexOlive);
  buildShippingContainer(10, 0, -34, -0.3, containerTexOrange);

  // Guard Watchtower
  function buildWatchtower(x: number, z: number): THREE.Group {
    const tower = new THREE.Group();
    const frameMat = new THREE.MeshStandardMaterial({ map: metalPlatesTex, metalness: 0.7, roughness: 0.3 });

    // 4 Truss Legs
    const legGeo = new THREE.CylinderGeometry(0.2, 0.35, 10, 6);
    const legOffsets = [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]];
    legOffsets.forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(legGeo, frameMat);
      leg.position.set(lx, 5, lz);
      tower.add(leg);
    });

    // Catwalk Platform
    const platGeo = new THREE.BoxGeometry(6.5, 0.5, 6.5);
    const plat = new THREE.Mesh(platGeo, frameMat);
    plat.position.set(0, 10, 0);
    tower.add(plat);

    // Searchlight Lamp
    const lampGeo = new THREE.CylinderGeometry(0.6, 0.8, 1.2, 12);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const lamp = new THREE.Mesh(lampGeo, lampMat);
    lamp.rotation.x = Math.PI / 3;
    lamp.position.set(0, 11.2, 2.5);
    tower.add(lamp);

    const spot = new THREE.SpotLight(0x38bdf8, 4.0, 45, Math.PI / 4, 0.5);
    spot.position.set(0, 11, 2.5);
    spot.target.position.set(x > 0 ? -10 : 10, 0, z + 15);
    scene.add(spot.target);
    tower.add(spot);

    tower.position.set(x, 0, z);
    scene.add(tower);
    return tower;
  }

  buildWatchtower(-24, -22);
  buildWatchtower(24, -20);

  // --- THE SHRINKING ELECTRIC STORM SAFE ZONE RING ---
  const stormGeo = new THREE.CylinderGeometry(stormRadius, stormRadius, 35, 48, 1, true);
  const stormMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    transparent: true,
    opacity: 0.28,
    side: THREE.DoubleSide,
    wireframe: false,
  });
  const stormRingMesh = new THREE.Mesh(stormGeo, stormMat);
  stormRingMesh.position.set(0, 17.5, -12);
  scene.add(stormRingMesh);

  // Glowing Storm Rim at Base
  const stormRimGeo = new THREE.RingGeometry(stormRadius - 0.4, stormRadius + 0.4, 48);
  const stormRimMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide });
  const stormRimMesh = new THREE.Mesh(stormRimGeo, stormRimMat);
  stormRimMesh.rotation.x = -Math.PI / 2;
  stormRimMesh.position.set(0, 0.08, -12);
  scene.add(stormRimMesh);

  // --- FIRST-PERSON TACTICAL WEAPON VIEWMODEL ---
  const activeSkin = getActiveWeaponSkin();
  const weaponGroup = new THREE.Group();

  // Upper & Lower Receiver
  const receiverMat = new THREE.MeshStandardMaterial({
    color: activeSkin.primaryColor,
    roughness: activeSkin.roughness,
    metalness: activeSkin.metalness,
    emissive: activeSkin.emissiveColor ? new THREE.Color(activeSkin.emissiveColor) : new THREE.Color(0x000000),
    emissiveIntensity: activeSkin.emissiveColor ? 0.45 : 0,
  });
  const receiverGeo = new THREE.BoxGeometry(0.12, 0.18, 0.65);
  const receiver = new THREE.Mesh(receiverGeo, receiverMat);
  receiver.castShadow = true;
  weaponGroup.add(receiver);

  // Fluted Precision Barrel & Compensator
  const barrelGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.6, 12);
  const barrel = new THREE.Mesh(barrelGeo, receiverMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.02, -0.6);
  weaponGroup.add(barrel);

  const muzzleBrakeGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.08, 12);
  const brakeMat = new THREE.MeshStandardMaterial({
    color: activeSkin.accentColor,
    metalness: activeSkin.metalness,
  });
  const brake = new THREE.Mesh(muzzleBrakeGeo, brakeMat);
  brake.rotation.x = Math.PI / 2;
  brake.position.set(0, 0.02, -0.94);
  weaponGroup.add(brake);

  // Tactical Handguard
  const guardGeo = new THREE.BoxGeometry(0.1, 0.12, 0.45);
  const guard = new THREE.Mesh(guardGeo, receiverMat);
  guard.position.set(0, -0.01, -0.42);
  weaponGroup.add(guard);

  // Curved 30-Round Magazine
  const magGeo = new THREE.BoxGeometry(0.07, 0.32, 0.16);
  const magMat = new THREE.MeshStandardMaterial({ color: 0x22222c, metalness: 0.7 });
  const mag = new THREE.Mesh(magGeo, magMat);
  mag.position.set(0, -0.22, -0.1);
  mag.rotation.x = 0.25;
  weaponGroup.add(mag);

  // Open-Frame EOTech Holographic Reflex Sight (Translucent Glass + Neon Reticle!)
  const sightPostGeo = new THREE.BoxGeometry(0.015, 0.11, 0.14);
  const sightPostL = new THREE.Mesh(sightPostGeo, receiverMat);
  sightPostL.position.set(-0.045, 0.145, -0.15);
  weaponGroup.add(sightPostL);

  const sightPostR = new THREE.Mesh(sightPostGeo, receiverMat);
  sightPostR.position.set(0.045, 0.145, -0.15);
  weaponGroup.add(sightPostR);

  const sightTopGeo = new THREE.BoxGeometry(0.105, 0.015, 0.14);
  const sightTop = new THREE.Mesh(sightTopGeo, receiverMat);
  sightTop.position.set(0, 0.20, -0.15);
  weaponGroup.add(sightTop);

  const sightGlassGeo = new THREE.PlaneGeometry(0.075, 0.085);
  const sightGlassMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide,
  });
  const sightGlass = new THREE.Mesh(sightGlassGeo, sightGlassMat);
  sightGlass.position.set(0, 0.145, -0.18);
  weaponGroup.add(sightGlass);

  const reticleGeo = new THREE.RingGeometry(0.01, 0.018, 16);
  const reticleMat = new THREE.MeshBasicMaterial({ color: 0xff0044, side: THREE.DoubleSide });
  const reticle = new THREE.Mesh(reticleGeo, reticleMat);
  reticle.position.set(0, 0.145, -0.19);
  weaponGroup.add(reticle);

  // PEQ Tactical Laser Emitter (projects aiming laser beam)
  const peqGeo = new THREE.BoxGeometry(0.06, 0.05, 0.14);
  const peqMat = new THREE.MeshStandardMaterial({ color: 0x334155 });
  const peq = new THREE.Mesh(peqGeo, peqMat);
  peq.position.set(0.08, 0.08, -0.35);
  weaponGroup.add(peq);

  const laserLineGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0.08, 0.08, -0.42),
    new THREE.Vector3(0, 0.02, -35),
  ]);
  const laserLineMat = new THREE.LineBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.45 });
  const weaponLaser = new THREE.Line(laserLineGeo, laserLineMat);
  weaponGroup.add(weaponLaser);

  // Dynamic Muzzle Flash Point Light & Cross Mesh
  const muzzleLight = new THREE.PointLight(0xffa500, 0, 8);
  muzzleLight.position.set(0, 0.02, -1.05);
  weaponGroup.add(muzzleLight);

  const flashGeo = new THREE.OctahedronGeometry(0.15, 0);
  const flashMat = new THREE.MeshBasicMaterial({ color: 0xffeedd, transparent: true, opacity: 0 });
  const flashMesh = new THREE.Mesh(flashGeo, flashMat);
  flashMesh.position.set(0, 0.02, -1.02);
  weaponGroup.add(flashMesh);

  // Initial weapon viewmodel offset relative to player camera + dedicated weapon key light
  weaponGroup.position.set(0.28, -0.22, -0.65);
  camera.add(weaponGroup);
  const dzVmLight = new THREE.PointLight(0xe0f2fe, 2.0, 4);
  dzVmLight.position.set(0.2, 0.25, -0.25);
  camera.add(dzVmLight);
  scene.add(camera);

  // --- PROCEDURAL 3D HUMANOID OPERATOR BUILDER ---
  function createHumanoidOperator(type: 'sniper' | 'striker' | 'boss'): {
    group: THREE.Group;
    laser: THREE.Line;
    light: THREE.PointLight;
    animHandle?: ModelAnimationHandle;
  } {
    const grp = new THREE.Group();
    const isBoss = type === 'boss';

    // If Boss, spawn authentic heavy combat mecha robot with articulated limbs and power core
    if (isBoss) {
      const robotHandle = buildCombatRobot({
        scale: 1.25,
        primaryColor: 0x1e293b,
        accentColor: 0xd97706,
        glowColor: 0xff0044,
        weaponType: 'rifle',
      });
      grp.add(robotHandle.group);

      const laserMat = new THREE.LineBasicMaterial({
        color: 0xff0044,
        transparent: true,
        opacity: 0.75,
      });
      const laserGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0.35, 1.8, 0.9),
        new THREE.Vector3(0, 2.5, 20),
      ]);
      const laser = new THREE.Line(laserGeo, laserMat);
      grp.add(laser);

      const laserLight = new THREE.PointLight(0xff0044, 2.0, 8);
      laserLight.position.set(0.35, 1.8, 0.95);
      grp.add(laserLight);

      return { group: grp, laser, light: laserLight, animHandle: robotHandle };
    }

    // Materials for Operators
    const armorColor = type === 'sniper' ? 0x0284c7 : 0x64748b;
    const vestMat = new THREE.MeshStandardMaterial({ color: armorColor, metalness: 0.6, roughness: 0.35 });
    const fatigueMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.65 });

    // Torso / Tactical Plate Carrier (Heroic Combat Scale)
    const torsoScale = 1.25;
    const torsoGeo = new THREE.BoxGeometry(0.9 * torsoScale, 1.2 * torsoScale, 0.5 * torsoScale);
    const torso = new THREE.Mesh(torsoGeo, vestMat);
    torso.position.y = 1.9 * torsoScale;
    torso.castShadow = true;
    grp.add(torso);

    // Ammo Pouches on chest
    const pouchGeo = new THREE.BoxGeometry(0.25 * torsoScale, 0.3 * torsoScale, 0.15 * torsoScale);
    [-0.25, 0, 0.25].forEach((px) => {
      const p = new THREE.Mesh(pouchGeo, fatigueMat);
      p.position.set(px * torsoScale, 1.8 * torsoScale, 0.3 * torsoScale);
      grp.add(p);
    });

    // Head & Ballistic Kevlar Helmet
    const headGeo = new THREE.SphereGeometry(0.32 * torsoScale, 12, 12);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 2.8 * torsoScale;
    grp.add(head);

    const helmetGeo = new THREE.SphereGeometry(0.36 * torsoScale, 12, 12, 0, Math.PI * 2, 0, Math.PI / 1.8);
    const helmet = new THREE.Mesh(helmetGeo, vestMat);
    helmet.position.y = 2.85 * torsoScale;
    grp.add(helmet);

    // Glowing NVG Visor / Cyber Eye Lens
    const visorGeo = new THREE.BoxGeometry(0.42 * torsoScale, 0.1 * torsoScale, 0.2 * torsoScale);
    const visorMat = new THREE.MeshBasicMaterial({ color: type === 'sniper' ? 0x38bdf8 : 0xf43f5e });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 2.8 * torsoScale, 0.28 * torsoScale);
    grp.add(visor);

    // Articulated Arms & Tactical Carbine Weapon
    const armGeo = new THREE.CylinderGeometry(0.12 * torsoScale, 0.1 * torsoScale, 0.9 * torsoScale, 8);
    const leftArm = new THREE.Mesh(armGeo, fatigueMat);
    leftArm.position.set(-0.65 * torsoScale, 2.0 * torsoScale, 0.3 * torsoScale);
    leftArm.rotation.x = -Math.PI / 3;
    grp.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, fatigueMat);
    rightArm.position.set(0.65 * torsoScale, 2.0 * torsoScale, 0.3 * torsoScale);
    rightArm.rotation.x = -Math.PI / 3;
    grp.add(rightArm);

    // Enemy Assault Rifle in hand
    const rifleGeo = new THREE.BoxGeometry(0.12 * torsoScale, 0.18 * torsoScale, 0.9 * torsoScale);
    const rifle = new THREE.Mesh(rifleGeo, receiverMat);
    rifle.position.set(0.2 * torsoScale, 1.8 * torsoScale, 0.65 * torsoScale);
    grp.add(rifle);

    // Legs
    const legGeo = new THREE.CylinderGeometry(0.15 * torsoScale, 0.12 * torsoScale, 1.3 * torsoScale, 8);
    const leftLeg = new THREE.Mesh(legGeo, fatigueMat);
    leftLeg.position.set(-0.28 * torsoScale, 0.7 * torsoScale, 0);
    grp.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, fatigueMat);
    rightLeg.position.set(0.28 * torsoScale, 0.7 * torsoScale, 0);
    grp.add(rightLeg);

    // Red Aiming Laser targeting player
    const laserMat = new THREE.LineBasicMaterial({
      color: 0xff2222,
      transparent: true,
      opacity: 0.65,
    });
    const laserGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0.2 * torsoScale, 1.8 * torsoScale, 0.9 * torsoScale),
      new THREE.Vector3(0, 2.5, 20),
    ]);
    const laser = new THREE.Line(laserGeo, laserMat);
    grp.add(laser);

    // Laser Tip Glow Light
    const laserLight = new THREE.PointLight(0xff2222, 1.5, 6);
    laserLight.position.set(0.2 * torsoScale, 1.8 * torsoScale, 0.95 * torsoScale);
    grp.add(laserLight);

    return { group: grp, laser, light: laserLight };
  }

  // --- SPAWN HOSTILE COMBATANT ---
  function spawnEnemy(type: 'sniper' | 'striker' | 'boss'): void {
    if (isGameEnded) return;

    const { group, laser, light: laserLight, animHandle } = createHumanoidOperator(type);
    let spawnPos = new THREE.Vector3();
    let word = '';

    if (type === 'boss') {
      spawnPos.set(0, 0, -26);
      word = BOSS_PHRASES[bossPhaseIndex];
      speakMechVoice('Warning: Apex Squad Leader detected! Eliminate the warlord!');
    } else if (type === 'sniper') {
      // Position on top of containers or watchtowers
      const perchSide = Math.random() > 0.5 ? 1 : -1;
      const onTower = Math.random() > 0.6;
      if (onTower) {
        spawnPos.set(perchSide * 24, 10.2, perchSide > 0 ? -20 : -22);
      } else {
        spawnPos.set(perchSide * 16, 3.2, -9 + (Math.random() - 0.5) * 4);
      }
      word = SNIPER_WORDS[Math.floor(Math.random() * SNIPER_WORDS.length)];
    } else {
      // Ground assault striker
      const x = (Math.random() - 0.5) * 28;
      const z = -14 - Math.random() * 16;
      spawnPos.set(x, 0, z);
      word = STRIKER_WORDS[Math.floor(Math.random() * STRIKER_WORDS.length)];
    }

    group.position.copy(spawnPos);
    group.lookAt(camera.position.x, spawnPos.y, camera.position.z);
    scene.add(group);

    const maxTimer =
      type === 'boss'
        ? (difficulty === 'nightmare' ? 9.0 : 12.0)
        : type === 'sniper'
        ? (difficulty === 'nightmare' ? 4.2 : difficulty === 'cadet' ? 7.5 : 5.8)
        : (difficulty === 'nightmare' ? 4.8 : difficulty === 'cadet' ? 8.2 : 6.4);

    const labelBadge = type === 'boss' ? 'APEX WARLORD' : type === 'sniper' ? 'SNIPER' : 'STRIKER';
    const labelColor = type === 'boss' ? '#eab308' : type === 'sniper' ? '#38bdf8' : '#f43f5e';

    const labelHandle = create2DLabel(word, {
      offsetY: type === 'boss' ? 3.8 : 3.2,
      className: `dropzone-enemy-label label-${type}`,
    });

    labelHandle.element.innerHTML = `
      <div style="background:rgba(5,4,10,0.85);border:1px solid ${labelColor};border-radius:6px;padding:3px 8px;text-align:center;box-shadow:0 0 12px rgba(0,0,0,0.7);">
        <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:${labelColor};letter-spacing:1px;font-weight:800;">${escapeHTML(labelBadge)}</div>
        <div class="word-text" style="font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:900;color:#ffffff;letter-spacing:1.5px;">${escapeHTML(word)}</div>
        <div style="width:100%;height:3px;background:rgba(255,255,255,0.2);margin-top:3px;border-radius:2px;overflow:hidden;">
          <div class="timer-bar" style="width:100%;height:100%;background:${labelColor};transition:width 0.1s linear;"></div>
        </div>
      </div>
    `;
    group.add(labelHandle.labelObj);

    activeEnemies.push({
      mesh: group,
      type,
      word,
      maxHp: type === 'boss' ? 3 : 1,
      currentHp: type === 'boss' ? 3 : 1,
      labelHandle,
      attackTimer: maxTimer,
      maxAttackTimer: maxTimer,
      laserBeam: laser,
      laserLight,
      isDead: false,
      basePosition: spawnPos.clone(),
      animHandle,
    });
  }

  // --- SPAWN AIRDROP SUPPLY CRATE ---
  function spawnAirdrop(): void {
    if (currentAirdrop || isGameEnded) return;

    playSafeZoneSiren();
    speakMechVoice('Tactical airdrop incoming! Intercept the supply crate!');

    const airdropGrp = new THREE.Group();

    // Red / Gold Military Crate
    const crateGeo = new THREE.BoxGeometry(2.4, 2.2, 2.4);
    const crateMat = new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      metalness: 0.6,
      roughness: 0.35,
    });
    const crate = new THREE.Mesh(crateGeo, crateMat);
    crate.castShadow = true;
    airdropGrp.add(crate);

    // Yellow Stencil & Straps
    const strapMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const strapGeo = new THREE.BoxGeometry(2.45, 0.25, 2.45);
    const strap = new THREE.Mesh(strapGeo, strapMat);
    airdropGrp.add(strap);

    // Parachute Dome
    const chuteGeo = new THREE.SphereGeometry(3.5, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2.2);
    const chuteMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      roughness: 0.9,
      side: THREE.DoubleSide,
    });
    const chute = new THREE.Mesh(chuteGeo, chuteMat);
    chute.position.y = 5.2;
    airdropGrp.add(chute);

    // Parachute Suspension Lines
    const linesMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(Math.cos(angle) * 3.4, 5.2, Math.sin(angle) * 3.4),
        new THREE.Vector3(0, 1.1, 0),
      ]);
      airdropGrp.add(new THREE.Line(lineGeo, linesMat));
    }

    const dropX = (Math.random() - 0.5) * 20;
    const dropZ = -15 - Math.random() * 12;
    airdropGrp.position.set(dropX, 35, dropZ);
    scene.add(airdropGrp);

    // Volumetric Smoke Particle Plume (ignites upon landing)
    const smokeCount = 120;
    const smokeGeo = new THREE.BufferGeometry();
    const smokePos = new Float32Array(smokeCount * 3);
    for (let i = 0; i < smokeCount; i++) {
      smokePos[i * 3] = (Math.random() - 0.5) * 1.5;
      smokePos[i * 3 + 1] = Math.random() * 12;
      smokePos[i * 3 + 2] = (Math.random() - 0.5) * 1.5;
    }
    smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3));
    const smokeMat = new THREE.PointsMaterial({
      color: 0xef4444,
      size: 1.2,
      transparent: true,
      opacity: 0,
    });
    const smokeMesh = new THREE.Points(smokeGeo, smokeMat);
    smokeMesh.position.set(dropX, 0, dropZ);
    scene.add(smokeMesh);

    const benefit: 'armor' | 'medkit' | 'airstrike' =
      playerHp < 50 ? 'medkit' : playerArmor < 50 ? 'armor' : 'airstrike';
    const word = AIRDROP_WORDS[Math.floor(Math.random() * AIRDROP_WORDS.length)];

    const labelHandle = create2DLabel(word, {
      offsetY: 2.8,
      className: 'dropzone-airdrop-label',
    });
    labelHandle.element.innerHTML = `
      <div style="background:rgba(185,28,28,0.9);border:2px solid #facc15;border-radius:6px;padding:3px 10px;text-align:center;box-shadow:0 0 16px rgba(250,204,21,0.8);">
        <div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:#fef08a;font-weight:900;">AIRDROP LOOT</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:900;color:#ffffff;letter-spacing:1.5px;">${escapeHTML(word)}</div>
      </div>
    `;
    airdropGrp.add(labelHandle.labelObj);

    currentAirdrop = {
      mesh: airdropGrp,
      smokeMesh,
      word,
      benefit,
      labelHandle,
      hasLanded: false,
      isClaimed: false,
      fallSpeed: 6.5,
    };
  }

  // --- EJECT BRASS CASING SIMULATION ---
  function ejectShellCasing(): void {
    const casingGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.06, 8);
    const casingMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.9, roughness: 0.2 });
    const casing = new THREE.Mesh(casingGeo, casingMat);

    // Ejection world position
    const ejectPos = new THREE.Vector3(0.35, -0.15, -0.6);
    ejectPos.applyMatrix4(camera.matrixWorld);
    casing.position.copy(ejectPos);
    scene.add(casing);

    activeCasings.push({
      mesh: casing,
      velocity: new THREE.Vector3(
        (0.8 + Math.random() * 0.4) * (Math.random() > 0.5 ? 1 : 0.8),
        1.5 + Math.random() * 0.8,
        -0.4 + Math.random() * 0.6
      ),
      rotVelocity: new THREE.Vector3(
        Math.random() * 20,
        Math.random() * 20,
        Math.random() * 20
      ),
      life: 1.8,
    });
  }

  // --- ADD TO KILLFEED ---
  function pushKillfeed(killer: string, victim: string, weapon: string, isPlayer = false): void {
    killfeedMessages.unshift({ killer, victim, weapon, isPlayer, time: 3.5 });
    if (killfeedMessages.length > 5) killfeedMessages.pop();

    killfeedOverlay.innerHTML = killfeedMessages
      .map((k) => {
        const bg = k.isPlayer ? 'rgba(234, 179, 8, 0.25)' : 'rgba(15, 23, 42, 0.8)';
        const border = k.isPlayer ? '#eab308' : 'rgba(255,255,255,0.1)';
        const killerColor = k.isPlayer ? '#facc15' : '#94a3b8';
        return `
          <div style="background:${bg};border:1px solid ${border};padding:4px 8px;border-radius:4px;display:flex;align-items:center;gap:6px;box-shadow:0 2px 8px rgba(0,0,0,0.5);">
            <span style="color:${killerColor};font-weight:800;">${escapeHTML(k.killer)}</span>
            <span style="color:#ef4444;">➔</span>
            <span style="color:#cbd5e1;">${escapeHTML(k.victim)}</span>
            <span style="color:#64748b;font-size:9px;">[${escapeHTML(k.weapon)}]</span>
          </div>
        `;
      })
      .join('');
  }

  // --- EXECUTE ENEMY ELIMINATION ---
  function eliminateEnemy(enemy: EnemyCombatant): void {
    enemy.isDead = true;
    killCount++;
    aliveCount = Math.max(1, aliveCount - (enemy.type === 'boss' ? 1 : 2));
    score += enemy.type === 'boss' ? 2500 : enemy.type === 'sniper' ? 650 : 450;
    if (isAdsActive) score += 150;

    // Multi-Kill Streak Tracker
    const nowTime = performance.now();
    if (nowTime - lastKillTimestamp < 4000) {
      multiKillCount++;
    } else {
      multiKillCount = 1;
    }
    lastKillTimestamp = nowTime;

    if (multiKillCount === 2) {
      showMultiKillBanner('⚡ DOUBLE KILL!');
      speakMechVoice('Double kill!');
    } else if (multiKillCount === 3) {
      showMultiKillBanner('🔥 TRIPLE KILL!');
      speakMechVoice('Triple kill!');
    } else if (multiKillCount >= 4) {
      showMultiKillBanner('👑 RAMPAGE // UNSTOPPABLE!');
      speakMechVoice('Rampage! Unstoppable!');
    }

    // Visual Explosion & Floating Damage
    create3DExplosion(enemy.mesh.position.clone().add(new THREE.Vector3(0, 1.8, 0)), new THREE.Color(0xfacc15), 32);
    const critDmg = isAdsActive ? 350 : 220;
    spawnCombatDamageFloat(enemy.mesh.position, isAdsActive ? `💥 ${critDmg} ADS CRIT!` : `🎯 ${critDmg} HEADSHOT!`, 'headshot');

    playSniperRifle();
    playArcadeExplosion();
    shakeCamera(enemy.type === 'boss' ? 0.45 : 0.2);

    pushKillfeed('YOU', enemy.type === 'boss' ? 'ALPHA_WARLORD' : enemy.word, isAdsActive ? 'AWM [4X SCOPE]' : 'AWM HEADSHOT', true);
    enemy.labelHandle.dispose();
    if (enemy.animHandle) {
      enemy.animHandle.dispose();
    }
    scene.remove(enemy.mesh);

    // Spawn Dropped Loot Crate for non-boss enemies
    if (enemy.type !== 'boss') {
      spawnLootDrop(enemy.mesh.position);
    }

    // Free Fire Announcer Voice
    if (killCount === 1) speakMechVoice('First blood confirmed!');
    else if (killCount === 5) speakMechVoice('Dominating the dropzone!');
    else if (killCount === 10) speakMechVoice('Unstoppable apex sniper!');

    // Check Victory (BOOYAH!)
    if (aliveCount <= 1 || (enemy.type === 'boss' && bossPhaseIndex >= BOSS_PHRASES.length - 1)) {
      triggerBooyah();
    }
  }

  // --- CLAIM AIRDROP ---
  function claimAirdrop(drop: AirdropCrate): void {
    drop.isClaimed = true;
    playArcadePowerup();
    drop.labelHandle.dispose();

    if (drop.benefit === 'medkit') {
      playerHp = Math.min(100, playerHp + 60);
      speakMechVoice('Medkit applied! Full combat vitality!');
    } else if (drop.benefit === 'armor') {
      playerArmor = 100;
      speakMechVoice('Level 3 tactical Kevlar equipped!');
    } else {
      // Tactical airstrike wiping active enemies with plunging 3D combat rockets!
      playSniperRifle();
      speakMechVoice('Tactical airstrike coordinates confirmed! Incoming precision missiles!');
      activeEnemies.forEach((e, idx) => {
        if (!e.isDead && e.type !== 'boss') {
          const rocketHandle = buildCombatRocket({
            scale: 0.95,
            bodyColor: 0x1e293b,
            finColor: 0xeab308,
            exhaustColor: 0xff4400,
          });
          const targetPos = e.mesh.position.clone();
          const startPos = new THREE.Vector3(
            targetPos.x + (Math.random() - 0.5) * 4,
            42,
            targetPos.z - 8
          );
          rocketHandle.group.position.copy(startPos);
          rocketHandle.group.lookAt(targetPos);
          scene.add(rocketHandle.group);

          scheduleGameTimeout(() => {
            activeAirstrikeRockets.push({
              handle: rocketHandle,
              origin: startPos,
              target: targetPos,
              progress: 0,
              speed: 2.2,
              onImpact: () => {
                eliminateEnemy(e);
              },
            });
          }, idx * 160);
        }
      });
    }

    scene.remove(drop.mesh);
    currentAirdrop = null;
    nextAirdropTimer = difficulty === 'nightmare' ? 26 : 20;
  }

  // --- TRIGGER THE ICONIC "BOOYAH!" ---
  function triggerBooyah(): void {
    if (isBooyah || isGameEnded) return;
    isBooyah = true;
    isGameEnded = true;

    aliveCount = 1;
    score += 5000;
    playBooyahFanfare();
    speakMechVoice('BOOYAH! You are the apex champion!');
    unlockArcadeTrophy('booyahChampion');

    booyahBanner.style.display = 'flex';
    shakeCamera(0.35);

    // Celebratory fireworks geysers in 3D scene
    for (let i = 0; i < 8; i++) {
      scheduleGameTimeout(() => {
        const fireworkPos = new THREE.Vector3(
          (Math.random() - 0.5) * 35,
          10 + Math.random() * 12,
          -15 - Math.random() * 20
        );
        create3DExplosion(fireworkPos, new THREE.Color(i % 2 === 0 ? 0xfacc15 : 0x38bdf8), 45);
      }, i * 350);
    }

    scheduleGameTimeout(() => {
      endGame();
    }, 4500);
  }

  // --- GAME OVER END ENGINE ---
  function endGame(): void {
    if (isGameEnded && !isBooyah) return;
    isGameEnded = true;

    const accuracy = totalKeystrokes > 0 ? Math.round((correctKeystrokes / totalKeystrokes) * 100) : 100;
    const finalScore = score + killCount * 250;

    if (accuracy >= 98) {
      unlockArcadeTrophy('deadeyeSniper');
    }

    onEndCallback({
      score: finalScore,
      words: killCount,
      accuracy,
      maxCombo: maxStreak,
    });
  }

  // --- INPUT HANDLING ---
  function onInputHandler(): void {
    if (isGameEnded) return;

    const val = inputEl.value.trim().toUpperCase();
    if (!val) return;

    totalKeystrokes++;
    let matchedAny = false;

    // Check Airdrop first
    if (currentAirdrop && !currentAirdrop.isClaimed && currentAirdrop.hasLanded) {
      if (val === currentAirdrop.word) {
        correctKeystrokes++;
        claimAirdrop(currentAirdrop);
        inputEl.value = '';
        return;
      } else if (currentAirdrop.word.startsWith(val)) {
        matchedAny = true;
      }
    }

    // Check Dropped Tactical Loot Crates
    for (let i = activeLootDrops.length - 1; i >= 0; i--) {
      const loot = activeLootDrops[i];
      if (val === loot.word) {
        matchedAny = true;
        correctKeystrokes++;
        claimLootDrop(loot);
        inputEl.value = '';
        return;
      } else if (loot.word.startsWith(val)) {
        matchedAny = true;
      }
    }

    // Check Active Enemies
    for (const enemy of activeEnemies) {
      if (enemy.isDead) continue;

      if (val === enemy.word) {
        matchedAny = true;
        correctKeystrokes++;
        currentStreak++;
        if (currentStreak > maxStreak) maxStreak = currentStreak;

        // Weapon Fire recoil impulse
        weaponRecoilZ = 0.08;
        weaponRecoilRotX = 0.12;
        muzzleFlashTime = 0.05;
        ejectShellCasing();

        if (enemy.type === 'boss') {
          enemy.currentHp--;
          if (enemy.currentHp > 0) {
            bossPhaseIndex++;
            enemy.word = BOSS_PHRASES[bossPhaseIndex];
            enemy.labelHandle.setText(enemy.word);
            playAssaultRifleBurst();
            create3DExplosion(enemy.mesh.position.clone().add(new THREE.Vector3(0, 2, 0)), new THREE.Color(0xf59e0b), 16);
            inputEl.value = '';
            return;
          }
        }

        eliminateEnemy(enemy);
        inputEl.value = '';
        return;
      } else if (enemy.word.startsWith(val)) {
        matchedAny = true;
        enemy.labelHandle.setWordProgress(enemy.word, val.length, true);
      } else {
        enemy.labelHandle.setWordProgress(enemy.word, 0, false);
      }
    }

    if (matchedAny) {
      correctKeystrokes++;
      playAssaultRifleBurst();
      weaponRecoilZ = 0.03;
      weaponRecoilRotX = 0.04;
      muzzleFlashTime = 0.035;
      ejectShellCasing();
    } else {
      currentStreak = 0;
      playTactileClick('error');
    }
  }

  inputEl.addEventListener('input', onInputHandler);
  inputEl.value = '';
  inputEl.focus();

  // --- MAIN 60 FPS RENDER LOOP ---
  let lastTime = performance.now();
  let animationId = 0;
  let bgBattleTimer = 2.5;

  function renderLoop(): void {
    animationId = requestAnimationFrame(renderLoop);
    const now = performance.now();
    const delta = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    // --- OPENING AIRDROP SKYFALL DIVE ---
    if (isSkyfall) {
      if (skyfallAltitude > 22) {
        skyfallAltitude -= delta * 36;
        compassRibbon.innerHTML = `<span style="color:#eab308;font-weight:900;">✈️</span> FREEFALL // ALTITUDE: ${Math.round(skyfallAltitude * 10)}M`;
      } else {
        if (!parachuteDeployed) {
          parachuteDeployed = true;
          playParachuteSnap();
          skyfallTargetRotX = -0.06;
          shakeCamera(0.35);
        }
        skyfallAltitude -= delta * 14;
        compassRibbon.innerHTML = `<span style="color:#4ade80;font-weight:900;">🪂</span> CHUTE DEPLOYED // ALTITUDE: ${Math.round(skyfallAltitude * 10)}M`;
      }

      camera.position.set(0, skyfallAltitude, 14.0 + (skyfallAltitude / 75) * 8);
      camera.rotation.x = THREE.MathUtils.lerp(camera.rotation.x, skyfallTargetRotX, delta * 3.5);

      if (skyfallAltitude <= 3.0) {
        skyfallAltitude = 3.0;
        isSkyfall = false;
        camera.position.set(0, 3.0, 14.0);
        camera.rotation.x = -0.06;
        playArcadeDamage();
        shakeCamera(0.25);
        speakMechVoice('Boots on ground. 50 operators deployed. Survive the storm.');
        compassRibbon.innerHTML = `<span style="color:#eab308;font-weight:900;">▼</span> 180° S // DROPZONE SECTOR-07`;

        spawnEnemy('striker');
        scheduleGameTimeout(() => spawnEnemy('sniper'), 1400);
      }
    }

    // --- STORM SAFE ZONE PROGRESSION ---
    if (!isGameEnded) {
      stormTimer -= delta;
      if (stormTimer <= 0) {
        currentStormPhase = Math.min(currentStormPhase + 1, STORM_PHASE_TIMES.length - 1);
        targetStormRadius = STORM_RADII[currentStormPhase];
        stormTimer = STORM_PHASE_TIMES[currentStormPhase];
        playSafeZoneSiren();
        speakMechVoice('Safe zone is shrinking! Retreat to center!');
      }

      // Smoothly interpolate storm cylinder radius
      if (Math.abs(stormRadius - targetStormRadius) > 0.1) {
        stormRadius += (targetStormRadius - stormRadius) * delta * 0.4;
        stormRingMesh.geometry.dispose();
        stormRingMesh.geometry = new THREE.CylinderGeometry(stormRadius, stormRadius, 35, 48, 1, true);
        stormRimMesh.geometry.dispose();
        stormRimMesh.geometry = new THREE.RingGeometry(stormRadius - 0.4, stormRadius + 0.4, 48);
      }

      // Pulse storm barrier opacity
      stormMat.opacity = 0.22 + Math.sin(now * 0.003) * 0.08;
    }

    // --- SIMULATE BACKGROUND ROYALE COMBAT ---
    if (!isGameEnded && aliveCount > 2) {
      bgBattleTimer -= delta;
      if (bgBattleTimer <= 0) {
        bgBattleTimer = 2.8 + Math.random() * 3.2;
        aliveCount = Math.max(2, aliveCount - 1);
        const killer = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
        let victim = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
        while (victim === killer) victim = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
        const weapon = BOT_WEAPONS[Math.floor(Math.random() * BOT_WEAPONS.length)];
        pushKillfeed(killer, victim, weapon, false);

        // Spawn final boss when 2 remain
        if (aliveCount === 2 && !activeEnemies.some((e) => e.type === 'boss')) {
          activeEnemies.forEach((e) => {
            if (!e.isDead) {
              e.labelHandle.dispose();
              scene.remove(e.mesh);
              e.isDead = true;
            }
          });
          spawnEnemy('boss');
        }
      }
    }

    // --- AIRDROP PROGRESSION ---
    if (!isGameEnded) {
      nextAirdropTimer -= delta;
      if (nextAirdropTimer <= 0 && !currentAirdrop && aliveCount > 3) {
        spawnAirdrop();
      }

      if (currentAirdrop && !currentAirdrop.isClaimed) {
        if (!currentAirdrop.hasLanded) {
          currentAirdrop.mesh.position.y -= currentAirdrop.fallSpeed * delta;
          if (currentAirdrop.mesh.position.y <= 1.1) {
            currentAirdrop.mesh.position.y = 1.1;
            currentAirdrop.hasLanded = true;
            playAirdropLanding();
            shakeCamera(0.2);
            // Hide parachute dome, activate red smoke plume
            (currentAirdrop.smokeMesh.material as THREE.PointsMaterial).opacity = 0.7;
          }
        } else {
          // Smoke billowing
          const positions = currentAirdrop.smokeMesh.geometry.attributes.position.array as Float32Array;
          for (let i = 1; i < positions.length; i += 3) {
            positions[i] += delta * 4.5;
            if (positions[i] > 18) positions[i] = 0;
          }
          currentAirdrop.smokeMesh.geometry.attributes.position.needsUpdate = true;
        }
      }
    }

    // --- ENEMY COMBATANTS LOGIC ---
    if (!isGameEnded) {
      // Keep 2-3 hostiles spawned
      const liveEnemies = activeEnemies.filter((e) => !e.isDead);
      if (liveEnemies.length < (aliveCount > 10 ? 3 : 2) && aliveCount > 2) {
        const type = Math.random() > 0.45 ? 'sniper' : 'striker';
        spawnEnemy(type);
      }

      activeEnemies.forEach((enemy) => {
        if (enemy.isDead) return;

        // Subtle tactical sway / breathing or robot mech animation
        if (enemy.animHandle?.update) {
          enemy.animHandle.update(delta, now * 0.001);
        } else {
          enemy.mesh.position.y = enemy.basePosition.y + Math.sin(now * 0.003 + enemy.basePosition.x) * 0.08;
        }

        // Aim laser sight directly at player's camera
        const origin = enemy.mesh.position.clone().add(new THREE.Vector3(0.2, 1.8, 0.9));
        const laserPoints = [origin, camera.position.clone().add(new THREE.Vector3(0, -0.4, 0))];
        enemy.laserBeam.geometry.setFromPoints(laserPoints);

        // Attack Timer Countdown
        enemy.attackTimer -= delta;
        const progressPct = Math.max(0, (enemy.attackTimer / enemy.maxAttackTimer) * 100);
        const timerBar = enemy.labelHandle.element.querySelector('.timer-bar') as HTMLElement;
        if (timerBar) timerBar.style.width = `${progressPct}%`;

        // Laser intensifies as attack timer nears expiration
        if (enemy.attackTimer < 1.5) {
          enemy.laserLight.intensity = 3.5 + Math.sin(now * 0.02) * 2;
        }

        // Enemy Attack Execution
        if (enemy.attackTimer <= 0) {
          enemy.attackTimer = enemy.maxAttackTimer;
          const damage = enemy.type === 'boss' ? 35 : enemy.type === 'sniper' ? 24 : 14;

          // Absorb into armor first
          if (playerArmor > 0) {
            const absorbed = Math.min(playerArmor, damage);
            playerArmor -= absorbed;
            playerHp -= (damage - absorbed);
          } else {
            playerHp -= damage;
          }

          playArcadeDamage();
          shakeCamera(enemy.type === 'sniper' ? 0.35 : 0.2);

          threatVignette.style.boxShadow = 'inset 0 0 75px rgba(239, 68, 68, 0.85)';
          scheduleGameTimeout(() => {
            threatVignette.style.boxShadow = 'inset 0 0 0px rgba(239, 68, 68, 0)';
          }, 240);

          if (playerHp <= 0) {
            playerHp = 0;
            speakMechVoice('Operator down! Elimination confirmed.');
            endGame();
          }
        }
      });
    }

    // --- ANIMATE INCOMING 3D TACTICAL AIRSTRIKE ROCKETS ---
    for (let r = activeAirstrikeRockets.length - 1; r >= 0; r--) {
      const rkt = activeAirstrikeRockets[r];
      rkt.progress += delta * rkt.speed;
      rkt.handle.update?.(delta, now * 0.001);
      rkt.handle.group.position.lerpVectors(rkt.origin, rkt.target, rkt.progress);

      if (rkt.progress >= 1.0) {
        create3DExplosion(rkt.target, new THREE.Color(0xf59e0b), 50);
        create3DExplosion(rkt.target, new THREE.Color(0xff4400), 35);
        shakeCamera(0.65);
        playArcadeExplosion();
        rkt.onImpact?.();
        rkt.handle.dispose();
        scene.remove(rkt.handle.group);
        activeAirstrikeRockets.splice(r, 1);
      }
    }

    // --- WEAPON VIEWMODEL SPRING, SWAY & ADS BLEND ---
    const targetAdsBlend = isAdsActive ? 1 : 0;
    currentAdsBlend += (targetAdsBlend - currentAdsBlend) * Math.min(1, delta * 12);

    const swayMult = 1 - currentAdsBlend * 0.75;
    const swayX = Math.cos(now * 0.002) * 0.006 * swayMult;
    const swayY = Math.sin(now * 0.004) * 0.008 * swayMult;

    const hipX = 0.28, hipY = -0.22, hipZ = -0.65;
    const adsX = 0.0, adsY = -0.16, adsZ = -0.42;

    weaponRecoilZ = Math.max(0, weaponRecoilZ - delta * 0.45);
    weaponRecoilRotX = Math.max(0, weaponRecoilRotX - delta * 0.65);

    weaponGroup.position.set(
      hipX + (adsX - hipX) * currentAdsBlend + swayX,
      hipY + (adsY - hipY) * currentAdsBlend + swayY,
      hipZ + (adsZ - hipZ) * currentAdsBlend + weaponRecoilZ
    );
    weaponGroup.rotation.x = weaponRecoilRotX;
    // Hide hipfire rifle model cleanly when zoomed into 4.0X sniper optic overlay
    weaponGroup.visible = currentAdsBlend < 0.72;

    // Smooth Camera FOV Zoom for ADS (65 -> 40)
    const targetFov = isAdsActive ? 40 : 65;
    if (Math.abs(camera.fov - targetFov) > 0.1) {
      camera.fov += (targetFov - camera.fov) * Math.min(1, delta * 12);
      camera.updateProjectionMatrix();
    }

    // --- TACTICAL LOOT DROPS TICK ---
    for (let i = activeLootDrops.length - 1; i >= 0; i--) {
      const loot = activeLootDrops[i];
      loot.life -= delta;
      if (loot.life <= 0) {
        loot.labelHandle.dispose();
        scene.remove(loot.group);
        activeLootDrops.splice(i, 1);
        continue;
      }
      loot.group.rotation.y += delta * 1.6;
      loot.group.position.y = 0.45 + Math.sin(now * 0.003 + loot.group.position.x) * 0.1;
    }

    // Muzzle Flash Decay
    if (muzzleFlashTime > 0) {
      muzzleFlashTime -= delta;
      muzzleLight.intensity = 4.5;
      flashMat.opacity = 0.9;
    } else {
      muzzleLight.intensity = 0;
      flashMat.opacity = 0;
    }

    // --- SPENT SHELL CASING PHYSICS ---
    for (let i = activeCasings.length - 1; i >= 0; i--) {
      const casing = activeCasings[i];
      casing.life -= delta;
      if (casing.life <= 0) {
        scene.remove(casing.mesh);
        casing.mesh.geometry.dispose();
        activeCasings.splice(i, 1);
        continue;
      }

      casing.velocity.y -= 9.8 * delta; // Gravity
      casing.mesh.position.addScaledVector(casing.velocity, delta);
      casing.mesh.rotation.x += casing.rotVelocity.x * delta;
      casing.mesh.rotation.y += casing.rotVelocity.y * delta;

      // Ground bounce
      if (casing.mesh.position.y < 0.03) {
        casing.mesh.position.y = 0.03;
        casing.velocity.y = -casing.velocity.y * 0.35;
        casing.velocity.x *= 0.6;
        casing.velocity.z *= 0.6;
      }
    }

    // Update 3D FX & Render
    updateFX(delta);

    // Update HUD Stats
    const aliveEl = hudEl.querySelector('#dropzone-alive') as HTMLElement;
    const killsEl = hudEl.querySelector('#dropzone-kills') as HTMLElement;
    const hpEl = hudEl.querySelector('#dropzone-hp') as HTMLElement;
    const armorEl = hudEl.querySelector('#dropzone-armor') as HTMLElement;
    const stormEl = hudEl.querySelector('#dropzone-storm') as HTMLElement;

    if (aliveEl) aliveEl.innerText = `🔥 ${aliveCount} ALIVE`;
    if (killsEl) killsEl.innerText = `${killCount}`;
    if (hpEl) {
      hpEl.innerText = `${Math.max(0, Math.ceil(playerHp))}%`;
      hpEl.style.color = playerHp < 35 ? '#ef4444' : '#4ade80';
    }
    if (armorEl) armorEl.innerText = `${Math.ceil(playerArmor)}%`;
    if (stormEl) stormEl.innerText = `${Math.ceil(stormTimer)}s`;
  }

  animationId = requestAnimationFrame(renderLoop);

  return {
    id: 'cyberDropzone',
    stop: () => {
      isStopped = true;
      isGameEnded = true;
      pendingTimeouts.forEach(clearTimeout);
      pendingTimeouts.clear();
      cancelAnimationFrame(animationId);
      inputEl.removeEventListener('input', onInputHandler);
      killfeedOverlay.remove();
      booyahBanner.remove();
      compassRibbon.remove();
      threatVignette.remove();
      adsScopeOverlay.remove();
      stageEl.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onAdsKeyDown);

      activeLootDrops.forEach((l) => {
        l.labelHandle.dispose();
        scene.remove(l.group);
      });

      activeEnemies.forEach((e) => {
        e.labelHandle.dispose();
        if (e.animHandle) {
          e.animHandle.dispose();
        }
        scene.remove(e.mesh);
      });
      activeAirstrikeRockets.forEach((r) => {
        r.handle.dispose();
        scene.remove(r.handle.group);
      });
      activeAirstrikeRockets.length = 0;
      activeCasings.forEach((c) => {
        scene.remove(c.mesh);
        c.mesh.geometry.dispose();
      });
      if (currentAirdrop) {
        currentAirdrop.labelHandle.dispose();
        scene.remove(currentAirdrop.mesh);
        scene.remove(currentAirdrop.smokeMesh);
      }

      camera.remove(weaponGroup);
      camera.remove(dzVmLight);
      dzVmLight.dispose();
      dispose();
    },
  };
}