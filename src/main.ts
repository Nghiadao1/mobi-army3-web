import './style.css';
import { AssetManager } from './assets/AssetManager';
import { sound } from './audio/SoundEngine';
import { BATTLE_ITEMS, BOSS_HUNT_STAGES, CAMPAIGN_STAGES, getHeroById, HEROES } from './data/gameContent';
import { BattleEngine, HudSnapshot } from './engine/BattleEngine';
import { CharacterRenderer } from './engine/CharacterRenderer';
import { OnlineManager, OnlinePacket } from './network/OnlineManager';
import { BattleItemId, BattleSetup, BotDifficulty, CampaignStage, MatchStats } from './types';

const STORAGE_STAGE_KEY = 'mobiarmy3_offline_unlocked_stage_v1';
const STORAGE_ITEMS_KEY = 'mobiarmy3_selected_items_v1';

class GameApp {
  private readonly canvas = document.getElementById('battle-canvas') as HTMLCanvasElement;
  private readonly uiRoot = document.getElementById('ui-root') as HTMLDivElement;
  private readonly assets = new AssetManager();
  private readonly online = new OnlineManager();
  private previewRenderer!: CharacterRenderer;

  private battle: BattleEngine | null = null;

  // Trạng thái chọn ở Sảnh Chính
  private activeTab: 'campaign' | 'boss_hunt' | 'skirmish' | 'online' | 'guide' = 'campaign';
  private selectedHeroId = 'gunner';
  private selectedAllyHeroId = 'captain';
  private selectedTeamSize: 1 | 2 = 1;
  private selectedMapId = 11;
  private selectedDifficulty: BotDifficulty = 'normal';
  private unlockedStage = 1;
  private selectedItems: BattleItemId[] = ['heal', 'teleport', 'double', 'mouse', 'shield', 'freeze'];

  // Trạng thái phòng Solo Trực Tuyến (1v1 Online)
  private onlineStatusText = 'Chưa kết nối phòng. Hãy Tạo Phòng mới hoặc nhập Mã Phòng 4 số để Solo 1v1!';
  private onlineRemoteHeroId = 'ironman';

  // Tham chiếu DOM HUD để cập nhật mượt mà không render lại toàn bộ DOM
  private hudRefs: {
    windVal: HTMLElement;
    timerVal: HTMLElement;
    turnInfo: HTMLElement;
    angleVal: HTMLElement;
    flyBox: HTMLElement;
    powerFill: HTMLElement;
    lastPowerMark: HTMLElement;
    powerLabel: HTMLElement;
    power2Track: HTMLElement;
    power2Fill: HTMLElement;
    power2Label: HTMLElement;
    hpFill: HTMLElement;
    hpText: HTMLElement;
    staminaFill: HTMLElement;
    staminaText: HTMLElement;
    powFill: HTMLElement;
    powText: HTMLElement;
    powBtn: HTMLButtonElement;
    fireBtn: HTMLButtonElement;
    itemBtns: Map<BattleItemId, { btn: HTMLButtonElement; countEl: HTMLElement }>;
  } | null = null;

  public async boot(): Promise<void> {
    this.unlockedStage = Math.max(
      1,
      parseInt(localStorage.getItem(STORAGE_STAGE_KEY) || '1', 10) || 1
    );

    const savedItems = localStorage.getItem(STORAGE_ITEMS_KEY);
    if (savedItems) {
      try {
        const parsed = JSON.parse(savedItems);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.selectedItems = parsed.slice(0, 6);
        }
      } catch {}
    }

    this.setupOnlineCallbacks();

