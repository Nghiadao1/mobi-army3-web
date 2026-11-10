import './style.css';
import { ARENAS } from './data/arenas';
import { CLASSIC_HEROES, getHero, HEROES, MARVEL_HEROES } from './data/heroes';
import { GameEngine, type EngineSnapshot } from './engine/GameEngine';
import { applyBattleResult, loadProfile, saveProfile, xpForLevel } from './progression';
import type { ArenaDef, BattleResult, HeroDef, Profile } from './types';

class Army2WebApp {
  private root: HTMLElement;
  private profile: Profile = loadProfile();
  private selectedHero = getHero(this.profile.selectedHero);
  private selectedArena = ARENAS[0];
  private activeFaction: 'army2' | 'marvel' = this.selectedHero.faction;
  private engine: GameEngine | null = null;
  private snapshot: EngineSnapshot | null = null;
  private messageTimer = 0;

  constructor(root: HTMLElement) {
    this.root = root;
    this.renderLobby();
  }

  private renderLobby(): void {
    this.engine?.destroy();
    this.engine = null;
    const nextXp = xpForLevel(this.profile.level);
    this.root.innerHTML = `
      <main class="app-shell lobby-screen">
        <header class="topbar glass-panel">
          <button class="brand" data-action="home" aria-label="Trang chủ">
            <img src="assets/army2/ui/logoGame.png" alt="Army 2" />
            <span><strong>ARMY 2</strong><small>WEB REFORGED</small></span>
          </button>
          <div class="profile-strip">
            <div class="rank-badge">${this.profile.level}</div>
            <div class="profile-progress">
              <b>Chỉ huy Nghĩa</b>
              <span><i style="width:${Math.min(100, this.profile.xp / nextXp * 100)}%"></i></span>
              <small>${this.profile.xp}/${nextXp} XP</small>
            </div>
          </div>
          <div class="wallet"><span>🪙</span><b>${this.profile.coins.toLocaleString('vi-VN')}</b></div>
          <button class="icon-btn ${this.profile.music ? 'active' : ''}" data-action="music" aria-label="Bật tắt nhạc">♫</button>
        </header>

        <section class="hero-stage">
          <div class="stage-copy">
            <span class="eyebrow">BIG UPDATE • CLIENT LIBGDX → CANVAS WEB</span>
            <h1>${this.selectedHero.name}</h1>
            <p>${this.selectedHero.title}</p>
            <div class="hero-stats">
              ${this.stat('HP', this.selectedHero.hp, 1800)}
              ${this.stat('CÔNG', this.selectedHero.attack * this.selectedHero.shots, 400)}
              ${this.stat('GIÁP', this.selectedHero.armor, 30)}
              ${this.stat('CƠ ĐỘNG', this.selectedHero.move, 140)}
            </div>
            <div class="skill-card">
              <span>⚡ TUYỆT KỸ</span><b>${this.selectedHero.skillName}</b>
              <p>${this.selectedHero.skillDescription}</p>
            </div>
          </div>
          <div class="hero-showcase" style="--hero:${this.selectedHero.color};--accent:${this.selectedHero.accent}">
            <div class="energy-ring ring-a"></div><div class="energy-ring ring-b"></div>
            <div class="showcase-avatar ${this.selectedHero.faction}">
              <span class="cape"></span><span class="body"></span><span class="head"></span><span class="visor"></span><span class="weapon"></span><span class="core"></span>
            </div>
            <div class="platform"><span></span></div>
            <div class="faction-stamp">${this.selectedHero.faction === 'marvel' ? 'MARVEL SQUAD' : 'ARMY 2 CLASSIC'}</div>
          </div>
          <div class="mode-panel glass-panel">
            <div><span class="eyebrow">CHẾ ĐỘ</span><h2>Đấu Bot Chiến Thuật</h2><p>Vật lý góc–lực–gió, địa hình phá hủy, progression offline.</p></div>
            <div class="arena-select">
              <button class="arena-current" data-action="next-arena">
                <span class="arena-thumb" style="--sky:${this.selectedArena.sky[0]};--ground:${this.selectedArena.ground}"></span>
                <span><small>BẢN ĐỒ</small><b>${this.selectedArena.name}</b><em>${this.selectedArena.subtitle}</em></span>
                <strong>›</strong>
              </button>
              <div class="difficulty">Độ khó ${'◆'.repeat(this.selectedArena.difficulty)}${'◇'.repeat(3 - this.selectedArena.difficulty)}</div>
            </div>
            <button class="play-btn" data-action="play"><span>⚔</span><b>CHIẾN NGAY</b><small>NHẬN XP & XU</small></button>
          </div>
        </section>

        <section class="roster-panel glass-panel">
          <div class="roster-head">
            <div><span class="eyebrow">KHO VŨ KHÍ SỐNG</span><h2>Chọn chiến binh</h2></div>
            <div class="tabs">
              <button class="${this.activeFaction === 'army2' ? 'active' : ''}" data-faction="army2">10 Xạ thủ gốc</button>
              <button class="${this.activeFaction === 'marvel' ? 'active' : ''}" data-faction="marvel">17 Biệt đội Marvel</button>
            </div>
            <span class="roster-count">${this.activeFaction === 'army2' ? CLASSIC_HEROES.length : MARVEL_HEROES.length} TƯỚNG</span>
          </div>
          <div class="hero-grid">${this.renderHeroCards()}</div>
        </section>
        <footer><span>Army 2 Web Reforged • Offline-first</span><span>Thắng ${this.profile.wins} • Thua ${this.profile.losses}</span></footer>
      </main>`;
    this.bindLobby();
  }

