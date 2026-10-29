import { AssetManager } from '../assets/AssetManager';
import { sound } from '../audio/SoundEngine';
import { getHeroById, HEROES } from '../data/gameContent';
import { OnlineBattleAction } from '../network/OnlineManager';
import {
  BattleItemId,
  BattleSetup,
  BotDifficulty,
  HeroDef,
  MapDef,
  MatchStats,
  SpriteStripEntry,
  UnitKind,
} from '../types';
import { BotDecision, computeShotVelocity, PHYSICS, solveBotShot } from './BotAI';
import { CharacterRenderer } from './CharacterRenderer';
import { Terrain } from './Terrain';

export interface UltronClone {
  id: number;
  offsetX: number;
  offsetY: number;
}

export interface Fighter {
  id: string;
  name: string;
  baseHeroId?: string;
  team: 0 | 1; // 0 = phe Trái (Host / Người Chơi), 1 = phe Phải (Địch / Boss / Guest)
  isPlayerControlled: boolean;
  isRemoteOnline?: boolean;
  botDifficulty: BotDifficulty;
  unitKind: UnitKind;
  isBoss: boolean;
  hero: HeroDef;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facingLeft: boolean;
  aimAngleDeg: number;
  hp: number;
  maxHp: number;
  attack: number;
  pow: number; // 0..100
  stamina: number;
  maxStamina: number;
  alive: boolean;
  grounded: boolean;
  shieldTurns: number;
  webbedTurns: number;
  frozenTurns?: number;
  poisonTurns?: number;
  stealthTurns?: number;
  lastPower: number;
  lastAngle: number;
  scale: number;
  animMode: 'idle' | 'walk' | 'jump' | 'aim' | 'shoot' | 'hurt';
  animTick: number;
  hurtTimer: number;
  inventory: Record<BattleItemId, number>;
  ultronTurnCount?: number;
  ultronClones?: UltronClone[];
}

interface QueuedShot {
  delayTicks: number;
  fire: () => void;
}

interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerId: string;
  team: 0 | 1;
  spriteKey: keyof AssetManager['manifest']['bullets'];
  effectKey: keyof AssetManager['manifest']['effects'];
  holeMask: string;
  holeScale: number;
  damage: number;
  blastRadius: number;
  windScale: number;
  age: number;
  scale?: number;
  special?:
    | 'teleport'
    | 'digger'
    | 'cluster'
    | 'chicky_egg'
    | 'homing'
    | 'electric'
    | 'mouse'
    | 'web'
    | 'shield_bounce'
    | 'sky_lightning'
    | 'hulk_leap'
    | 'hawkeye_giant_homing'
    | 'apache_diamond'
    | 'boomerang_curve'
    | 'freeze'
    | 'poison'
    | 'nuke';
  diggerCharges?: number;
  droppedEgg?: boolean;
  eggDropTick?: number;
  returningToOwner?: boolean;
  boomerangTurnDir?: 1 | -1;
  boomerangTurned?: boolean;
  leapStartY?: number;
  leapPeakHeight?: number;
  hoveringDiamond?: boolean;
  hoverTicks?: number;
  laserTargetX?: number;
  laserTargetY?: number;
  crawling?: boolean;
  crawlDir?: 1 | -1;
  crawlTicksLeft?: number;
  trail: Array<{ x: number; y: number }>;
}

interface LightningBeam {
  x: number;
  y: number;
  ticksLeft: number;
}

interface VisualEffect {
  x: number;
  y: number;
  sprite: SpriteStripEntry;
  tick: number;
  frameDuration: number;
  scale: number;
}

interface FloatingText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
}

interface SupplyCrate {
  x: number;
  y: number;
  vy: number;
  landed: boolean;
  collected: boolean;
  kind: 'hp' | 'pow';
}

interface WindParticle {
  x: number;
  y: number;
  size: number;
  alpha: number;
}

export interface HudSnapshot {
  phase: 'aiming' | 'charging' | 'charging_2' | 'firing' | 'settling' | 'ended';
  activeUnit: Fighter | null;
  fighters: Fighter[];
  wind: number;
  turnTimeLeft: number;
  chargePower: number;
  chargePower2?: number;
  powArmed: boolean;
  activeItemArmed: BattleItemId | null;
  doubleArmed: boolean;
  hawkeyeGiantArmed?: boolean;
  turnNumber: number;
  mapName: string;
  modeLabel: string;
}

export class BattleEngine {
  public readonly terrain: Terrain;
  public readonly charRenderer: CharacterRenderer;
  public fighters: Fighter[] = [];

  private projectiles: Projectile[] = [];
  private queuedShots: QueuedShot[] = [];
  private effects: VisualEffect[] = [];
  private lightningBeams: LightningBeam[] = [];
  private floatingTexts: FloatingText[] = [];
  private crates: SupplyCrate[] = [];
  private windParticles: WindParticle[] = [];
  private bgLayers: string[] = [];

  public wind = 0;
  private pendingNextWind: number | null = null;
  private windMax = 22;
  public phase: HudSnapshot['phase'] = 'aiming';
  private turnOrderIdx = -1;
  public activeUnitId = '';
  public turnTimeLeft = 25;
  public turnNumber = 1;

  // Trạng thái thao tác lượt hiện tại
  public chargePower = 0;
  private chargeDir: 1 | -1 = 1;
  public chargePower2 = 0;
  private chargeDir2: 1 | -1 = 1;
  private charge2WaitRelease = false;
  public powArmed = false;
  public activeItemArmed: BattleItemId | null = null;
  public doubleArmed = false;
  public hawkeyeGiantArmed = false;
  public itemsUsedThisTurn = 0;
  private usedInstantItemCount = 0;

  // Điều khiển bàn phím & nút cảm ứng
  public keys = {
    left: false,
    right: false,
    up: false,
    down: false,
    flyUp: false,
    flyDown: false,
    angleUp: false,
    angleDown: false,
    space: false,
  };

  // Trạng thái AI trong lượt của Bot
  private botPlan: BotDecision | null = null;
  private botThinkTicks = 0;

  // Camera
  private camX = 400;
  private camY = 300;
  private camZoom = 1.08;
  private manualCamTimer = 0;
  private isDraggingCam = false;
  private dragLastX = 0;
  private dragLastY = 0;
  private shakeIntensity = 0;

  // Thống kê trận đấu
  private totalDamageDealt = 0;
  private enemiesDefeated = 0;
  private settleTicks = 0;
  private endBannerTimer = 0;
  private matchResult: MatchStats | null = null;