    this.renderLoading(0, 'Đang khởi động khung game...');
    try {
      await this.assets.initCore((pct, label) => this.renderLoading(pct, label));
      this.previewRenderer = new CharacterRenderer(this.assets);
      if (this.assets.maps.length > 0) {
        this.selectedMapId = this.assets.maps[0].mapId;
      }
      this.bindGlobalKeyboard();

      // Kiểm tra nếu người chơi mở bằng Link mời ?room=XXXX
      const urlParams = new URLSearchParams(window.location.search);
      const roomParam = urlParams.get('room');
      if (roomParam) {
        this.activeTab = 'online';
        this.renderLobby();
        this.online.joinRoom(roomParam).catch(() => {});
      } else {
        this.renderLobby();
      }
    } catch (err) {
      this.uiRoot.innerHTML = `
        <div class="screen-overlay">
          <div class="panel-card" style="max-width:520px;margin:auto;text-align:center">
            <h2>Lỗi nạp tài nguyên</h2>
            <p style="color:#fca5a5">${String(err)}</p>
          </div>
        </div>
      `;
    }
  }

  private setupOnlineCallbacks(): void {
    this.online.onStatusChange = (status, connected) => {
      this.onlineStatusText = status;
      if (connected) {
        if (this.online.role === 'host') {
          this.broadcastLobbySync();
        } else {
          this.online.send({
            type: 'guest_select',
            guestHeroId: this.selectedHeroId,
            guestName: 'Khách',
          });
        }
      }
      if (!this.battle && this.activeTab === 'online') {
        this.renderLobby();
      }
    };

    this.online.onPacket = (packet: OnlinePacket) => {
      switch (packet.type) {
        case 'lobby_sync': {
          this.onlineRemoteHeroId = packet.hostHeroId;
          this.selectedMapId = packet.mapId;
          if (!this.battle && this.activeTab === 'online') {
            this.renderLobby();
          }
          break;
        }
        case 'guest_select': {
          this.onlineRemoteHeroId = packet.guestHeroId;
          if (this.online.role === 'host') {
            this.broadcastLobbySync();
          }
          if (!this.battle && this.activeTab === 'online') {
            this.renderLobby();
          }
          break;
        }
        case 'start_match': {
          sound.playPow();
          const isHost = this.online.role === 'host';
          this.launchBattle({
            mode: 'online',
            onlineRole: isHost ? 'host' : 'guest',
            playerHeroId: isHost ? packet.hostHeroId : packet.guestHeroId,
            remoteHeroId: isHost ? packet.guestHeroId : packet.hostHeroId,
            teamSize: 1,
            mapId: packet.mapId,
            difficulty: 'normal',
            seed: packet.seed,
          });
          break;
        }
        case 'battle_action': {
          this.battle?.applyOnlineAction(packet.payload);
          break;
        }
      }
    };

    this.online.onDisconnect = () => {
      if (!this.battle && this.activeTab === 'online') {
        this.renderLobby();
      }
    };
  }

  private broadcastLobbySync(): void {
    if (this.online.role === 'host' && this.online.isConnected) {
      this.online.send({
        type: 'lobby_sync',
        hostHeroId: this.selectedHeroId,
        guestHeroId: this.onlineRemoteHeroId,
        mapId: this.selectedMapId,
        hostName: 'Chủ Phòng',
        guestName: 'Khách',
      });
    }
  }

  private renderLoading(pct: number, label: string): void {
    this.uiRoot.innerHTML = `
      <div class="screen-overlay" style="justify-content:center">
        <div class="panel-card" style="width:100%;max-width:440px;text-align:center">
          <img src="./assets/ui/logo-army3.png" alt="Logo" style="width:92px;height:92px;border-radius:18px;margin-bottom:10px" />
          <h2 style="justify-content:center;margin-bottom:6px">MOBI ARMY 3 WEB EDITION</h2>
          <p style="color:#94a3b8;font-size:0.86rem;margin:0 0 14px">${label}</p>
          <div class="gauge-track">
            <div class="gauge-fill-power" style="width:${pct}%"></div>
            <div class="gauge-text" style="justify-content:center"><span>${pct}%</span></div>
          </div>
        </div>
      </div>
    `;
  }

  // ==================== LOBBY / MAIN MENU ====================

  private renderLobby(): void {
    const prevScrollTop = this.uiRoot.querySelector('.screen-overlay')?.scrollTop ?? 0;
    if (this.battle) {
      this.battle.destroy();
      this.battle = null;
    }
    this.hudRefs = null;

    const hero = getHeroById(this.selectedHeroId);
    const remoteHero = getHeroById(this.onlineRemoteHeroId);

    const mapOptionsHtml = this.assets.maps
      .map(
        (m) =>
          `<option value="${m.mapId}" ${m.mapId === this.selectedMapId ? 'selected' : ''}>#${
            m.mapId
          } — ${m.name} (${m.width}x${m.height})</option>`
      )
      .join('');

    const allyOptionsHtml = HEROES.map(
      (h) =>
        `<option value="${h.id}" ${h.id === this.selectedAllyHeroId ? 'selected' : ''}>${
          h.name
        } — ${h.title}</option>`
    ).join('');

    const bossHuntStagesHtml = BOSS_HUNT_STAGES.map((st) => {
      const mapObj = this.assets.maps.find((m) => m.mapId === st.mapId);
      const bossEnemy = st.enemies.find((e) => e.isBoss) || st.enemies[0];
      return `
        <div class="stage-card boss-stage">
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <span class="stage-badge" style="background:rgba(239,68,68,0.25);color:#fca5a5">👑 ${st.subtitle}</span>
              <span style="font-size:0.75rem;color:#94a3b8">Map: ${mapObj?.name ?? st.mapId}</span>
            </div>
            <h3 style="margin:0 0 6px;font-size:1.05rem;color:#f8fafc">${st.name}</h3>
            <p style="margin:0 0 8px;font-size:0.83rem;color:#cbd5e1;line-height:1.4">${st.description}</p>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <span class="stat-pill" style="color:#f43f5e">Boss HP: ${bossEnemy.hp}</span>
              <span class="stat-pill" style="color:#facc15">Công Boss: ${bossEnemy.attack}</span>
              <span class="stat-pill" style="color:#38bdf8">Tổ Đội: 2 Người</span>
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">
            <span style="font-size:0.76rem;color:#fde047">★ ${st.rewardTitle}</span>
            <button class="primary-cta btn-start-boss-hunt" data-boss-stage="${st.id}" style="padding:8px 18px;font-size:0.85rem">Săn Boss Ngay →</button>
          </div>
        </div>
      `;
    }).join('');

    const stagesHtml = CAMPAIGN_STAGES.map((st) => {
      const unlocked = st.id <= this.unlockedStage;
      const isBoss = st.enemies.some((e) => e.isBoss);
      const mapObj = this.assets.maps.find((m) => m.mapId === st.mapId);
      return `
        <div class="stage-card ${unlocked ? '' : 'locked'} ${isBoss ? 'boss-stage' : ''}">
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <span class="stage-badge">${st.subtitle}</span>
              <span style="font-size:0.75rem;color:#94a3b8">Map: ${mapObj?.name ?? st.mapId}</span>
            </div>
            <h3 style="margin:0 0 6px;font-size:1rem;color:#f8fafc">${st.name}</h3>
            <p style="margin:0;font-size:0.82rem;color:#cbd5e1;line-height:1.4">${st.description}</p>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">
            <span style="font-size:0.76rem;color:#fde047">★ ${st.rewardTitle}</span>
            ${
              unlocked
                ? `<button class="primary-cta btn-start-stage" data-stage="${st.id}" style="padding:8px 16px;font-size:0.85rem">Vào Ải →</button>`
                : `<span style="font-size:0.78rem;color:#64748b">🔒 Qua Ải ${st.id - 1} để mở</span>`
            }
          </div>
        </div>
      `;
    }).join('');

    const inviteUrl = this.online.roomCode
      ? `${window.location.origin}${window.location.pathname}?room=${this.online.roomCode}`
      : '';

    this.uiRoot.innerHTML = `
      <div class="screen-overlay">
        <div class="menu-container">
          <!-- Header -->
          <div class="brand-header">
            <div class="brand-left">
              <img class="brand-logo" src="./assets/ui/logoGame.png" alt="Mobi Army 3" />
              <div class="brand-title">
                <h1>MOBI ARMY 3 — BẢN WEB OFFLINE &amp; SOLO ONLINE</h1>
                <p>17 Chiến Binh (9 Tướng Gốc + 8 Siêu Anh Hùng Marvel) • Vượt Ải Boss • Đấu Bot • Solo Trực Tuyến 1v1</p>
              </div>
            </div>
            <div class="mode-tabs">
              <button class="tab-btn ${this.activeTab === 'campaign' ? 'active' : ''}" data-tab="campaign">🗺️ Vượt Ải (${Math.min(this.unlockedStage, CAMPAIGN_STAGES.length)}/${CAMPAIGN_STAGES.length})</button>
              <button class="tab-btn ${this.activeTab === 'boss_hunt' ? 'active' : ''}" data-tab="boss_hunt">👑 Săn Boss Tổ Đội</button>
              <button class="tab-btn ${this.activeTab === 'skirmish' ? 'active' : ''}" data-tab="skirmish">⚔️ Đấu Bot</button>
              <button class="tab-btn ${this.activeTab === 'online' ? 'active' : ''}" data-tab="online">🌐 Solo Trực Tuyến</button>
              <button class="tab-btn ${this.activeTab === 'guide' ? 'active' : ''}" data-tab="guide">🎨 Thay Đồ Họa</button>
              <button class="tab-btn" id="btn-mute-lobby" title="Bật/Tắt Âm Thanh">${sound.muted ? '🔇' : '🔊'}</button>
            </div>
          </div>

          <!-- Chọn Tướng Chủ Lực (8 Tướng Mobi Army 3 + 6 Skin Biệt Đội Marvel) -->
          <div class="panel-card">
            <h2>
              <span>1. Chọn Chiến Binh Ra Trận (Bao gồm Biệt Đội MARVEL)</span>
              <span style="font-size:0.8rem;color:#38bdf8;font-weight:600">Đang chọn: ${hero.name} (${hero.title})</span>
            </h2>
            <div class="hero-grid">
              ${HEROES.map(
                (h) => `
                <div class="hero-card ${h.faction === 'marvel' ? 'marvel-hero' : ''} ${
                  h.id === this.selectedHeroId ? 'selected' : ''
                }" data-hero="${h.id}">
                  ${h.faction === 'marvel' ? '<span class="marvel-badge">MARVEL</span>' : ''}
                  <canvas id="hero-preview-${h.id}" width="72" height="72"></canvas>
                  <div class="hero-name" style="color:${h.color}">${h.name}</div>
                  <div class="hero-role">${h.title.replace(' [MARVEL]', '')}</div>
                </div>
              `
              ).join('')}
            </div>
            <div class="hero-detail-bar">
              <div style="max-width:580px">
                <div style="font-weight:800;font-size:0.95rem;color:${hero.color}">${hero.name} — Tuyệt kỹ Nộ: <span style="color:#fde047">${hero.powName}</span></div>
                <div style="font-size:0.83rem;color:#cbd5e1;margin-top:3px">${hero.description}</div>
              </div>
              <div class="stat-pills">
                <span class="stat-pill">❤️ HP: ${hero.hp}</span>
                <span class="stat-pill">💥 Công: ${hero.attack}</span>
                <span class="stat-pill">📐 Góc: ${hero.minAngle}°..${hero.maxAngle}°</span>
                <span class="stat-pill">🏃 Thể lực: ${hero.staminaMax}</span>
              </div>
            </div>
          </div>

          <!-- Chọn Túi Vật Phẩm Mang Vào Trận (Tối đa 6 món) -->
          <div class="panel-card">
            <h2>
              <span>2. Chọn Túi Vật Phẩm Mang Vào Trận (Tối đa 6 món — Phím tắt 1..6)</span>
              <span style="font-size:0.8rem;color:#facc15;font-weight:700">Đã chọn: ${this.selectedItems.length}/6 món (Nhấp để chọn / bỏ)</span>
            </h2>
            <div class="loadout-items-grid">
              ${BATTLE_ITEMS.map((it) => {
                const slotIdx = this.selectedItems.indexOf(it.id);
                const isSel = slotIdx >= 0;
                return `
                  <div class="loadout-item-card ${isSel ? 'selected' : ''}" data-loadout-item="${it.id}" title="${it.name}: ${it.shortDesc}">
                    ${isSel ? `<span class="loadout-item-badge">${slotIdx + 1}</span>` : ''}
                    <div class="item-icon-strip" style="background-image: url('./assets/ui/item.png'); background-position: 0px ${-26 * it.stripIndex}px"></div>
                    <div>
                      <div style="font-size:0.82rem;font-weight:700;color:${isSel ? '#fde047' : '#f8fafc'}">${it.name}</div>
                      <div style="font-size:0.7rem;color:#94a3b8">${it.shortDesc}</div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Nội dung theo Tab -->
          ${
            this.activeTab === 'campaign'
              ? `
            <div class="panel-card">
              <h2>
                <span>3. Chiến Dịch Vượt Ải &amp; Săn Boss</span>
                <button class="ctrl-btn" id="btn-unlock-all" style="height:30px;font-size:0.75rem;font-weight:600">🔓 Mở Khóa Thử Mọi Ải</button>
              </h2>
              <div class="stage-grid">
                ${stagesHtml}
              </div>
            </div>
          `
              : this.activeTab === 'boss_hunt'
              ? `
            <div class="panel-card">
              <h2>
                <span>3. Tổ Đội Săn Boss (2 Chiến Binh Hợp Lực)</span>
              </h2>
              <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-bottom:14px;background:rgba(2,6,23,0.5);padding:10px 14px;border-radius:10px;border:1px solid rgba(244,63,94,0.3)">
                <div class="field-group" style="flex:1;min-width:240px">
                  <label>Chọn Tướng Đồng Đội Hỗ Trợ Bạn:</label>
                  <select class="select-input" id="sel-boss-ally">${allyOptionsHtml}</select>
                </div>
                <div style="font-size:0.82rem;color:#cbd5e1;flex:2;min-width:240px">
                  Đồng đội sẽ xuất kích cùng bạn, tự động tính gió, phối hợp hỏa lực và sử dụng Item để hạ gục Đại Boss máu trâu!
                </div>
              </div>
              <div class="stage-grid">
                ${bossHuntStagesHtml}
              </div>
            </div>
          `
              : this.activeTab === 'skirmish'
              ? `
            <div class="panel-card">
              <h2><span>3. Thiết Lập Trận Đấu Bot (27 Bản Đồ Gốc Chuẩn Mực Nước)</span></h2>
              <div class="skirmish-options">
                <div class="field-group">
                  <label>Bản Đồ Chiến Trường (Đầy đủ gạch phá hủy):</label>
                  <select class="select-input" id="sel-map">${mapOptionsHtml}</select>
                </div>
                <div class="field-group">
                  <label>Chế Độ Đội Hình:</label>
                  <select class="select-input" id="sel-teamsize">
                    <option value="1" ${this.selectedTeamSize === 1 ? 'selected' : ''}>1 vs 1 (Đấu Đơn)</option>
                    <option value="2" ${this.selectedTeamSize === 2 ? 'selected' : ''}>2 vs 2 (Đấu Đôi — Điều khiển 2 Tướng)</option>
                  </select>
                </div>
                ${
                  this.selectedTeamSize === 2
                    ? `
                  <div class="field-group">
                    <label>Tướng Đồng Đội Số 2:</label>
                    <select class="select-input" id="sel-ally">${allyOptionsHtml}</select>
                  </div>
                `
                    : ''
                }
                <div class="field-group">
                  <label>Trí Tuệ Nhân Tạo Bot (AI):</label>
                  <select class="select-input" id="sel-diff">
                    <option value="easy" ${this.selectedDifficulty === 'easy' ? 'selected' : ''}>Dễ (Tập căn góc &amp; gió)</option>
                    <option value="normal" ${this.selectedDifficulty === 'normal' ? 'selected' : ''}>Thường (Chuẩn giải trí)</option>
                    <option value="hard" ${this.selectedDifficulty === 'hard' ? 'selected' : ''}>Khó (Xạ thủ tính gió chuẩn + dùng Item)</option>
                  </select>
                </div>
                <button class="primary-cta" id="btn-start-skirmish">🔥 BẮT ĐẦU TRẬN ĐẤU</button>
              </div>
            </div>
          `
              : this.activeTab === 'online'
              ? `
            <div class="panel-card">
              <h2>
                <span>2. Phòng Đấu Solo Trực Tuyến 1v1 (P2P WebRTC Thời Gian Thực)</span>
                <span style="font-size:0.8rem;color:${
                  this.online.isConnected ? '#4ade80' : '#facc15'
                }">${this.online.isConnected ? '● Đã Kết Nối 2 Người Chơi' : '○ Đang Chờ Kết Nối'}</span>
              </h2>

              <div style="padding:10px 14px;border-radius:10px;background:rgba(2,6,23,0.6);border:1px solid rgba(56,189,248,0.28);margin-bottom:14px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px">
                <div style="font-size:0.88rem;color:#e2e8f0">
                  <strong>Trạng thái:</strong> <span style="color:#7dd3fc">${this.onlineStatusText}</span>
                </div>
                ${
                  this.online.roomCode
                    ? `
                  <div style="display:flex;align-items:center;gap:8px">
                    <span class="stat-pill" style="background:#0284c7;color:#fff;font-size:0.88rem">Mã Phòng: #${this.online.roomCode}</span>
                    <button class="ctrl-btn" id="btn-copy-room" style="height:32px;font-size:0.78rem">📋 Copy Link Mời</button>
                  </div>
                `
                    : ''
                }
              </div>

              <div class="skirmish-options" style="margin-bottom:14px">
                <div class="field-group">
                  <label>Cách 1: Tạo Phòng Mới (Làm Chủ Phòng)</label>
                  <button class="tab-btn active" id="btn-host-online" style="width:100%">📡 Tạo Phòng Solo 1v1</button>
                </div>

                <div class="field-group">
                  <label>Cách 2: Nhập Mã Phòng 4 Số Để Vào</label>
                  <div style="display:flex;gap:8px">
                    <input type="text" id="inp-join-code" class="select-input" placeholder="VD: 4829" maxlength="6" style="flex:1;font-weight:800;letter-spacing:1px" value="${
                      this.online.role === 'guest' ? this.online.roomCode : ''
                    }" />
                    <button class="tab-btn" id="btn-join-online">🔗 Vào Phòng</button>
                  </div>
                </div>

                <div class="field-group">
                  <label>Bản Đồ Thi Đấu (Chủ Phòng Chọn):</label>
                  <select class="select-input" id="sel-online-map" ${
                    this.online.role === 'guest' ? 'disabled' : ''
                  }>${mapOptionsHtml}</select>
                </div>
              </div>

              <div class="hero-detail-bar" style="justify-content:space-around;text-align:center">
                <div>
                  <div style="font-size:0.75rem;color:#94a3b8">BẠN (${
                    this.online.role === 'guest' ? 'KHÁCH - BÊN PHẢI' : 'CHỦ PHÒNG - BÊN TRÁI'
                  })</div>
                  <div style="font-size:1.05rem;font-weight:800;color:${hero.color}">${hero.name}</div>
                </div>
                <div style="font-size:1.3rem;font-weight:900;color:#facc15">⚡ VS ⚡</div>
                <div>
                  <div style="font-size:0.75rem;color:#94a3b8">ĐỐI THỦ TRỰC TUYẾN</div>
                  <div style="font-size:1.05rem;font-weight:800;color:${
                    this.online.isConnected ? remoteHero.color : '#64748b'
                  }">${
                    this.online.isConnected ? remoteHero.name : 'Đang chờ người chơi thứ 2...'
                  }</div>
                </div>
                ${
                  this.online.role === 'host'
                    ? `<button class="primary-cta" id="btn-start-online" ${
                        this.online.isConnected ? '' : 'disabled style="opacity:0.45;cursor:not-allowed"'
                      }>🚀 BẮT ĐẦU SOLO TRỰC TUYẾN</button>`
                    : `<div style="font-size:0.84rem;color:#fde047;font-weight:700">${
                        this.online.isConnected
                          ? '⏳ Đang chờ Chủ Phòng bấm Bắt Đầu...'
                          : 'Hãy nhập mã phòng để kết nối với Chủ Phòng'
                      }</div>`
                }
              </div>
            </div>
          `
              : `
            <div class="panel-card" style="line-height:1.55;font-size:0.88rem;color:#cbd5e1">
              <h2><span>🎨 Kiến Trúc Tách Rời Tài Nguyên — Sẵn Sàng Thay Đồ Họa Mới</span></h2>
              <p style="margin-top:0">Toàn bộ tài nguyên mã hóa trong Unity &amp; HotRes gốc đã được giải mã sang định dạng ảnh chuẩn <code>.png</code> và dữ liệu <code>.json</code> trong thư mục <code>web-game/public/assets/</code>:</p>
              <ul style="margin:6px 0 10px;padding-left:20px">
                <li><strong>Địa hình &amp; Bản đồ:</strong> Thay ảnh gạch trong <code>public/assets/bricks/*.png</code> hoặc chỉnh bố cục trong <code>public/assets/data/maps.json</code>.</li>
                <li><strong>Đạn, Hố đạn, Hiệu ứng nổ, Boss:</strong> Ghi đè trực tiếp file <code>.png</code> trong <code>bullets/</code>, <code>holes/</code>, <code>effects/</code>, <code>bosses/</code> hoặc sửa đường dẫn trong <code>public/assets/assets-manifest.json</code>.</li>
                <li><strong>Skin Marvel &amp; Nhân vật mới:</strong> Các bộ phận skin Marvel nằm tại <code>public/assets/heroes/small/2Small*.png</code>; hoặc thả spritesheet ngang <code>.png</code> vào <code>public/assets/heroes/overrides/</code> và khai báo vào mục <code>heroOverrides</code> trong <code>assets-manifest.json</code>.</li>
              </ul>
              <p style="margin:0;color:#7dd3fc"><strong>Phím tắt chiến đấu:</strong> <code>← / →</code> (hoặc <code>A / D</code>) Di chuyển • <code>↑ / ↓</code> (hoặc <code>W / S</code>) Chỉnh góc • Giữ <code>SPACE</code> Gồng lực &amp; nhả để Bắn • <code>P</code> Bật Tuyệt kỹ Nộ • <code>1..8</code> Dùng 8 Vật phẩm chuẩn • Kéo chuột / Lăn chuột để xem toàn bản đồ.</p>
            </div>
          `
          }
        </div>
      </div>
    `;

    // Vẽ chân dung thực tế 14 Tướng (8 Tướng Gốc + 6 Tướng Marvel) lên từng thẻ chọn tướng
    for (const h of HEROES) {
      const c = document.getElementById(`hero-preview-${h.id}`) as HTMLCanvasElement | null;
      if (c) {
        this.previewRenderer.drawHeroPreview(c, h, 12);
      }
    }

    // Gắn sự kiện tương tác Sảnh
    this.uiRoot.querySelectorAll<HTMLElement>('[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        sound.playClick();
        this.activeTab = btn.dataset.tab as 'campaign' | 'boss_hunt' | 'skirmish' | 'online' | 'guide';
        this.renderLobby();
      });
    });

    document.getElementById('btn-mute-lobby')?.addEventListener('click', () => {
      sound.toggleMute();
      this.renderLobby();
    });

    this.uiRoot.querySelectorAll<HTMLElement>('[data-hero]').forEach((card) => {
      card.addEventListener('click', () => {
        sound.playClick();
        this.selectedHeroId = card.dataset.hero || 'gunner';
        if (this.online.isConnected) {
          if (this.online.role === 'host') {
            this.broadcastLobbySync();
          } else {
            this.online.send({
              type: 'guest_select',
              guestHeroId: this.selectedHeroId,
              guestName: 'Khách',
            });
          }
        }
        this.renderLobby();
      });
    });

    this.uiRoot.querySelectorAll<HTMLElement>('[data-loadout-item]').forEach((card) => {
      card.addEventListener('click', () => {
        const id = card.dataset.loadoutItem as BattleItemId;
        this.toggleItemSelection(id);
      });
    });

    document.getElementById('btn-unlock-all')?.addEventListener('click', () => {
      sound.playItemUse();
      this.unlockedStage = CAMPAIGN_STAGES.length;
      localStorage.setItem(STORAGE_STAGE_KEY, String(this.unlockedStage));
      this.renderLobby();
    });

    this.uiRoot.querySelectorAll<HTMLElement>('.btn-start-stage').forEach((btn) => {
      btn.addEventListener('click', () => {
        sound.playClick();
        const id = parseInt(btn.dataset.stage || '1', 10);
        const stage = CAMPAIGN_STAGES.find((s) => s.id === id) ?? CAMPAIGN_STAGES[0];
        this.launchBattle({
          mode: 'campaign',
          playerHeroId: this.selectedHeroId,
          teamSize: stage.allyHeroId ? 2 : 1,
          mapId: stage.mapId,
          difficulty: 'normal',
          stage,
          selectedItems: this.selectedItems,
        });
      });
    });

    document.getElementById('sel-boss-ally')?.addEventListener('change', (e) => {
      this.selectedAllyHeroId = (e.target as HTMLSelectElement).value;
    });

    this.uiRoot.querySelectorAll<HTMLElement>('.btn-start-boss-hunt').forEach((btn) => {
      btn.addEventListener('click', () => {
        sound.playClick();
        const id = parseInt(btn.dataset.bossStage || '101', 10);
        const stage = BOSS_HUNT_STAGES.find((s) => s.id === id) ?? BOSS_HUNT_STAGES[0];
        this.launchBattle({
          mode: 'campaign',
          playerHeroId: this.selectedHeroId,
          allyHeroId: this.selectedAllyHeroId || stage.allyHeroId || 'thor',
          teamSize: 2,
          mapId: stage.mapId,
          difficulty: 'hard',
          stage,
          selectedItems: this.selectedItems,
        });
      });
    });

    document.getElementById('sel-map')?.addEventListener('change', (e) => {
      this.selectedMapId = parseInt((e.target as HTMLSelectElement).value, 10);
    });
    document.getElementById('sel-teamsize')?.addEventListener('change', (e) => {
      this.selectedTeamSize = parseInt((e.target as HTMLSelectElement).value, 10) === 2 ? 2 : 1;
      this.renderLobby();
    });
    document.getElementById('sel-ally')?.addEventListener('change', (e) => {
      this.selectedAllyHeroId = (e.target as HTMLSelectElement).value;
    });
    document.getElementById('sel-diff')?.addEventListener('change', (e) => {
      this.selectedDifficulty = (e.target as HTMLSelectElement).value as BotDifficulty;
    });

    document.getElementById('btn-start-skirmish')?.addEventListener('click', () => {
      sound.playClick();
      this.launchBattle({
        mode: 'skirmish',
        playerHeroId: this.selectedHeroId,
        allyHeroId: this.selectedAllyHeroId,
        teamSize: this.selectedTeamSize,
        mapId: this.selectedMapId,
        difficulty: this.selectedDifficulty,
        selectedItems: this.selectedItems,
      });
    });

    // Sự kiện Tab Solo Trực Tuyến 1v1
    document.getElementById('btn-host-online')?.addEventListener('click', async () => {
      sound.playClick();
      try {
        await this.online.hostRoom();
        this.renderLobby();
      } catch {
        this.renderLobby();
      }
    });

    document.getElementById('btn-join-online')?.addEventListener('click', async () => {
      sound.playClick();
      const inp = document.getElementById('inp-join-code') as HTMLInputElement | null;
      const code = inp?.value.trim() || '';
      if (!code) return;
      try {
        await this.online.joinRoom(code);
        this.renderLobby();
      } catch {
        this.renderLobby();
      }
    });

    document.getElementById('btn-copy-room')?.addEventListener('click', (e) => {
      sound.playItemUse();
      if (inviteUrl && navigator.clipboard) {
        navigator.clipboard.writeText(inviteUrl);
        (e.currentTarget as HTMLButtonElement).textContent = '✅ Đã Copy Link!';
      }
    });

    document.getElementById('sel-online-map')?.addEventListener('change', (e) => {
      this.selectedMapId = parseInt((e.target as HTMLSelectElement).value, 10);
      this.broadcastLobbySync();
    });

    document.getElementById('btn-start-online')?.addEventListener('click', () => {
      if (!this.online.isConnected || this.online.role !== 'host') return;
      sound.playPow();
      const initialWind = Math.round((Math.random() * 2 - 1) * 12);
      const matchSeed = Math.floor(100000 + Math.random() * 900000);
      this.online.send({
        type: 'start_match',
        hostHeroId: this.selectedHeroId,
        guestHeroId: this.onlineRemoteHeroId,
        mapId: this.selectedMapId,
        seed: matchSeed,
        initialWind,
      });
      this.launchBattle({
        mode: 'online',
        onlineRole: 'host',
        playerHeroId: this.selectedHeroId,
        remoteHeroId: this.onlineRemoteHeroId,
        teamSize: 1,
        mapId: this.selectedMapId,
        difficulty: 'normal',
        seed: matchSeed,
        selectedItems: this.selectedItems,
      });
    });

    const overlay = this.uiRoot.querySelector('.screen-overlay');
    if (overlay && prevScrollTop > 0) {
      overlay.scrollTop = prevScrollTop;
      requestAnimationFrame(() => {
        if (overlay) overlay.scrollTop = prevScrollTop;
      });
    }
  }

  private toggleItemSelection(id: BattleItemId): void {
    const idx = this.selectedItems.indexOf(id);
    if (idx >= 0) {
      if (this.selectedItems.length > 1) {
        this.selectedItems.splice(idx, 1);
        sound.playClick();
      }
    } else {
      if (this.selectedItems.length < 6) {
        this.selectedItems.push(id);
      } else {
        // Nếu đã đủ 6 món, bấm món mới sẽ thay thế món thứ 6
        this.selectedItems[5] = id;
      }
      sound.playItemUse();
    }
    localStorage.setItem(STORAGE_ITEMS_KEY, JSON.stringify(this.selectedItems));
    this.renderLobby();
  }

  // ==================== BATTLE HUD & LAUNCH ====================

  private async launchBattle(setup: BattleSetup): Promise<void> {
    if (!setup.selectedItems || setup.selectedItems.length === 0) {
      setup.selectedItems = [...this.selectedItems];
    }
    const map =
      this.assets.maps.find((m) => m.mapId === setup.mapId) ?? this.assets.maps[0];
    this.renderLoading(60, `Đang dựng địa hình bản đồ "${map.name}"...`);
    await this.assets.loadMapAssets(map);

    this.buildBattleHudDom(setup);

    this.battle = new BattleEngine(
      this.canvas,
      this.assets,
      map,
      setup,
      (snap) => this.updateBattleHud(snap),
      (stats) => this.showMatchResultModal(stats, setup),
      (onlineAction) => {
        if (setup.mode === 'online') {
          this.online.send({
            type: 'battle_action',
            payload: onlineAction,
          });
        }
      }
    );
    this.battle.start();
  }

  private buildBattleHudDom(setup?: BattleSetup): void {
    const activeItems =
      setup?.selectedItems && setup.selectedItems.length > 0
        ? setup.selectedItems.slice(0, 6)
        : this.battle?.setup.selectedItems && this.battle.setup.selectedItems.length > 0
        ? this.battle.setup.selectedItems.slice(0, 6)
        : this.selectedItems.slice(0, 6);

    const itemsHtml = activeItems.map((itemId, idx) => {
      const it = BATTLE_ITEMS.find((b) => b.id === itemId) || BATTLE_ITEMS[0];
      const hotkey = String(idx + 1);
      return `
        <button class="item-btn" data-item="${it.id}" title="${it.name} (Phím ${hotkey}): ${it.shortDesc}">
          <span class="item-key">${hotkey}</span>
          <div class="item-icon-strip" style="background-image: url('./assets/ui/item.png'); background-position: 0px ${-26 * it.stripIndex}px"></div>
          <span class="item-count" id="item-cnt-${it.id}">0</span>
        </button>
      `;
    }).join('');

    this.uiRoot.innerHTML = `
      <!-- Thanh trên: Thông tin Map/Lượt, Sức Gió & Đồng Hồ Đếm Ngược, Nút Tiện Ích -->
      <div class="hud-top">
        <div class="hud-box">
          <div>
            <div style="font-size:0.74rem;color:#94a3b8" id="hud-mode-map">Bản đồ</div>
            <div style="font-weight:800;font-size:0.9rem;color:#f8fafc" id="hud-turn-info">Lượt 1</div>
          </div>
        </div>

        <div class="hud-box">
          <div class="wind-box">
            <span class="wind-label">Sức Gió Chiến Trường</span>
            <span class="wind-value" id="hud-wind">◀ 0 ▶</span>
          </div>
          <div class="timer-circle" id="hud-timer">25</div>
        </div>

        <div class="hud-box">
          <button class="ctrl-btn" id="btn-center-cam" title="Đưa Camera về Tướng (Phím C)">🎯 Định Tâm</button>
          <button class="ctrl-btn" id="btn-skip-turn" title="Nhường lượt (+20 Nộ) (Phím F)">⏭️ Bỏ Lượt</button>
          <button class="ctrl-btn" id="btn-mute-battle" title="Âm thanh">${sound.muted ? '🔇' : '🔊'}</button>
          <button class="ctrl-btn" id="btn-exit-lobby" style="border-color:rgba(244,63,94,0.5);color:#fda4af">✕ Thoát</button>
        </div>
      </div>

      <div class="hud-spacer"></div>

      <!-- Bảng điều khiển Chiến Đấu dưới đáy -->
      <div class="hud-bottom">
        <div class="dpad-cluster">
          <button class="ctrl-btn" data-hold="left" title="Đi Trái (A / ←)">◀</button>
          <div style="display:flex;flex-direction:column;gap:4px">
            <button class="ctrl-btn" data-hold="up" style="height:32px" title="Bay Lên (Iron Man/Ultron) hoặc Nâng Góc (W / ↑)">▲</button>
            <button class="ctrl-btn" data-hold="down" style="height:32px" title="Bay Xuống (Iron Man/Ultron) hoặc Hạ Góc (S / ↓)">▼</button>
          </div>
          <button class="ctrl-btn" data-hold="right" title="Đi Phải (D / →)">▶</button>
          <div id="hud-fly-box" style="display:none;flex-direction:column;gap:4px;margin-left:2px">
            <button class="ctrl-btn" data-hold="angleUp" style="height:32px;font-size:0.72rem;padding:0 6px;border-color:#38bdf8;color:#7dd3fc" title="Tăng Góc Bắn (Phím Q)">📐+Góc</button>
            <button class="ctrl-btn" data-hold="angleDown" style="height:32px;font-size:0.72rem;padding:0 6px;border-color:#38bdf8;color:#7dd3fc" title="Giảm Góc Bắn (Phím E)">📐-Góc</button>
          </div>
          <div style="margin-left:6px;text-align:center;min-width:58px">
            <div style="font-size:0.7rem;color:#94a3b8">GÓC BẮN</div>
            <div style="font-size:1.1rem;font-weight:900;color:#38bdf8" id="hud-angle">35°</div>
          </div>
        </div>

        <div class="bars-center">
          <div class="items-row">
            <div class="item-slots">${itemsHtml}</div>
            <div style="font-size:0.75rem;color:#94a3b8">Giữ <strong style="color:#f8fafc">SPACE</strong> hoặc nút <strong style="color:#fca5a5">BẮN</strong> để gồng lực</div>
          </div>

          <div class="gauge-track">
            <div class="gauge-fill-power" id="hud-power-fill" style="width:0%"></div>
            <div class="last-power-marker" id="hud-last-power" style="left:0%;display:none"></div>
            <div class="gauge-text">
              <span>THANH LỰC BẮN</span>
              <span id="hud-power-label">0 / 100</span>
            </div>
          </div>

          <div class="gauge-track" id="hud-power2-track" style="display:none;height:18px;border-color:rgba(250,204,21,0.55)">
            <div class="gauge-fill-power" id="hud-power2-fill" style="width:0%;background:linear-gradient(90deg,#fde047,#f59e0b)"></div>
            <div class="gauge-text" style="font-size:0.7rem">
              <span>🥚 THANH 2: CĂN GIỜ GÀ ĐẺ TRỨNG</span>
              <span id="hud-power2-label">0%</span>
            </div>
          </div>

          <div class="sub-bars">
            <div class="mini-bar">
              <div class="mini-bar-fill" id="hud-hp-fill" style="width:100%;background:#22c55e"></div>
              <span id="hud-hp-text">HP</span>
            </div>
            <div class="mini-bar">
              <div class="mini-bar-fill" id="hud-stamina-fill" style="width:100%;background:#eab308"></div>
              <span id="hud-stamina-text">Thể lực</span>
            </div>
            <div class="mini-bar">
              <div class="mini-bar-fill" id="hud-pow-fill" style="width:20%;background:linear-gradient(90deg,#f97316,#dc2626)"></div>
              <span id="hud-pow-text">Nộ POW: 20%</span>
            </div>
          </div>
        </div>

        <div class="fire-cluster">
          <button class="ctrl-btn" id="btn-ultron-clone" style="display:none;height:42px;padding:0 10px;font-size:0.8rem;background:rgba(244,63,94,0.25);border-color:#f43f5e;color:#fda4af;white-space:nowrap;font-weight:700" title="Gọi Phân Thân Ultron (Phím U) - Hồi chiêu 2 lượt">👥 Phân Thân</button>
          <button class="pow-btn" id="btn-pow" disabled title="Kích hoạt Tuyệt Kỹ Nộ (Phím P)">🔥 POW</button>
          <button class="fire-btn" id="btn-fire">🎯 GIỮ BẮN</button>
        </div>
      </div>
    `;

    const itemBtns = new Map<BattleItemId, { btn: HTMLButtonElement; countEl: HTMLElement }>();
    this.uiRoot.querySelectorAll<HTMLButtonElement>('[data-item]').forEach((btn) => {
      const id = btn.dataset.item as BattleItemId;
      const countEl = document.getElementById(`item-cnt-${id}`)!;
      itemBtns.set(id, { btn, countEl });
      btn.addEventListener('click', () => this.battle?.useItem(id));
    });

    document.getElementById('btn-ultron-clone')?.addEventListener('click', () => {
      this.battle?.summonUltronClone();
    });

    this.hudRefs = {
      windVal: document.getElementById('hud-wind')!,
      timerVal: document.getElementById('hud-timer')!,
      turnInfo: document.getElementById('hud-turn-info')!,
      angleVal: document.getElementById('hud-angle')!,
      flyBox: document.getElementById('hud-fly-box')!,
      powerFill: document.getElementById('hud-power-fill')!,
      lastPowerMark: document.getElementById('hud-last-power')!,
      powerLabel: document.getElementById('hud-power-label')!,
      power2Track: document.getElementById('hud-power2-track')!,
      power2Fill: document.getElementById('hud-power2-fill')!,
      power2Label: document.getElementById('hud-power2-label')!,
      hpFill: document.getElementById('hud-hp-fill')!,
      hpText: document.getElementById('hud-hp-text')!,
      staminaFill: document.getElementById('hud-stamina-fill')!,
      staminaText: document.getElementById('hud-stamina-text')!,
      powFill: document.getElementById('hud-pow-fill')!,
      powText: document.getElementById('hud-pow-text')!,
      powBtn: document.getElementById('btn-pow') as HTMLButtonElement,
      fireBtn: document.getElementById('btn-fire') as HTMLButtonElement,
      itemBtns,
    };

    this.uiRoot.querySelectorAll<HTMLButtonElement>('[data-hold]').forEach((btn) => {
      const key = btn.dataset.hold as
        | 'left'
        | 'right'
        | 'up'
        | 'down'
        | 'flyUp'
        | 'flyDown'
        | 'angleUp'
        | 'angleDown';
      const setHold = (val: boolean) => {
        if (!this.battle) return;
        this.battle.keys[key] = val;
        btn.classList.toggle('held', val);
      };
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        setHold(true);
      });
      btn.addEventListener('pointerup', () => setHold(false));
      btn.addEventListener('pointerleave', () => setHold(false));
      btn.addEventListener('pointercancel', () => setHold(false));
    });

    const fireBtn = this.hudRefs.fireBtn;
    const setFireHold = (val: boolean) => {
      if (!this.battle) return;
      this.battle.keys.space = val;
      fireBtn.classList.toggle('charging', val);
    };
    fireBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      setFireHold(true);
    });
    window.addEventListener('pointerup', () => setFireHold(false));

    this.hudRefs.powBtn.addEventListener('click', () => this.battle?.togglePow());
    document.getElementById('btn-center-cam')?.addEventListener('click', () => {
      sound.playClick();
      this.battle?.centerCameraOnActive();
    });
    document.getElementById('btn-skip-turn')?.addEventListener('click', () => {
      this.battle?.skipTurn();
    });
    document.getElementById('btn-mute-battle')?.addEventListener('click', (e) => {
      const muted = sound.toggleMute();
      (e.currentTarget as HTMLButtonElement).textContent = muted ? '🔇' : '🔊';
    });
    document.getElementById('btn-exit-lobby')?.addEventListener('click', () => {
      sound.playClick();
      this.renderLobby();
    });
  }

  private updateBattleHud(snap: HudSnapshot): void {
    if (!this.hudRefs) return;
    const r = this.hudRefs;

    const modeMapEl = document.getElementById('hud-mode-map');
    if (modeMapEl) {
      modeMapEl.textContent = `${snap.modeLabel} • Map: ${snap.mapName}`;
    }

    const u = snap.activeUnit;
    r.turnInfo.textContent = u
      ? `Lượt ${snap.turnNumber}: ${u.name}`
      : `Lượt ${snap.turnNumber}`;
    r.turnInfo.style.color = u?.isPlayerControlled ? '#7dd3fc' : '#fda4af';

    if (snap.wind === 0) {
      r.windVal.textContent = '• Gió Lặng 0 •';
      r.windVal.style.color = '#cbd5e1';
    } else if (snap.wind > 0) {
      r.windVal.textContent = `Gió Xuôi +${snap.wind} ▶▶`;
      r.windVal.style.color = '#38bdf8';
    } else {
      r.windVal.textContent = `◀◀ Gió Ngược ${snap.wind}`;
      r.windVal.style.color = '#fb923c';
    }

    r.timerVal.textContent = String(snap.turnTimeLeft);
    r.timerVal.classList.toggle('urgent', snap.turnTimeLeft <= 6);

    if (u) {
      r.angleVal.textContent = `${Math.round(u.aimAngleDeg)}°`;
      r.flyBox.style.display = u.hero.canFly ? 'flex' : 'none';
      r.powerFill.style.width = `${snap.chargePower}%`;
      r.powerLabel.textContent = `${snap.chargePower} / 100${
        u.lastPower > 0 ? ` (Cũ: ${u.lastPower})` : ''
      }`;

      if (u.hero.weapon === 'chicky') {
        r.power2Track.style.display = 'block';
        const p2 = snap.chargePower2 ?? 0;
        r.power2Fill.style.width = `${p2}%`;
        r.power2Label.textContent = `${p2}% (Thời gian đẻ trứng)`;
      } else {
        r.power2Track.style.display = 'none';
      }

      if (u.lastPower > 0) {
        r.lastPowerMark.style.display = 'block';
        r.lastPowerMark.style.left = `${u.lastPower}%`;
      } else {
        r.lastPowerMark.style.display = 'none';
      }

      const hpPct = Math.round((u.hp / u.maxHp) * 100);
      r.hpFill.style.width = `${hpPct}%`;
      r.hpText.textContent = `HP: ${u.hp}/${u.maxHp}`;

      const stPct = Math.round((u.stamina / u.maxStamina) * 100);
      r.staminaFill.style.width = `${stPct}%`;
      r.staminaText.textContent = `Thể lực: ${stPct}%`;

      r.powFill.style.width = `${u.pow}%`;
      r.powText.textContent = `Nộ POW: ${u.pow}%`;

      const canControl = u.isPlayerControlled && snap.phase === 'aiming';
      const powReady = canControl && u.pow >= 100;
      r.powBtn.disabled = !powReady;
      r.powBtn.classList.toggle('ready', powReady);
      r.powBtn.classList.toggle('armed', snap.powArmed);

      const btnUltron = document.getElementById('btn-ultron-clone') as HTMLButtonElement | null;
      if (btnUltron) {
        const isUltron = u.hero.id === 'ultron';
        btnUltron.style.display = isUltron ? 'inline-flex' : 'none';
        if (isUltron) {
          const cd = u.ultronCloneCooldown ?? 0;
          btnUltron.disabled = !canControl || cd > 0;
          btnUltron.textContent = cd > 0 ? `👥 Hồi: ${cd}T` : '👥 Phân Thân';
        }
      }

      r.fireBtn.disabled =
        !u.isPlayerControlled ||
        (snap.phase !== 'aiming' && snap.phase !== 'charging' && snap.phase !== 'charging_2');
      r.fireBtn.textContent =
        snap.phase === 'charging_2'
          ? '🥚 ĐẺ TRỨNG!'
          : u.hero.weapon === 'hulk_leap'
          ? '💥 GIỮ NHẢY'
          : '🎯 GIỮ BẮN';

      for (const [id, entry] of r.itemBtns.entries()) {
        const cnt = u.inventory[id] ?? 0;
        entry.countEl.textContent = String(cnt);
        entry.btn.disabled = !canControl || cnt <= 0;
        const armed =
          snap.activeItemArmed === id || (id === 'double' && snap.doubleArmed);
        entry.btn.classList.toggle('armed', armed);
      }
    }
  }

  private showMatchResultModal(stats: MatchStats, setup: BattleSetup): void {
    let unlockedNew = false;
    if (stats.won && stats.mode === 'campaign' && stats.stageId) {
      if (stats.stageId >= this.unlockedStage && this.unlockedStage < CAMPAIGN_STAGES.length) {
        this.unlockedStage = stats.stageId + 1;
        localStorage.setItem(STORAGE_STAGE_KEY, String(this.unlockedStage));
        unlockedNew = true;
      }
    }

    const nextStage: CampaignStage | undefined =
      stats.won && stats.mode === 'campaign' && stats.stageId
        ? CAMPAIGN_STAGES.find((s) => s.id === stats.stageId! + 1)
        : undefined;

    const modal = document.createElement('div');
    modal.className = 'result-modal';
    modal.innerHTML = `
      <div class="result-box">
        <h2 style="margin:0 0 6px;font-size:1.5rem;color:${
          stats.draw ? '#cbd5e1' : stats.won ? '#4ade80' : '#f87171'
        }">
          ${stats.draw ? '⚖️ HÒA TRẬN!' : stats.won ? '🏆 CHIẾN THẮNG!' : '💥 THẤT BẠI!'}
        </h2>
        <p style="margin:0 0 14px;color:#94a3b8;font-size:0.9rem">
          ${
            unlockedNew && nextStage
              ? `Chúc mừng! Đã mở khóa <strong>${nextStage.name}</strong>!`
              : stats.won
              ? 'Pháo đội của bạn đã làm chủ hoàn toàn chiến trường!'
              : 'Hãy căn lại sức gió hoặc khoét đất hất đối thủ xuống nước!'
          }
        </p>
        <div class="stat-pills" style="justify-content:center;margin-bottom:18px">
          <span class="stat-pill">⏱️ Số lượt: ${stats.turnsTaken}</span>
          <span class="stat-pill">💥 Sát thương: ${stats.damageDealt}</span>
          <span class="stat-pill">🎯 Hạ gục: ${stats.enemiesDefeated}</span>
        </div>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          <button class="tab-btn" id="btn-res-lobby">🏠 Về Sảnh</button>
          ${
            setup.mode !== 'online'
              ? `<button class="tab-btn active" id="btn-res-retry">🔄 Đấu Lại</button>`
              : ''
          }
          ${
            nextStage
              ? `<button class="primary-cta" id="btn-res-next" style="padding:10px 18px;font-size:0.9rem">Ải Tiếp Theo →</button>`
              : ''
          }
        </div>
      </div>
    `;
    this.uiRoot.appendChild(modal);

    document.getElementById('btn-res-lobby')?.addEventListener('click', () => {
      sound.playClick();
      this.renderLobby();
    });
    document.getElementById('btn-res-retry')?.addEventListener('click', () => {
      sound.playClick();
      if (this.battle) {
        this.battle.destroy();
        this.battle = null;
      }
      this.launchBattle(setup);
    });
    if (nextStage) {
      document.getElementById('btn-res-next')?.addEventListener('click', () => {
        sound.playClick();
        if (this.battle) {
          this.battle.destroy();
          this.battle = null;
        }
        this.launchBattle({
          mode: 'campaign',
          playerHeroId: setup.playerHeroId,
          teamSize: nextStage.allyHeroId ? 2 : 1,
          mapId: nextStage.mapId,
          difficulty: 'normal',
          stage: nextStage,
        });
      });
    }
  }

  // ==================== KEYBOARD BINDINGS ====================

  private bindGlobalKeyboard(): void {
    const mapKey = (code: string, down: boolean, e: KeyboardEvent) => {
      if (!this.battle) return;
      switch (code) {
        case 'ArrowLeft':
        case 'KeyA':
          this.battle.keys.left = down;
          e.preventDefault();
          break;
        case 'ArrowRight':
        case 'KeyD':
          this.battle.keys.right = down;
          e.preventDefault();
          break;
        case 'ArrowUp':
        case 'KeyW':
          this.battle.keys.up = down;
          e.preventDefault();
          break;
        case 'ArrowDown':
        case 'KeyS':
          this.battle.keys.down = down;
          e.preventDefault();
          break;
        case 'KeyQ':
          this.battle.keys.angleUp = down;
          e.preventDefault();
          break;
        case 'KeyE':
          this.battle.keys.angleDown = down;
          e.preventDefault();
          break;
        case 'Space':
          this.battle.keys.space = down;
          e.preventDefault();
          break;
        default:
          break;
      }

      if (down && !e.repeat) {
        if (code === 'KeyP') this.battle.togglePow();
        if (code === 'KeyU') this.battle.summonUltronClone();
        if (code === 'KeyC') this.battle.centerCameraOnActive();
        if (code === 'KeyF') this.battle.skipTurn();
        if (code.startsWith('Digit')) {
          const num = parseInt(code.replace('Digit', ''), 10);
          if (num >= 1 && num <= 6) {
            const activeItems = this.battle.setup.selectedItems || this.selectedItems;
            const itemId = activeItems[num - 1];
            if (itemId) this.battle.useItem(itemId);
          }
        }
      }
    };

    window.addEventListener('keydown', (e) => mapKey(e.code, true, e));
    window.addEventListener('keyup', (e) => mapKey(e.code, false, e));
    window.addEventListener('blur', () => {
      if (!this.battle) return;
      this.battle.keys = {
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
    });
  }
}

new GameApp().boot();
