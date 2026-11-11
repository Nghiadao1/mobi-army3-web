import type { ArenaDef, BattleResult, Fighter, HeroDef, Projectile, ShotPattern } from '../types';
import { blastDamage, launchVelocity, solveShot, stepProjectile } from './physics';

interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number; }
interface FloatText { x: number; y: number; text: string; color: string; life: number; }
interface SpriteEffect { x: number; y: number; age: number; duration: number; scale: number; }

export interface EngineSnapshot {
  turn: 'player' | 'enemy'; player: Fighter; enemy: Fighter; wind: number;
  angle: number; power: number; canAct: boolean; turnSeconds: number; round: number;
}

export interface GameEngineOptions {
  playerHero: HeroDef; enemyHero: HeroDef; arena: ArenaDef;
  onSnapshot: (snapshot: EngineSnapshot) => void;
  onMessage: (message: string, tone?: 'good' | 'bad' | 'info') => void;
  onFinish: (result: BattleResult) => void;
  sfx: boolean;
}

const WORLD_W = 1280;
const WORLD_H = 720;
const TURN_TIME = 24;

export class GameEngine {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly canvas: HTMLCanvasElement;
  private readonly opts: GameEngineOptions;
  private terrain = new Float32Array(WORLD_W);
  private fighters: Fighter[] = [];
  private projectiles: Projectile[] = [];
  private particles: Particle[] = [];
  private texts: FloatText[] = [];
  private spriteEffects: SpriteEffect[] = [];
  private projectileSprites = new Map<ShotPattern, HTMLImageElement>();
  private explosionSprite: HTMLImageElement | null = null;
  private running = true;
  private lastTime = performance.now();
  private turn: 'player' | 'enemy' = 'player';
  private wind = 0;
  private power = 52;
  private round = 1;
  private canAct = true;
  private turnLeft = TURN_TIME;
  private pendingTurn = 0;
  private shake = 0;
  private flash = 0;
  private snapshotClock = 0;
  private bgImage: HTMLImageElement | null = null;
  private audio: HTMLAudioElement | null = null;

  constructor(canvas: HTMLCanvasElement, options: GameEngineOptions) {
    this.canvas = canvas;
    this.opts = options;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Trình duyệt không hỗ trợ Canvas 2D');
    this.ctx = context;
    canvas.width = WORLD_W;
    canvas.height = WORLD_H;
    this.generateTerrain(options.arena.seed);
    this.fighters = [
      this.createFighter(1, options.playerHero, 'player', 365, 1),
      this.createFighter(2, options.enemyHero, 'enemy', WORLD_W - 365, -1),
    ];
    this.loadCombatSprites();
    this.loadBackground();
    this.newWind();
    this.opts.onMessage(`${options.playerHero.name} đối đầu ${options.enemyHero.name}`, 'info');
    this.emitSnapshot();
    requestAnimationFrame(this.loop);
  }

  private createFighter(id: number, hero: HeroDef, team: 'player' | 'enemy', x: number, facing: 1 | -1): Fighter {
    return {
      id, hero, team, x, y: this.groundAt(x) - 23, vx: 0, vy: 0,
      hp: hero.hp, maxHp: hero.hp, angle: 48, facing, shield: hero.passive === 'shield' ? 180 : 0,
      power: 0, marked: false, frozenTurns: 0, alive: true,
    };
  }

  private loadBackground(): void {
    const choices = ['back1.png', 'back3.png', 'back7.png', 'back11.png', 'rungRam.png', 'map_spider_layout.png'];
    const image = new Image();
    image.src = `assets/army2/backgrounds/${choices[this.opts.arena.seed % choices.length]}`;
    image.onload = () => { this.bgImage = image; };
  }

