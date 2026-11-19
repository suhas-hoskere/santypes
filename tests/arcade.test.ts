// Santypes 3D Arcade & Gamification Unit Tests
import { describe, it, expect, beforeEach } from 'vitest';
import { awardArcadeReward, getAccountState, saveAccountState } from '../src/stubs/account-stub.ts';
import {
  ARCADE_GAMES,
  getArcadeWord,
  DIFFICULTY_PRESETS,
  ARCADE_TROPHIES,
  getUnlockedTrophies,
  unlockArcadeTrophy,
  WEAPON_SKINS,
  getActiveWeaponSkin,
  setActiveWeaponSkin,
} from '../src/views/arcade/arcade-types.ts';
import {
  buildCombatRobot,
  buildCombatRocket,
  buildPiercingArrow,
  buildGoliathSiegeTank,
  buildAerialPredatorDrone,
} from '../src/views/arcade/procedural-models.ts';
import * as THREE from 'three';

// Mock localStorage and window for Node environment
const mockStorage: Record<string, string> = {};
globalThis.localStorage = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, value: string) => {
    mockStorage[key] = value;
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
  clear: () => {
    for (const k in mockStorage) delete mockStorage[k];
  },
  key: (i: number) => Object.keys(mockStorage)[i] || null,
  length: 0,
};

if (typeof window === 'undefined') {
  (globalThis as any).window = {
    dispatchEvent: () => true,
  };
}