  private stat(label: string, value: number, max: number): string {
    return `<div><span><b>${label}</b><em>${value}</em></span><i><u style="width:${Math.min(100, value / max * 100)}%"></u></i></div>`;
  }

  private renderHeroCards(): string {
    const heroes = this.activeFaction === 'army2' ? CLASSIC_HEROES : MARVEL_HEROES;
    return heroes.map((hero) => {
      const unlocked = this.profile.unlockedHeroes.includes(hero.id) || this.profile.level >= hero.unlockLevel;
      const selected = hero.id === this.selectedHero.id;
      return `<button class="hero-card ${selected ? 'selected' : ''} ${unlocked ? '' : 'locked'}" data-hero="${hero.id}" ${unlocked ? '' : 'disabled'} style="--hero:${hero.color};--accent:${hero.accent}">
        <span class="mini-avatar"><i></i><u></u><em></em></span>
        <span class="hero-card-copy"><b>${hero.name}</b><small>${hero.skillName}</small></span>
        ${unlocked ? `<span class="pattern">${this.patternIcon(hero.pattern)}</span>` : `<span class="lock">LV ${hero.unlockLevel}</span>`}
      </button>`;
    }).join('');
  }

  private patternIcon(pattern: HeroDef['pattern']): string {
    return ({ single: '●', burst: '•••', spread: '⌁', boomerang: '◒', laser: '━', cluster: '✣', lightning: 'ϟ', melee: '◆' })[pattern];
  }

  private bindLobby(): void {
    this.root.querySelectorAll<HTMLElement>('[data-hero]').forEach((button) => button.addEventListener('click', () => {
      this.selectedHero = getHero(button.dataset.hero ?? 'army-0');
      this.profile.selectedHero = this.selectedHero.id;
      saveProfile(this.profile);
      this.renderLobby();
    }));
    this.root.querySelectorAll<HTMLButtonElement>('[data-faction]').forEach((button) => button.addEventListener('click', () => {
      this.activeFaction = button.dataset.faction as 'army2' | 'marvel';
      this.renderLobby();
    }));
    this.onAction('next-arena', () => {
      this.selectedArena = ARENAS[(ARENAS.indexOf(this.selectedArena) + 1) % ARENAS.length];
      this.renderLobby();
    });
    this.onAction('music', () => { this.profile.music = !this.profile.music; saveProfile(this.profile); this.renderLobby(); });
    this.onAction('play', () => this.startBattle());
  }

  private onAction(action: string, handler: () => void): void {
    this.root.querySelector<HTMLElement>(`[data-action="${action}"]`)?.addEventListener('click', handler);
  }