  private loadCombatSprites(): void {
    const files: Record<ShotPattern, string> = {
      single: 'cannon.png', burst: 'dan.png', spread: 'rocket2.png',
      boomerang: 'boomerang-big.png', laser: 'laser.png', cluster: 'grenade.png',
      lightning: 'specialbullet.png', melee: 'thienthach.png',
    };
    for (const [pattern, file] of Object.entries(files) as Array<[ShotPattern, string]>) {
      const image = new Image();
      image.src = `assets/army2/projectiles/${file}`;
      image.onload = () => this.projectileSprites.set(pattern, image);
    }
    const explosion = new Image();
    explosion.src = 'assets/army2/effects/Eff.png';
    explosion.onload = () => { this.explosionSprite = explosion; };
  }

  private generateTerrain(seed: number): void {
    const random = this.seeded(seed);
    const phaseA = random() * Math.PI * 2;
    const phaseB = random() * Math.PI * 2;
    for (let x = 0; x < WORLD_W; x++) {
      const normalized = x / WORLD_W;
      let y = 505 + Math.sin(normalized * Math.PI * 3.2 + phaseA) * 48;
      y += Math.sin(normalized * Math.PI * 8 + phaseB) * 24;
      y += (random() - 0.5) * 7;
      if (this.opts.arena.id === 'frozen-bridge' && x > 490 && x < 790) y = 485;
      if (this.opts.arena.id === 'spider-cave' && x > 570 && x < 710) y = 650;
      this.terrain[x] = Math.max(360, Math.min(620, y));
    }
    this.smoothTerrain(5);
  }

  private seeded(seed: number): () => number {
    let state = seed >>> 0;
    return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
  }

  private smoothTerrain(rounds: number): void {
    for (let pass = 0; pass < rounds; pass++) {
      const next = this.terrain.slice();
      for (let x = 2; x < WORLD_W - 2; x++) next[x] = (this.terrain[x - 2] + this.terrain[x - 1] + this.terrain[x] * 2 + this.terrain[x + 1] + this.terrain[x + 2]) / 6;
      this.terrain = next;
    }
  }

  private groundAt(x: number): number {
    return this.terrain[Math.max(0, Math.min(WORLD_W - 1, Math.round(x)))] ?? WORLD_H;
  }

  setPower(value: number): void {
    this.power = Math.max(5, Math.min(100, value));
    this.emitSnapshot();
  }

  adjustAngle(delta: number): void {
    const player = this.fighters[0];
    if (!this.canPlayerAct()) return;
    player.angle = Math.max(5, Math.min(85, player.angle + delta));
    this.emitSnapshot();
  }

  move(direction: -1 | 1): void {
    const fighter = this.fighters[0];
    if (!this.canPlayerAct()) return;
    const distance = fighter.hero.passive === 'fly' ? 18 : 12;
    const nextX = Math.max(32, Math.min(WORLD_W - 32, fighter.x + direction * distance));
    fighter.x = nextX;
    fighter.facing = direction;
    fighter.y = fighter.hero.passive === 'fly' ? Math.min(fighter.y, this.groundAt(nextX) - 72) : this.groundAt(nextX) - 23;
    this.emitSnapshot();
  }

  fire(): void {
    if (!this.canPlayerAct()) return;
    this.launch(this.fighters[0], this.power);
  }

  useSkill(): void {
    if (!this.canPlayerAct()) return;
    const fighter = this.fighters[0];
    if (fighter.power < 100) {
      this.opts.onMessage(`Nộ khí mới đạt ${Math.round(fighter.power)}%`, 'bad');
      return;
    }
    fighter.power = 0;
    this.launch(fighter, Math.min(100, this.power + 14), true);
  }

  private canPlayerAct(): boolean { return this.running && this.turn === 'player' && this.canAct && this.projectiles.length === 0; }