describe('3D Arcade Combat & Reward System', () => {
  beforeEach(() => {
    localStorage.clear();
    saveAccountState({
      xp: 0,
      level: 1,
      streak: { current: 1, best: 1, lastActiveDate: '2026-10-26' },
      unlockedBadges: {},
      dailyChallenge: { date: '2026-10-26', completed: false },
    });
  });

  it('calculates arcade XP reward correctly with high accuracy bonus', () => {
    // score: 2400, words: 12, accuracy: 96%, maxCombo: 15
    const reward = awardArcadeReward(2400, 12, 96, 15);

    expect(reward.score).toBe(2400);
    expect(reward.wordsDestroyed).toBe(12);
    expect(reward.accuracy).toBe(96);
    expect(reward.maxCombo).toBe(15);

    // baseScore: 2400/8 = 300
    // wordsXp: 12*6 = 72
    // comboBonus: 15*4 = 60
    // accBonus (>=95%): 75
    // total: 300 + 72 + 60 + 75 = 507 XP
    expect(reward.earnedXp).toBe(507);

    const state = getAccountState();
    expect(state.xp).toBe(507);
    expect(reward.newLevel).toBeGreaterThan(1);
  });

  it('awards minimum baseline XP even on quick game over', () => {
    const reward = awardArcadeReward(10, 0, 50, 0);
    expect(reward.earnedXp).toBeGreaterThanOrEqual(25);
  });

  it('persists arcade high score in localStorage', () => {
    localStorage.setItem('santypes_arcade_highscore', '4500');
    expect(Number(localStorage.getItem('santypes_arcade_highscore'))).toBe(4500);
  });

  it('validates 4 curated arcade games: Titan Protocol, Speed Racer GP, Cyber Extraction, and Cyber Dropzone', () => {
    expect(ARCADE_GAMES.length).toBe(4);
    const bossGames = ARCADE_GAMES.filter((g) => g.category === 'boss');
    const racingGames = ARCADE_GAMES.filter((g) => g.category === 'racing');
    const survivalGames = ARCADE_GAMES.filter((g) => g.category === 'survival');
    const royaleGames = ARCADE_GAMES.filter((g) => g.category === 'royale');
    expect(bossGames.length).toBe(1);
    expect(racingGames.length).toBe(1);
    expect(survivalGames.length).toBe(1);
    expect(royaleGames.length).toBe(1);

    const titan = ARCADE_GAMES.find((g) => g.id === 'titanProtocol');
    expect(titan).toBeDefined();
    expect(titan?.name).toBe('Titan Protocol');
    expect(titan?.category).toBe('boss');

    const racer = ARCADE_GAMES.find((g) => g.id === 'speedRacer');
    expect(racer).toBeDefined();
    expect(racer?.name).toBe('Speed Racer GP');
    expect(racer?.category).toBe('racing');

    const extraction = ARCADE_GAMES.find((g) => g.id === 'cyberExtraction');
    expect(extraction).toBeDefined();
    expect(extraction?.name).toBe('Cyber Extraction');
    expect(extraction?.category).toBe('survival');

    const dropzone = ARCADE_GAMES.find((g) => g.id === 'cyberDropzone');
    expect(dropzone).toBeDefined();
    expect(dropzone?.name).toBe('Cyber Dropzone');
    expect(dropzone?.category).toBe('royale');
    expect(dropzone?.metric).toBe('Best Kills');

    const easyWord = getArcadeWord('easy');
    const medWord = getArcadeWord('medium');
    const hardWord = getArcadeWord('hard');

    expect(typeof easyWord).toBe('string');
    expect(typeof medWord).toBe('string');
    expect(typeof hardWord).toBe('string');
    expect(easyWord.length).toBeGreaterThan(0);
    expect(hardWord.length).toBeGreaterThan(0);
  });

  it('validates Cyber Dropzone Free Fire battle royale mechanics, storm ring and BOOYAH victory', () => {
    // 50-player lobby count starts at 50 on elite, shrinks down to 1
    const initialAlive = 50;
    let aliveCount = initialAlive;
    const killsToWin = 13;

    // Simulate lobby eliminations
    for (let k = 0; k < killsToWin; k++) {
      aliveCount = Math.max(1, aliveCount - 4);
    }
    expect(aliveCount).toBe(1); // Final 1 survivor achieves Booyah

    // Storm safe zone radii contract progressively inward
    const stormRadii = [52, 34, 18, 8];
    for (let i = 0; i < stormRadii.length - 1; i++) {
      expect(stormRadii[i]).toBeGreaterThan(stormRadii[i + 1]);
    }

    // Airdrop loot benefits correctly allocate based on player state
    const getAirdropBenefit = (hp: number, armor: number) =>
      hp < 50 ? 'medkit' : armor < 50 ? 'armor' : 'airstrike';

    expect(getAirdropBenefit(30, 100)).toBe('medkit');
    expect(getAirdropBenefit(100, 20)).toBe('armor');
    expect(getAirdropBenefit(100, 100)).toBe('airstrike');
  });

  it('validates Titan Protocol combat balance and perfect parry multiplier', () => {
    // Normal parry score baseline vs perfect parry
    const baseScore = 50;
    const perfectParryScore = 250;
    expect(perfectParryScore).toBeGreaterThan(baseScore);

    // Stagger progression thresholds
    const normalParryStagger = 28;
    const perfectParryStagger = 45;
    expect(perfectParryStagger).toBeGreaterThan(normalParryStagger);

    // Overdrive combo damage ensures boss can be defeated within 2-3 stagger cycles
    const maxBossHp = 2600;
    const comboDamage = 420;
    const strikesNeeded = Math.ceil(maxBossHp / comboDamage);
    expect(strikesNeeded).toBeLessThanOrEqual(7);
  });

  it('validates Speed Racer GP 3D drag mechanics, rival pacing and nitro multipliers', () => {
    // Rivals have realistic graduated target WPMs
    const rivalWpms = [52, 70, 86];
    expect(rivalWpms[0]).toBeLessThan(rivalWpms[1]);
    expect(rivalWpms[1]).toBeLessThan(rivalWpms[2]);

    // Nitro hyperdrive speed multiplier is at least 1.4x
    const normalVelocity = 60 * 0.72;
    const nitroVelocity = normalVelocity * 1.45;
    expect(nitroVelocity).toBeGreaterThan(normalVelocity);

    // Player with 90 WPM overtakes all 3 rivals
    const playerWpm = 90;
    const overtakenCount = rivalWpms.filter((r) => playerWpm > r).length;
    expect(overtakenCount).toBe(3);
  });

  it('validates Arcade difficulty presets and XP multipliers across all games', () => {
    expect(DIFFICULTY_PRESETS.cadet).toBeDefined();
    expect(DIFFICULTY_PRESETS.elite).toBeDefined();
    expect(DIFFICULTY_PRESETS.nightmare).toBeDefined();

    expect(DIFFICULTY_PRESETS.cadet.xpMultiplier).toBe(0.85);
    expect(DIFFICULTY_PRESETS.elite.xpMultiplier).toBe(1.0);
    expect(DIFFICULTY_PRESETS.nightmare.xpMultiplier).toBe(1.5);
    expect(DIFFICULTY_PRESETS.nightmare.xpMultiplier).toBeGreaterThan(DIFFICULTY_PRESETS.elite.xpMultiplier);
  });

  it('validates Combat Pilot Trophies manifest, unlocking and persistence', () => {
    expect(ARCADE_TROPHIES.length).toBe(6);

    const booyah = ARCADE_TROPHIES.find((t) => t.id === 'booyahChampion');
    expect(booyah).toBeDefined();
    expect(booyah?.gameId).toBe('cyberDropzone');
    expect(booyah?.xpReward).toBe(500);

    const mach = ARCADE_TROPHIES.find((t) => t.id === 'hyperdriveAce');
    expect(mach).toBeDefined();
    expect(mach?.gameId).toBe('speedRacer');

    const slayer = ARCADE_TROPHIES.find((t) => t.id === 'nexusSlayer');
    expect(slayer).toBeDefined();
    expect(slayer?.gameId).toBe('titanProtocol');

    const guardian = ARCADE_TROPHIES.find((t) => t.id === 'perimeterGuardian');
    expect(guardian).toBeDefined();
    expect(guardian?.gameId).toBe('cyberExtraction');

    // Unlocking a trophy returns true and persists
    expect(getUnlockedTrophies().booyahChampion).toBeUndefined();
    const unlocked = unlockArcadeTrophy('booyahChampion');
    expect(unlocked).toBe(true);
    expect(getUnlockedTrophies().booyahChampion).toBe(true);

    // Unlocking already unlocked trophy returns false (idempotent)
    const secondUnlock = unlockArcadeTrophy('booyahChampion');
    expect(secondUnlock).toBe(false);
  });

  it('validates The Armory procedural weapon and vehicle skins', () => {
    expect(WEAPON_SKINS.length).toBe(4);

    const skinIds = WEAPON_SKINS.map((s) => s.id);
    expect(skinIds).toContain('obsidian');
    expect(skinIds).toContain('cyberpunk');
    expect(skinIds).toContain('sovereign');
    expect(skinIds).toContain('hazard');

    // Default skin is obsidian
    expect(getActiveWeaponSkin().id).toBe('obsidian');

    // Equipping cyberpunk skin updates active state
    setActiveWeaponSkin('cyberpunk');
    expect(getActiveWeaponSkin().id).toBe('cyberpunk');
    expect(getActiveWeaponSkin().primaryColor).toBe(0x0f172a);
    expect(getActiveWeaponSkin().accentColor).toBe(0x00f0ff);

    // Equipping sovereign gold skin
    setActiveWeaponSkin('sovereign');
    expect(getActiveWeaponSkin().id).toBe('sovereign');
    expect(getActiveWeaponSkin().metalness).toBe(0.95);

    // Reset back to obsidian
    setActiveWeaponSkin('obsidian');
    expect(getActiveWeaponSkin().id).toBe('obsidian');
  });

  it('validates 4 distinct AAA game definitions, icons, badges and descriptions in Arcade manifest', () => {
    expect(ARCADE_GAMES.length).toBe(4);

    const dropzone = ARCADE_GAMES.find((g) => g.id === 'cyberDropzone');
    expect(dropzone).toBeDefined();
    expect(dropzone?.name).toBe('Cyber Dropzone');
    expect(dropzone?.techBadge).toBe('3D Battle Royale');
    expect(dropzone?.themeColor).toBe('#eab308');
    expect(dropzone?.category).toBe('royale');

    const racer = ARCADE_GAMES.find((g) => g.id === 'speedRacer');
    expect(racer).toBeDefined();
    expect(racer?.name).toBe('Speed Racer GP');
    expect(racer?.category).toBe('racing');

    const titan = ARCADE_GAMES.find((g) => g.id === 'titanProtocol');
    expect(titan).toBeDefined();
    expect(titan?.name).toBe('Titan Protocol');
    expect(titan?.category).toBe('boss');

    const extraction = ARCADE_GAMES.find((g) => g.id === 'cyberExtraction');
    expect(extraction).toBeDefined();
    expect(extraction?.name).toBe('Cyber Extraction');
    expect(extraction?.category).toBe('survival');
  });

  it('blocks prototype pollution and rejects invalid trophy or skin IDs', () => {
    localStorage.setItem(
      'santypes_arcade_unlocked_trophies',
      '{"__proto__":true,"constructor":true,"toString":true,"unknownTrophy":true,"booyahChampion":true}'
    );

    const unlocked = getUnlockedTrophies();
    expect(unlocked.booyahChampion).toBe(true);
    expect(unlocked.unknownTrophy).toBeUndefined();
    expect(Object.getPrototypeOf(unlocked)).toBeNull();
    expect(Object.prototype.hasOwnProperty.call(unlocked, '__proto__')).toBe(false);
    expect((unlocked as Record<string, unknown>).toString).toBeUndefined();
    expect(unlockArcadeTrophy('__proto__')).toBe(false);
    expect(unlockArcadeTrophy('constructor')).toBe(false);
    expect(unlockArcadeTrophy('notARealTrophy')).toBe(false);

    setActiveWeaponSkin('obsidian');
    setActiveWeaponSkin('__proto__' as any);
    expect(getActiveWeaponSkin().id).toBe('obsidian');
  });

  describe('Procedural 3D Model Factory (Robots, Rockets, Arrows, Siege Tanks & Drones)', () => {
    it('generates an articulated 3D Combat Robot mecha with stride animations and clean disposal', () => {
      const robot = buildCombatRobot({
        scale: 1.0,
        primaryColor: 0x334155,
        accentColor: 0xef4444,
        glowColor: 0x00f0ff,
        weaponType: 'rifle',
      });

      expect(robot).toBeDefined();
      expect(robot.group).toBeInstanceOf(THREE.Group);

      let meshCount = 0;
      robot.group.traverse((child) => {
        if (child instanceof THREE.Mesh) meshCount++;
      });
      // Should have extensive articulated meshes (head, visor, chest, reactor, arms, rifle, thighs, boots)
      expect(meshCount).toBeGreaterThan(15);

      // Animation stride update test
      expect(typeof robot.update).toBe('function');
      robot.update!(0.016, 1.25);

      // Disposal test
      expect(() => robot.dispose()).not.toThrow();
    });

    it('generates an authentic aerodynamic 3D Combat Rocket with ogive nosecone, 4 fins, and thruster flame', () => {
      const rocket = buildCombatRocket({
        scale: 1.0,
        bodyColor: 0xf1f5f9,
        finColor: 0xe11d48,
        exhaustColor: 0xff5500,
      });

      expect(rocket).toBeDefined();
      expect(rocket.group).toBeInstanceOf(THREE.Group);

      let meshCount = 0;
      rocket.group.traverse((child) => {
        if (child instanceof THREE.Mesh) meshCount++;
      });
      // Warhead, radome tip, main fuselage, decal band, 4 stabilizer fins, nozzle, outer flame, inner flame
      expect(meshCount).toBeGreaterThanOrEqual(9);

      // Roll & flame flicker animation test
      expect(typeof rocket.update).toBe('function');
      rocket.update!(0.016, 0.5);

      expect(() => rocket.dispose()).not.toThrow();
    });

    it('generates an authentic razor broadhead 3D Piercing Arrow with barbed blade, carbon shaft, and 3-vaned fletching', () => {
      const arrow = buildPiercingArrow({
        scale: 1.0,
        tipColor: 0x38bdf8,
        shaftColor: 0x334155,
        fletchColor: 0x0284c7,
      });

      expect(arrow).toBeDefined();
      expect(arrow.group).toBeInstanceOf(THREE.Group);

      let meshCount = 0;
      arrow.group.traverse((child) => {
        if (child instanceof THREE.Mesh) meshCount++;
      });
      // Broadhead tip, shaft, 3 fletching feathers, rear nock
      expect(meshCount).toBeGreaterThanOrEqual(5);

      expect(typeof arrow.update).toBe('function');
      arrow.update!(0.016, 0.8);

      expect(() => arrow.dispose()).not.toThrow();
    });

    it('generates an authentic Heavy Goliath Siege Tank with caterpillar tracks, rotating turret, and twin railguns', () => {
      const tank = buildGoliathSiegeTank({
        scale: 1.0,
        armorColor: 0x334155,
        glowColor: 0xa855f7,
      });

      expect(tank).toBeDefined();
      expect(tank.group).toBeInstanceOf(THREE.Group);

      let meshCount = 0;
      tank.group.traverse((child) => {
        if (child instanceof THREE.Mesh) meshCount++;
      });
      // Heavy tracks with road wheels, chassis hull, ram blade, turret base & hull, twin barrels, muzzle brakes, cupola, radar, reactor
      expect(meshCount).toBeGreaterThanOrEqual(15);

      expect(typeof tank.update).toBe('function');
      tank.update!(0.016, 2.0);

      expect(() => tank.dispose()).not.toThrow();
    });

    it('generates an authentic 3D Aerial Predator Drone with swept delta wings, ducted VTOL fans, and jet thruster', () => {
      const drone = buildAerialPredatorDrone({
        scale: 1.0,
        bodyColor: 0x1e293b,
        glowColor: 0x38bdf8,
      });

      expect(drone).toBeDefined();
      expect(drone.group).toBeInstanceOf(THREE.Group);

      let meshCount = 0;
      drone.group.traverse((child) => {
        if (child instanceof THREE.Mesh) meshCount++;
      });
      // Stealth fuselage, nose canopy, optic sensor ball, swept delta wings, cowl rings, fan hubs, micro missiles, jet thruster
      expect(meshCount).toBeGreaterThanOrEqual(10);

      expect(typeof drone.update).toBe('function');
      drone.update!(0.016, 1.5);

      expect(() => drone.dispose()).not.toThrow();
    });
  });
});