  private startBattle(): void {
    const pool = HEROES.filter((hero) => hero.id !== this.selectedHero.id && (hero.faction === this.selectedHero.faction || this.selectedArena.difficulty === 3));
    const enemy = pool[(this.selectedArena.seed + this.profile.wins) % pool.length];
    this.root.innerHTML = `
      <main class="battle-screen">
        <canvas id="battle-canvas" aria-label="Chiến trường ${this.selectedArena.name}"></canvas>
        <header class="battle-top">
          <div class="combatant player"><span class="portrait" style="--hero:${this.selectedHero.color};--accent:${this.selectedHero.accent}"></span><div><b>${this.selectedHero.name}</b><span class="hp-track"><i data-hud="player-hp"></i></span><small data-hud="player-hp-text"></small></div></div>
          <div class="round-widget"><span data-hud="round">LƯỢT 1</span><b data-hud="timer">24</b><small data-hud="wind">GIÓ 0</small></div>
          <div class="combatant enemy"><div><b>${enemy.name}</b><span class="hp-track"><i data-hud="enemy-hp"></i></span><small data-hud="enemy-hp-text"></small></div><span class="portrait" style="--hero:${enemy.color};--accent:${enemy.accent}"></span></div>
        </header>
        <div class="battle-message" data-hud="message">Chuẩn bị chiến đấu</div>
        <button class="battle-exit" data-action="exit" aria-label="Thoát trận">☰</button>
        <div class="battle-controls">
          <div class="move-pad">
            <button data-control="left" aria-label="Đi trái">◀</button><button data-control="right" aria-label="Đi phải">▶</button>
          </div>
          <div class="aim-control">
            <button data-control="down">−</button><div><small>GÓC BẮN</small><b data-hud="angle">48°</b></div><button data-control="up">＋</button>
          </div>
          <label class="power-control"><span><small>LỰC BẮN</small><b data-hud="power">52</b></span><input data-control="power" type="range" min="5" max="100" value="52" /></label>
          <button class="skill-btn" data-control="skill"><span data-hud="rage">0%</span><b>⚡</b><small>NỘ</small></button>
          <button class="fire-btn" data-control="fire"><b>BẮN</b><span>SPACE</span></button>
        </div>
        <div class="key-hints">A/D di chuyển • W/S chỉnh góc • Kéo lực • Space bắn</div>
      </main>`;
    const canvas = this.root.querySelector<HTMLCanvasElement>('#battle-canvas')!;
    this.engine = new GameEngine(canvas, {
      playerHero: this.selectedHero, enemyHero: enemy, arena: this.selectedArena,
      onSnapshot: (snapshot) => this.updateBattleHud(snapshot),
      onMessage: (message, tone) => this.showBattleMessage(message, tone),
      onFinish: (result) => this.showResult(result), sfx: this.profile.sfx,
    });
    this.engine.startMusic(this.profile.music);
    this.bindBattle();
  }

  private bindBattle(): void {
    const hold = (selector: string, action: () => void) => {
      const button = this.root.querySelector<HTMLElement>(selector);
      if (!button) return;
      let timer = 0;
      const start = (event: Event) => { event.preventDefault(); action(); timer = window.setInterval(action, 85); };
      const stop = () => window.clearInterval(timer);
      button.addEventListener('pointerdown', start); button.addEventListener('pointerup', stop); button.addEventListener('pointercancel', stop); button.addEventListener('pointerleave', stop);
    };
    hold('[data-control="left"]', () => this.engine?.move(-1));
    hold('[data-control="right"]', () => this.engine?.move(1));
    hold('[data-control="up"]', () => this.engine?.adjustAngle(1));
    hold('[data-control="down"]', () => this.engine?.adjustAngle(-1));
    this.root.querySelector<HTMLInputElement>('[data-control="power"]')?.addEventListener('input', (event) => this.engine?.setPower(Number((event.target as HTMLInputElement).value)));
    this.root.querySelector('[data-control="fire"]')?.addEventListener('click', () => this.engine?.fire());
    this.root.querySelector('[data-control="skill"]')?.addEventListener('click', () => this.engine?.useSkill());
    this.onAction('exit', () => { if (window.confirm('Rời trận và tính là thất bại?')) this.finishAbandonedBattle(); });
    window.addEventListener('keydown', this.onKeyDown);
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (!this.engine) return;
    if (event.code === 'KeyA' || event.code === 'ArrowLeft') this.engine.move(-1);
    if (event.code === 'KeyD' || event.code === 'ArrowRight') this.engine.move(1);
    if (event.code === 'KeyW' || event.code === 'ArrowUp') this.engine.adjustAngle(1);
    if (event.code === 'KeyS' || event.code === 'ArrowDown') this.engine.adjustAngle(-1);
    if (event.code === 'Space') { event.preventDefault(); this.engine.fire(); }
  };