  private launch(fighter: Fighter, power: number, skill = false): void {
    this.canAct = false;
    const hero = fighter.hero;
    const count = skill ? Math.max(hero.shots + 2, 3) : hero.shots;
    const base = launchVelocity(fighter.angle, power, fighter.facing);
    const pattern: ShotPattern = skill && hero.pattern === 'single' ? 'spread' : hero.pattern;
    for (let index = 0; index < count; index++) {
      const centered = index - (count - 1) / 2;
      const spread = pattern === 'spread' || pattern === 'lightning' || pattern === 'cluster' ? centered * 0.075 : centered * 0.018;
      const speedScale = pattern === 'burst' ? 1 - index * 0.035 : 1;
      const damage = hero.attack * (skill ? 1.36 : 1);
      const projectile: Projectile = {
        x: fighter.x + fighter.facing * 22, y: fighter.y - 12,
        vx: (base.x * Math.cos(spread) - base.y * Math.sin(spread)) * speedScale,
        vy: (base.x * Math.sin(spread) + base.y * Math.cos(spread)) * speedScale,
        ownerId: fighter.id, damage, radius: hero.blast + (skill ? 10 : 0),
        color: skill ? '#fff27a' : hero.accent, pattern, age: -index * 0.08,
        maxAge: pattern === 'laser' ? 1.7 : 6, pierce: hero.passive === 'pierce' || pattern === 'laser',
      };
      this.projectiles.push(projectile);
    }
    this.playTone(220, 0.08, 'square');
    this.opts.onMessage(skill ? `${hero.skillName}!` : `${fighter.team === 'player' ? 'Bạn' : hero.name} khai hỏa`, fighter.team === 'player' ? 'good' : 'bad');
    this.emitSnapshot();
  }

  private loop = (now: number): void => {
    if (!this.running) return;
    const dt = Math.min(0.033, Math.max(0.001, (now - this.lastTime) / 1000));
    this.lastTime = now;
    this.update(dt);
    this.render();
    requestAnimationFrame(this.loop);
  };

  private update(dt: number): void {
    this.snapshotClock += dt;
    if (this.snapshotClock >= 0.25) { this.snapshotClock = 0; this.emitSnapshot(); }
    if (this.canAct) {
      this.turnLeft -= dt;
      if (this.turnLeft <= 0) {
        if (this.turn === 'player') this.opts.onMessage('Hết thời gian — tự động bắn!', 'bad');
        const active = this.turn === 'player' ? this.fighters[0] : this.fighters[1];
        this.launch(active, this.turn === 'player' ? this.power : 50);
      }
    }

    for (const projectile of [...this.projectiles]) this.updateProjectile(projectile, dt);
    this.projectiles = this.projectiles.filter((projectile) => projectile.age < projectile.maxAge);

    for (const particle of this.particles) {
      particle.life -= dt; particle.vy += 220 * dt; particle.x += particle.vx * dt; particle.y += particle.vy * dt;
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);
    for (const text of this.texts) { text.life -= dt; text.y -= 34 * dt; }
    this.texts = this.texts.filter((text) => text.life > 0);
    for (const effect of this.spriteEffects) effect.age += dt;
    this.spriteEffects = this.spriteEffects.filter((effect) => effect.age < effect.duration);
    this.shake = Math.max(0, this.shake - dt * 20);
    this.flash = Math.max(0, this.flash - dt * 3.5);

    for (const fighter of this.fighters) {
      if (fighter.hero.passive !== 'fly') fighter.y = Math.min(this.groundAt(fighter.x) - 23, fighter.y + 180 * dt);
    }

    if (!this.canAct && this.projectiles.length === 0) {
      this.pendingTurn += dt;
      if (this.pendingTurn > 1.15) this.nextTurn();
    }
  }