  private rafId = 0;
  private lastFrameTime = 0;
  private accumulator = 0;
  private globalTick = 0;
  private destroyed = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly assets: AssetManager,
    public readonly map: MapDef,
    public readonly setup: BattleSetup,
    private readonly onHudUpdate: (hud: HudSnapshot) => void,
    private readonly onMatchEnd: (stats: MatchStats) => void,
    private readonly onOnlineAction?: (action: OnlineBattleAction) => void
  ) {
    this.terrain = new Terrain(map, assets);
    this.charRenderer = new CharacterRenderer(assets);
    this.bgLayers = assets.pickBackgroundLayers(map.bgType, map.mapId);
    this.windMax =
      setup.stage?.windMax ??
      (setup.difficulty === 'easy' ? 14 : setup.difficulty === 'normal' ? 20 : 25);

    this.spawnFighters();
    this.initWindParticles();
    this.bindCanvasCameraEvents();

    this.camX = this.map.width / 2;
    this.camY = this.map.height * 0.48;
    this.fitDefaultZoom();

    this.advanceTurn(true);
  }

  private fitDefaultZoom(): void {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const fitW = vw / Math.max(540, this.map.width * 0.88);
    const fitH = vh / Math.max(420, this.map.height * 0.92);
    const minZoom = vw < 680 ? 0.62 : 0.82;
    this.camZoom = Math.max(minZoom, Math.min(1.45, Math.min(fitW, fitH)));
  }

  private defaultInventory(isBoss = false): Record<BattleItemId, number> {
    const inv: Record<BattleItemId, number> = {
      heal: 0,
      teleport: 0,
      double: 0,
      mouse: 0,
      shield: 0,
      windstop: 0,
      digger: 0,
      web: 0,
      freeze: 0,
      poison: 0,
      nuke: 0,
      stealth: 0,
    };
    if (isBoss) {
      inv.heal = 1;
      inv.double = 2;
      inv.shield = 1;
      inv.freeze = 1;
      inv.nuke = 1;
      return inv;
    }
    const selected =
      this.setup.selectedItems && this.setup.selectedItems.length > 0
        ? this.setup.selectedItems.slice(0, 6)
        : (['heal', 'teleport', 'double', 'mouse', 'shield', 'freeze'] as BattleItemId[]);
    selected.forEach((id) => {
      inv[id] = id === 'teleport' || id === 'mouse' || id === 'nuke' ? 1 : 2;
    });
    return inv;
  }

  private spawnFighters(): void {
    if (this.setup.mode === 'online') {
      const isHost = this.setup.onlineRole !== 'guest';
      const hostHeroId = isHost ? this.setup.playerHeroId : (this.setup.remoteHeroId || 'gunner');
      const guestHeroId = isHost ? (this.setup.remoteHeroId || 'rocketer') : this.setup.playerHeroId;

      const hostHero = getHeroById(hostHeroId);
      const guestHero = getHeroById(guestHeroId);

      const p1Pos = this.terrain.findSpawnPoint(this.map.width * 0.18);
      const p2Pos = this.terrain.findSpawnPoint(this.map.width * 0.82);

      this.fighters.push({
        id: 'online_host',
        name: isHost ? `Bạn (${hostHero.name})` : `Đối Thủ (${hostHero.name})`,
        team: 0,
        isPlayerControlled: isHost,
        isRemoteOnline: !isHost,
        botDifficulty: 'normal',
        unitKind: 'hero',
        isBoss: false,
        hero: hostHero,
        x: p1Pos.x,
        y: p1Pos.y,
        vx: 0,
        vy: 0,
        facingLeft: false,
        aimAngleDeg: Math.max(28, hostHero.minAngle),
        hp: hostHero.hp,
        maxHp: hostHero.hp,
        attack: hostHero.attack,
        pow: 20,
        stamina: hostHero.staminaMax,
        maxStamina: hostHero.staminaMax,
        alive: true,
        grounded: true,
        shieldTurns: 0,
        webbedTurns: 0,
        lastPower: 0,
        lastAngle: 35,
        scale: 1,
        animMode: 'idle',
        animTick: 0,
        hurtTimer: 0,
        inventory: this.defaultInventory(false),
      });

      this.fighters.push({
        id: 'online_guest',
        name: !isHost ? `Bạn (${guestHero.name})` : `Đối Thủ (${guestHero.name})`,
        team: 1,
        isPlayerControlled: !isHost,
        isRemoteOnline: isHost,
        botDifficulty: 'normal',
        unitKind: 'hero',
        isBoss: false,
        hero: guestHero,
        x: p2Pos.x,
        y: p2Pos.y,
        vx: 0,
        vy: 0,
        facingLeft: true,
        aimAngleDeg: Math.max(28, guestHero.minAngle),
        hp: guestHero.hp,
        maxHp: guestHero.hp,
        attack: guestHero.attack,
        pow: 20,
        stamina: guestHero.staminaMax,
        maxStamina: guestHero.staminaMax,
        alive: true,
        grounded: true,
        shieldTurns: 0,
        webbedTurns: 0,
        lastPower: 0,
        lastAngle: 35,
        scale: 1,
        animMode: 'idle',
        animTick: 10,
        hurtTimer: 0,
        inventory: this.defaultInventory(false),
      });
    } else {
    const playerHero = getHeroById(this.setup.playerHeroId);
    const p1Pos = this.terrain.findSpawnPoint(this.map.width * 0.18);

    this.fighters.push({
      id: 'player_1',
      name: `Bạn (${playerHero.name})`,
      team: 0,
      isPlayerControlled: true,
      botDifficulty: 'normal',
      unitKind: 'hero',
      isBoss: false,
      hero: playerHero,
      x: p1Pos.x,
      y: p1Pos.y,
      vx: 0,
      vy: 0,
      facingLeft: false,
      aimAngleDeg: Math.max(25, playerHero.minAngle),
      hp: playerHero.hp,
      maxHp: playerHero.hp,
      attack: playerHero.attack,
      pow: 20,
      stamina: playerHero.staminaMax,
      maxStamina: playerHero.staminaMax,
      alive: true,
      grounded: true,
      shieldTurns: 0,
      webbedTurns: 0,
      lastPower: 0,
      lastAngle: 35,
      scale: 1,
      animMode: 'idle',
      animTick: 0,
      hurtTimer: 0,
      inventory: this.defaultInventory(false),
    });

    // Đồng đội (Đấu Bot 2v2 hoặc Ải có đồng đội AI/Người chơi điều khiển)
    const allyHeroId =
      this.setup.mode === 'campaign'
        ? this.setup.stage?.allyHeroId
        : this.setup.teamSize === 2
        ? this.setup.allyHeroId || 'rocketer'
        : null;

    if (allyHeroId) {
      const allyHero = getHeroById(allyHeroId);
      const p2Pos = this.terrain.findSpawnPoint(this.map.width * 0.3);
      this.fighters.push({
        id: 'ally_2',
        name: `Đồng Đội (${allyHero.name})`,
        team: 0,
        isPlayerControlled: this.setup.mode === 'skirmish',
        botDifficulty: 'normal',
        unitKind: 'hero',
        isBoss: false,
        hero: allyHero,
        x: p2Pos.x,
        y: p2Pos.y,
        vx: 0,
        vy: 0,
        facingLeft: false,
        aimAngleDeg: Math.max(30, allyHero.minAngle),
        hp: allyHero.hp,
        maxHp: allyHero.hp,
        attack: allyHero.attack,
        pow: 15,
        stamina: allyHero.staminaMax,
        maxStamina: allyHero.staminaMax,
        alive: true,
        grounded: true,
        shieldTurns: 0,
        webbedTurns: 0,
        lastPower: 0,
        lastAngle: 35,
        scale: 1,
        animMode: 'idle',
        animTick: 12,
        hurtTimer: 0,
        inventory: this.defaultInventory(false),
      });
    }

    if (this.setup.mode === 'campaign' && this.setup.stage) {
      this.setup.stage.enemies.forEach((spec, idx) => {
        const eh = getHeroById(spec.heroId);
        const isFlying = spec.unitKind !== 'hero';
        const groundSpawn = this.terrain.findSpawnPoint(this.map.width * spec.spawnXRatio);
        const sx = isFlying ? Math.round(this.map.width * spec.spawnXRatio) : groundSpawn.x;
        const sy = isFlying ? (spec.spawnY ?? 150) : groundSpawn.y;

        this.fighters.push({
          id: `enemy_${idx + 1}`,
          name: spec.name,
          team: 1,
          isPlayerControlled: false,
          botDifficulty: spec.difficulty,
          unitKind: spec.unitKind,
          isBoss: Boolean(spec.isBoss),
          hero: eh,
          x: sx,
          y: sy,
          vx: 0,
          vy: 0,
          facingLeft: true,
          aimAngleDeg: isFlying ? -25 : Math.max(35, eh.minAngle),
          hp: spec.hp,
          maxHp: spec.hp,
          attack: spec.attack,
          pow: spec.isBoss ? 50 : 15,
          stamina: eh.staminaMax,
          maxStamina: eh.staminaMax,
          alive: true,
          grounded: isFlying,
          shieldTurns: 0,
          webbedTurns: 0,
          lastPower: 0,
          lastAngle: 40,
          scale: spec.scale ?? 1,
          animMode: 'idle',
          animTick: idx * 9,
          hurtTimer: 0,
          inventory: this.defaultInventory(spec.isBoss),
        });
      });
    } else {
      // Đấu Bot tự do (1v1 hoặc 2v2) — bao gồm cả tướng Army và Marvel!
      const count = this.setup.teamSize;
      const pool = [
        'rocketer',
        'aka',
        'granos',
        'electrician',
        'chicky',
        'apache',
        'kingkong',
        'tazang',
        'gunner',
        'captain',
        'thor',
        'ironman',
        'hulk',
        'hawkeye',
        'wintersoldier',
        'ultron',
        'loki',
      ].filter((id) => id !== this.setup.playerHeroId);
      for (let i = 0; i < count; i++) {
        const pickId = pool[(Math.floor(Math.random() * pool.length) + i) % pool.length];
        const eh = getHeroById(pickId);
        const ratio = count === 1 ? 0.8 : i === 0 ? 0.72 : 0.86;
        const pos = this.terrain.findSpawnPoint(this.map.width * ratio);
        const hpMul =
          this.setup.difficulty === 'easy' ? 0.88 : this.setup.difficulty === 'hard' ? 1.12 : 1;

        this.fighters.push({
          id: `bot_${i + 1}`,
          name: `Bot ${eh.name}`,
          team: 1,
          isPlayerControlled: false,
          botDifficulty: this.setup.difficulty,
          unitKind: 'hero',
          isBoss: false,
          hero: eh,
          x: pos.x,
          y: pos.y,
          vx: 0,
          vy: 0,
          facingLeft: true,
          aimAngleDeg: Math.max(38, eh.minAngle),
          hp: Math.round(eh.hp * hpMul),
          maxHp: Math.round(eh.hp * hpMul),
          attack: eh.attack,
          pow: 15,
          stamina: eh.staminaMax,
          maxStamina: eh.staminaMax,
          alive: true,
          grounded: true,
          shieldTurns: 0,
          webbedTurns: 0,
          lastPower: 0,
          lastAngle: 40,
          scale: 1,
          animMode: 'idle',
          animTick: i * 11,
          hurtTimer: 0,
          inventory: this.defaultInventory(false),
        });
      }
    }
    }

    for (const f of this.fighters) {
      f.baseHeroId = f.hero.id;
      if (f.hero.id === 'ultron') {
        f.ultronTurnCount = 0;
        f.ultronClones = [];
      }
    }
  }

  private initWindParticles(): void {
    for (let i = 0; i < 26; i++) {
      this.windParticles.push({
        x: Math.random() * this.map.width,
        y: Math.random() * this.map.height,
        size: 1.5 + Math.random() * 2.2,
        alpha: 0.25 + Math.random() * 0.45,
      });
    }
  }

  private bindCanvasCameraEvents(): void {
    let pinchStartDist = 0;
    let pinchStartZoom = 1;

    this.canvas.addEventListener('pointerdown', (e) => {
      this.isDraggingCam = true;
      this.dragLastX = e.clientX;
      this.dragLastY = e.clientY;
    });
    window.addEventListener('pointermove', (e) => {
      if (!this.isDraggingCam) return;
      const dx = e.clientX - this.dragLastX;
      const dy = e.clientY - this.dragLastY;
      if (Math.hypot(dx, dy) > 2) {
        this.camX -= dx / this.camZoom;
        this.camY -= dy / this.camZoom;
        this.clampCamera();
        this.manualCamTimer = 180;
      }
      this.dragLastX = e.clientX;
      this.dragLastY = e.clientY;
    });
    window.addEventListener('pointerup', () => {
      this.isDraggingCam = false;
    });

    // Hỗ trợ 2 ngón tay Pinch-to-Zoom trên điện thoại (Mobile Touch)
    this.canvas.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length === 2) {
          this.isDraggingCam = false;
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          pinchStartDist = Math.hypot(dx, dy);
          pinchStartZoom = this.camZoom;
        }
      },
      { passive: true }
    );
    this.canvas.addEventListener(
      'touchmove',
      (e) => {
        if (e.touches.length === 2 && pinchStartDist > 10) {
          e.preventDefault();
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const dist = Math.hypot(dx, dy);
          const ratio = dist / pinchStartDist;
          this.camZoom = Math.max(0.55, Math.min(1.85, pinchStartZoom * ratio));
          this.clampCamera();
          this.manualCamTimer = 180;
        }
      },
      { passive: false }
    );
    this.canvas.addEventListener('touchend', () => {
      pinchStartDist = 0;
    });

    this.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.08 : 0.92;
        this.camZoom = Math.max(0.55, Math.min(1.85, this.camZoom * factor));
        this.clampCamera();
      },
      { passive: false }
    );

    window.addEventListener('resize', () => {
      this.fitDefaultZoom();
    });
  }

  public centerCameraOnActive(): void {
    const u = this.getActiveUnit();
    if (!u) return;
    this.manualCamTimer = 0;
    this.camX = u.x;
    this.camY = u.y - 30;
    this.clampCamera();
  }

  private clampCamera(): void {
    const padX = 140;
    const padY = 120;
    this.camX = Math.max(-padX, Math.min(this.map.width + padX, this.camX));
    this.camY = Math.max(-padY, Math.min(this.map.height + padY, this.camY));
  }

  public start(): void {
    this.lastFrameTime = performance.now();
    const loop = (now: number) => {
      if (this.destroyed) return;
      const dt = Math.min(0.05, (now - this.lastFrameTime) / 1000);
      this.lastFrameTime = now;
      this.accumulator += dt;

      const fixedStep = 1 / 60;
      while (this.accumulator >= fixedStep) {
        this.fixedUpdate();
        this.accumulator -= fixedStep;
      }

      this.render();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  public destroy(): void {
    this.destroyed = true;
    sound.stopCharge();
    cancelAnimationFrame(this.rafId);
  }

  public getActiveUnit(): Fighter | null {
    return this.fighters.find((f) => f.id === this.activeUnitId && f.alive) ?? null;
  }

  // ==================== ONLINE 1v1 SYNCHRONIZATION ====================

  public applyOnlineAction(action: OnlineBattleAction): void {
    const u = this.fighters.find((f) => f.id === action.unitId && f.alive);
    if (!u) return;

    switch (action.action) {
      case 'sync_pos': {
        u.x = action.x;
        u.y = action.y;
        u.facingLeft = action.facingLeft;
        u.aimAngleDeg = action.aimAngle;
        u.stamina = action.stamina;
        break;
      }
      case 'use_item': {
        this.applyUnitItem(u, action.itemId);
        this.emitHud();
        break;
      }
      case 'toggle_pow': {
        this.powArmed = action.active;
        if (this.powArmed) {
          this.activeItemArmed = null;
          sound.playPow();
          this.spawnFloatingText(u.x, u.y - 46, 'NỘ POW!', '#facc15', 1.25);
        }
        this.emitHud();
        break;
      }
      case 'skip_turn': {
        this.pendingNextWind = action.nextWind;
        sound.stopCharge();
        u.pow = Math.min(100, u.pow + 20);
        this.spawnFloatingText(u.x, u.y - 38, 'ĐỐI THỦ BỎ LƯỢT', '#94a3b8', 1.0);
        this.phase = 'settling';
        this.settleTicks = 28;
        this.emitHud();
        break;
      }
      case 'fire': {
        u.x = action.x;
        u.y = action.y;
        u.facingLeft = action.facingLeft;
        u.aimAngleDeg = action.aimAngle;
        this.activeItemArmed = action.activeShotMod;
        this.powArmed = action.powQueued;
        this.pendingNextWind = action.nextWind;
        this.executeFire(u, action.power, true);
        break;
      }
      case 'loki_morph': {
        const f = this.fighters.find((unit) => unit.id === action.unitId);
        if (f) {
          const picked = getHeroById(action.morphHeroId);
          f.hero = picked;
          f.aimAngleDeg = Math.max(picked.minAngle, Math.min(picked.maxAngle, f.aimAngleDeg));
          if (this.assets.manifest.effects.loki) {
            this.spawnEffect(f.x, f.y - 18, this.assets.manifest.effects.loki, 1.15);
          }
          sound.playPow();
          this.spawnFloatingText(
            f.x,
            f.y - 54,
            `LOKI BIẾN HÌNH: ${picked.name.toUpperCase()}!`,
            '#10b981',
            1.25
          );
          this.emitHud();
        }
        break;
      }
    }
  }

  // ==================== ITEM & SKILL ACTIONS ====================

  public togglePow(): void {
    const u = this.getActiveUnit();
    if (!u || !u.isPlayerControlled || this.phase !== 'aiming') return;
    if (u.pow < 100) return;
    this.powArmed = !this.powArmed;
    if (this.powArmed) {
      this.activeItemArmed = null;
      sound.playPow();
      this.spawnFloatingText(u.x, u.y - 46, 'NỘ POW!', '#facc15', 1.25);
    } else {
      sound.playClick();
    }
    this.onOnlineAction?.({
      action: 'toggle_pow',
      unitId: u.id,
      active: this.powArmed,
    });
    this.emitHud();
  }

  public useItem(itemId: BattleItemId): void {
    const u = this.getActiveUnit();
    if (!u || !u.isPlayerControlled || this.phase !== 'aiming') return;
    if (this.applyUnitItem(u, itemId)) {
      this.onOnlineAction?.({
        action: 'use_item',
        unitId: u.id,
        itemId,
      });
    }
    this.emitHud();
  }

  private applyUnitItem(u: Fighter, itemId: BattleItemId): boolean {
    if ((u.inventory[itemId] ?? 0) <= 0) return false;

    // Không được dùng item khi đang nộ POW
    if (this.powArmed) {
      this.spawnFloatingText(u.x, u.y - 36, 'Đang Nộ POW không thể dùng item!', '#f87171', 1.1);
      return false;
    }

    // Mỗi lượt người chơi chỉ có thể sử dụng tối đa 1 item
    if (this.itemsUsedThisTurn >= 1) {
      this.spawnFloatingText(u.x, u.y - 36, 'Mỗi lượt chỉ dùng 1 vật phẩm!', '#f87171', 1.1);
      return false;
    }

    // Kỹ năng đặc biệt của Hawkeye: Khi dùng bất kỳ Item nào -> nạp Mũi Tên Kỹ Năng với sát thương cố định 300!
    if (u.hero.weapon === 'hawkeye_bow') {
      if (this.hawkeyeGiantArmed) return false;
      u.inventory[itemId]--;
      this.itemsUsedThisTurn++;
      this.hawkeyeGiantArmed = true;
      this.activeItemArmed = null;
      sound.playPow();
      this.spawnFloatingText(
        u.x,
        u.y - 46,
        'ƯNG NHÃN: NẠP KỸ NĂNG VẬT PHẨM (300 DMG)!',
        '#c084fc',
        1.22
      );
      return true;
    }

    if (itemId === 'heal') {
      if (this.usedInstantItemCount >= 1) return false;
      u.inventory.heal--;
      this.itemsUsedThisTurn++;
      this.usedInstantItemCount++;
      const healAmt = Math.min(u.maxHp - u.hp, 350);
      u.hp += healAmt;
      sound.playItemUse();
      this.spawnFloatingText(
        u.x,
        u.y - 42,
        `+${healAmt > 0 ? healAmt : 350} HP`,
        '#4ade80',
        1.15
      );
      return true;
    }

    if (itemId === 'shield') {
      if (u.shieldTurns > 0) return false;
      u.inventory.shield--;
      this.itemsUsedThisTurn++;
      u.shieldTurns = 2;
      sound.playItemUse();
      this.spawnFloatingText(u.x, u.y - 42, 'KHIÊN BẢO VỆ (2 LƯỢT)!', '#38bdf8', 1.15);
      return true;
    }

    if (itemId === 'windstop') {
      u.inventory.windstop--;
      this.itemsUsedThisTurn++;
      this.wind = 0;
      sound.playItemUse();
      this.spawnFloatingText(u.x, u.y - 42, 'NGƯNG GIÓ (GIÓ = 0)!', '#38bdf8', 1.2);
      return true;
    }

    if (itemId === 'stealth') {
      if (u.stealthTurns && u.stealthTurns > 0) return false;
      u.inventory.stealth--;
      this.itemsUsedThisTurn++;
      u.stealthTurns = 2;
      sound.playItemUse();
      if (this.assets.manifest.effects.stealth) {
        this.spawnEffect(u.x, u.y - 18, this.assets.manifest.effects.stealth, 1.15);
      }
      this.spawnFloatingText(u.x, u.y - 42, 'TÀNG HÌNH (2 LƯỢT)!', '#c084fc', 1.2);
      return true;
    }

    if (itemId === 'double') {
      if (this.doubleArmed) return false;
      u.inventory.double--;
      this.itemsUsedThisTurn++;
      this.doubleArmed = true;
      sound.playItemUse();
      this.spawnFloatingText(u.x, u.y - 42, 'ĐẠN ĐÔI x2!', '#fb923c', 1.15);
      return true;
    }

    if (
      itemId === 'teleport' ||
      itemId === 'digger' ||
      itemId === 'mouse' ||
      itemId === 'web' ||
      itemId === 'freeze' ||
      itemId === 'poison' ||
      itemId === 'nuke'
    ) {
      if (this.activeItemArmed === itemId) {
        this.activeItemArmed = null;
        sound.playClick();
      } else {
        this.activeItemArmed = itemId;
        this.powArmed = false;
        sound.playItemUse();
        const labelMap: Record<string, string> = {
          teleport: 'NGỌC DỊCH CHUYỂN',
          digger: 'BOM PHÁ ĐẤT',
          mouse: 'CHUỘT GẮN BOM',
          web: 'ĐẠN TƠ NHỆN',
          freeze: 'ĐẠN ĐÓNG BĂNG',
          poison: 'KHÓI ĐỘC AXIT',
          nuke: 'BOM NGUYÊN TỬ',
        };
        this.spawnFloatingText(u.x, u.y - 42, labelMap[itemId] || itemId, '#c084fc', 1.1);
      }
      return true;
    }

    return false;
  }

  public skipTurn(): void {
    const u = this.getActiveUnit();
    if (!u || !u.isPlayerControlled || (this.phase !== 'aiming' && this.phase !== 'charging'))
      return;
    sound.stopCharge();
    sound.playClick();
    u.pow = Math.min(100, u.pow + 20);
    this.spawnFloatingText(u.x, u.y - 38, 'BỎ LƯỢT (+20 NỘ)', '#94a3b8', 1.0);

    const nextWind = this.rollNextWind();
    this.pendingNextWind = nextWind;
    this.onOnlineAction?.({
      action: 'skip_turn',
      unitId: u.id,
      nextWind,
    });

    this.phase = 'settling';
    this.settleTicks = 28;
    this.emitHud();
  }

  private rollNextWind(): number {
    const delta = Math.round((Math.random() * 2 - 1) * 9);
    return Math.max(-this.windMax, Math.min(this.windMax, this.wind + delta));
  }

  // ==================== TURN MANAGEMENT ====================

  private checkMatchFinished(): MatchStats | null {
    const aliveTeam0 = this.fighters.some((f) => f.alive && f.team === 0);
    const aliveTeam1 = this.fighters.some((f) => f.alive && f.team === 1);
    if (aliveTeam0 && aliveTeam1) return null;

    const myTeam =
      this.setup.mode === 'online' && this.setup.onlineRole === 'guest' ? 1 : 0;
    const aliveMyTeam = myTeam === 0 ? aliveTeam0 : aliveTeam1;
    const aliveEnemyTeam = myTeam === 0 ? aliveTeam1 : aliveTeam0;

    const won = aliveMyTeam && !aliveEnemyTeam;
    const draw = !aliveTeam0 && !aliveTeam1;
    return {
      won,
      draw,
      turnsTaken: this.turnNumber,
      damageDealt: Math.round(this.totalDamageDealt),
      enemiesDefeated: this.enemiesDefeated,
      mode: this.setup.mode,
      stageId: this.setup.stage?.id,
    };
  }

  private advanceTurn(initial = false): void {
    sound.stopCharge();
    const ended = this.checkMatchFinished();
    if (ended) {
      this.enterEndedState(ended);
      return;
    }

    const n = this.fighters.length;
    for (let step = 1; step <= n; step++) {
      const idx = (this.turnOrderIdx + step) % n;
      if (this.fighters[idx].alive) {
        this.turnOrderIdx = idx;
        break;
      }
    }

    const active = this.fighters[this.turnOrderIdx];
    this.activeUnitId = active.id;
    if (!initial) this.turnNumber++;

    // 1. Kỹ năng của LOKI: Biến hình thành 1 nhân vật ngẫu nhiên mỗi lượt 1 lần và sử dụng kỹ năng của chúng!
    if (active.baseHeroId === 'loki') {
      const morphPool = HEROES.filter((h) => h.id !== 'loki');
      const seedVal = Math.abs(this.setup.seed ?? 12345);
      const pickIdx =
        this.setup.mode === 'online'
          ? (seedVal * 101 + this.turnNumber * 37) % morphPool.length
          : Math.floor(Math.random() * morphPool.length);
      const picked = morphPool[pickIdx];
      active.hero = picked;
      active.aimAngleDeg = Math.max(
        picked.minAngle,
        Math.min(picked.maxAngle, active.aimAngleDeg)
      );
      if (this.assets.manifest.effects.loki) {
        this.spawnEffect(active.x, active.y - 18, this.assets.manifest.effects.loki, 1.15);
      }
      this.spawnFloatingText(
        active.x,
        active.y - 54,
        `LOKI BIẾN HÌNH: ${picked.name.toUpperCase()}!`,
        '#10b981',
        1.22
      );
      if (this.setup.mode === 'online' && active.isPlayerControlled) {
        this.onOnlineAction?.({
          action: 'loki_morph',
          unitId: active.id,
          morphHeroId: picked.id,
        });
      }
    }

    // 2. Kỹ năng của ULTRON: Cứ mỗi 3 lượt của Ultron sẽ gọi ra 1 Ultron Nhân Bản tự động bắn khi Ultron tấn công!
    if (active.hero.id === 'ultron') {
      active.ultronTurnCount = (active.ultronTurnCount ?? 0) + 1;
      if (!active.ultronClones) active.ultronClones = [];
      if (active.ultronTurnCount % 3 === 1 && active.ultronClones.length < 3) {
        const cloneIdx = active.ultronClones.length;
        const offsets = [
          { offsetX: -34, offsetY: -36 },
          { offsetX: 34, offsetY: -36 },
          { offsetX: 0, offsetY: -56 },
        ];
        active.ultronClones.push({
          id: cloneIdx + 1,
          offsetX: offsets[cloneIdx].offsetX,
          offsetY: offsets[cloneIdx].offsetY,
        });
        this.spawnEffect(
          active.x + offsets[cloneIdx].offsetX,
          active.y + offsets[cloneIdx].offsetY,
          this.assets.manifest.effects.teleport,
          0.95
        );
        this.spawnFloatingText(
          active.x,
          active.y - 52,
          `TRIỆU HỒI ULTRON NHÂN BẢN #${cloneIdx + 1}!`,
          '#f43f5e',
          1.18
        );
      }
    }

    if (active.shieldTurns > 0) active.shieldTurns--;
    if (active.stealthTurns && active.stealthTurns > 0) active.stealthTurns--;
    if (active.poisonTurns && active.poisonTurns > 0) {
      active.poisonTurns--;
      const poisonDmg = 75;
      active.hp = Math.max(1, active.hp - poisonDmg);
      this.spawnFloatingText(active.x, active.y - 38, `-${poisonDmg} HP (ĐỘC)`, '#84cc16', 1.15);
      if (this.assets.manifest.effects.poison) {
        this.spawnEffect(active.x, active.y - 18, this.assets.manifest.effects.poison, 1.0);
      }
    }
    if (active.frozenTurns && active.frozenTurns > 0) {
      active.frozenTurns--;
      this.spawnFloatingText(active.x, active.y - 48, 'BỊ ĐÓNG BĂNG! MẤT LƯỢT', '#38bdf8', 1.25);
      sound.playPow();
      this.phase = 'settling';
      this.settleTicks = 35;
      this.emitHud();
      return;
    }
    if (active.webbedTurns > 0) {
      active.webbedTurns--;
      active.stamina = 0;
      this.spawnFloatingText(active.x, active.y - 46, 'BỊ TRÓI TƠ NHỆN!', '#e2e8f0', 1.15);
    } else {
      active.stamina = active.maxStamina;
    }
    active.pow = Math.min(100, active.pow + 10);

    // Gió đổi nhẹ sau mỗi lượt giống Mobi Army 3
    if (initial) {
      if (this.setup.seed !== undefined) {
        this.wind = this.setup.seed;
      } else {
        this.wind = Math.round((Math.random() * 2 - 1) * (this.windMax * 0.55));
      }
    } else if (this.pendingNextWind !== null) {
      this.wind = this.pendingNextWind;
      this.pendingNextWind = null;
    } else {
      this.wind = this.rollNextWind();
    }

    // Thả hòm tiếp tế ngẫu nhiên mỗi 3 lượt (ở chế độ Offline)
    if (
      !initial &&
      this.setup.mode !== 'online' &&
      this.turnNumber % 3 === 0 &&
      this.crates.filter((c) => !c.collected).length < 2
    ) {
      this.crates.push({
        x: 90 + Math.random() * (this.map.width - 180),
        y: -20,
        vy: 1.35,
        landed: false,
        collected: false,
        kind: Math.random() < 0.55 ? 'hp' : 'pow',
      });
    }

    this.phase = 'aiming';
    this.turnTimeLeft = 25;
    this.chargePower = 0;
    this.chargeDir = 1;
    this.chargePower2 = 0;
    this.chargeDir2 = 1;
    this.charge2WaitRelease = false;
    this.powArmed = false;
    this.activeItemArmed = null;
    this.doubleArmed = false;
    this.hawkeyeGiantArmed = false;
    this.itemsUsedThisTurn = 0;
    this.usedInstantItemCount = 0;
    this.manualCamTimer = 0;

    sound.playTurnStart(active.isPlayerControlled);

    if (!active.isPlayerControlled && !active.isRemoteOnline) {
      this.botThinkTicks = 42;
      this.botPlan = solveBotShot(
        {
          id: active.id,
          team: active.team,
          x: active.x,
          y: active.y,
          hp: active.hp,
          maxHp: active.maxHp,
          alive: active.alive,
          minAngle: active.hero.minAngle,
          maxAngle: active.hero.maxAngle,
          unitKind: active.unitKind,
          windScale: this.getHeroWindScale(active.hero),
        },
        this.fighters.map((f) => ({
          id: f.id,
          team: f.team,
          x: f.x,
          y: f.y,
          hp: f.hp,
          maxHp: f.maxHp,
          alive: f.alive,
          minAngle: f.hero.minAngle,
          maxAngle: f.hero.maxAngle,
          unitKind: f.unitKind,
          windScale: this.getHeroWindScale(f.hero),
        })),
        this.terrain,
        this.wind,
        active.botDifficulty,
        active.pow >= 100,
        active.inventory.heal > 0,
        active.inventory.double > 0
      );
    } else {
      this.botPlan = null;
    }

    this.emitHud();
  }

  private getHeroWindScale(hero: HeroDef): number {
    switch (hero.weapon) {
      case 'electric':
        return 0.45;
      case 'repulsor':
      case 'winter_sniper':
        return 0.25;
      case 'hawkeye_bow':
        return 0.35;
      default:
        return 1;
    }
  }

  private enterEndedState(stats: MatchStats): void {
    if (this.phase === 'ended') return;
    this.phase = 'ended';
    this.matchResult = stats;
    this.endBannerTimer = 95;
    sound.playEndBanner(stats.won);
    this.emitHud();
  }

  // ==================== FIXED 60FPS SIMULATION ====================

  private fixedUpdate(): void {
    this.globalTick++;

    if (this.shakeIntensity > 0.1) {
      this.shakeIntensity *= 0.88;
    } else {
      this.shakeIntensity = 0;
    }

    this.updateWindParticles();
    this.updateCrates();
    this.updateFighterPhysics();
    this.updateEffectsAndTexts();

    if (this.phase === 'ended') {
      if (this.endBannerTimer > 0) {
        this.endBannerTimer--;
        if (this.endBannerTimer === 0 && this.matchResult) {
          this.onMatchEnd(this.matchResult);
        }
      }
      return;
    }

    // Kiểm tra thắng/thua tức thì (ví dụ đối thủ rơi xuống nước chết ngay)
    if (this.phase === 'aiming' || this.phase === 'charging' || this.phase === 'charging_2') {
      const immediateEnd = this.checkMatchFinished();
      if (immediateEnd) {
        this.enterEndedState(immediateEnd);
        return;
      }
    }

    const active = this.getActiveUnit();
    if (!active && (this.phase === 'aiming' || this.phase === 'charging' || this.phase === 'charging_2')) {
      this.phase = 'settling';
      this.settleTicks = 25;
    }

    if (this.phase === 'aiming' || this.phase === 'charging' || this.phase === 'charging_2') {
      this.turnTimeLeft -= 1 / 60;
      if (this.turnTimeLeft <= 0) {
        this.turnTimeLeft = 0;
        sound.stopCharge();
        if (active && active.isPlayerControlled) {
          this.skipTurn();
        } else if (!active?.isRemoteOnline) {
          this.phase = 'settling';
          this.settleTicks = 25;
          this.emitHud();
        }
        return;
      }

      if (active) {
        if (active.isPlayerControlled) {
          this.updatePlayerInput(active);
        } else if (!active.isRemoteOnline) {
          this.updateBotTurn(active);
        }
      }

      if (this.globalTick % 4 === 0) {
        this.emitHud();
      }
    } else if (this.phase === 'firing') {
      this.updateQueuedShots();
      this.updateProjectiles();

      if (this.queuedShots.length === 0 && this.projectiles.length === 0) {
        this.phase = 'settling';
        this.settleTicks = 42;
      }
    } else if (this.phase === 'settling') {
      const anyFalling = this.fighters.some(
        (f) => f.alive && f.unitKind === 'hero' && !f.grounded
      );
      if (!anyFalling) {
        this.settleTicks--;
      }
      if (this.settleTicks <= 0) {
        this.advanceTurn(false);
      }
    }

    this.updateCameraFollow();
  }

  private updatePlayerInput(u: Fighter): void {
    if (this.phase === 'aiming') {
      let moved = false;
      let aimChanged = false;
      if (this.keys.left && !this.keys.right) {
        u.facingLeft = true;
        if (u.stamina > 0) {
          moved = this.tryWalkStep(u, -u.hero.moveSpeed);
        }
      } else if (this.keys.right && !this.keys.left) {
        u.facingLeft = false;
        if (u.stamina > 0) {
          moved = this.tryWalkStep(u, u.hero.moveSpeed);
        }
      }

      // Iron Man & Ultron: bay tự do 4 hướng (Trái/Phải/Lên/Xuống) lơ lửng trên map, giới hạn bởi thể lực!
      if (u.hero.canFly) {
        if (u.stamina > 0) {
          if (this.keys.flyUp || this.keys.up) {
            const nextY = Math.max(26, u.y - u.hero.moveSpeed * 1.05);
            if (!this.terrain.isSolid(u.x, nextY - 14)) {
              u.y = nextY;
              u.stamina = Math.max(0, u.stamina - 0.62);
              moved = true;
            }
          } else if (this.keys.flyDown || this.keys.down) {
            const nextY = Math.min(this.terrain.waterY - 14, u.y + u.hero.moveSpeed * 1.05);
            if (!this.terrain.isSolid(u.x, nextY)) {
              u.y = nextY;
              u.stamina = Math.max(0, u.stamina - 0.62);
              moved = true;
            }
          }
        }

        if (this.keys.angleUp || (u.stamina <= 0 && this.keys.up)) {
          u.aimAngleDeg = Math.min(u.hero.maxAngle, u.aimAngleDeg + 0.85);
          aimChanged = true;
        }
        if (this.keys.angleDown || (u.stamina <= 0 && this.keys.down)) {
          u.aimAngleDeg = Math.max(u.hero.minAngle, u.aimAngleDeg - 0.85);
          aimChanged = true;
        }
      } else {
        if (this.keys.up || this.keys.angleUp) {
          u.aimAngleDeg = Math.min(u.hero.maxAngle, u.aimAngleDeg + 0.85);
          aimChanged = true;
        }
        if (this.keys.down || this.keys.angleDown) {
          u.aimAngleDeg = Math.max(u.hero.minAngle, u.aimAngleDeg - 0.85);
          aimChanged = true;
        }
      }

      u.animMode = moved ? 'walk' : aimChanged ? 'aim' : 'idle';

      if ((moved || aimChanged) && this.globalTick % 4 === 0) {
        this.onOnlineAction?.({
          action: 'sync_pos',
          unitId: u.id,
          x: u.x,
          y: u.y,
          facingLeft: u.facingLeft,
          aimAngle: u.aimAngleDeg,
          stamina: u.stamina,
        });
      }

      if (this.keys.space) {
        this.phase = 'charging';
        this.chargePower = 2;
        this.chargeDir = 1;
        u.animMode = 'aim';
        this.emitHud();
      }
    } else if (this.phase === 'charging') {
      u.animMode = 'aim';
      if (this.keys.space) {
        this.chargePower += 1.35 * this.chargeDir;
        if (this.chargePower >= 100) {
          this.chargePower = 100;
          this.chargeDir = -1;
        } else if (this.chargePower <= 5) {
          this.chargePower = 5;
          this.chargeDir = 1;
        }
        sound.updateCharge(this.chargePower / 100);
      } else {
        // Riêng Chicky: Có 2 thanh lực! Thanh 1 = Lực bắn Gà, Thanh 2 = Khoảng thời gian Gà đẻ Trứng Vàng!
        if (u.hero.weapon === 'chicky' && !this.activeItemArmed) {
          this.phase = 'charging_2';
          this.chargePower2 = 0;
          this.chargeDir2 = 1;
          this.charge2WaitRelease = false;
          sound.playClick();
          this.spawnFloatingText(
            u.x,
            u.y - 48,
            'THANH 2: BẤM BẮN ĐỂ CHỐT GIỜ GÀ ĐẺ TRỨNG!',
            '#facc15',
            1.15
          );
          this.emitHud();
        } else {
          this.executeFire(u, this.chargePower, false);
        }
      }
    } else if (this.phase === 'charging_2') {
      u.animMode = 'aim';
      this.chargePower2 += 1.45 * this.chargeDir2;
      sound.updateCharge(this.chargePower2 / 100);
      if (this.keys.space) {
        this.charge2WaitRelease = true;
      }
      if (
        (this.charge2WaitRelease && !this.keys.space) ||
        this.chargePower2 >= 100
      ) {
        this.chargePower2 = Math.min(100, Math.max(5, this.chargePower2));
        this.executeFire(u, this.chargePower, false);
      }
    }
  }

  private updateBotTurn(u: Fighter): void {
    if (!this.botPlan) {
      this.executeFire(u, 55, false);
      return;
    }

    if (this.botThinkTicks > 0) {
      this.botThinkTicks--;
      return;
    }

    if (this.botPlan.useHeal) {
      this.botPlan.useHeal = false;
      this.applyUnitItem(u, 'heal');
      this.botThinkTicks = 18;
      return;
    }
    if (this.botPlan.useDouble) {
      this.botPlan.useDouble = false;
      this.applyUnitItem(u, 'double');
      this.botThinkTicks = 16;
      return;
    }
    if (this.botPlan.usePow && u.pow >= 100 && !this.powArmed) {
      this.powArmed = true;
      sound.playPow();
      this.spawnFloatingText(
        u.x,
        u.y - 48,
        u.isBoss ? 'TUYỆT KỸ BOSS!' : 'NỘ POW!',
        '#facc15',
        1.25
      );
      this.botThinkTicks = 18;
      return;
    }

    const dx = this.botPlan.moveTargetX - u.x;
    if (Math.abs(dx) > 3 && u.stamina > 8) {
      const dir = dx > 0 ? 1 : -1;
      u.facingLeft = dir < 0;
      if (u.unitKind !== 'hero') {
        u.x += dir * 1.8;
        if (this.botPlan.moveTargetY !== undefined) {
          u.y += Math.sign(this.botPlan.moveTargetY - u.y) * 1.1;
        }
        if (u.isBoss) {
          u.x = Math.max(50, Math.min(this.terrain.width - 50, u.x));
          u.y = Math.max(50, Math.min(this.terrain.waterY - 70, u.y));
        }
        u.stamina -= 1.2;
      } else {
        const ok = this.tryWalkStep(u, dir * u.hero.moveSpeed);
        u.animMode = ok ? 'walk' : 'idle';
        if (!ok) this.botPlan.moveTargetX = u.x;
      }
      return;
    }

    u.facingLeft = this.botPlan.facingLeft;
    const angleDiff = this.botPlan.aimAngleDeg - u.aimAngleDeg;
    if (Math.abs(angleDiff) > 1.1) {
      u.aimAngleDeg += Math.sign(angleDiff) * 1.2;
      u.animMode = 'aim';
      return;
    }
    u.aimAngleDeg = this.botPlan.aimAngleDeg;

    if (this.phase === 'aiming') {
      this.phase = 'charging';
      this.chargePower = 4;
    } else if (this.phase === 'charging') {
      this.chargePower += 1.65;
      sound.updateCharge(this.chargePower / 100);
      if (this.chargePower >= this.botPlan.power) {
        this.chargePower = this.botPlan.power;
        this.executeFire(u, this.chargePower, false);
      }
    }
  }

  private tryWalkStep(u: Fighter, stepX: number): boolean {
    const nextX = Math.max(18, Math.min(this.terrain.width - 18, u.x + stepX));
    // Iron Man & Ultron: bay tự do lơ lửng trên map, không cần điểm tựa địa hình bên dưới!
    if (u.hero.canFly) {
      if (!this.terrain.isSolid(nextX, u.y - 6) && !this.terrain.isSolid(nextX, u.y - 18)) {
        u.x = nextX;
        u.stamina = Math.max(0, u.stamina - Math.abs(stepX) * 0.65);
        return true;
      }
    }
    for (let climb = -9; climb <= 8; climb++) {
      const testY = u.y + climb;
      if (!this.terrain.isSolid(nextX, testY) && !this.terrain.isSolid(nextX, testY - 12)) {
        if (this.terrain.isSolid(nextX, testY + 1) || climb === 8) {
          u.x = nextX;
          u.y = testY;
          u.stamina = Math.max(0, u.stamina - Math.abs(stepX) * 0.72);
          return true;
        }
      }
    }
    return false;
  }

  private updateFighterPhysics(): void {
    for (const u of this.fighters) {
      if (!u.alive) continue;
      u.animTick++;

      if (u.hurtTimer > 0) {
        u.hurtTimer--;
        u.animMode = 'hurt';
        if (u.hurtTimer === 0) u.animMode = 'idle';
      }

      if (u.unitKind !== 'hero') {
        u.grounded = true;
        continue;
      }

      // Iron Man & Ultron bay tự do lơ lửng không bị rơi theo trọng lực; hoặc Hulk đang bật nhảy trên không
      const isLeapingHulk = this.projectiles.some(
        (p) => p.special === 'hulk_leap' && p.ownerId === u.id
      );
      if (u.hero.canFly || isLeapingHulk) {
        u.vy = 0;
        u.grounded = true;
        if (u.y >= this.terrain.waterY) {
          this.eliminateByWater(u);
        }
        continue;
      }

      if (!this.terrain.isSolid(u.x, u.y + 1)) {
        u.grounded = false;
        u.vy = Math.min(11, u.vy + 0.34);
        const steps = Math.max(1, Math.ceil(Math.abs(u.vy)));
        const stepVy = u.vy / steps;
        for (let s = 0; s < steps; s++) {
          if (this.terrain.isSolid(u.x, u.y + stepVy)) {
            u.y = Math.floor(u.y);
            u.vy = 0;
            u.grounded = true;
            break;
          }
          u.y += stepVy;
        }
      } else {
        u.vy = 0;
        u.grounded = true;
      }

      if (u.y >= this.terrain.waterY) {
        this.eliminateByWater(u);
      }
    }
  }

  private eliminateByWater(u: Fighter): void {
    if (!u.alive) return;
    u.alive = false;
    u.hp = 0;
    if (u.team === 1) this.enemiesDefeated++;
    sound.playSplash();
    this.spawnEffect(u.x, this.terrain.waterY - 12, this.assets.manifest.effects.splash, 1.15);
    this.spawnFloatingText(u.x, this.terrain.waterY - 26, 'RƠI XUỐNG NƯỚC!', '#38bdf8', 1.25);
  }

  private updateCrates(): void {
    for (const c of this.crates) {
      if (c.collected) continue;
      if (!c.landed) {
        c.y += c.vy;
        if (this.terrain.isSolid(c.x, c.y + 10)) {
          c.landed = true;
        } else if (c.y >= this.terrain.waterY) {
          c.collected = true;
          this.spawnEffect(c.x, this.terrain.waterY - 8, this.assets.manifest.effects.splash, 0.8);
          continue;
        }
      }

      for (const f of this.fighters) {
        if (!f.alive) continue;
        if (Math.hypot(f.x - c.x, f.y - 16 - c.y) < 26) {
          c.collected = true;
          sound.playItemUse();
          if (c.kind === 'hp') {
            const gain = Math.min(f.maxHp - f.hp, 260);
            f.hp += gain;
            this.spawnFloatingText(f.x, f.y - 42, 'HÒM CỨU THƯƠNG +260 HP', '#4ade80', 1.1);
          } else {
            f.pow = Math.min(100, f.pow + 55);
            this.spawnFloatingText(f.x, f.y - 42, 'HÒM NĂNG LƯỢNG +55 NỘ', '#facc15', 1.1);
          }
          break;
        }
      }
    }
  }

  // ==================== FIRING & WEAPON PATTERNS ====================

  private executeFire(u: Fighter, power: number, fromRemote = false): void {
    sound.stopCharge();
    u.lastPower = Math.round(power);
    u.lastAngle = Math.round(u.aimAngleDeg);
    u.animMode = 'shoot';
    this.phase = 'firing';
    this.manualCamTimer = 0;

    if (!fromRemote && u.isPlayerControlled && this.setup.mode === 'online') {
      const nextWind = this.rollNextWind();
      this.pendingNextWind = nextWind;
      this.onOnlineAction?.({
        action: 'fire',
        unitId: u.id,
        x: u.x,
        y: u.y,
        facingLeft: u.facingLeft,
        aimAngle: u.aimAngleDeg,
        power,
        activeShotMod: this.activeItemArmed,
        powQueued: this.powArmed,
        nextWind,
      });
    }

    const usePow = this.powArmed && u.pow >= 100;
    if (usePow) {
      u.pow = 0;
    }

    const salvoCount = this.doubleArmed && !this.activeItemArmed ? 2 : 1;

    // 1. Item bắn đặc biệt: Dịch Chuyển (stripIndex 1)
    if (this.activeItemArmed === 'teleport') {
      u.inventory.teleport = Math.max(0, u.inventory.teleport - 1);
      this.queueProjectile(0, () => {
        sound.playShoot(false);
        this.spawnBullet(u, u.aimAngleDeg, power, {
          spriteKey: 'special',
          effectKey: 'teleport',
          holeMask: 'smallhole.png',
          holeScale: 0.4,
          damage: 0,
          blastRadius: 10,
          special: 'teleport',
        });
      });
      this.emitHud();
      return;
    }

    // 2. Item Bom Phá Đất / Đạn Khoan Đất (stripIndex 9)
    if (this.activeItemArmed === 'digger') {
      u.inventory.digger = Math.max(0, u.inventory.digger - 1);
      this.queueProjectile(0, () => {
        sound.playShoot(true);
        this.spawnBullet(u, u.aimAngleDeg, power, {
          spriteKey: 'digger',
          effectKey: 'explosion',
          holeMask: 'h44x39.png',
          holeScale: 1.18,
          damage: u.attack * 0.68,
          blastRadius: 40,
          special: 'digger',
          diggerCharges: 3,
        });
      });
      this.emitHud();
      return;
    }

    // 3. Item Chuột Gắn Bom (stripIndex 5, chuotBull.png)
    if (this.activeItemArmed === 'mouse') {
      u.inventory.mouse = Math.max(0, u.inventory.mouse - 1);
      this.queueProjectile(0, () => {
        sound.playShoot(false);
        this.spawnBullet(u, u.aimAngleDeg, Math.min(65, power), {
          spriteKey: 'mouse',
          effectKey: 'bigExplosion',
          holeMask: 'h55x50.png',
          holeScale: 1.2,
          damage: u.attack * 1.25,
          blastRadius: 50,
          special: 'mouse',
        });
      });
      this.emitHud();
      return;
    }

    // 4. Item Đạn Tơ Nhện (stripIndex 10, web.png)
    if (this.activeItemArmed === 'web') {
      u.inventory.web = Math.max(0, u.inventory.web - 1);
      this.queueProjectile(0, () => {
        sound.playShoot(false);
        this.spawnBullet(u, u.aimAngleDeg, power, {
          spriteKey: 'web',
          effectKey: 'smoke',
          holeMask: 'h36x30.png',
          holeScale: 0.9,
          damage: u.attack * 0.75,
          blastRadius: 46,
          special: 'web',
        });
      });
      this.emitHud();
      return;
    }

    // 5. Item Đạn Đóng Băng (stripIndex 4, freeze.png)
    if (this.activeItemArmed === 'freeze') {
      u.inventory.freeze = Math.max(0, u.inventory.freeze - 1);
      this.queueProjectile(0, () => {
        sound.playShoot(false);
        this.spawnBullet(u, u.aimAngleDeg, power, {
          spriteKey: 'special',
          effectKey: 'freeze',
          holeMask: 'h36x30.png',
          holeScale: 0.9,
          damage: u.attack * 0.45,
          blastRadius: 42,
          special: 'freeze',
        });
      });
      this.emitHud();
      return;
    }

    // 6. Item Khói Độc Axit (stripIndex 3, axit.png)
    if (this.activeItemArmed === 'poison') {
      u.inventory.poison = Math.max(0, u.inventory.poison - 1);
      this.queueProjectile(0, () => {
        sound.playShoot(false);
        this.spawnBullet(u, u.aimAngleDeg, power, {
          spriteKey: 'acid',
          effectKey: 'poison',
          holeMask: 'h40x35.png',
          holeScale: 1.0,
          damage: u.attack * 0.55,
          blastRadius: 46,
          special: 'poison',
        });
      });
      this.emitHud();
      return;
    }

    // 7. Item Bom Nguyên Tử (stripIndex 13, thienthach.png/bomnguyentu.png)
    if (this.activeItemArmed === 'nuke') {
      u.inventory.nuke = Math.max(0, u.inventory.nuke - 1);
      this.queueProjectile(0, () => {
        sound.playShoot(true);
        this.spawnBullet(u, u.aimAngleDeg, power, {
          spriteKey: 'meteor',
          effectKey: 'nuke',
          holeMask: 'h55x50.png',
          holeScale: 1.45,
          damage: 380,
          blastRadius: 62,
          special: 'nuke',
        });
      });
      this.emitHud();
      return;
    }

    // Vũ khí đặc trưng của Boss & Oanh Tạc Cơ
    if (u.unitKind === 'ufo') {
      this.scheduleBossUfoPattern(u, power, usePow);
      this.emitHud();
      return;
    }
    if (u.unitKind === 'mech') {
      this.scheduleBossMechPattern(u, power, usePow);
      this.emitHud();
      return;
    }
    if (u.unitKind === 'bomber') {
      for (let i = 0; i < 2; i++) {
        this.queueProjectile(i * 12, () => {
          sound.playShoot(true);
          this.spawnBullet(u, u.aimAngleDeg + (i === 0 ? -2 : 2), power, {
            spriteKey: 'bomb',
            effectKey: 'bigExplosion',
            holeMask: 'h44x39.png',
            holeScale: 1.0,
            damage: u.attack * 0.62,
            blastRadius: 42,
          });
        });
      }
      this.emitHud();
      return;
    }

    // Vũ khí chuẩn của 8 Tướng Mobi Army 3 + 6 Siêu Anh Hùng Marvel
    for (let s = 0; s < salvoCount; s++) {
      const baseDelay = s * 22;
      this.scheduleHeroWeapon(u, power, usePow, baseDelay);
    }

    this.emitHud();
  }

  private scheduleHeroWeapon(
    u: Fighter,
    power: number,
    usePow: boolean,
    baseDelay: number
  ): void {
    switch (u.hero.weapon) {
      case 'cannon': {
        // Gunner chuẩn Mobi Army 3: 1 viên pháo cối uy lực lớn; POW = 3 viên pháo hạt nhân
        if (!usePow) {
          this.queueProjectile(baseDelay, () => {
            sound.playShoot(true);
            this.spawnBullet(u, u.aimAngleDeg, power, {
              spriteKey: 'cannon',
              effectKey: 'bigExplosion',
              holeMask: u.hero.holeMask,
              holeScale: 1.08,
              damage: u.attack * 1.02,
              blastRadius: 45,
            });
          });
        } else {
          [-3.2, 0, 3.2].forEach((da, i) => {
            this.queueProjectile(baseDelay + i * 8, () => {
              sound.playShoot(true);
              this.spawnBullet(u, u.aimAngleDeg + da, power, {
                spriteKey: 'special',
                effectKey: 'nuke',
                holeMask: 'h55x50.png',
                holeScale: 1.18,
                damage: u.attack * 0.68,
                blastRadius: 50,
              });
            });
          });
        }
        break;
      }

      case 'ak': {
        // Miss 6 (Aka): điểm xạ 3 viên liên thanh; POW = 6 viên liên thanh
        const count = usePow ? 6 : 3;
        const perShotDmg = usePow ? 0.35 : 0.41;
        for (let i = 0; i < count; i++) {
          this.queueProjectile(baseDelay + i * 5, () => {
            sound.playShoot(false);
            const spread = (i - (count - 1) / 2) * 0.65;
            this.spawnBullet(u, u.aimAngleDeg + spread, power, {
              spriteKey: 'ak',
              effectKey: 'explosion',
              holeMask: usePow ? u.hero.powHoleMask : u.hero.holeMask,
              holeScale: 0.95,
              damage: u.attack * perShotDmg,
              blastRadius: 32,
            });
          });
        }
        break;
      }

      case 'electric': {
        // Điện Quang chuẩn Mobi Army 3: chùm 3 cầu sét Plasma tách góc; POW = 5 tia sét giật sét trời
        const angles = usePow ? [-5, -2.5, 0, 2.5, 5] : [-2.4, 0, 2.4];
        const ratio = usePow ? 0.42 : 0.44;
        angles.forEach((da, i) => {
          this.queueProjectile(baseDelay + i * 5, () => {
            sound.playShoot(true);
            this.spawnBullet(u, u.aimAngleDeg + da, power, {
              spriteKey: 'lightning',
              effectKey: 'electric',
              holeMask: usePow ? u.hero.powHoleMask : u.hero.holeMask,
              holeScale: usePow ? 1.05 : 0.95,
              damage: u.attack * ratio,
              blastRadius: 40,
              windScale: 0.45,
              special: usePow ? 'sky_lightning' : 'electric',
            });
          });
        });
        break;
      }

      case 'banana_cluster': {
        // King Kong (Khỉ Đột): Bắn chùm 4 quả chuối xoáy (POW = 6 quả chuối đại)
        const angles = usePow ? [-6, -3.6, -1.2, 1.2, 3.6, 6] : [-4.5, -1.5, 1.5, 4.5];
        const ratio = usePow ? 0.36 : 0.34;
        angles.forEach((da, i) => {
          this.queueProjectile(baseDelay + i * 5, () => {
            sound.playShoot(true);
            this.spawnBullet(u, u.aimAngleDeg + da, power, {
              spriteKey: 'banana',
              effectKey: usePow ? 'bigExplosion' : 'explosion',
              holeMask: 'hrangcua.png',
              holeScale: usePow ? 1.05 : 0.92,
              damage: u.attack * ratio,
              blastRadius: 38,
              windScale: 0.85,
              scale: 1.2,
            });
          });
        });
        break;
      }

      case 'boomerang': {
        // Tazang: Ném 1 chiếc Bumerang xoáy và tự động ĐỔI HƯỚNG quay ngược lại khi đang bay!
        this.queueProjectile(baseDelay, () => {
          sound.playShoot(true);
          this.spawnBullet(u, u.aimAngleDeg, power, {
            spriteKey: 'boomerang',
            effectKey: usePow ? 'nuke' : 'bigExplosion',
            holeMask: 'hrangcua.png',
            holeScale: usePow ? 1.32 : 1.18,
            damage: u.attack * (usePow ? 1.52 : 1.12),
            blastRadius: usePow ? 52 : 46,
            windScale: 0.35,
            special: 'boomerang_curve',
            boomerangTurnDir: u.facingLeft ? 1 : -1,
            scale: usePow ? 1.35 : 1.12,
          });
        });
        break;
      }

      case 'rocket': {
        // Rocketer chuẩn Mobi Army 3: chùm 3 tên lửa 13Missile.png; POW = 5 tên lửa
        const angles = usePow ? [-6, -3, 0, 3, 6] : [-3.2, 0, 3.2];
        const ratio = usePow ? 0.42 : 0.44;
        angles.forEach((da, i) => {
          this.queueProjectile(baseDelay + i * 4, () => {
            sound.playShoot(false);
            this.spawnBullet(u, u.aimAngleDeg + da, power, {
              spriteKey: 'rocket',
              effectKey: usePow ? 'bigExplosion' : 'explosion',
              holeMask: usePow ? u.hero.powHoleMask : u.hero.holeMask,
              holeScale: 1.0,
              damage: u.attack * ratio,
              blastRadius: 36,
            });
          });
        });
        break;
      }

      case 'grenade': {
        // Granos: lựu đạn mẹ phát nổ văng ra 3 quả bom con (POW = 5 quả bom con)
        this.queueProjectile(baseDelay, () => {
          sound.playShoot(true);
          this.spawnBullet(u, u.aimAngleDeg, power, {
            spriteKey: 'bomb',
            effectKey: usePow ? 'nuke' : 'bigExplosion',
            holeMask: usePow ? 'h55x50.png' : u.hero.holeMask,
            holeScale: usePow ? 1.25 : 1.08,
            damage: u.attack * (usePow ? 0.95 : 0.72),
            blastRadius: 44,
            special: 'cluster',
            diggerCharges: usePow ? 5 : 3,
          });
        });
        break;
      }

      case 'chicky': {
        // Chicky: Đạn bắn ra là 1 con Gà (gatruilong.png), căn thời gian đẻ Trứng Vàng theo Thanh Lực 2!
        const shots = usePow ? [-2.5, 0, 2.5] : [0];
        const eggTick =
          u.isPlayerControlled && this.chargePower2 > 0
            ? Math.round(6 + (this.chargePower2 / 100) * 58)
            : 24;
        shots.forEach((da, i) => {
          this.queueProjectile(baseDelay + i * 8, () => {
            sound.playShoot(false);
            this.spawnBullet(u, u.aimAngleDeg + da, power, {
              spriteKey: 'gatruilong',
              effectKey: 'explosion',
              holeMask: u.hero.holeMask,
              holeScale: 0.95,
              damage: u.attack * (usePow ? 0.42 : 0.62),
              blastRadius: 36,
              special: 'chicky_egg',
              eggDropTick: eggTick + i * 4,
              scale: 1.15,
            });
          });
        });
        break;
      }

      case 'apache': {
        // Apache: Bắn 1 viên Kim Cương lên trời và phóng tia Laze tới đó, khúc xạ thành hình tam giác gây nổ ở điểm cuối!
        this.queueProjectile(baseDelay, () => {
          sound.playShoot(true);
          this.spawnBullet(u, Math.max(25, u.aimAngleDeg), power, {
            spriteKey: 'imgDiamond',
            effectKey: usePow ? 'nuke' : 'bigExplosion',
            holeMask: usePow ? 'h55x50.png' : 'h44x39.png',
            holeScale: usePow ? 1.32 : 1.15,
            damage: u.attack * (usePow ? 1.55 : 1.18),
            blastRadius: usePow ? 54 : 46,
            windScale: 0.35,
            special: 'apache_diamond',
            scale: 1.25,
          });
        });
        break;
      }

      // ================= VŨ KHÍ ĐẶC TRƯNG BIỆT ĐỘI MARVEL =================
      case 'vibranium_shield': {
        // Captain America: Ném Khiên va chạm địa hình bật nảy 1 lần nữa, hoàn thành hoặc trúng mục tiêu sẽ quay về với Cap!
        const shots = usePow ? [-2.5, 2.5] : [0];
        shots.forEach((da, i) => {
          this.queueProjectile(baseDelay + i * 10, () => {
            sound.playShoot(true);
            this.spawnBullet(u, u.aimAngleDeg + da, power, {
              spriteKey: 'shield',
              effectKey: 'electric',
              holeMask: 'hrangcua.png',
              holeScale: 1.15,
              damage: u.attack * (usePow ? 0.68 : 0.85),
              blastRadius: 44,
              windScale: 0.5,
              special: 'shield_bounce',
              diggerCharges: 2,
            });
          });
        });
        break;
      }

      case 'mjolnir': {
        // Thần Sấm Thor: Ném Rìu Stormbreaker tới mục tiêu và gọi cột Sét khổng lồ đánh xuống tại vị trí cuối!
        const shots = usePow ? [-4, 0, 4] : [0];
        shots.forEach((da, i) => {
          this.queueProjectile(baseDelay + i * 9, () => {
            sound.playShoot(true);
            this.spawnBullet(u, u.aimAngleDeg + da, power, {
              spriteKey: 'stormbreaker',
              effectKey: 'electric',
              holeMask: usePow ? 'h55x50.png' : 'h44x39.png',
              holeScale: usePow ? 1.22 : 1.14,
              damage: u.attack * (usePow ? 0.7 : 1.12),
              blastRadius: 48,
              windScale: 0.45,
              special: 'sky_lightning',
              scale: 1.1,
            });
          });
        });
        break;
      }

      case 'repulsor': {
        // Iron Man: 2 tia Laze Repulsor siêu tốc kháng gió + tên lửa tầm nhiệt Jericho
        const laserCount = usePow ? 3 : 2;
        for (let i = 0; i < laserCount; i++) {
          this.queueProjectile(baseDelay + i * 5, () => {
            sound.playShoot(false);
            this.spawnBullet(u, u.aimAngleDeg + (i - (laserCount - 1) / 2) * 1.2, power, {
              spriteKey: 'lightning',
              effectKey: 'electric',
              holeMask: 'h36x30.png',
              holeScale: 0.95,
              damage: u.attack * 0.36,
              blastRadius: 36,
              windScale: 0.25,
              special: 'electric',
            });
          });
        }
        const missileCount = usePow ? 2 : 1;
        for (let m = 0; m < missileCount; m++) {
          this.queueProjectile(baseDelay + 12 + m * 6, () => {
            sound.playShoot(true);
            this.spawnBullet(u, u.aimAngleDeg + (m === 0 ? 2 : -2), power, {
              spriteKey: 'rocket',
              effectKey: 'bigExplosion',
              holeMask: 'h44x39.png',
              holeScale: 1.05,
              damage: u.attack * 0.42,
              blastRadius: 40,
              special: 'homing',
            });
          });
        }
        break;
      }

      case 'hulk_leap':
      case 'hulk_smash': {
        // Hulk: Thay vì bắn súng, Hulk BẬT NHẢY trực tiếp tới đích và gây sát thương khi nhảy trúng mục tiêu! Nhảy càng cao sát thương càng to!
        this.queueProjectile(baseDelay, () => {
          sound.playShoot(true);
          this.spawnFloatingText(u.x, u.y - 46, 'HULK BẬT NHẢY!!', '#ef4444', 1.25);
          this.spawnBullet(u, u.aimAngleDeg, power, {
            spriteKey: 'meteor',
            effectKey: 'nuke',
            holeMask: 'h55x50.png',
            holeScale: usePow ? 1.38 : 1.18,
            damage: u.attack * (usePow ? 1.25 : 0.92),
            blastRadius: 56,
            windScale: 0.4,
            special: 'hulk_leap',
            leapStartY: u.y,
          });
        });
        break;
      }

      case 'hawkeye_bow': {
        // Hawkeye: Khi có POW HOẶC dùng Item HOẶC góc bắn nâng lên đúng 89°, bắn 1 Mũi Tên Kỹ Năng / Khổng Lồ (muiten_cn.png) tỉ lệ trúng đích 100%!
        const isFromItem = this.hawkeyeGiantArmed;
        const isSpecialSkill = usePow || isFromItem || Math.round(u.aimAngleDeg) === 89;
        if (isSpecialSkill) {
          this.hawkeyeGiantArmed = false;
          // Sát thương kĩ năng khi dùng item giảm xuống còn 300; khi dùng POW hoặc góc 89 độ là sát thương chuẩn
          const dmg = isFromItem ? 300 : u.attack * (usePow ? 1.75 : 1.45);
          this.queueProjectile(baseDelay, () => {
            sound.playPow();
            this.spawnFloatingText(
              u.x,
              u.y - 48,
              isFromItem
                ? 'ƯNG NHÃN: KỸ NĂNG VẬT PHẨM (300 DMG)!'
                : 'MŨI TÊN KHỔNG LỒ 100% TRÚNG ĐÍCH!!',
              '#c084fc',
              1.28
            );
            this.spawnBullet(u, u.aimAngleDeg, Math.max(65, power), {
              spriteKey: 'muiten_cn',
              effectKey: 'nuke',
              holeMask: 'h55x50.png',
              holeScale: 1.32,
              damage: dmg,
              blastRadius: 52,
              windScale: 0,
              special: 'hawkeye_giant_homing',
              scale: 1.65,
            });
          });
        } else {
          // Bắn cung thường: Chỉ bắn duy nhất 1 mũi tên thẳng hướng bắn!
          this.queueProjectile(baseDelay, () => {
            sound.playShoot(false);
            this.spawnBullet(u, u.aimAngleDeg, power, {
              spriteKey: 'muiten',
              effectKey: 'explosion',
              holeMask: 'h36x30.png',
              holeScale: 0.95,
              damage: u.attack,
              blastRadius: 36,
              windScale: 0.35,
            });
          });
        }
        break;
      }

      case 'ultron_beam': {
        // Ultron: Phóng chùm cầu năng lượng Plasma + các Ultron Nhân Bản tự động bắn yểm trợ!
        const mainCount = usePow ? 3 : 2;
        for (let i = 0; i < mainCount; i++) {
          this.queueProjectile(baseDelay + i * 5, () => {
            sound.playShoot(true);
            this.spawnBullet(u, u.aimAngleDeg + (i - (mainCount - 1) / 2) * 1.8, power, {
              spriteKey: 'lightning',
              effectKey: 'electric',
              holeMask: 'h40x35.png',
              holeScale: 1.0,
              damage: u.attack * (usePow ? 0.44 : 0.48),
              blastRadius: 38,
              windScale: 0.3,
              special: 'electric',
            });
          });
        }
        const clones = u.ultronClones ?? [];
        if (clones.length > 0) {
          this.spawnFloatingText(
            u.x,
            u.y - 52,
            `${clones.length} ULTRON NHÂN BẢN ĐỒNG LOẠT TẤN CÔNG!`,
            '#f43f5e',
            1.15
          );
          clones.forEach((clone, cIdx) => {
            this.queueProjectile(baseDelay + 12 + cIdx * 7, () => {
              sound.playShoot(false);
              const { vx, vy } = computeShotVelocity(u.facingLeft, u.aimAngleDeg, power);
              this.projectiles.push({
                x: u.x + clone.offsetX,
                y: u.y + clone.offsetY,
                vx,
                vy,
                ownerId: u.id,
                team: u.team,
                spriteKey: 'special',
                effectKey: 'explosion',
                holeMask: 'h36x30.png',
                holeScale: 0.9,
                damage: u.attack * 0.34,
                blastRadius: 36,
                windScale: 0.3,
                age: 0,
                special: 'homing',
                trail: [],
              });
            });
          });
        }
        break;
      }

      case 'winter_sniper':
      default: {
        // Winter Soldier: Đạn bắn tỉa siêu tốc kháng gió + Lựu đạn phân mảnh Bionic
        const sniperCount = usePow ? 3 : 1;
        for (let i = 0; i < sniperCount; i++) {
          this.queueProjectile(baseDelay + i * 5, () => {
            sound.playShoot(false);
            this.spawnBullet(u, u.aimAngleDeg + (i - (sniperCount - 1) / 2) * 0.8, power, {
              spriteKey: 'ak',
              effectKey: 'explosion',
              holeMask: 'h36x30.png',
              holeScale: 0.95,
              damage: u.attack * (usePow ? 0.38 : 0.55),
              blastRadius: 34,
              windScale: 0.25,
            });
          });
        }
        this.queueProjectile(baseDelay + 10, () => {
          sound.playShoot(true);
          this.spawnBullet(u, u.aimAngleDeg, power, {
            spriteKey: 'bomb',
            effectKey: 'bigExplosion',
            holeMask: 'h44x39.png',
            holeScale: 1.05,
            damage: u.attack * (usePow ? 0.58 : 0.52),
            blastRadius: 42,
            special: 'cluster',
            diggerCharges: usePow ? 3 : 2,
          });
        });
        break;
      }
    }
  }

  private scheduleBossUfoPattern(u: Fighter, power: number, usePow: boolean): void {
    const count = usePow ? 3 : 2;
    for (let i = 0; i < count; i++) {
      const da = (i - (count - 1) / 2) * 4;
      this.queueProjectile(i * 10, () => {
        sound.playShoot(true);
        this.spawnBullet(u, u.aimAngleDeg + da, power, {
          spriteKey: usePow ? 'meteor' : 'lightning',
          effectKey: usePow ? 'nuke' : 'electric',
          holeMask: usePow ? 'h55x50.png' : 'h40x35.png',
          holeScale: 1.1,
          damage: u.attack * (usePow ? 0.58 : 0.56),
          blastRadius: 45,
          windScale: 0.5,
          special: 'electric',
        });
      });
    }
  }

  private scheduleBossMechPattern(u: Fighter, power: number, usePow: boolean): void {
    const angles = usePow ? [-7, -3.5, 0, 3.5, 7] : [-4, 0, 4];
    angles.forEach((da, i) => {
      this.queueProjectile(i * 7, () => {
        sound.playShoot(true);
        this.spawnBullet(u, u.aimAngleDeg + da, power, {
          spriteKey: usePow && i === 2 ? 'special' : 'rocket',
          effectKey: usePow ? 'nuke' : 'bigExplosion',
          holeMask: usePow ? 'h55x50.png' : 'h44x39.png',
          holeScale: 1.12,
          damage: u.attack * (usePow ? 0.42 : 0.44),
          blastRadius: 46,
        });
      });
    });
  }

  private queueProjectile(delayTicks: number, fire: () => void): void {
    this.queuedShots.push({ delayTicks, fire });
  }

  private spawnBullet(
    u: Fighter,
    angleDeg: number,
    power: number,
    opts: {
      spriteKey: keyof AssetManager['manifest']['bullets'];
      effectKey: keyof AssetManager['manifest']['effects'];
      holeMask: string;
      holeScale: number;
      damage: number;
      blastRadius: number;
      windScale?: number;
      special?: Projectile['special'];
      diggerCharges?: number;
      eggDropTick?: number;
      leapStartY?: number;
      boomerangTurnDir?: 1 | -1;
      scale?: number;
    }
  ): void {
    const { vx, vy } = computeShotVelocity(u.facingLeft, angleDeg, power);
    let sx = u.x;
    let sy = u.y;
    if (opts.special === 'hulk_leap') {
      sx = u.x;
      sy = u.y - 10;
    } else if (u.isBoss) {
      // Boss có kích thước lớn (hitRadius ~34), tính họng súng hướng ra ngoài thân boss theo góc ngắm để không kẹt đạn ở góc map
      const bossMuzzleDist = 38;
      const muzzleRad = (angleDeg * Math.PI) / 180;
      const bossDir = u.facingLeft ? -1 : 1;
      sx = u.x + bossDir * Math.cos(muzzleRad) * bossMuzzleDist;
      sy = u.y - 24 - Math.sin(muzzleRad) * bossMuzzleDist;
      sx = Math.max(18, Math.min(this.terrain.width - 18, sx));
      sy = Math.max(16, Math.min(this.terrain.waterY - 20, sy));
    } else {
      sx = u.x + (u.facingLeft ? -PHYSICS.MUZZLE_OFFSET_X : PHYSICS.MUZZLE_OFFSET_X);
      sy = u.y + PHYSICS.MUZZLE_OFFSET_Y;
    }

    this.projectiles.push({
      x: sx,
      y: sy,
      vx,
      vy,
      ownerId: u.id,
      team: u.team,
      spriteKey: opts.spriteKey,
      effectKey: opts.effectKey,
      holeMask: opts.holeMask,
      holeScale: opts.holeScale,
      damage: opts.damage,
      blastRadius: opts.blastRadius,
      windScale: opts.windScale ?? 1,
      age: 0,
      scale: opts.scale,
      special: opts.special,
      diggerCharges: opts.diggerCharges,
      eggDropTick: opts.eggDropTick,
      boomerangTurnDir: opts.boomerangTurnDir,
      leapStartY: opts.leapStartY,
      leapPeakHeight: 0,
      trail: [],
    });
  }

  private updateQueuedShots(): void {
    for (let i = this.queuedShots.length - 1; i >= 0; i--) {
      this.queuedShots[i].delayTicks--;
      if (this.queuedShots[i].delayTicks <= 0) {
        const job = this.queuedShots[i];
        this.queuedShots.splice(i, 1);
        job.fire();
      }
    }
  }

  private updateProjectiles(): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.age++;
      if (p.age > 260) {
        this.projectiles.splice(i, 1);
        continue;
      }

      // 1. Khiên Vibranium của Captain America đang bay quay trở lại tay Cap!
      if (p.returningToOwner) {
        const owner = this.fighters.find((f) => f.id === p.ownerId && f.alive);
        if (!owner || p.age > 170) {
          this.projectiles.splice(i, 1);
          continue;
        }
        const tx = owner.x;
        const ty = owner.y - 18;
        const dx = tx - p.x;
        const dy = ty - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= 20) {
          sound.playItemUse();
          this.spawnFloatingText(owner.x, owner.y - 44, 'THU KHIÊN VIBRANIUM!', '#38bdf8', 1.05);
          this.projectiles.splice(i, 1);
          continue;
        }
        const returnSpeed = 14.5;
        p.vx = (dx / dist) * returnSpeed;
        p.vy = (dy / dist) * returnSpeed;
        p.x += p.vx;
        p.y += p.vy;
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > 14) p.trail.shift();
        continue;
      }

      // 2. Viên Kim Cương của Apache đang lơ lửng trên trời và khúc xạ Tia Laze Tam Giác!
      if (p.hoveringDiamond) {
        p.hoverTicks = (p.hoverTicks ?? 1) - 1;
        if ((p.hoverTicks ?? 0) <= 0) {
          const tx = p.laserTargetX ?? p.x;
          const ty = p.laserTargetY ?? p.y;
          this.detonateProjectile(p, tx, ty, false);
          this.projectiles.splice(i, 1);
        }
        continue;
      }

      // 3. Xử lý Chuột Gắn Bom đang bò dọc theo mặt đất (chuotBull.png)
      if (p.crawling) {
        p.crawlTicksLeft = (p.crawlTicksLeft ?? 1) - 1;
        const dir = p.crawlDir ?? 1;
        const nextX = p.x + dir * 2.3;
        let stepped = false;
        for (let dy = -10; dy <= 12; dy++) {
          const testY = p.y + dy;
          if (!this.terrain.isSolid(nextX, testY) && this.terrain.isSolid(nextX, testY + 1)) {
            p.x = nextX;
            p.y = testY;
            stepped = true;
            break;
          }
        }
        if (!stepped) {
          p.x = nextX;
          p.y += 3;
        }

        const hitEnemy = this.fighters.find(
          (f) => f.alive && f.team !== p.team && Math.hypot(f.x - p.x, f.y - 14 - p.y) <= 22
        );
        if (hitEnemy || (p.crawlTicksLeft ?? 0) <= 0 || p.y >= this.terrain.waterY) {
          this.detonateProjectile(p, p.x, p.y, false);
          this.projectiles.splice(i, 1);
        }
        continue;
      }

      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 14) p.trail.shift();

      const prevX = p.x;
      const prevY = p.y;

      // 4. Mũi Tên Khổng Lồ 100% Trúng Đích của Hawkeye (góc 89° hoặc dùng Item):
      if (p.special === 'hawkeye_giant_homing' && p.age >= 16) {
        const target = this.fighters
          .filter((f) => f.alive && f.team !== p.team)
          .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
        if (target) {
          const tx = target.x;
          const ty = target.isBoss ? target.y - 24 : target.y - 14;
          const dx = tx - p.x;
          const dy = ty - p.y;
          const dist = Math.hypot(dx, dy);
          const speed = 15.5;
          if (dist <= speed + 8) {
            this.detonateProjectile(p, tx, ty, false);
            this.projectiles.splice(i, 1);
            continue;
          }
          p.vx = (dx / dist) * speed;
          p.vy = (dy / dist) * speed;
          p.x += p.vx;
          p.y += p.vy;
          continue;
        }
      }

      p.x += p.vx;
      p.y += p.vy;

      // 4b. Tazang Bumerang: Đổi hướng khi đang bay trên không như 1 chiếc Bumerang thật!
      if (p.special === 'boomerang_curve') {
        p.vx += this.wind * PHYSICS.WIND_FACTOR * p.windScale;
        if (p.age <= 14) {
          p.vy += PHYSICS.GRAVITY * 0.72;
        } else {
          const turnDir = p.boomerangTurnDir ?? -1;
          const prevSign = Math.sign(p.vx);
          p.vx += turnDir * 0.36;
          p.vy += PHYSICS.GRAVITY * 0.54 - 0.07;
          if (!p.boomerangTurned && Math.sign(p.vx) === turnDir && prevSign !== turnDir) {
            p.boomerangTurned = true;
            sound.playShoot(false);
            this.spawnFloatingText(p.x, p.y - 22, 'BUMERANG ĐỔI HƯỚNG!', '#84cc16', 1.12);
          }
        }
      } else {
        p.vx += this.wind * PHYSICS.WIND_FACTOR * p.windScale;
        p.vy += PHYSICS.GRAVITY;
      }

      // 5. Hulk Bật Nhảy: Hulk di chuyển trực tiếp theo quỹ đạo nhảy và tích lũy độ cao cực đại!
      if (p.special === 'hulk_leap') {
        const owner = this.fighters.find((f) => f.id === p.ownerId && f.alive);
        if (owner) {
          owner.x = Math.max(18, Math.min(this.terrain.width - 18, p.x));
          owner.y = p.y + 10;
          owner.animMode = 'jump';
          owner.facingLeft = p.vx < 0;
        }
        p.leapPeakHeight = Math.max(p.leapPeakHeight ?? 0, (p.leapStartY ?? p.y) - p.y);
      }

      // 6. Chicky: Gà bay đẻ Trứng Vàng theo đúng thời điểm Thanh Lực 2 (eggDropTick)!
      if (p.special === 'chicky_egg' && !p.droppedEgg) {
        const triggerTick = p.eggDropTick ?? 24;
        if (p.age >= triggerTick) {
          p.droppedEgg = true;
          sound.playItemUse();
          if (this.assets.manifest.effects.longga) {
            this.spawnEffect(p.x, p.y, this.assets.manifest.effects.longga, 1.0);
          }
          this.spawnFloatingText(p.x, p.y - 22, 'CỤC TÁC! ĐẺ TRỨNG VÀNG!', '#facc15', 1.05);
          this.projectiles.push({
            x: p.x,
            y: p.y + 6,
            vx: 0,
            vy: 4.8,
            ownerId: p.ownerId,
            team: p.team,
            spriteKey: 'egg',
            effectKey: 'bigExplosion',
            holeMask: 'h44x39.png',
            holeScale: 1.08,
            damage: p.damage * 1.15,
            blastRadius: 42,
            windScale: 0.05,
            age: 4,
            trail: [],
          });
        }
      }

      // 7. Apache: Khi viên Kim Cương bay lên đạt đỉnh (age >= 24 hoặc vy >= -0.2), dừng lại trên trời và bắn Tia Laze Khúc Xạ Tam Giác!
      if (p.special === 'apache_diamond' && !p.hoveringDiamond && (p.age >= 24 || p.vy >= -0.2)) {
        p.hoveringDiamond = true;
        p.hoverTicks = 24;
        // Tìm điểm cuối của tia laze khúc xạ (ưu tiên hướng xuống theo quỹ đạo hoặc kẻ địch phía trước)
        const dirSign = p.vx >= 0 ? 1 : -1;
        let rayX = p.x;
        let rayY = p.y;
        const stepX = dirSign * 3.2;
        const stepY = 5.2;
        // Nếu có kẻ địch gần đường khúc xạ phía dưới, hội tụ tia laze về phía khu vực đó
        const enemyAhead = this.fighters
          .filter((f) => f.alive && f.team !== p.team && Math.sign(f.x - p.x) === dirSign)
          .sort((a, b) => Math.abs(a.x - (p.x + dirSign * 110)) - Math.abs(b.x - (p.x + dirSign * 110)))[0];
        const aimSlopeX = enemyAhead
          ? (enemyAhead.x - p.x) / Math.max(20, Math.hypot(enemyAhead.x - p.x, enemyAhead.y - p.y)) * 6
          : stepX;
        const aimSlopeY = enemyAhead
          ? Math.max(2.5, (enemyAhead.y - 12 - p.y) / Math.max(20, Math.hypot(enemyAhead.x - p.x, enemyAhead.y - p.y)) * 6)
          : stepY;

        for (let s = 0; s < 160; s++) {
          rayX += aimSlopeX;
          rayY += aimSlopeY;
          const hitF = this.fighters.find(
            (f) => f.alive && f.team !== p.team && Math.hypot(f.x - rayX, f.y - 16 - rayY) <= 20
          );
          if (hitF || this.terrain.isSolid(rayX, rayY) || rayY >= this.terrain.waterY - 4) {
            break;
          }
        }
        p.laserTargetX = Math.max(20, Math.min(this.terrain.width - 20, rayX));
        p.laserTargetY = Math.min(this.terrain.waterY - 4, Math.max(20, rayY));
        sound.playPow();
        this.spawnFloatingText(p.x, p.y - 24, 'LAZE KIM CƯƠNG KHÚC XẠ!', '#06b6d4', 1.15);
        continue;
      }

      // Hiệu ứng đạn dẫn đường tầm nhiệt của Iron Man / Ultron Nhân Bản khi đang lao xuống
      if (p.special === 'homing' && p.vy > 0 && p.age > 10 && p.age < 120) {
        const nearest = this.fighters
          .filter((f) => f.alive && f.team !== p.team)
          .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
        if (nearest && Math.hypot(nearest.x - p.x, nearest.y - 16 - p.y) < 260) {
          const desiredVx = Math.sign(nearest.x - p.x) * 0.16;
          p.vx += desiredVx;
        }
      }

      // Rơi xuống biển hoặc ra ngoài biên bản đồ
      if (p.y >= this.terrain.waterY) {
        sound.playSplash();
        this.spawnEffect(p.x, this.terrain.waterY - 10, this.assets.manifest.effects.splash, 0.95);
        this.projectiles.splice(i, 1);
        continue;
      }
      if (p.x < -140 || p.x > this.terrain.width + 140 || p.y > this.terrain.height + 100) {
        this.projectiles.splice(i, 1);
        continue;
      }

      // Kiểm tra trúng thân Tướng / Boss trực tiếp (bỏ qua chủ nhân trong 8 tick đầu)
      let directFighterHit: Fighter | null = null;
      for (const f of this.fighters) {
        if (!f.alive) continue;
        if (
          f.id === p.ownerId &&
          (p.age < 9 || p.special === 'hulk_leap' || p.special === 'boomerang_curve')
        )
          continue;
        const hitRadius = f.isBoss ? 34 : f.unitKind === 'bomber' ? 25 : 17;
        const centerY = f.isBoss ? f.y - 26 : f.y - 16;
        if (Math.hypot(p.x - f.x, p.y - centerY) <= hitRadius) {
          directFighterHit = f;
          break;
        }
      }

      if (directFighterHit && p.special !== 'teleport') {
        this.detonateProjectile(p, p.x, p.y);
        if (p.special === 'shield_bounce') {
          // Khiên Captain America trúng mục tiêu sẽ quay trở lại với Cap!
          p.returningToOwner = true;
        } else {
          this.projectiles.splice(i, 1);
        }
        continue;
      }

      // Kiểm tra chạm địa hình bằng Bresenham raycast ($nMi)
      const hitLand = this.terrain.raycast(prevX, prevY, p.x, p.y);
      if (hitLand) {
        if (p.special === 'mouse' && !p.crawling) {
          // Chuột gắn bom đáp xuống đất và bắt đầu chạy về phía kẻ địch gần nhất!
          p.crawling = true;
          p.x = hitLand.x;
          p.y = hitLand.y - 1;
          const nearestEnemy = this.fighters
            .filter((f) => f.alive && f.team !== p.team)
            .sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
          p.crawlDir = nearestEnemy ? (nearestEnemy.x >= p.x ? 1 : -1) : p.vx >= 0 ? 1 : -1;
          p.crawlTicksLeft = 75;
          this.spawnFloatingText(p.x, p.y - 24, 'CHÍCH CHÍCH!!', '#fb923c', 1.0);
        } else if (p.special === 'digger' && (p.diggerCharges ?? 0) > 1) {
          // Đạn khoan xuyên qua lớp đất và nổ tiếp!
          p.diggerCharges = (p.diggerCharges ?? 2) - 1;
          this.detonateProjectile(p, hitLand.x, hitLand.y, true);
          p.x = hitLand.x + p.vx * 0.8;
          p.y = hitLand.y + p.vy * 0.8;
          p.vx *= 0.82;
          p.vy *= 0.82;
        } else if (p.special === 'shield_bounce' && (p.diggerCharges ?? 0) > 1) {
          // Khiên Vibranium của Captain America va chạm địa hình bật nảy thêm 1 lần nữa!
          p.diggerCharges = (p.diggerCharges ?? 2) - 1;
          this.detonateProjectile(p, hitLand.x, hitLand.y, true);
          p.x = hitLand.x;
          p.y = hitLand.y - 6;
          p.vx *= 0.82;
          p.vy = -Math.max(4.6, Math.abs(p.vy) * 0.68);
        } else if (p.special === 'shield_bounce') {
          // Sau khi hoàn thành lần nảy thứ 2, Khiên quay trở lại tay Captain America!
          this.detonateProjectile(p, hitLand.x, hitLand.y, false);
          p.x = hitLand.x;
          p.y = hitLand.y - 8;
          p.returningToOwner = true;
        } else {
          this.detonateProjectile(p, hitLand.x, hitLand.y, false);
          this.projectiles.splice(i, 1);
        }
      }
    }
  }

  private detonateProjectile(p: Projectile, ix: number, iy: number, isSubDrill = false): void {
    // 1. Ngọc Dịch Chuyển
    if (p.special === 'teleport') {
      const owner = this.fighters.find((f) => f.id === p.ownerId && f.alive);
      if (owner) {
        this.spawnEffect(owner.x, owner.y - 18, this.assets.manifest.effects.teleport, 1.0);
        owner.x = Math.max(20, Math.min(this.terrain.width - 20, ix));
        owner.y = Math.max(20, iy - 3);
        this.spawnEffect(owner.x, owner.y - 18, this.assets.manifest.effects.teleport, 1.1);
        sound.playItemUse();
        this.spawnFloatingText(owner.x, owner.y - 40, 'DỊCH CHUYỂN!', '#c084fc', 1.1);
      }
      return;
    }

    // 1b. Hulk Bật Nhảy: Khi đáp đất sẽ KHÔNG phá địa hình và KHÔNG tự gây sát thương lên chính mình!
    if (p.special === 'hulk_leap') {
      const owner = this.fighters.find((f) => f.id === p.ownerId && f.alive);
      const heightBonus = Math.min(1.4, Math.max(0.05, (p.leapPeakHeight ?? 0) / 155));
      p.damage *= 1 + heightBonus;
      p.blastRadius += Math.round(heightBonus * 18);
      if (owner) {
        const landX = Math.max(20, Math.min(this.terrain.width - 20, Math.round(ix)));
        let landY = Math.max(20, Math.min(this.terrain.waterY - 14, Math.round(iy)));
        while (landY > 24 && this.terrain.isSolid(landX, landY)) {
          landY--;
        }
        owner.x = landX;
        owner.y = landY;
        owner.vy = 0;
        owner.grounded = true;
        owner.animMode = 'idle';
        this.spawnFloatingText(
          owner.x,
          owner.y - 48,
          `HULK DẬM ĐẤT! (+${Math.round(heightBonus * 100)}% ST ĐỘ CAO)`,
          '#ef4444',
          1.22
        );
      }
    }

    // 2. Khoét hố đạn (Hulk đáp đất không phá địa hình) + rung màn hình + hiệu ứng nổ gốc
    if (p.special !== 'hulk_leap') {
      this.terrain.carveCrater(ix, iy, p.holeMask, p.holeScale);
    }
    this.shakeIntensity = Math.min(14, Math.max(this.shakeIntensity, p.blastRadius * 0.18));
    sound.playExplosion(p.holeScale);

    const fxEntry =
      this.assets.manifest.effects[p.effectKey] ?? this.assets.manifest.effects.explosion;
    this.spawnEffect(ix, iy, fxEntry, p.effectKey === 'nuke' ? 1.25 : 1.0);

    // Tia sét giáng từ bầu trời xuống của Thor (Stormbreaker/Mjolnir) & POW Điện Quang
    if (p.special === 'sky_lightning') {
      this.lightningBeams.push({ x: ix, y: iy, ticksLeft: 24 });
      for (let sy = iy - 45; sy > 0; sy -= 48) {
        this.spawnEffect(ix, sy, this.assets.manifest.effects.electric, 0.95);
      }
    }

    // Mảnh đạn chùm của Granos & Winter Soldier
    if (!isSubDrill && p.special === 'cluster' && (p.diggerCharges ?? 0) > 0) {
      const subCount = p.diggerCharges ?? 3;
      for (let k = 0; k < subCount; k++) {
        const ang = (-125 + (k / Math.max(1, subCount - 1)) * 70) * (Math.PI / 180);
        this.projectiles.push({
          x: ix,
          y: iy - 6,
          vx: Math.cos(ang) * 4.2,
          vy: Math.sin(ang) * 4.5,
          ownerId: p.ownerId,
          team: p.team,
          spriteKey: 'cannon',
          effectKey: 'explosion',
          holeMask: 'h32x26.png',
          holeScale: 0.85,
          damage: p.damage * 0.34,
          blastRadius: 32,
          windScale: 0.6,
          age: 10,
          trail: [],
        });
      }
    }

    // 3. Mở hòm tiếp tế nếu đạn nổ trúng hòm
    for (const c of this.crates) {
      if (!c.collected && Math.hypot(c.x - ix, c.y - iy) <= p.blastRadius + 14) {
        c.collected = true;
        const owner = this.fighters.find((f) => f.id === p.ownerId && f.alive);
        if (owner) {
          if (c.kind === 'hp') {
            owner.hp = Math.min(owner.maxHp, owner.hp + 240);
            this.spawnFloatingText(owner.x, owner.y - 42, '+240 HP (BẮN HÒM)', '#4ade80', 1.1);
          } else {
            owner.pow = Math.min(100, owner.pow + 50);
            this.spawnFloatingText(owner.x, owner.y - 42, '+50 NỘ (BẮN HÒM)', '#facc15', 1.1);
          }
        }
      }
    }

    // 4. Tính sát thương theo khoảng cách tâm vụ nổ
    const shooter = this.fighters.find((f) => f.id === p.ownerId);
    for (const target of this.fighters) {
      if (!target.alive) continue;
      // Hulk đáp đất không tự gây sát thương lên chính mình
      if (p.special === 'hulk_leap' && target.id === p.ownerId) continue;
      const centerY = target.isBoss ? target.y - 24 : target.y - 16;
      const bodyRadius = target.isBoss ? 26 : 12;
      const dist = Math.max(0, Math.hypot(target.x - ix, centerY - iy) - bodyRadius);
      if (dist > p.blastRadius) continue;

      const falloff = Math.max(0.28, 1 - (dist / p.blastRadius) * 0.72);
      let rawDmg = p.damage * falloff;

      if (p.special === 'electric' || p.special === 'sky_lightning') {
        rawDmg += p.special === 'sky_lightning' ? 32 : 18;
        this.spawnEffect(target.x, centerY, this.assets.manifest.effects.electric, 0.8);
      }

      if (p.special === 'web' && target.team !== p.team) {
        target.webbedTurns = 1;
        this.spawnFloatingText(target.x, centerY - 32, 'TRÓI TƠ NHỆN!', '#e2e8f0', 1.15);
      }

      if (p.special === 'freeze' && target.team !== p.team) {
        target.frozenTurns = 1;
        this.spawnFloatingText(target.x, centerY - 32, 'ĐÓNG BĂNG (MẤT 1 LƯỢT)!', '#38bdf8', 1.25);
        if (this.assets.manifest.effects.freeze) {
          this.spawnEffect(target.x, centerY, this.assets.manifest.effects.freeze, 1.1);
        }
      }

      if (p.special === 'poison' && target.team !== p.team) {
        target.poisonTurns = 2;
        this.spawnFloatingText(target.x, centerY - 32, 'DÍNH ĐỘC AXIT (2 LƯỢT)!', '#84cc16', 1.2);
        if (this.assets.manifest.effects.poison) {
          this.spawnEffect(target.x, centerY, this.assets.manifest.effects.poison, 1.1);
        }
      }

      if (target.team === p.team) {
        rawDmg *= 0.45;
      }

      if (target.shieldTurns > 0) {
        rawDmg *= 0.45;
      }

      const finalDmg = Math.max(1, Math.round(rawDmg));
      target.hp = Math.max(0, target.hp - finalDmg);
      target.hurtTimer = 24;

      target.pow = Math.min(100, target.pow + Math.round((finalDmg / target.maxHp) * 85));
      if (shooter && target.team !== shooter.team) {
        shooter.pow = Math.min(100, shooter.pow + Math.round((finalDmg / target.maxHp) * 55));
        if (shooter.isPlayerControlled) {
          this.totalDamageDealt += finalDmg;
        }
      }

      const isCrit = falloff > 0.88;
      this.spawnFloatingText(
        target.x + (Math.random() - 0.5) * 16,
        centerY - 18,
        `-${finalDmg}${isCrit ? '!' : ''}`,
        isCrit ? '#fbbf24' : '#f87171',
        isCrit ? 1.3 : 1.08
      );

      if (target.hp <= 0) {
        target.alive = false;
        if (target.team === 1) this.enemiesDefeated++;
        this.spawnEffect(
          target.x,
          centerY,
          this.assets.manifest.effects.bigExplosion,
          target.isBoss ? 1.6 : 1.15
        );
        this.spawnFloatingText(target.x, centerY - 34, 'HẠ GỤC!', '#fde047', 1.35);
      }
    }
  }

  // ==================== EFFECTS, CAMERA & RENDERING ====================

  private spawnEffect(x: number, y: number, sprite: SpriteStripEntry, scale = 1): void {
    this.effects.push({
      x,
      y,
      sprite,
      tick: 0,
      frameDuration: 4,
      scale,
    });
  }

  private spawnFloatingText(x: number, y: number, text: string, color: string, scale = 1): void {
    this.floatingTexts.push({
      x,
      y,
      vy: -0.95,
      text,
      color,
      life: 62,
      maxLife: 62,
      scale,
    });
  }

  private updateEffectsAndTexts(): void {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const fx = this.effects[i];
      fx.tick++;
      const totalFrames = fx.sprite.frames || 5;
      if (fx.tick >= totalFrames * fx.frameDuration) {
        this.effects.splice(i, 1);
      }
    }

    for (let i = this.lightningBeams.length - 1; i >= 0; i--) {
      this.lightningBeams[i].ticksLeft--;
      if (this.lightningBeams[i].ticksLeft <= 0) {
        this.lightningBeams.splice(i, 1);
      }
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy;
      ft.vy *= 0.97;
      ft.life--;
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  private updateWindParticles(): void {
    const vx = this.wind * 0.14;
    for (const wp of this.windParticles) {
      wp.x += vx;
      wp.y += 0.35 + Math.sin(this.globalTick * 0.04 + wp.x * 0.02) * 0.25;
      if (wp.x < -20) wp.x = this.map.width + 20;
      if (wp.x > this.map.width + 20) wp.x = -20;
      if (wp.y > this.terrain.waterY) wp.y = -10;
    }
  }

  private updateCameraFollow(): void {
    if (this.isDraggingCam) return;
    if (this.manualCamTimer > 0) {
      this.manualCamTimer--;
      return;
    }

    let targetX = this.camX;
    let targetY = this.camY;

    if (this.projectiles.length > 0) {
      const lead = this.projectiles[0];
      targetX = lead.x;
      targetY = Math.min(this.terrain.waterY - 40, Math.max(40, lead.y));
    } else {
      const active = this.getActiveUnit();
      if (active) {
        targetX = active.x + (active.facingLeft ? -45 : 45);
        targetY = active.y - 35;
      }
    }

    this.camX += (targetX - this.camX) * 0.09;
    this.camY += (targetY - this.camY) * 0.09;
    this.clampCamera();
  }

  private render(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cssW = this.canvas.clientWidth || window.innerWidth;
    const cssH = this.canvas.clientHeight || window.innerHeight;
    if (
      this.canvas.width !== Math.floor(cssW * dpr) ||
      this.canvas.height !== Math.floor(cssH * dpr)
    ) {
      this.canvas.width = Math.floor(cssW * dpr);
      this.canvas.height = Math.floor(cssH * dpr);
    }

    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);

    this.drawSkyAndParallax(ctx, cssW, cssH);

    ctx.save();
    const shakeX = this.shakeIntensity > 0 ? (Math.random() * 2 - 1) * this.shakeIntensity : 0;
    const shakeY = this.shakeIntensity > 0 ? (Math.random() * 2 - 1) * this.shakeIntensity : 0;
    ctx.translate(cssW / 2 + shakeX, cssH / 2 + shakeY);
    ctx.scale(this.camZoom, this.camZoom);
    ctx.translate(-this.camX, -this.camY);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, this.terrain.width, this.terrain.height);

    this.drawWaterBack(ctx);

    ctx.drawImage(this.terrain.canvas, 0, 0, this.terrain.width, this.terrain.height);

    this.drawCrates(ctx);
    this.drawFightersAndAimGuide(ctx);
    this.drawProjectiles(ctx);
    this.drawWaterSurface(ctx);
    this.drawWindParticles(ctx);
    this.drawEffectsAndTexts(ctx);

    ctx.restore();

    if (this.phase === 'ended' && this.matchResult) {
      this.drawEndBanner(ctx, cssW, cssH, this.matchResult);
    }

    ctx.restore();
  }

  private drawSkyAndParallax(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0f172a');
    sky.addColorStop(0.52, '#1e3a5f');
    sky.addColorStop(1, '#38bdf8');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    const sun = this.assets.getImage('./assets/backgrounds/sun10.png');
    if (sun) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.drawImage(
        sun,
        w * 0.82 - this.camX * 0.04,
        h * 0.12,
        sun.width * 1.1,
        sun.height * 1.1
      );
      ctx.restore();
    }

    const cl1 = this.assets.getImage('./assets/backgrounds/cl1.png');
    const cl2 = this.assets.getImage('./assets/backgrounds/cl2.png');
    if (cl1) {
      const cx = ((this.globalTick * 0.25) % (w + 300)) - 150;
      ctx.globalAlpha = 0.55;
      ctx.drawImage(cl1, cx, h * 0.15, cl1.width * 0.9, cl1.height * 0.9);
      ctx.globalAlpha = 1;
    }
    if (cl2) {
      const cx2 = ((this.globalTick * 0.16 + 420) % (w + 350)) - 170;
      ctx.globalAlpha = 0.45;
      ctx.drawImage(cl2, cx2, h * 0.24, cl2.width * 0.85, cl2.height * 0.85);
      ctx.globalAlpha = 1;
    }

    this.bgLayers.forEach((url, idx) => {
      const img = this.assets.getImage(url);
      if (!img) return;
      const parallax = 0.08 + idx * 0.09;
      const scale = Math.max(w / img.width, 0.95);
      const dw = img.width * scale;
      const dh = img.height * scale * 0.72;
      const offsetX = -((this.camX * parallax) % dw);
      const drawY = h - dh + idx * 14;

      ctx.save();
      ctx.globalAlpha = idx === 0 ? 0.45 : idx === 1 ? 0.62 : 0.78;
      for (let x = offsetX - dw; x < w + dw; x += dw) {
        ctx.drawImage(img, x, drawY, dw + 1, dh);
      }
      ctx.restore();
    });
  }

  private drawWaterBack(ctx: CanvasRenderingContext2D): void {
    const wy = this.terrain.waterY;
    const grad = ctx.createLinearGradient(0, wy, 0, this.terrain.height + 240);
    grad.addColorStop(0, 'rgba(14, 165, 233, 0.55)');
    grad.addColorStop(1, 'rgba(3, 105, 161, 0.92)');
    ctx.fillStyle = grad;
    ctx.fillRect(-300, wy, this.terrain.width + 600, 320);
  }

  private drawWaterSurface(ctx: CanvasRenderingContext2D): void {
    const wy = this.terrain.waterY;
    const topEntry = this.assets.manifest.ui.waterTop;
    const topImg = this.assets.getImage(topEntry.url);
    const deepImg = this.assets.getImage(this.assets.manifest.ui.waterDeep);

    if (deepImg) {
      ctx.save();
      ctx.globalAlpha = 0.65;
      for (let x = -240; x < this.terrain.width + 240; x += 24) {
        ctx.drawImage(deepImg, x, wy + 22, 24, 24);
      }
      ctx.restore();
    }

    if (topImg) {
      const frames = topEntry.frames || 2;
      const fh = Math.floor(topImg.height / frames);
      const frame = Math.floor(this.globalTick / 12) % frames;
      const shift = Math.sin(this.globalTick * 0.05) * 6;
      ctx.save();
      ctx.globalAlpha = 0.86;
      for (let x = -240; x < this.terrain.width + 240; x += 24) {
        ctx.drawImage(topImg, 0, frame * fh, topImg.width, fh, x + shift, wy - 4, 24, 24);
      }
      ctx.restore();
    }
  }

  private drawCrates(ctx: CanvasRenderingContext2D): void {
    const boxImg = this.assets.getImage(this.assets.manifest.bullets.crate.url);
    for (const c of this.crates) {
      if (c.collected) continue;
      ctx.save();
      ctx.translate(c.x, c.y);
      if (!c.landed) {
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-10, -14);
        ctx.lineTo(-4, -2);
        ctx.moveTo(10, -14);
        ctx.lineTo(4, -2);
        ctx.stroke();

        ctx.fillStyle = c.kind === 'hp' ? '#22c55e' : '#eab308';
        ctx.beginPath();
        ctx.arc(0, -14, 12, Math.PI, 0);
        ctx.fill();
      }
      if (boxImg) {
        ctx.drawImage(boxImg, -12, -12, 24, 24);
      } else {
        ctx.fillStyle = '#d97706';
        ctx.fillRect(-10, -10, 20, 20);
      }
      ctx.restore();
    }
  }

  private drawFightersAndAimGuide(ctx: CanvasRenderingContext2D): void {
    const active = this.getActiveUnit();
    const turnImg = this.assets.getImage(this.assets.manifest.ui.turnArrow);
    const webEntry = this.assets.manifest.bullets.web;
    const webImg = webEntry ? this.assets.getImage(webEntry.url) : undefined;

    for (const f of this.fighters) {
      if (!f.alive) continue;

      if (
        active &&
        active.id === f.id &&
        (this.phase === 'aiming' || this.phase === 'charging' || this.phase === 'charging_2')
      ) {
        this.drawAimReticle(ctx, f);
      }

      // Vẽ các Ultron Nhân Bản đang bay hộ tống quanh Ultron
      if (f.ultronClones && f.ultronClones.length > 0) {
        const ulHero = getHeroById('ultron');
        for (const clone of f.ultronClones) {
          const bob = Math.sin((this.globalTick + clone.id * 17) * 0.12) * 3.5;
          this.charRenderer.drawUnit(ctx, {
            unitKind: 'hero',
            hero: ulHero,
            x: f.x + clone.offsetX,
            y: f.y + clone.offsetY + bob,
            facingLeft: f.facingLeft,
            aimAngleDeg: f.aimAngleDeg,
            animMode: f.animMode,
            animTick: f.animTick + clone.id * 9,
            isPowReady: false,
            hasShield: false,
            scale: 0.76,
          });
        }
      }

      this.charRenderer.drawUnit(ctx, {
        unitKind: f.unitKind,
        hero: f.hero,
        x: f.x,
        y: f.y,
        facingLeft: f.facingLeft,
        aimAngleDeg: f.aimAngleDeg,
        animMode: f.animMode,
        animTick: f.animTick,
        isPowReady: f.pow >= 100,
        hasShield: f.shieldTurns > 0,
        scale: f.scale,
      });

      // Lưới tơ nhện quấn quanh người nếu bị trúng Đạn Tơ Nhện (web.png)
      if (f.webbedTurns > 0 && webImg) {
        const fh = Math.floor(webImg.height / (webEntry.frames || 2));
        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.drawImage(webImg, 0, 0, webImg.width, fh, f.x - 18, f.y - 34, 36, 36);
        ctx.restore();
      }

      const headOffsetY = f.isBoss ? -88 : f.unitKind === 'bomber' ? -46 : -48;
      const barW = f.isBoss ? 76 : 44;
      const barH = f.isBoss ? 7 : 5;
      const hpRatio = Math.max(0, Math.min(1, f.hp / f.maxHp));

      ctx.save();
      ctx.translate(f.x, f.y + headOffsetY);

      ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
      ctx.fillRect(-barW / 2 - 1, -1, barW + 2, barH + 2);

      ctx.fillStyle = f.isPlayerControlled ? '#22c55e' : f.isBoss ? '#f43f5e' : '#ef4444';
      ctx.fillRect(-barW / 2, 0, barW * hpRatio, barH);

      ctx.font = f.isBoss ? 'bold 10px system-ui, sans-serif' : '600 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#020617';
      ctx.fillText(f.name, 1, -4);
      ctx.fillStyle = f.isPlayerControlled ? '#bae6fd' : f.isBoss ? '#fde047' : '#fecaca';
      ctx.fillText(f.name, 0, -5);

      if (active && active.id === f.id && turnImg) {
        const bounce = Math.sin(this.globalTick * 0.18) * 3;
        ctx.drawImage(turnImg, -7, -30 + bounce, 14, 20);
      }

      ctx.restore();
    }
  }

  private drawAimReticle(ctx: CanvasRenderingContext2D, u: Fighter): void {
    const cx = u.x;
    const cy = u.y + PHYSICS.MUZZLE_OFFSET_Y;
    const radius = 52;
    const dir = u.facingLeft ? -1 : 1;

    ctx.save();
    ctx.translate(cx, cy);

    const toCanvasRad = (deg: number) => {
      const r = (deg * Math.PI) / 180;
      return Math.atan2(-Math.sin(r), Math.cos(r) * dir);
    };

    const aMin = toCanvasRad(u.hero.minAngle);
    const aMax = toCanvasRad(u.hero.maxAngle);
    const aCur = toCanvasRad(u.aimAngleDeg);

    ctx.strokeStyle = u.isPlayerControlled
      ? 'rgba(56, 189, 248, 0.35)'
      : 'rgba(248, 113, 113, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(0, 0, radius, Math.min(aMin, aMax), Math.max(aMin, aMax), u.facingLeft);
    ctx.stroke();
    ctx.setLineDash([]);

    const ux = Math.cos(aCur);
    const uy = Math.sin(aCur);
    ctx.strokeStyle = this.powArmed ? '#facc15' : '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ux * 14, uy * 14);
    ctx.lineTo(ux * (radius + 8), uy * (radius + 8));
    ctx.stroke();

    if (u.isPlayerControlled) {
      const previewPower =
        this.phase === 'charging' ? this.chargePower : u.lastPower > 0 ? u.lastPower : 58;
      const { vx: ivx, vy: ivy } = computeShotVelocity(u.facingLeft, u.aimAngleDeg, previewPower);
      let px = u.facingLeft ? -PHYSICS.MUZZLE_OFFSET_X : PHYSICS.MUZZLE_OFFSET_X;
      let py = 0;
      let vx = ivx;
      let vy = ivy;
      const windScale = this.getHeroWindScale(u.hero);
      const isBoomerang = u.hero.weapon === 'boomerang' && !this.activeItemArmed;
      const previewSteps = isBoomerang ? 42 : 26;
      const turnDir = u.facingLeft ? 1 : -1;
      for (let step = 1; step <= previewSteps; step++) {
        px += vx;
        py += vy;
        if (isBoomerang) {
          vx += this.wind * PHYSICS.WIND_FACTOR * 0.35;
          if (step <= 14) {
            vy += PHYSICS.GRAVITY * 0.72;
          } else {
            vx += turnDir * 0.36;
            vy += PHYSICS.GRAVITY * 0.54 - 0.07;
          }
        } else {
          vx += this.wind * PHYSICS.WIND_FACTOR * windScale;
          vy += PHYSICS.GRAVITY;
        }
        if (step % 3 === 0) {
          ctx.fillStyle = this.powArmed
            ? `rgba(250, 204, 21, ${Math.max(0.18, 0.85 - step * 0.018)})`
            : isBoomerang
            ? `rgba(132, 204, 22, ${Math.max(0.22, 0.88 - step * 0.018)})`
            : `rgba(125, 211, 252, ${0.8 - step * 0.026})`;
          ctx.beginPath();
          ctx.arc(px, py, 2.1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }

  private drawProjectiles(ctx: CanvasRenderingContext2D): void {
    // Vẽ cột sét khổng lồ của Thor giáng từ bầu trời xuống vị trí cuối
    for (const beam of this.lightningBeams) {
      const alpha = Math.min(1, beam.ticksLeft / 12);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 10;
      ctx.shadowColor = '#60a5fa';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(beam.x, 0);
      for (let y = 24; y < beam.y; y += 26) {
        const jitter = (Math.random() - 0.5) * 26;
        ctx.lineTo(beam.x + jitter, y);
      }
      ctx.lineTo(beam.x, beam.y);
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.restore();
    }

    for (const p of this.projectiles) {
      // Hiệu ứng Laze Tam Giác Khúc Xạ qua Kim Cương của Apache!
      if (p.hoveringDiamond) {
        const owner = this.fighters.find((f) => f.id === p.ownerId);
        const ox = owner ? owner.x : p.x - 90;
        const oy = owner ? owner.y - 18 : p.y + 80;
        const tx = p.laserTargetX ?? p.x + 80;
        const ty = p.laserTargetY ?? p.y + 120;

        ctx.save();
        // Mảng sáng tam giác laze khúc xạ
        ctx.fillStyle = 'rgba(6, 182, 212, 0.16)';
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(p.x, p.y);
        ctx.lineTo(tx, ty);
        ctx.closePath();
        ctx.fill();

        // 3 cạnh tia laze tam giác rực sáng
        ctx.shadowColor = '#22d3ee';
        ctx.shadowBlur = 14;
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(p.x, p.y);
        ctx.lineTo(tx, ty);
        ctx.closePath();
        ctx.stroke();

        ctx.strokeStyle = '#f0f9ff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Tâm hội tụ laze ở điểm cuối
        const pulse = 8 + Math.sin(this.globalTick * 0.5) * 4;
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.arc(tx, ty, pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Hulk bật nhảy: thân hình Hulk đã bay theo tọa độ p.x, p.y nên chỉ vẽ hào quang xung kích xanh/đỏ quanh người Hulk
      if (p.special === 'hulk_leap') {
        ctx.save();
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.72)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y - 4, 22, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        continue;
      }

      for (let i = 0; i < p.trail.length; i++) {
        const pt = p.trail[i];
        const ratio = (i + 1) / p.trail.length;
        ctx.fillStyle =
          p.special === 'electric' || p.special === 'sky_lightning'
            ? `rgba(167, 139, 250, ${ratio * 0.48})`
            : p.special === 'hawkeye_giant_homing'
            ? `rgba(192, 132, 252, ${ratio * 0.7})`
            : p.special === 'teleport'
            ? `rgba(192, 132, 252, ${ratio * 0.5})`
            : `rgba(248, 250, 252, ${ratio * 0.36})`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 1.5 + ratio * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      const entry = this.assets.manifest.bullets[p.spriteKey];
      const img = entry ? this.assets.getImage(entry.url) : undefined;
      ctx.save();
      ctx.translate(p.x, p.y);
      if (p.crawling) {
        if ((p.crawlDir ?? 1) < 0) ctx.scale(-1, 1);
      } else if (p.spriteKey === 'gatruilong') {
        if (p.vx < 0) ctx.scale(-1, 1);
      } else {
        let rot: number;
        if (
          p.spriteKey === 'boomerang' ||
          p.spriteKey === 'banana' ||
          p.spriteKey === 'stormbreaker' ||
          p.special === 'shield_bounce'
        ) {
          rot = p.age * 0.42;
        } else if (p.hoveringDiamond) {
          rot = p.age * 0.12;
        } else if (
          p.spriteKey === 'muiten' ||
          p.spriteKey === 'muiten_cn' ||
          p.spriteKey === 'special' ||
          p.spriteKey === 'meteor' ||
          p.spriteKey === 'egg' ||
          p.spriteKey === 'rocket'
        ) {
          // Sprite gốc hướng thẳng đứng lên trên (12h) -> xoay thêm +PI/2 để đầu đạn luôn hướng về phía trước theo quỹ đạo bay
          rot = Math.atan2(p.vy, p.vx) + Math.PI / 2;
        } else if (p.spriteKey === 'digger') {
          // Mũi khoan trong daodat.png hướng thẳng đứng xuống dưới (6h) -> xoay -PI/2 để mũi khoan luôn hướng về trước
          rot = Math.atan2(p.vy, p.vx) - Math.PI / 2;
        } else if (p.spriteKey === 'bomb') {
          // Bom trong bomb.png chúc góc +45 độ (hướng xuống-phải) -> trừ PI/4 để đầu bom hướng theo quỹ đạo bay
          rot = Math.atan2(p.vy, p.vx) - Math.PI / 4;
        } else {
          rot = Math.atan2(p.vy, p.vx);
        }
        ctx.rotate(rot);
      }

      if (img) {
        const frames = entry.frames || 1;
        const fh = Math.floor(img.height / frames);
        const frame = Math.floor(p.age / 3) % frames;
        const sc = (p.scale ?? 1) * 0.58;
        const dw = img.width * sc;
        const dh = fh * sc;
        ctx.drawImage(img, 0, frame * fh, img.width, fh, -dw / 2, -dh / 2, dw, dh);
      } else {
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private drawWindParticles(ctx: CanvasRenderingContext2D): void {
    if (Math.abs(this.wind) < 2) return;
    ctx.save();
    for (const wp of this.windParticles) {
      ctx.strokeStyle = `rgba(226, 232, 240, ${wp.alpha})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(wp.x, wp.y);
      ctx.lineTo(wp.x + this.wind * 0.42, wp.y + 0.8);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawEffectsAndTexts(ctx: CanvasRenderingContext2D): void {
    for (const fx of this.effects) {
      const img = this.assets.getImage(fx.sprite.url);
      if (!img) continue;
      const frames = fx.sprite.frames || 5;
      const fh = Math.floor(img.height / frames);
      const frame = Math.min(frames - 1, Math.floor(fx.tick / fx.frameDuration));
      const dw = img.width * 0.85 * fx.scale;
      const dh = fh * 0.85 * fx.scale;
      ctx.drawImage(img, 0, frame * fh, img.width, fh, fx.x - dw / 2, fx.y - dh / 2, dw, dh);
    }

    for (const ft of this.floatingTexts) {
      const alpha = Math.min(1, ft.life / 20);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `900 ${Math.round(13 * ft.scale)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 3;
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }

  private drawEndBanner(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    stats: MatchStats
  ): void {
    const bannerUrl = stats.draw
      ? this.assets.manifest.ui.drawBanner
      : stats.won
      ? this.assets.manifest.ui.winBanner
      : this.assets.manifest.ui.loseBanner;
    const img = this.assets.getImage(bannerUrl);
    if (!img) return;
    ctx.save();
    ctx.fillStyle = 'rgba(2, 6, 23, 0.35)';
    ctx.fillRect(0, 0, w, h);
    const scale = 1.25;
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, w / 2 - dw / 2, h * 0.32 - dh / 2, dw, dh);
    ctx.restore();
  }

  private emitHud(): void {
    const modeLabel =
      this.setup.mode === 'online'
        ? `Solo Trực Tuyến 1v1`
        : this.setup.mode === 'campaign' && this.setup.stage
        ? this.setup.stage.name
        : `Đấu Bot ${this.setup.teamSize}v${this.setup.teamSize}`;
    this.onHudUpdate({
      phase: this.phase,
      activeUnit: this.getActiveUnit(),
      fighters: this.fighters,
      wind: this.wind,
      turnTimeLeft: Math.ceil(this.turnTimeLeft),
      chargePower:
        this.phase === 'charging' || this.phase === 'charging_2'
          ? Math.round(this.chargePower)
          : this.getActiveUnit()?.lastPower ?? 0,
      chargePower2: Math.round(this.chargePower2),
      powArmed: this.powArmed,
      activeItemArmed: this.activeItemArmed,
      doubleArmed: this.doubleArmed,
      hawkeyeGiantArmed: this.hawkeyeGiantArmed,
      turnNumber: this.turnNumber,
      mapName: this.map.name,
      modeLabel,
    });
  }
}