  private updateBattleHud(snapshot: EngineSnapshot): void {
    this.snapshot = snapshot;
    const set = (name: string, text: string) => { const element = this.root.querySelector<HTMLElement>(`[data-hud="${name}"]`); if (element) element.textContent = text; };
    const width = (name: string, value: number) => { const element = this.root.querySelector<HTMLElement>(`[data-hud="${name}"]`); if (element) element.style.width = `${Math.max(0, Math.min(100, value))}%`; };
    set('player-hp-text', `${snapshot.player.hp}/${snapshot.player.maxHp}`); set('enemy-hp-text', `${snapshot.enemy.hp}/${snapshot.enemy.maxHp}`);
    width('player-hp', snapshot.player.hp / snapshot.player.maxHp * 100); width('enemy-hp', snapshot.enemy.hp / snapshot.enemy.maxHp * 100);
    set('round', snapshot.turn === 'player' ? `LƯỢT ${snapshot.round} • BẠN` : `LƯỢT ${snapshot.round} • ĐỊCH`);
    set('timer', String(snapshot.turnSeconds)); set('wind', `GIÓ ${snapshot.wind > 0 ? '→' : snapshot.wind < 0 ? '←' : '•'} ${Math.abs(snapshot.wind)}`);
    set('angle', `${Math.round(snapshot.angle)}°`); set('power', String(Math.round(snapshot.power))); set('rage', `${Math.round(snapshot.player.power)}%`);
    this.root.querySelectorAll<HTMLButtonElement>('[data-control="fire"],[data-control="skill"]').forEach((button) => { button.disabled = !snapshot.canAct; });
  }

  private showBattleMessage(message: string, tone: 'good' | 'bad' | 'info' = 'info'): void {
    const element = this.root.querySelector<HTMLElement>('[data-hud="message"]');
    if (!element) return;
    element.textContent = message; element.dataset.tone = tone; element.classList.add('show');
    window.clearTimeout(this.messageTimer);
    this.messageTimer = window.setTimeout(() => element.classList.remove('show'), 2200);
  }

  private finishAbandonedBattle(): void {
    this.engine?.destroy(); window.removeEventListener('keydown', this.onKeyDown);
    const outcome = applyBattleResult(this.profile, { victory: false, coins: 0, xp: 0, heroId: this.selectedHero.id });
    this.profile = outcome.profile; this.renderLobby();
  }

  private showResult(result: BattleResult): void {
    window.removeEventListener('keydown', this.onKeyDown);
    const outcome = applyBattleResult(this.profile, result);
    this.profile = outcome.profile;
    this.root.insertAdjacentHTML('beforeend', `<div class="result-backdrop"><section class="result-card ${result.victory ? 'victory' : 'defeat'}">
      <span class="result-icon">${result.victory ? '🏆' : '⚔️'}</span><small>${result.victory ? 'NHIỆM VỤ HOÀN THÀNH' : 'TRẬN CHIẾN KẾT THÚC'}</small>
      <h2>${result.victory ? 'CHIẾN THẮNG' : 'THẤT BẠI'}</h2><p>${outcome.leveledUp ? `Thăng cấp ${this.profile.level}! Bạn nhận thêm 250 xu.` : 'Rèn luyện góc bắn và trở lại mạnh hơn.'}</p>
      <div class="rewards"><span><i>🪙</i><b>+${result.coins}</b><small>XU</small></span><span><i>✦</i><b>+${result.xp}</b><small>XP</small></span></div>
      <div><button data-result="again">ĐẤU LẠI</button><button data-result="lobby" class="primary">VỀ SẢNH</button></div>
    </section></div>`);
    this.root.querySelector('[data-result="again"]')?.addEventListener('click', () => this.startBattle());
    this.root.querySelector('[data-result="lobby"]')?.addEventListener('click', () => this.renderLobby());
  }
}

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Không tìm thấy #app');
new Army2WebApp(root);