  private updateProjectile(projectile: Projectile, dt: number): void {
    projectile.age += dt;
    if (projectile.age < 0) return;
    if (projectile.pattern === 'laser') {
      projectile.x += projectile.vx * dt * 1.8;
      projectile.y += projectile.vy * dt * 1.8;
    } else {
      const stepped = stepProjectile(projectile, projectile, this.wind, dt);
      projectile.x = stepped.position.x; projectile.y = stepped.position.y;
      projectile.vx = stepped.velocity.x; projectile.vy = stepped.velocity.y;
      if (projectile.pattern === 'boomerang' && projectile.age > 0.8) projectile.vx *= 1 - dt * 1.8;
    }

    this.particles.push({ x: projectile.x, y: projectile.y, vx: -projectile.vx * 0.03, vy: -projectile.vy * 0.03, life: 0.24, maxLife: 0.24, color: projectile.color, size: 3 });
    const owner = this.fighters.find((fighter) => fighter.id === projectile.ownerId);
    for (const fighter of this.fighters) {
      if (!fighter.alive || fighter.id === projectile.ownerId || !owner || fighter.team === owner.team) continue;
      if (Math.hypot(projectile.x - fighter.x, projectile.y - (fighter.y - 10)) < 24) {
        this.explode(projectile, fighter);
        if (!projectile.pierce) projectile.age = projectile.maxAge;
        else projectile.damage *= 0.55;
        return;
      }
    }
    const outside = projectile.x < -80 || projectile.x > WORLD_W + 80 || projectile.y > WORLD_H + 60;
    const terrainHit = !projectile.pierce && projectile.x >= 0 && projectile.x < WORLD_W && projectile.y >= this.groundAt(projectile.x);
    if (terrainHit || outside) {
      if (!outside) this.explode(projectile);
      projectile.age = projectile.maxAge;
    }
  }

  private explode(projectile: Projectile, direct?: Fighter): void {
    this.shake = Math.min(14, 5 + projectile.radius / 8);
    this.flash = 0.55;
    this.playTone(72, 0.16, 'sawtooth');
    this.spriteEffects.push({ x: projectile.x, y: projectile.y, age: 0, duration: 0.42, scale: Math.max(1, projectile.radius / 34) });
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 35 + Math.random() * 190;
      this.particles.push({ x: projectile.x, y: projectile.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 50, life: 0.45 + Math.random() * 0.6, maxLife: 1, color: i % 3 ? projectile.color : '#ffffff', size: 2 + Math.random() * 6 });
    }
    this.crater(projectile.x, projectile.radius * 0.78);
    for (const fighter of this.fighters) {
      if (!fighter.alive) continue;
      const distance = Math.hypot(projectile.x - fighter.x, projectile.y - fighter.y);
      let damage = blastDamage(projectile.damage, distance, projectile.radius, fighter.hero.armor);
      if (direct?.id === fighter.id) damage = Math.max(damage, Math.round(projectile.damage * 0.72));
      if (fighter.marked) damage = Math.round(damage * 1.2);
      if (fighter.shield > 0 && damage > 0) {
        const absorbed = Math.min(fighter.shield, damage);
        fighter.shield -= absorbed; damage -= absorbed;
        this.texts.push({ x: fighter.x, y: fighter.y - 50, text: `KHIÊN -${absorbed}`, color: '#67e8f9', life: 1.1 });
      }
      if (damage <= 0) continue;
      fighter.hp = Math.max(0, fighter.hp - damage);
      fighter.power = Math.min(100, fighter.power + Math.max(10, damage / 9));
      this.texts.push({ x: fighter.x, y: fighter.y - 34, text: `-${damage}`, color: '#fff3a3', life: 1.2 });
      const owner = this.fighters.find((candidate) => candidate.id === projectile.ownerId);
      if (owner?.hero.passive === 'mark') fighter.marked = true;
      if (owner?.hero.passive === 'freeze' && Math.random() < 0.28) fighter.frozenTurns = 1;
      if (fighter.hp <= 0) { fighter.alive = false; this.finish(owner?.team === 'player'); }
    }
    if (projectile.pattern === 'lightning') this.lightning(projectile.x, projectile.y, projectile.damage * 0.28, projectile.ownerId);
  }

  private lightning(x: number, y: number, damage: number, ownerId: number): void {
    for (const offset of [-55, 0, 55]) {
      for (let segment = 0; segment < 12; segment++) this.particles.push({ x: x + offset + (Math.random() - 0.5) * 18, y: y - segment * 34, vx: 0, vy: 0, life: 0.32, maxLife: 0.32, color: '#dff8ff', size: 5 });
    }
    const owner = this.fighters.find((fighter) => fighter.id === ownerId);
    for (const fighter of this.fighters) {
      if (fighter.team === owner?.team || Math.abs(fighter.x - x) > 85 || !fighter.alive) continue;
      const actual = Math.round(damage * (100 / (100 + fighter.hero.armor)));
      fighter.hp = Math.max(0, fighter.hp - actual);
      this.texts.push({ x: fighter.x, y: fighter.y - 50, text: `⚡ -${actual}`, color: '#dff8ff', life: 1.1 });
      if (fighter.hp <= 0) { fighter.alive = false; this.finish(owner?.team === 'player'); }
    }
  }

  private crater(cx: number, radius: number): void {
    const minX = Math.max(0, Math.floor(cx - radius));
    const maxX = Math.min(WORLD_W - 1, Math.ceil(cx + radius));
    for (let x = minX; x <= maxX; x++) {
      const dx = x - cx;
      const depth = Math.sqrt(Math.max(0, radius * radius - dx * dx)) * 0.72;
      this.terrain[x] = Math.min(WORLD_H - 12, this.terrain[x] + depth);
    }
  }

  private nextTurn(): void {
    if (!this.running) return;
    this.pendingTurn = 0;
    this.turn = this.turn === 'player' ? 'enemy' : 'player';
    if (this.turn === 'player') this.round++;
    this.canAct = true;
    this.turnLeft = TURN_TIME;
    this.newWind();
    const active = this.turn === 'player' ? this.fighters[0] : this.fighters[1];
    if (active.frozenTurns > 0) {
      active.frozenTurns--;
      this.opts.onMessage(`${active.hero.name} bị đóng băng và mất lượt!`, 'bad');
      this.canAct = false;
      this.pendingTurn = 0.5;
    } else if (this.turn === 'enemy') {
      window.setTimeout(() => this.aiTurn(), 650);
    } else {
      this.opts.onMessage(`Lượt ${this.round} — đến lượt bạn`, 'good');
    }
    this.emitSnapshot();
  }

  private aiTurn(): void {
    if (!this.running || this.turn !== 'enemy' || !this.canAct) return;
    const enemy = this.fighters[1];
    const player = this.fighters[0];
    enemy.facing = player.x >= enemy.x ? 1 : -1;
    const solution = solveShot(player.x - enemy.x, player.y - enemy.y, this.wind);
    enemy.angle = Math.max(8, Math.min(84, solution.angle + (Math.random() - 0.5) * (11 - this.opts.arena.difficulty * 2)));
    this.launch(enemy, Math.max(20, Math.min(100, solution.power + (Math.random() - 0.5) * 8)));
  }

  private newWind(): void { this.wind = Math.round((Math.random() * 16 - 8) * 10) / 10; }

  private finish(victory = false): void {
    if (!this.running) return;
    this.running = false;
    const coins = victory ? 190 + this.opts.arena.difficulty * 70 : 55;
    const xp = victory ? 150 + this.opts.arena.difficulty * 45 : 45;
    window.setTimeout(() => this.opts.onFinish({ victory, coins, xp, heroId: this.opts.playerHero.id }), 900);
    this.render();
  }

  private emitSnapshot(): void {
    this.opts.onSnapshot({ turn: this.turn, player: this.fighters[0], enemy: this.fighters[1], wind: this.wind, angle: this.fighters[0].angle, power: this.power, canAct: this.canPlayerAct(), turnSeconds: Math.ceil(this.turnLeft), round: this.round });
  }

  private playTone(frequency: number, duration: number, type: OscillatorType): void {
    if (!this.opts.sfx) return;
    try {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.08, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
      oscillator.connect(gain).connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + duration);
    } catch { /* WebAudio may be locked before user interaction. */ }
  }

  startMusic(enabled: boolean): void {
    if (!enabled) return;
    this.audio = new Audio('assets/army2/audio/theme.mp3');
    this.audio.loop = true; this.audio.volume = 0.24;
    void this.audio.play().catch(() => undefined);
  }

  destroy(): void { this.running = false; this.audio?.pause(); }

  private render(): void {
    const ctx = this.ctx;
    ctx.save();
    const sx = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    const sy = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    ctx.translate(sx, sy);
    const gradient = ctx.createLinearGradient(0, 0, 0, WORLD_H);
    gradient.addColorStop(0, this.opts.arena.sky[0]); gradient.addColorStop(0.75, this.opts.arena.sky[1]);
    ctx.fillStyle = gradient; ctx.fillRect(-20, -20, WORLD_W + 40, WORLD_H + 40);
    this.drawBackdrop(ctx);
    this.drawTerrain(ctx);
    this.drawAim(ctx);
    for (const fighter of this.fighters) this.drawFighter(ctx, fighter);
    for (const projectile of this.projectiles) if (projectile.age >= 0) this.drawProjectile(ctx, projectile);
    for (const particle of this.particles) {
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.color; ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const effect of this.spriteEffects) this.drawSpriteEffect(ctx, effect);
    for (const text of this.texts) {
      ctx.globalAlpha = Math.min(1, text.life * 1.5); ctx.fillStyle = text.color;
      ctx.font = '900 24px system-ui'; ctx.textAlign = 'center'; ctx.strokeStyle = '#111827'; ctx.lineWidth = 5;
      ctx.strokeText(text.text, text.x, text.y); ctx.fillText(text.text, text.x, text.y);
    }
    ctx.globalAlpha = 1;
    if (this.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.25})`; ctx.fillRect(0, 0, WORLD_W, WORLD_H); }
    ctx.restore();
  }

  private drawBackdrop(ctx: CanvasRenderingContext2D): void {
    if (this.bgImage) {
      ctx.globalAlpha = 0.24;
      const scale = Math.max(WORLD_W / this.bgImage.width, WORLD_H / this.bgImage.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.bgImage, 0, WORLD_H - this.bgImage.height * scale, this.bgImage.width * scale, this.bgImage.height * scale);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    for (let i = 0; i < 7; i++) {
      const x = (i * 227 + this.opts.arena.seed * 11) % WORLD_W;
      const y = 95 + (i % 3) * 52;
      ctx.beginPath(); ctx.ellipse(x, y, 65, 18, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  private drawTerrain(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath(); ctx.moveTo(0, WORLD_H);
    for (let x = 0; x < WORLD_W; x += 2) ctx.lineTo(x, this.terrain[x]);
    ctx.lineTo(WORLD_W, WORLD_H); ctx.closePath();
    const gradient = ctx.createLinearGradient(0, 380, 0, WORLD_H);
    gradient.addColorStop(0, this.opts.arena.ground); gradient.addColorStop(0.15, '#4a3727'); gradient.addColorStop(1, '#15100d');
    ctx.fillStyle = gradient; ctx.fill();
    ctx.strokeStyle = this.opts.arena.accent; ctx.globalAlpha = 0.75; ctx.lineWidth = 4;
    ctx.beginPath();
    for (let x = 0; x < WORLD_W; x += 3) x === 0 ? ctx.moveTo(x, this.terrain[x]) : ctx.lineTo(x, this.terrain[x]);
    ctx.stroke(); ctx.globalAlpha = 1;
  }

  private drawAim(ctx: CanvasRenderingContext2D): void {
    if (!this.canPlayerAct()) return;
    const fighter = this.fighters[0];
    const velocity = launchVelocity(fighter.angle, this.power, fighter.facing);
    let pos = { x: fighter.x + fighter.facing * 22, y: fighter.y - 12 };
    let vel = { ...velocity };
    ctx.fillStyle = 'rgba(255,255,255,.72)';
    for (let i = 0; i < 22; i++) {
      const step = stepProjectile(pos, vel, this.wind, 0.09);
      pos = step.position; vel = step.velocity;
      if (i % 2 === 0) { ctx.beginPath(); ctx.arc(pos.x, pos.y, Math.max(1.5, 4 - i * 0.1), 0, Math.PI * 2); ctx.fill(); }
      if (pos.y > this.groundAt(pos.x) || pos.x < 0 || pos.x > WORLD_W) break;
    }
  }

  private drawFighter(ctx: CanvasRenderingContext2D, fighter: Fighter): void {
    if (!fighter.alive) return;
    const x = fighter.x, y = fighter.y;
    ctx.save(); ctx.translate(x, y); ctx.scale(fighter.facing, 1);
    if (fighter.shield > 0) {
      ctx.strokeStyle = 'rgba(103,232,249,.8)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, -12, 31, 0, Math.PI * 2); ctx.stroke();
    }
    if (fighter.marked) { ctx.fillStyle = '#ef4444'; ctx.font = '900 18px system-ui'; ctx.textAlign = 'center'; ctx.fillText('⌖', 0, -53); }
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, 4, 23, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = fighter.hero.color; ctx.fillRect(-13, -25, 26, 26);
    ctx.beginPath(); ctx.arc(0, -34, 15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = fighter.hero.accent; ctx.fillRect(-11, -38, 22, 8);
    ctx.fillRect(8, -22, 22, 7);
    ctx.fillStyle = '#f8fafc'; ctx.fillRect(5, -36, 4, 3);
    if (fighter.hero.id.includes('captain')) { ctx.fillStyle = fighter.hero.accent; ctx.beginPath(); ctx.arc(-17, -17, 10, 0, Math.PI * 2); ctx.fill(); }
    if (fighter.hero.id.includes('ironman')) { ctx.fillStyle = '#67e8f9'; ctx.beginPath(); ctx.arc(0, -15, 5, 0, Math.PI * 2); ctx.fill(); }
    if (fighter.hero.id.includes('thor')) { ctx.fillStyle = '#e2e8f0'; ctx.fillRect(20, -20, 10, 12); }
    ctx.restore();
    const barW = 72;
    ctx.fillStyle = 'rgba(10,15,25,.8)'; ctx.fillRect(x - barW / 2, y - 66, barW, 9);
    ctx.fillStyle = fighter.hp / fighter.maxHp < 0.3 ? '#ef4444' : '#22c55e'; ctx.fillRect(x - barW / 2 + 2, y - 64, (barW - 4) * fighter.hp / fighter.maxHp, 5);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '700 13px system-ui'; ctx.fillText(fighter.hero.name, x, y - 74);
  }

  private drawProjectile(ctx: CanvasRenderingContext2D, projectile: Projectile): void {
    ctx.save(); ctx.translate(projectile.x, projectile.y); ctx.rotate(Math.atan2(projectile.vy, projectile.vx));
    ctx.shadowColor = projectile.color; ctx.shadowBlur = 14; ctx.fillStyle = projectile.color;
    const sprite = this.projectileSprites.get(projectile.pattern);
    if (sprite) {
      const frameHeight = sprite.height >= sprite.width * 2 ? sprite.width : sprite.height;
      const frameCount = Math.max(1, Math.floor(sprite.height / frameHeight));
      const frame = Math.floor(Math.max(0, projectile.age) * 12) % frameCount;
      const scale = projectile.pattern === 'melee' ? 1.35 : projectile.pattern === 'laser' ? 1.1 : 1.25;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sprite, 0, frame * frameHeight, sprite.width, frameHeight, -sprite.width * scale / 2, -frameHeight * scale / 2, sprite.width * scale, frameHeight * scale);
    } else if (projectile.pattern === 'laser') ctx.fillRect(-18, -3, 38, 6);
    else { ctx.beginPath(); ctx.arc(0, 0, projectile.pattern === 'melee' ? 9 : 6, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  private drawSpriteEffect(ctx: CanvasRenderingContext2D, effect: SpriteEffect): void {
    if (!this.explosionSprite) return;
    const frameSize = this.explosionSprite.width;
    const frameCount = Math.max(1, Math.floor(this.explosionSprite.height / frameSize));
    const frame = Math.min(frameCount - 1, Math.floor(effect.age / effect.duration * frameCount));
    const size = frameSize * effect.scale;
    ctx.save();
    ctx.globalAlpha = Math.min(1, (effect.duration - effect.age) * 5);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.explosionSprite, 0, frame * frameSize, frameSize, frameSize, effect.x - size / 2, effect.y - size / 2, size, size);
    ctx.restore();
  }
}
