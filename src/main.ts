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
  private activeTab: 'campaign' | 'boss_hunt' | 'skirmish' | 'online' | 'guide' = 'boss_hunt';
  private selectedHeroId = 'captain';
  private selectedAllyHeroId = 'thor';
  private selectedTeamSize: 1 | 2 = 2;
  private selectedMapId = 11;
  private selectedDifficulty: BotDifficulty = 'normal';
  private unlockedStage = 1;
  private selectedItems: BattleItemId[] = ['heal', 'team_heal', 'teleport', 'double', 'shield', 'freeze'];
  private selectedCoopBossStageId = 111;

  // Trạng thái phòng & Giao diện chuẩn ảnh Mobi Army 3
  private activeModal: 'none' | 'hero' | 'bag' | 'map' | 'mode' | 'menu' | 'chat' | 'online_room' | 'guide' = 'none';
  private selectingSlotForHero: 'player' | 'ally' = 'player';
  private lobbyView: 'room' | 'board' = 'room';
  private boardTab: 'boss_hunt' | 'campaign' | 'online' | 'maps' = 'boss_hunt';
  private chatTickerTimeout: any = null;
  private lobbyChatMessages: Array<{ sender: string; text: string; time: string; isSelf?: boolean }> = [
    { sender: 'Hệ Thống', text: 'Chào mừng các xạ thủ đến với Mobi Army 3 Web!', time: '12:00' }
  ];
  private playerBubbleText = '';
  private playerBubbleTimer: any = null;
  private allyBubbleText = '';
  private allyBubbleTimer: any = null;

  // Trạng thái phòng Solo Trực Tuyến (1v1 Online) & Tổ Đội Săn Boss Online (2P Co-op)
  private onlineStatusText = 'Chưa kết nối phòng. Nhấp Menu -> Phòng Trực Tuyến để tạo phòng!';
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
    slotBtns: Array<{ btn: HTMLButtonElement; countEl: HTMLElement; itemId: BattleItemId }>;
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

      // Kiểm tra nếu người chơi mở bằng Link mời ?room=XXXX hoặc ?bossroom=XXXX
      const urlParams = new URLSearchParams(window.location.search);
      const bossRoomParam = urlParams.get('bossroom');
      const roomParam = urlParams.get('room');
      if (bossRoomParam) {
        this.activeTab = 'boss_hunt';
        this.renderLobby();
        this.online.joinRoom(bossRoomParam).catch(() => {});
      } else if (roomParam) {
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
            guestName: 'Đồng Đội',
          });
        }
      }
      if (!this.battle) {
        this.renderLobby();
      }
    };

    this.online.onPacket = (packet: OnlinePacket) => {
      switch (packet.type) {
        case 'lobby_sync': {
          this.onlineRemoteHeroId = packet.hostHeroId;
          this.selectedMapId = packet.mapId;
          if (packet.coopStageId) {
            this.selectedCoopBossStageId = packet.coopStageId;
          }
          if (!this.battle) {
            this.renderLobby();
          }
          break;
        }
        case 'guest_select': {
          this.onlineRemoteHeroId = packet.guestHeroId;
          if (this.online.role === 'host') {
            this.broadcastLobbySync();
          }
          if (!this.battle) {
            this.renderLobby();
          }
          break;
        }
        case 'start_match': {
          sound.playPow();
          const isHost = this.online.role === 'host';
          const coopStage = packet.coopStageId
            ? BOSS_HUNT_STAGES.find((s) => s.id === packet.coopStageId) ?? BOSS_HUNT_STAGES[0]
            : undefined;
          this.launchBattle({
            mode: 'online',
            onlineRole: isHost ? 'host' : 'guest',
            playerHeroId: isHost ? packet.hostHeroId : packet.guestHeroId,
            remoteHeroId: isHost ? packet.guestHeroId : packet.hostHeroId,
            teamSize: coopStage ? 2 : 1,
            mapId: coopStage ? coopStage.mapId : packet.mapId,
            difficulty: coopStage ? 'hard' : 'normal',
            seed: packet.seed,
            onlineCoopStage: coopStage,
            selectedItems: this.selectedItems,
          });
          break;
        }
        case 'battle_action': {
          this.battle?.applyOnlineAction(packet.payload);
          break;
        }
        case 'chat': {
          const sender = packet.senderName || 'Đồng Đội';
          this.lobbyChatMessages.push({
            sender,
            text: packet.text,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isSelf: false,
          });
          if (this.lobbyChatMessages.length > 50) this.lobbyChatMessages.shift();

          this.allyBubbleText = packet.text;
          clearTimeout(this.allyBubbleTimer);
          this.allyBubbleTimer = setTimeout(() => {
            this.allyBubbleText = '';
            this.updatePedestalBubbles();
          }, 4000);

          this.updatePedestalBubbles();
          this.updateChatDrawer();
          this.showChatTicker(packet.senderName || 'Đối Thủ', packet.text);

          if (this.battle) {
            const remoteFighter = this.battle.fighters.find(
              (f) => !f.isPlayerControlled
            );
            if (remoteFighter) {
              this.battle.sayChat(packet.text, remoteFighter.id);
            }
          }
          break;
        }
        case 'player_left': {
          if (this.battle) {
            if (this.battle.setup.onlineCoopStage) {
              alert(packet.reason || 'Chủ phòng / Đồng đội đã rời phòng. Trận đấu kết thúc!');
              this.renderLobby();
            } else {
              alert('Đối thủ đã thoát trận! Bạn giành chiến thắng!');
              this.battle.handleOpponentForfeit();
            }
          } else {
            alert('Người chơi đã rời phòng.');
            this.renderLobby();
          }
          break;
        }
      }
    };

    this.online.onDisconnect = () => {
      if (this.battle) {
        if (this.battle.setup.onlineCoopStage) {
          alert('Mất kết nối với phòng. Trận đấu tổ đội kết thúc!');
          this.renderLobby();
        } else if (this.battle.setup.mode === 'online') {
          alert('Đối thủ đã mất kết nối! Bạn giành chiến thắng!');
          this.battle.handleOpponentForfeit();
        }
      } else {
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
        guestName: 'Đồng Đội',
        coopStageId: this.activeTab === 'boss_hunt' ? this.selectedCoopBossStageId : undefined,
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

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  public showChatTicker(sender: string, text: string): void {
    const bar = document.getElementById('chatTickerBar');
    const textEl = document.getElementById('chatTickerText');
    if (!bar || !textEl) return;
    textEl.textContent = `📢 [${sender}]: ${text}`;
    bar.classList.remove('hidden');
    // Khởi động lại animation trượt chữ
    textEl.style.animation = 'none';
    void textEl.offsetWidth;
    textEl.style.animation = 'ticker-scroll 12s linear infinite';

    if (this.chatTickerTimeout) {
      clearTimeout(this.chatTickerTimeout);
    }
    this.chatTickerTimeout = setTimeout(() => {
      bar.classList.add('hidden');
    }, 12000);
  }

  private sendChatMessage(text: string): void {
    if (!text || !text.trim()) return;
    const trimmed = text.trim();
    this.lobbyChatMessages.push({
      sender: 'Bạn',
      text: trimmed,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSelf: true,
    });
    if (this.lobbyChatMessages.length > 50) this.lobbyChatMessages.shift();

    this.playerBubbleText = trimmed;
    clearTimeout(this.playerBubbleTimer);
    this.playerBubbleTimer = setTimeout(() => {
      this.playerBubbleText = '';
      this.updatePedestalBubbles();
    }, 4000);

    sound.playClick();
    this.updatePedestalBubbles();
    this.updateChatDrawer();
    this.showChatTicker('Bạn', trimmed);

    if (this.online.isConnected) {
      this.online.send({
        type: 'chat',
        senderName: this.online.role === 'host' ? 'Chủ Phòng' : 'Đồng Đội',
        text: trimmed,
      });
    }

    if (this.battle) {
      this.battle.sayChat(trimmed);
    }
  }

  private updatePedestalBubbles(): void {
    const b0 = document.getElementById('bubble-slot-0');
    if (b0) {
      b0.textContent = this.playerBubbleText;
      b0.style.display = this.playerBubbleText ? 'block' : 'none';
    }
    const b1 = document.getElementById('bubble-slot-1');
    if (b1) {
      b1.textContent = this.allyBubbleText;
      b1.style.display = this.allyBubbleText ? 'block' : 'none';
    }
  }

  private updateChatDrawer(): void {
    const listEl = document.getElementById('chat-history-container');
    if (!listEl) return;
    listEl.innerHTML = this.lobbyChatMessages
      .map(
        (m) => `
        <div class="chat-msg-row" style="${m.isSelf ? 'border-left-color:#facc15' : 'border-left-color:#38bdf8'}">
          <div class="chat-msg-author" style="${m.isSelf ? 'color:#fde047' : 'color:#7dd3fc'}">${this.escapeHtml(
          m.sender
        )} <span style="font-size:0.65rem;color:#94a3b8;font-weight:400;margin-left:4px">${m.time}</span></div>
          <div class="chat-msg-text">${this.escapeHtml(m.text)}</div>
        </div>
      `
      )
      .join('');
    listEl.scrollTop = listEl.scrollHeight;
  }

  // ==================== AUTHENTIC MOBI ARMY 3 LOBBY ROOM ====================

  private renderLobbyBoardHtml(): string {
    const tabs: Array<{ id: 'boss_hunt' | 'campaign' | 'online' | 'maps'; label: string }> = [
      { id: 'boss_hunt', label: '👑 Săn Boss Tổ Đội (7 Ải Boss Khủng)' },
      { id: 'campaign', label: '🗺️ Vượt Ải Chiến Dịch (25 Ải)' },
      { id: 'online', label: '🌐 Phòng Đấu Solo Online' },
      { id: 'maps', label: '⚔️ Tất Cả 50 Map Gốc' },
    ];

    const tabHtml = tabs
      .map(
        (t) => `
      <button class="board-tab-btn ${this.boardTab === t.id ? 'active' : ''}" data-board-tab="${t.id}">
        ${t.label}
      </button>
    `
      )
      .join('');

    let rowsHtml = '';
    if (this.boardTab === 'boss_hunt') {
      rowsHtml = BOSS_HUNT_STAGES.map((s) => {
        const mapDef = this.assets.maps.find((m) => m.mapId === s.mapId);
        const mapName = mapDef?.name ?? `Map ${s.mapId}`;
        const mapSize = mapDef ? `${mapDef.width}m x ${mapDef.height}m` : '1000m x 800m';
        const bossEnemy = s.enemies[0];
        const diff = bossEnemy?.difficulty ?? 'hard';
        const isSelected = this.selectedCoopBossStageId === s.id;
        return `
          <tr class="board-row" data-enter-boss-stage="${s.id}">
            <td class="board-cell">
              <div class="board-cell-stage">
                <span class="board-badge boss">Ải ${s.id}</span>
                <div>
                  <div class="board-stage-title">${s.name}</div>
                  <div class="board-stage-sub">${s.subtitle}</div>
                </div>
              </div>
            </td>
            <td class="board-cell">
              <div style="font-weight:700;color:#facc15">${mapName}</div>
              <div style="font-size:0.72rem;color:#94a3b8">Kích thước: ${mapSize}</div>
            </td>
            <td class="board-cell">
              <div style="font-weight:800;color:#f43f5e">${bossEnemy.name}</div>
              <div style="font-size:0.72rem;color:#cbd5e1">HP: ${bossEnemy.hp} | Công: ${bossEnemy.attack}</div>
            </td>
            <td class="board-cell">
              <span class="board-badge ${diff === 'hard' ? 'boss' : 'campaign'}">${diff.toUpperCase()}</span>
              <div style="font-size:0.72rem;color:#94a3b8;margin-top:2px">Gió tối đa: ${s.windMax}</div>
            </td>
            <td class="board-cell" style="text-align:right">
              <button class="board-btn-enter" data-enter-boss-stage="${s.id}">
                ${isSelected ? '⚔️ Bắt Đầu' : '🎯 Chọn Ải'}
              </button>
            </td>
          </tr>
        `;
      }).join('');
    } else if (this.boardTab === 'campaign') {
      rowsHtml = CAMPAIGN_STAGES.map((s) => {
        const mapDef = this.assets.maps.find((m) => m.mapId === s.mapId);
        const mapName = mapDef?.name ?? `Map ${s.mapId}`;
        const mapSize = mapDef ? `${mapDef.width}m x ${mapDef.height}m` : '1000m x 700m';
        const isLocked = s.id > this.unlockedStage;
        const isCurrent = s.id === this.unlockedStage;
        return `
          <tr class="board-row ${isLocked ? 'locked' : ''}" data-enter-campaign-stage="${s.id}" style="${isLocked ? 'opacity:0.5' : ''}">
            <td class="board-cell">
              <div class="board-cell-stage">
                <span class="board-badge campaign">Ải ${s.id}</span>
                <div>
                  <div class="board-stage-title">${s.name}</div>
                  <div class="board-stage-sub">${s.subtitle}</div>
                </div>
              </div>
            </td>
            <td class="board-cell">
              <div style="font-weight:700;color:#facc15">${mapName}</div>
              <div style="font-size:0.72rem;color:#94a3b8">${mapSize}</div>
            </td>
            <td class="board-cell">
              <div style="font-weight:700;color:#cbd5e1">${s.enemies.map((e) => e.name).join(', ')}</div>
              <div style="font-size:0.72rem;color:#94a3b8">${s.enemies.length} Kẻ Địch</div>
            </td>
            <td class="board-cell">
              <span class="board-badge ${isLocked ? 'boss' : 'campaign'}">${isLocked ? '🔒 Khóa' : isCurrent ? '⭐ Đang Đến' : '✅ Đã Vượt'}</span>
            </td>
            <td class="board-cell" style="text-align:right">
              <button class="board-btn-enter" data-enter-campaign-stage="${s.id}" ${isLocked ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>
                ${isLocked ? 'Chưa Mở' : '⚔️ Chiến Ngay'}
              </button>
            </td>
          </tr>
        `;
      }).join('');
    } else if (this.boardTab === 'online') {
      rowsHtml = `
        <tr class="board-row">
          <td class="board-cell" colspan="5" style="text-align:center;padding:24px 12px">
            <div style="font-size:1.1rem;font-weight:900;color:#facc15;margin-bottom:8px">🌐 PHÒNG ĐẤU TRỰC TUYẾN REALTIME</div>
            <div style="font-size:0.85rem;color:#cbd5e1;margin-bottom:16px">${this.onlineStatusText}</div>
            <div style="display:flex;justify-content:center;gap:12px">
              <button class="board-btn-enter" id="board-btn-create-online" style="padding:10px 22px;font-size:0.9rem">➕ Tạo Phòng 1v1 Mới</button>
              <button class="board-btn-enter" id="board-btn-join-online" style="padding:10px 22px;font-size:0.9rem;background:linear-gradient(180deg,#38bdf8,#0284c7)">🔑 Nhập Mã Phòng</button>
            </div>
          </td>
        </tr>
      `;
    } else {
      // 50 official maps
      rowsHtml = this.assets.maps.map((m) => {
        const isSelected = this.selectedMapId === m.mapId;
        const isBossMap = m.name.startsWith('Boss');
        return `
          <tr class="board-row" data-select-board-map="${m.mapId}">
            <td class="board-cell">
              <div class="board-cell-stage">
                <span class="board-badge ${isBossMap ? 'boss' : 'campaign'}">${isBossMap ? '👑 Boss' : 'Map'} #${m.mapId}</span>
                <div class="board-stage-title">${m.name}</div>
              </div>
            </td>
            <td class="board-cell">
              <div style="font-weight:700;color:#facc15">${m.width}m x ${m.height}m</div>
              <div style="font-size:0.72rem;color:#94a3b8">Mực nước: ${m.waterY}px</div>
            </td>
            <td class="board-cell">
              <div style="color:#cbd5e1">${m.bricks.length} Khối Địa Hình</div>
            </td>
            <td class="board-cell">
              <span class="board-badge ${isBossMap ? 'boss' : 'campaign'}">${isBossMap ? 'Map Boss Khủng' : 'Chiến Trường Tiêu Chuẩn'}</span>
            </td>
            <td class="board-cell" style="text-align:right">
              <button class="board-btn-enter" data-select-board-map="${m.mapId}">
                ${isSelected ? '✅ Đang Chọn' : '🎯 Chọn Map Này'}
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }

    return `
      <div class="lobby-board-view">
        <div class="board-tab-row">
          ${tabHtml}
        </div>
        <div class="board-table-container">
          <table class="board-table">
            <thead>
              <tr>
                <th>Ải / Bản Đồ</th>
                <th>Kích Thước</th>
                <th>Thông Số Đối Thủ</th>
                <th>Độ Khó / Trạng Thái</th>
                <th style="text-align:right">Hành Động</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  private renderLobby(): void {
    if (this.battle) {
      this.battle.destroy();
      this.battle = null;
    }
    this.hudRefs = null;

    const hero = getHeroById(this.selectedHeroId);
    const allyHero = getHeroById(this.selectedAllyHeroId);
    const remoteHero = getHeroById(this.onlineRemoteHeroId);
    const selectedMap =
      this.assets.maps.find((m) => m.mapId === this.selectedMapId) ?? this.assets.maps[0] ?? {
        mapId: 11,
        name: 'Rừng đá',
      };

    let modeTitle = 'Phòng 4-56';
    let roomTagLabel = '👑 Săn Boss Tổ Đội';
    if (this.activeTab === 'boss_hunt') {
      const bStage = BOSS_HUNT_STAGES.find((s) => s.id === this.selectedCoopBossStageId) ?? BOSS_HUNT_STAGES[0];
      modeTitle = `Săn Boss: ${bStage.subtitle}`;
      roomTagLabel = '👑 Săn Boss Tổ Đội';
    } else if (this.activeTab === 'campaign') {
      const cStage = CAMPAIGN_STAGES.find((s) => s.id === this.unlockedStage) ?? CAMPAIGN_STAGES[0];
      modeTitle = `Ải ${cStage.id}: ${cStage.name}`;
      roomTagLabel = '🗺️ Vượt Ải';
    } else if (this.activeTab === 'skirmish') {
      modeTitle = `Đấu Bot: ${this.selectedTeamSize}v${this.selectedTeamSize}`;
      roomTagLabel = '⚔️ Đấu Bot';
    } else if (this.activeTab === 'online') {
      modeTitle = this.online.roomCode ? `Phòng #${this.online.roomCode}` : 'Solo 1v1 Online';
      roomTagLabel = '🌐 Solo 1v1';
    }

    const startBtnLabel =
      this.online.isConnected && this.online.role === 'guest' ? 'Sẵn Sàng' : 'Bắt Đầu';

    // 6 Ô vật phẩm dưới chân
    const bagSlotsBottomHtml = Array.from({ length: 6 }, (_, idx) => {
      const itemId = this.selectedItems[idx];
      const it = itemId ? BATTLE_ITEMS.find((b) => b.id === itemId) : undefined;
      if (!it) {
        return `
          <div class="room-item-box empty" data-room-bag-slot="${idx}" title="Ô ${idx + 1} trống - Nhấp để lắp Item">
            <span style="color:#ca8a04;font-size:0.82rem;font-weight:900">${idx + 1}</span>
          </div>
        `;
      }
      return `
        <div class="room-item-box" data-room-bag-slot="${idx}" title="Ô ${idx + 1}: ${it.name} - Nhấp để đổi">
          <div class="item-icon-strip" style="background-image: url('./assets/ui/item.png'); background-position: 0px ${
            -26 * it.stripIndex
          }px"></div>
        </div>
      `;
    }).join('');

    this.uiRoot.innerHTML = `
      <div class="room-lobby-screen">
        <!-- Thanh Trên: Nút Chat, Bản Đồ Giữa, View Switch, Nút Mode/Âm Thanh -->
        <div class="room-top-bar">
          <div class="room-top-left">
            <button class="room-btn-circle" id="btn-room-chat" title="Mở Khung Chat">💬</button>
            <div class="room-top-title-block">
              <div class="room-top-brand-title">MOBI ARMY 3</div>
              <div class="room-top-brand-sub">${
                this.online.roomCode ? `P #${this.online.roomCode}` : 'Sảnh Chờ'
              }</div>
            </div>
          </div>

          <div class="room-top-center">
            <canvas id="room-map-thumb" width="124" height="52" class="room-map-thumbnail" title="Nhấp để chọn Bản Đồ"></canvas>
            <div class="room-map-info-text">
              <div class="room-map-name">${selectedMap.name}</div>
              <div class="room-title-code">${modeTitle}</div>
            </div>
            <div class="room-top-stats-row">
              <div class="room-gold-badge">🪙 1000</div>
              <div class="room-balance-bar">
                <span style="color:#38bdf8">49</span>
                <div class="room-balance-track"></div>
                <span style="color:#f43f5e">50</span>
              </div>
            </div>
          </div>

          <div class="room-top-right">
            <div class="lobby-view-toggle">
              <button class="lobby-toggle-btn ${this.lobbyView === 'room' ? 'active' : ''}" id="btn-view-room" title="Chế độ Phòng Chờ 8 Bệ">🏟️ Bệ Phòng</button>
              <button class="lobby-toggle-btn ${this.lobbyView === 'board' ? 'active' : ''}" id="btn-view-board" title="Chế độ Bảng Danh Sách Phòng & Ải">📋 Bảng Ải</button>
            </div>
            <button class="room-btn-circle" id="btn-room-sound" title="Bật/Tắt Âm Thanh">${
              sound.muted ? '🔇' : '🔊'
            }</button>
            <button class="pedestal-badge ready" id="btn-room-mode-tag" title="Nhấp để Đổi Chế Độ">${roomTagLabel} ▾</button>
          </div>
        </div>

        ${
          this.lobbyView === 'room'
            ? `
        <!-- 8 Bệ Đứng Chiến Binh (4 Phe Xanh Bên Trái vs 4 Phe Đỏ Bên Phải) -->
        <div class="room-pedestals-stage">
          <!-- Phe Trái (Team 1) -->
          <div class="pedestal-team-column">
            <!-- Slot 0: Chủ Phòng / Người Chơi -->
            <div class="pedestal-slot" id="slot-ped-0" title="Nhấp để Chọn Tướng">
              <div class="room-chat-bubble" id="bubble-slot-0" style="display:${
                this.playerBubbleText ? 'block' : 'none'
              }">${this.escapeHtml(this.playerBubbleText)}</div>
              <div class="pedestal-badge-row">
                <span class="pedestal-badge host">⭐ Chủ ⭐</span>
              </div>
              <canvas id="ped-char-0" width="80" height="85" class="pedestal-char-canvas"></canvas>
              <div class="pedestal-brick">
                <span class="pedestal-sm-text">SM: ${hero.attack + 20}</span>
              </div>
            </div>

            <!-- Slot 1: Đồng Đội (Bot AI hoặc Bạn Bè Online) -->
            <div class="pedestal-slot" id="slot-ped-1" title="Nhấp để Chọn Tướng Đồng Đội">
              <div class="room-chat-bubble" id="bubble-slot-1" style="display:${
                this.allyBubbleText ? 'block' : 'none'
              }">${this.escapeHtml(this.allyBubbleText)}</div>
              <div class="pedestal-badge-row">
                <span class="pedestal-badge ready">ok</span>
              </div>
              <canvas id="ped-char-1" width="80" height="85" class="pedestal-char-canvas"></canvas>
              <div class="pedestal-brick">
                <span class="pedestal-sm-text">SM: ${allyHero.attack + 18}</span>
              </div>
            </div>

            <!-- Slot 2: Trống -->
            <div class="pedestal-empty-box" id="slot-ped-2">
              <div class="pedestal-brick" style="background:#475569;border-color:#1e293b">
                <span style="font-size:0.7rem;color:#94a3b8;font-weight:700">+ Trống</span>
              </div>
            </div>

            <!-- Slot 3: Trống -->
            <div class="pedestal-empty-box" id="slot-ped-3">
              <div class="pedestal-brick" style="background:#475569;border-color:#1e293b">
                <span style="font-size:0.7rem;color:#94a3b8;font-weight:700">+ Trống</span>
              </div>
            </div>
          </div>

          <!-- Phe Phải (Team 2: Boss / Quái / Đối Thủ) -->
          <div class="pedestal-team-column">
            <!-- Slot 4: Boss / Đối Thủ -->
            <div class="pedestal-slot" id="slot-ped-4">
              <div class="pedestal-badge-row">
                <span class="pedestal-badge host" style="${
                  this.activeTab === 'boss_hunt' ? 'background:#ef4444;color:#fff' : ''
                }">${this.activeTab === 'boss_hunt' ? '👑 Boss' : 'ok'}</span>
              </div>
              <canvas id="ped-char-4" width="80" height="85" class="pedestal-char-canvas"></canvas>
              <div class="pedestal-brick">
                <span class="pedestal-sm-text">SM: 45</span>
              </div>
            </div>

            <!-- Slot 5: Minion / Bot 2 -->
            <div class="pedestal-slot" id="slot-ped-5">
              <div class="pedestal-badge-row">
                <span class="pedestal-badge ready">ok</span>
              </div>
              <canvas id="ped-char-5" width="80" height="85" class="pedestal-char-canvas"></canvas>
              <div class="pedestal-brick">
                <span class="pedestal-sm-text">SM: 33</span>
              </div>
            </div>

            <!-- Slot 6: Trống -->
            <div class="pedestal-empty-box">
              <div class="pedestal-brick" style="background:#475569;border-color:#1e293b">
                <span style="font-size:0.7rem;color:#94a3b8;font-weight:700">+ Trống</span>
              </div>
            </div>

            <!-- Slot 7: Trống -->
            <div class="pedestal-empty-box">
              <div class="pedestal-brick" style="background:#475569;border-color:#1e293b">
                <span style="font-size:0.7rem;color:#94a3b8;font-weight:700">+ Trống</span>
              </div>
            </div>
          </div>
        </div>
        `
            : this.renderLobbyBoardHtml()
        }

        <!-- Thanh Đáy: Nút Menu, 6 Ô Túi Đồ, Nút Bắt Đầu -->
        <div class="room-bottom-bar">
          <button class="room-pill-btn" id="btn-room-menu">📜 Menu</button>
          <div class="room-bag-slots-row" title="Túi 6 Vật Phẩm Mang Vào Trận (Nhấp để Cài Đặt)">
            ${bagSlotsBottomHtml}
          </div>
          <button class="room-pill-btn" id="btn-room-start">${startBtnLabel}</button>
        </div>

        <!-- Khung Modal Overlay hiển thị khi activeModal !== 'none' -->
        ${this.renderActiveModalHtml()}
      </div>
    `;

    // Vẽ các Tướng lên bệ đứng nếu đang ở chế độ bệ phòng
    if (this.lobbyView === 'room') {
      this.renderPedestalHeroes();
    }

    // Vẽ thumbnail bản đồ thu nhỏ
    const mapThumbCanvas = document.getElementById('room-map-thumb') as HTMLCanvasElement | null;
    if (mapThumbCanvas) {
      this.drawMapThumbnail(mapThumbCanvas);
    }

    // Gắn sự kiện các nút chính
    document.getElementById('btn-view-room')?.addEventListener('click', () => {
      sound.playClick();
      this.lobbyView = 'room';
      this.renderLobby();
    });

    document.getElementById('btn-view-board')?.addEventListener('click', () => {
      sound.playClick();
      this.lobbyView = 'board';
      this.renderLobby();
    });

    // Sự kiện chuyển Tab trên Bảng Danh Sách Phòng & Ải
    this.uiRoot.querySelectorAll<HTMLElement>('[data-board-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        sound.playClick();
        this.boardTab = btn.dataset.boardTab as any;
        this.renderLobby();
      });
    });

    // Chọn & vào ải Săn Boss từ Bảng
    this.uiRoot.querySelectorAll<HTMLElement>('[data-enter-boss-stage]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const stageId = parseInt(el.dataset.enterBossStage || '101', 10);
        sound.playClick();
        this.activeTab = 'boss_hunt';
        this.selectedCoopBossStageId = stageId;
        const st = BOSS_HUNT_STAGES.find((s) => s.id === stageId);
        if (st) this.selectedMapId = st.mapId;
        this.lobbyView = 'room';
        this.renderLobby();
      });
    });

    // Chọn ải Chiến Dịch từ Bảng
    this.uiRoot.querySelectorAll<HTMLElement>('[data-enter-campaign-stage]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const stageId = parseInt(el.dataset.enterCampaignStage || '1', 10);
        if (stageId > this.unlockedStage) return;
        sound.playClick();
        this.activeTab = 'campaign';
        const st = CAMPAIGN_STAGES.find((s) => s.id === stageId);
        if (st) this.selectedMapId = st.mapId;
        this.lobbyView = 'room';
        this.renderLobby();
      });
    });

    // Chọn Bản Đồ từ Bảng
    this.uiRoot.querySelectorAll<HTMLElement>('[data-select-board-map]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const mapId = parseInt(el.dataset.selectBoardMap || '1', 10);
        sound.playClick();
        this.selectedMapId = mapId;
        this.lobbyView = 'room';
        this.renderLobby();
      });
    });

    document.getElementById('board-btn-create-online')?.addEventListener('click', () => {
      sound.playClick();
      this.activeModal = 'online_room';
      this.renderLobby();
    });

    document.getElementById('board-btn-join-online')?.addEventListener('click', () => {
      sound.playClick();
      this.activeModal = 'online_room';
      this.renderLobby();
    });

    document.getElementById('btn-room-chat')?.addEventListener('click', () => {
      sound.playClick();
      this.activeModal = 'chat';
      this.renderLobby();
    });

    document.getElementById('btn-room-sound')?.addEventListener('click', () => {
      sound.toggleMute();
      this.renderLobby();
    });

    document.getElementById('btn-room-mode-tag')?.addEventListener('click', () => {
      sound.playClick();
      this.activeModal = 'mode';
      this.renderLobby();
    });

    document.getElementById('room-map-thumb')?.addEventListener('click', () => {
      sound.playClick();
      this.activeModal = 'map';
      this.renderLobby();
    });

    document.getElementById('slot-ped-0')?.addEventListener('click', () => {
      sound.playClick();
      this.selectingSlotForHero = 'player';
      this.activeModal = 'hero';
      this.renderLobby();
    });

    document.getElementById('slot-ped-1')?.addEventListener('click', () => {
      sound.playClick();
      this.selectingSlotForHero = 'ally';
      this.activeModal = 'hero';
      this.renderLobby();
    });

    this.uiRoot.querySelectorAll<HTMLElement>('[data-room-bag-slot]').forEach((el) => {
      el.addEventListener('click', () => {
        sound.playClick();
        this.activeModal = 'bag';
        this.renderLobby();
      });
    });

    document.getElementById('btn-room-menu')?.addEventListener('click', () => {
      sound.playClick();
      this.activeModal = 'menu';
      this.renderLobby();
    });

    document.getElementById('btn-room-start')?.addEventListener('click', () => {
      this.handleRoomStartClick();
    });

    // Gắn sự kiện các Modal (nếu đang mở)
    this.bindModalEvents();
  }

  private renderPedestalHeroes(): void {
    const hero = getHeroById(this.selectedHeroId);
    const allyHero = getHeroById(this.selectedAllyHeroId);
    const remoteHero = getHeroById(this.onlineRemoteHeroId);

    // Slot 0 (Left 1: Player) - quay sang phải
    const c0 = document.getElementById('ped-char-0') as HTMLCanvasElement | null;
    if (c0) this.previewRenderer.drawHeroPreview(c0, hero, 12, false);

    // Slot 1 (Left 2: Ally or Online Teammate) - quay sang phải
    const c1 = document.getElementById('ped-char-1') as HTMLCanvasElement | null;
    if (c1) {
      const activeAlly = this.online.isConnected ? remoteHero : allyHero;
      this.previewRenderer.drawHeroPreview(c1, activeAlly, 12, false);
    }

    // Slot 4 (Right 1: Boss or Opponent) - quay sang trái
    const c4 = document.getElementById('ped-char-4') as HTMLCanvasElement | null;
    if (c4) {
      if (this.activeTab === 'online') {
        const oppHero = this.online.isConnected ? remoteHero : getHeroById('ironman');
        this.previewRenderer.drawHeroPreview(c4, oppHero, 12, true);
      } else if (this.activeTab === 'boss_hunt') {
        const bossHero = getHeroById('ultron') || hero;
        this.previewRenderer.drawHeroPreview(c4, bossHero, 12, true);
      } else {
        const enemyHero = getHeroById('gunner');
        this.previewRenderer.drawHeroPreview(c4, enemyHero, 12, true);
      }
    }

    // Slot 5 (Right 2: Minion or Bot 2) - quay sang trái
    const c5 = document.getElementById('ped-char-5') as HTMLCanvasElement | null;
    if (c5) {
      const minionHero = getHeroById('loki') || hero;
      this.previewRenderer.drawHeroPreview(c5, minionHero, 12, true);
    }
  }

  private drawMapThumbnail(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#38bdf8');
    sky.addColorStop(0.7, '#bae6fd');
    sky.addColorStop(1, '#0284c7');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Đồi & đảo cỏ
    ctx.fillStyle = '#65a30d';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.72);
    ctx.quadraticCurveTo(w * 0.25, h * 0.48, w * 0.5, h * 0.65);
    ctx.quadraticCurveTo(w * 0.78, h * 0.85, w, h * 0.56);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();

    // Khối đất lơ lửng
    ctx.fillStyle = '#84cc16';
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.38, w * 0.22, h * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#365314';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Nước biển dưới chân
    ctx.fillStyle = 'rgba(2, 132, 199, 0.75)';
    ctx.fillRect(0, h * 0.82, w, h * 0.18);
  }

  private handleRoomStartClick(): void {
    sound.playClick();
    if (this.activeTab === 'boss_hunt') {
      const stage =
        BOSS_HUNT_STAGES.find((s) => s.id === this.selectedCoopBossStageId) ?? BOSS_HUNT_STAGES[0];
      if (this.online.isConnected && this.online.role === 'host') {
        const initialWind = Math.round((Math.random() * 2 - 1) * 12);
        const matchSeed = Math.floor(100000 + Math.random() * 900000);
        this.online.send({
          type: 'start_match',
          hostHeroId: this.selectedHeroId,
          guestHeroId: this.onlineRemoteHeroId,
          mapId: stage.mapId,
          seed: matchSeed,
          initialWind,
          coopStageId: stage.id,
        });
        this.launchBattle({
          mode: 'online',
          onlineRole: 'host',
          playerHeroId: this.selectedHeroId,
          remoteHeroId: this.onlineRemoteHeroId,
          teamSize: 2,
          mapId: stage.mapId,
          difficulty: 'hard',
          seed: matchSeed,
          onlineCoopStage: stage,
          selectedItems: this.selectedItems,
        });
      } else {
        // Đi cùng Bot AI
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
      }
    } else if (this.activeTab === 'campaign') {
      const stage = CAMPAIGN_STAGES.find((s) => s.id === this.unlockedStage) ?? CAMPAIGN_STAGES[0];
      this.launchBattle({
        mode: 'campaign',
        playerHeroId: this.selectedHeroId,
        teamSize: stage.allyHeroId ? 2 : 1,
        mapId: stage.mapId,
        difficulty: 'normal',
        stage,
        selectedItems: this.selectedItems,
      });
    } else if (this.activeTab === 'skirmish') {
      this.launchBattle({
        mode: 'skirmish',
        playerHeroId: this.selectedHeroId,
        allyHeroId: this.selectedAllyHeroId,
        teamSize: this.selectedTeamSize,
        mapId: this.selectedMapId,
        difficulty: this.selectedDifficulty,
        selectedItems: this.selectedItems,
      });
    } else if (this.activeTab === 'online') {
      if (this.online.isConnected && this.online.role === 'host') {
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
      } else {
        this.activeModal = 'online_room';
        this.renderLobby();
      }
    }
  }

  // ==================== MODAL OVERLAYS RENDERING ====================

  private renderActiveModalHtml(): string {
    if (this.activeModal === 'none') return '';

    if (this.activeModal === 'chat') {
      return `
        <div class="chat-drawer" id="modal-chat-drawer">
          <div class="army-modal-header" style="background:#0f172a">
            <h2>💬 Tin Nhắn Phòng</h2>
            <button class="ctrl-btn" id="btn-close-modal" style="height:28px;padding:0 8px">✕</button>
          </div>
          <div class="chat-history" id="chat-history-container">
            ${this.lobbyChatMessages
              .map(
                (m) => `
              <div class="chat-msg-row" style="${m.isSelf ? 'border-left-color:#facc15' : 'border-left-color:#38bdf8'}">
                <div class="chat-msg-author" style="${m.isSelf ? 'color:#fde047' : 'color:#7dd3fc'}">${this.escapeHtml(
                  m.sender
                )} <span style="font-size:0.65rem;color:#94a3b8;font-weight:400;margin-left:4px">${m.time}</span></div>
                <div class="chat-msg-text">${this.escapeHtml(m.text)}</div>
              </div>
            `
              )
              .join('')}
          </div>
          <div class="chat-quick-pills">
            <button class="chat-pill" data-quick-chat="Chào mọi người!">👋 Chào bạn!</button>
            <button class="chat-pill" data-quick-chat="Sẵn sàng chiến nào!">🚀 Sẵn sàng!</button>
            <button class="chat-pill" data-quick-chat="Tập trung hất boss!">💥 Bắn boss!</button>
            <button class="chat-pill" data-quick-chat="Cố lên bạn ơi!">🛡️ Cố lên!</button>
          </div>
          <div class="chat-input-bar">
            <input type="text" id="inp-chat-drawer" class="select-input" placeholder="Nhập tin nhắn..." maxlength="60" style="flex:1" />
            <button class="tab-btn active" id="btn-send-chat" style="padding:0 12px;height:36px">Gửi</button>
          </div>
        </div>
      `;
    }

    if (this.activeModal === 'menu') {
      return `
        <div class="army-modal-overlay">
          <div class="army-modal-box" style="max-width:440px">
            <div class="army-modal-header">
              <h2>📜 Menu Mobi Army 3</h2>
              <button class="ctrl-btn" id="btn-close-modal" style="height:28px;padding:0 8px">✕</button>
            </div>
            <div class="army-modal-body" style="display:flex;flex-direction:column;gap:10px">
              <button class="tab-btn ${this.activeTab === 'boss_hunt' ? 'active' : ''}" data-nav-mode="boss_hunt" style="justify-content:flex-start;padding:12px">👑 Săn Boss Tổ Đội</button>
              <button class="tab-btn ${this.activeTab === 'campaign' ? 'active' : ''}" data-nav-mode="campaign" style="justify-content:flex-start;padding:12px">🗺️ Chiến Dịch Vượt Ải (${Math.min(this.unlockedStage, CAMPAIGN_STAGES.length)}/${CAMPAIGN_STAGES.length})</button>
              <button class="tab-btn ${this.activeTab === 'skirmish' ? 'active' : ''}" data-nav-mode="skirmish" style="justify-content:flex-start;padding:12px">⚔️ Đấu Bot Tự Do (1v1, 2v2)</button>
              <button class="tab-btn ${this.activeTab === 'online' ? 'active' : ''}" data-nav-mode="online" style="justify-content:flex-start;padding:12px">🌐 Solo Trực Tuyến 1v1 (P2P)</button>
              <button class="tab-btn" id="menu-btn-hero" style="justify-content:flex-start;padding:12px">🦸 Chọn Tướng & Biệt Đội Marvel</button>
              <button class="tab-btn" id="menu-btn-bag" style="justify-content:flex-start;padding:12px">🎒 Cài Đặt Túi Đồ Chiến Đấu (6 Ô)</button>
              <button class="tab-btn" id="menu-btn-online-room" style="justify-content:flex-start;padding:12px">📡 Tạo / Vào Phòng Mời Bạn Online</button>
              <button class="tab-btn" id="menu-btn-guide" style="justify-content:flex-start;padding:12px">🎨 Hướng Dẫn & Thay Đồ Họa</button>
            </div>
            <div class="army-modal-footer">
              <button class="tab-btn" id="btn-close-modal-footer">Đóng</button>
            </div>
          </div>
        </div>
      `;
    }

    if (this.activeModal === 'mode') {
      return `
        <div class="army-modal-overlay">
          <div class="army-modal-box" style="max-width:480px">
            <div class="army-modal-header">
              <h2>🎮 Chọn Chế Độ Chơi</h2>
              <button class="ctrl-btn" id="btn-close-modal" style="height:28px;padding:0 8px">✕</button>
            </div>
            <div class="army-modal-body" style="display:flex;flex-direction:column;gap:12px">
              <button class="stage-card ${this.activeTab === 'boss_hunt' ? 'boss-stage' : ''}" data-set-mode="boss_hunt" style="cursor:pointer;text-align:left">
                <h3 style="margin:0 0 4px;color:#fde047">👑 Săn Boss Tổ Đội (Mời Bạn Hoặc Đi Bot)</h3>
                <p style="margin:0;font-size:0.8rem;color:#cbd5e1">2 Người chơi cùng phe đối đầu Boss khủng (Hulk, Thor, Ultron, Nhện máy...)</p>
              </button>
              <button class="stage-card ${this.activeTab === 'campaign' ? 'boss-stage' : ''}" data-set-mode="campaign" style="cursor:pointer;text-align:left">
                <h3 style="margin:0 0 4px;color:#38bdf8">🗺️ Vượt Ải Chiến Dịch (${this.unlockedStage}/${CAMPAIGN_STAGES.length})</h3>
                <p style="margin:0;font-size:0.8rem;color:#cbd5e1">Chuỗi ải chiến dịch mở dần, đánh bại kẻ địch và boss từng bản đồ</p>
              </button>
              <button class="stage-card ${this.activeTab === 'skirmish' ? 'boss-stage' : ''}" data-set-mode="skirmish" style="cursor:pointer;text-align:left">
                <h3 style="margin:0 0 4px;color:#4ade80">⚔️ Đấu Bot Tự Do</h3>
                <p style="margin:0;font-size:0.8rem;color:#cbd5e1">Tập bắn thoải mái, chọn 27 bản đồ gốc và độ khó Bot</p>
              </button>
              <button class="stage-card ${this.activeTab === 'online' ? 'boss-stage' : ''}" data-set-mode="online" style="cursor:pointer;text-align:left">
                <h3 style="margin:0 0 4px;color:#fb7185">🌐 Solo Trực Tuyến 1v1</h3>
                <p style="margin:0;font-size:0.8rem;color:#cbd5e1">Tạo phòng lấy mã 4 số mời bạn bè so tài trực tuyến qua mạng</p>
              </button>
            </div>
          </div>
        </div>
      `;
    }

    if (this.activeModal === 'hero') {
      const isAlly = this.selectingSlotForHero === 'ally';
      const curHeroId = isAlly ? this.selectedAllyHeroId : this.selectedHeroId;
      const curHero = getHeroById(curHeroId);
      return `
        <div class="army-modal-overlay">
          <div class="army-modal-box">
            <div class="army-modal-header">
              <h2>🦸 ${isAlly ? 'Chọn Tướng Đồng Đội' : 'Chọn Chiến Binh Của Bạn'}: <span style="color:#fde047">${curHero.name}</span></h2>
              <button class="ctrl-btn" id="btn-close-modal" style="height:28px;padding:0 8px">✕</button>
            </div>
            <div class="army-modal-body">
              <div class="hero-grid" style="margin-bottom:14px">
                ${HEROES.map(
                  (h) => `
                  <div class="hero-card ${h.faction === 'marvel' ? 'marvel-hero' : ''} ${
                    h.id === curHeroId ? 'selected' : ''
                  }" data-pick-hero="${h.id}">
                    ${h.faction === 'marvel' ? '<span class="marvel-badge">MARVEL</span>' : ''}
                    <canvas id="modal-hero-${h.id}" width="72" height="72"></canvas>
                    <div class="hero-name" style="color:${h.color}">${h.name}</div>
                    <div class="hero-role">${h.title.replace(' [MARVEL]', '')}</div>
                  </div>
                `
                ).join('')}
              </div>
              <div class="hero-detail-bar">
                <div>
                  <div style="font-weight:800;font-size:0.95rem;color:${curHero.color}">${curHero.name} — Tuyệt kỹ Nộ: <span style="color:#fde047">${curHero.powName}</span></div>
                  <div style="font-size:0.82rem;color:#cbd5e1;margin-top:2px">${curHero.description}</div>
                </div>
                <div class="stat-pills">
                  <span class="stat-pill">❤️ HP: ${curHero.hp}</span>
                  <span class="stat-pill">💥 Công: ${curHero.attack}</span>
                  <span class="stat-pill">📐 Góc: ${curHero.minAngle}°..${curHero.maxAngle}°</span>
                  <span class="stat-pill">🏃 Thể lực: ${curHero.staminaMax}</span>
                </div>
              </div>
            </div>
            <div class="army-modal-footer">
              <button class="primary-cta" id="btn-confirm-hero" style="padding:8px 22px">Xác Nhận Chọn</button>
            </div>
          </div>
        </div>
      `;
    }

    if (this.activeModal === 'bag') {
      const bagSlotsModalHtml = Array.from({ length: 6 }, (_, idx) => {
        const itemId = this.selectedItems[idx];
        const it = itemId ? BATTLE_ITEMS.find((b) => b.id === itemId) : undefined;
        if (!it) {
          return `
            <div class="loadout-item-card" style="opacity:0.45;border-style:dashed;justify-content:center;min-height:54px">
              <div style="font-size:0.75rem;color:#64748b;text-align:center">Ô ${idx + 1} (Trống)</div>
            </div>
          `;
        }
        return `
          <div class="loadout-item-card selected" data-bag-remove="${idx}" title="Nhấp để tháo ${it.name} khỏi Ô ${idx + 1}">
            <span class="loadout-item-badge">Ô ${idx + 1}</span>
            <div class="item-icon-strip" style="background-image: url('./assets/ui/item.png'); background-position: 0px ${-26 * it.stripIndex}px"></div>
            <div style="flex:1;min-width:0">
              <div style="font-size:0.78rem;font-weight:700;color:#fde047;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${it.name}</div>
              <div style="font-size:0.65rem;color:#cbd5e1">1 lần • Nhấp để tháo</div>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="army-modal-overlay">
          <div class="army-modal-box">
            <div class="army-modal-header">
              <h2>🎒 Cài Đặt Túi Đồ (6 Ô — Mỗi Ô 1 Lần Dùng, Được Lắp Trùng Nhau)</h2>
              <button class="ctrl-btn" id="btn-close-modal" style="height:28px;padding:0 8px">✕</button>
            </div>
            <div class="army-modal-body">
              <div style="margin-bottom:12px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                  <div style="font-size:0.78rem;color:#7dd3fc;font-weight:700">🎒 6 Ô ĐANG MANG VÀO TRẬN (Phím 1..6 — Nhấp vào ô để tháo):</div>
                  <button class="ctrl-btn" id="btn-clear-bag-modal" style="height:24px;font-size:0.7rem;padding:0 8px">🗑️ Làm Trống</button>
                </div>
                <div class="loadout-items-grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">
                  ${bagSlotsModalHtml}
                </div>
              </div>
              <div style="font-size:0.78rem;color:#cbd5e1;font-weight:700;margin-bottom:6px">➕ KHO VẬT PHẨM (Nhấp vào món để thêm vào ô trống tiếp theo):</div>
              <div class="loadout-items-grid">
                ${BATTLE_ITEMS.map((it) => {
                  const equippedCount = this.selectedItems.filter((x) => x === it.id).length;
                  const isSel = equippedCount > 0;
                  return `
                    <div class="loadout-item-card ${isSel ? 'selected' : ''}" data-loadout-item="${it.id}">
                      ${isSel ? `<span class="loadout-item-badge">x${equippedCount}</span>` : ''}
                      <div class="item-icon-strip" style="background-image: url('./assets/ui/item.png'); background-position: 0px ${-26 * it.stripIndex}px"></div>
                      <div>
                        <div style="font-size:0.8rem;font-weight:700;color:${isSel ? '#fde047' : '#f8fafc'}">${it.name}</div>
                        <div style="font-size:0.68rem;color:#94a3b8">${it.shortDesc}</div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
            <div class="army-modal-footer">
              <button class="primary-cta" id="btn-confirm-bag" style="padding:8px 22px">Xong</button>
            </div>
          </div>
        </div>
      `;
    }

    if (this.activeModal === 'map') {
      return `
        <div class="army-modal-overlay">
          <div class="army-modal-box">
            <div class="army-modal-header">
              <h2>🗺️ Chọn Bản Đồ & Ải Săn Boss</h2>
              <button class="ctrl-btn" id="btn-close-modal" style="height:28px;padding:0 8px">✕</button>
            </div>
            <div class="army-modal-body">
              <h3 style="margin:0 0 8px;font-size:0.92rem;color:#fde047">👑 Ải Săn Boss Khủng:</h3>
              <div class="stage-grid" style="margin-bottom:16px">
                ${BOSS_HUNT_STAGES.map((st) => `
                  <div class="stage-card boss-stage ${st.id === this.selectedCoopBossStageId ? 'selected' : ''}" data-pick-boss-stage="${st.id}" style="cursor:pointer">
                    <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                      <span class="stage-badge" style="background:rgba(239,68,68,0.25);color:#fca5a5">${st.subtitle}</span>
                      <span style="font-size:0.72rem;color:#94a3b8">Map #${st.mapId}</span>
                    </div>
                    <h3 style="margin:0 0 4px;font-size:0.95rem;color:#f8fafc">${st.name}</h3>
                    <p style="margin:0;font-size:0.76rem;color:#cbd5e1">${st.description}</p>
                  </div>
                `).join('')}
              </div>

              <h3 style="margin:0 0 8px;font-size:0.92rem;color:#38bdf8">🗺️ Danh Sách 27 Bản Đồ Chiến Trường:</h3>
              <div class="hero-grid" style="grid-template-columns:repeat(auto-fill,minmax(140px,1fr))">
                ${this.assets.maps.map((m) => `
                  <div class="loadout-item-card ${m.mapId === this.selectedMapId ? 'selected' : ''}" data-pick-map="${m.mapId}" style="cursor:pointer;flex-direction:column;align-items:flex-start">
                    <div style="font-weight:700;font-size:0.82rem;color:#f8fafc">#${m.mapId} — ${m.name}</div>
                    <div style="font-size:0.68rem;color:#94a3b8">${m.width}x${m.height}px</div>
                  </div>
                `).join('')}
              </div>
            </div>
            <div class="army-modal-footer">
              <button class="primary-cta" id="btn-confirm-map" style="padding:8px 22px">Xác Nhận</button>
            </div>
          </div>
        </div>
      `;
    }

    if (this.activeModal === 'online_room') {
      const inviteUrl = this.online.roomCode
        ? `${window.location.origin}${window.location.pathname}?room=${this.online.roomCode}`
        : '';
      return `
        <div class="army-modal-overlay">
          <div class="army-modal-box" style="max-width:540px">
            <div class="army-modal-header">
              <h2>🌐 Phòng Trực Tuyến (P2P WebRTC)</h2>
              <button class="ctrl-btn" id="btn-close-modal" style="height:28px;padding:0 8px">✕</button>
            </div>
            <div class="army-modal-body" style="display:flex;flex-direction:column;gap:12px">
              <div style="background:rgba(2,6,23,0.6);border:1px solid rgba(56,189,248,0.3);border-radius:10px;padding:10px 12px">
                <div style="font-size:0.85rem;color:#e2e8f0;margin-bottom:6px">
                  <strong>Trạng thái:</strong> <span style="color:#7dd3fc">${this.onlineStatusText}</span>
                </div>
                ${
                  this.online.roomCode
                    ? `
                  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                    <span class="stat-pill" style="background:#0284c7;color:#fff;font-size:0.9rem">Mã Phòng: #${this.online.roomCode}</span>
                    <button class="ctrl-btn" id="btn-copy-modal-room" style="height:30px;font-size:0.75rem">📋 Copy Link Mời</button>
                  </div>
                `
                    : ''
                }
              </div>

              <div class="field-group">
                <label>Bước 1 (Chủ Phòng): Tạo Phòng Lấy Mã</label>
                <button class="tab-btn active" id="btn-modal-host" style="width:100%;height:38px">📡 Tạo Phòng Mới</button>
              </div>

              <div class="field-group">
                <label>Bước 2 (Khách): Nhập Mã 4 Số Để Vào Phòng</label>
                <div style="display:flex;gap:8px">
                  <input type="text" id="inp-modal-code" class="select-input" placeholder="VD: 4829" maxlength="6" style="flex:1" value="${
                    this.online.role === 'guest' ? this.online.roomCode : ''
                  }" />
                  <button class="tab-btn" id="btn-modal-join" style="padding:0 16px">🔗 Vào</button>
                </div>
              </div>

              ${
                this.online.isConnected
                  ? `<button class="ctrl-btn" id="btn-modal-leave" style="color:#fda4af;border-color:rgba(244,63,94,0.5);margin-top:6px">🚪 Rời Khỏi Phòng Hiện Tại</button>`
                  : ''
              }
            </div>
            <div class="army-modal-footer">
              <button class="primary-cta" id="btn-confirm-online-room" style="padding:8px 22px">Xong</button>
            </div>
          </div>
        </div>
      `;
    }

    if (this.activeModal === 'guide') {
      return `
        <div class="army-modal-overlay">
          <div class="army-modal-box">
            <div class="army-modal-header">
              <h2>🎨 Hướng Dẫn & Thay Thế Đồ Họa</h2>
              <button class="ctrl-btn" id="btn-close-modal" style="height:28px;padding:0 8px">✕</button>
            </div>
            <div class="army-modal-body" style="line-height:1.6;font-size:0.86rem;color:#cbd5e1">
              <p>Mobi Army 3 Web Edition hỗ trợ tùy biến đồ họa, bản đồ và âm thanh:</p>
              <ul style="padding-left:20px;margin:8px 0">
                <li><strong>Địa hình:</strong> Thay ảnh gạch trong <code>public/assets/bricks/*.png</code> hoặc bố cục trong <code>maps.json</code>.</li>
                <li><strong>Đạn & Bom:</strong> Ghi đè file PNG trong <code>bullets/</code>, <code>holes/</code>, <code>effects/</code>.</li>
                <li><strong>Nhân vật & Skin:</strong> Tướng Marvel đặt trong <code>public/assets/heroes/small/2Small*.png</code>.</li>
              </ul>
              <p style="color:#fde047"><strong>Phím tắt:</strong> <code>A / D</code> di chuyển • <code>W / S</code> chỉnh góc • Giữ <code>SPACE</code> gồng lực • <code>P</code> bật Nộ POW • <code>1..6</code> dùng Item • <code>U</code> gọi phân thân Ultron.</p>
            </div>
            <div class="army-modal-footer">
              <button class="primary-cta" id="btn-confirm-guide" style="padding:8px 22px">Đóng</button>
            </div>
          </div>
        </div>
      `;
    }

    return '';
  }

  private bindModalEvents(): void {
    if (this.activeModal === 'none') return;

    // Nút đóng modal chung
    const closeModal = () => {
      sound.playClick();
      this.activeModal = 'none';
      this.renderLobby();
    };

    document.getElementById('btn-close-modal')?.addEventListener('click', closeModal);
    document.getElementById('btn-close-modal-footer')?.addEventListener('click', closeModal);
    document.getElementById('btn-confirm-hero')?.addEventListener('click', closeModal);
    document.getElementById('btn-confirm-bag')?.addEventListener('click', closeModal);
    document.getElementById('btn-confirm-map')?.addEventListener('click', closeModal);
    document.getElementById('btn-confirm-online-room')?.addEventListener('click', closeModal);
    document.getElementById('btn-confirm-guide')?.addEventListener('click', closeModal);

    // Chat Drawer
    if (this.activeModal === 'chat') {
      const inp = document.getElementById('inp-chat-drawer') as HTMLInputElement | null;
      const doSend = () => {
        if (inp && inp.value.trim()) {
          this.sendChatMessage(inp.value.trim());
          inp.value = '';
        }
      };
      document.getElementById('btn-send-chat')?.addEventListener('click', doSend);
      inp?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') doSend();
      });
      this.uiRoot.querySelectorAll<HTMLElement>('[data-quick-chat]').forEach((pill) => {
        pill.addEventListener('click', () => {
          const txt = pill.dataset.quickChat;
          if (txt) this.sendChatMessage(txt);
        });
      });
    }

    // Menu Drawer Navigation
    if (this.activeModal === 'menu') {
      this.uiRoot.querySelectorAll<HTMLElement>('[data-nav-mode]').forEach((btn) => {
        btn.addEventListener('click', () => {
          sound.playClick();
          this.activeTab = btn.dataset.navMode as any;
          this.activeModal = 'none';
          this.renderLobby();
        });
      });
      document.getElementById('menu-btn-hero')?.addEventListener('click', () => {
        sound.playClick();
        this.selectingSlotForHero = 'player';
        this.activeModal = 'hero';
        this.renderLobby();
      });
      document.getElementById('menu-btn-bag')?.addEventListener('click', () => {
        sound.playClick();
        this.activeModal = 'bag';
        this.renderLobby();
      });
      document.getElementById('menu-btn-online-room')?.addEventListener('click', () => {
        sound.playClick();
        this.activeModal = 'online_room';
        this.renderLobby();
      });
      document.getElementById('menu-btn-guide')?.addEventListener('click', () => {
        sound.playClick();
        this.activeModal = 'guide';
        this.renderLobby();
      });
    }

    // Mode Selection Modal
    if (this.activeModal === 'mode') {
      this.uiRoot.querySelectorAll<HTMLElement>('[data-set-mode]').forEach((btn) => {
        btn.addEventListener('click', () => {
          sound.playClick();
          this.activeTab = btn.dataset.setMode as any;
          this.activeModal = 'none';
          this.renderLobby();
        });
      });
    }

    // Hero Selection Modal
    if (this.activeModal === 'hero') {
      for (const h of HEROES) {
        const c = document.getElementById(`modal-hero-${h.id}`) as HTMLCanvasElement | null;
        if (c) {
          this.previewRenderer.drawHeroPreview(c, h, 12, false);
        }
      }
      this.uiRoot.querySelectorAll<HTMLElement>('[data-pick-hero]').forEach((card) => {
        card.addEventListener('click', () => {
          sound.playClick();
          const pickId = card.dataset.pickHero || 'captain';
          if (this.selectingSlotForHero === 'ally') {
            this.selectedAllyHeroId = pickId;
          } else {
            this.selectedHeroId = pickId;
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
          }
          this.renderLobby();
        });
      });
    }

    // Bag Selection Modal
    if (this.activeModal === 'bag') {
      this.uiRoot.querySelectorAll<HTMLElement>('[data-loadout-item]').forEach((card) => {
        card.addEventListener('click', () => {
          const id = card.dataset.loadoutItem as BattleItemId;
          this.addItemToBag(id);
        });
      });
      this.uiRoot.querySelectorAll<HTMLElement>('[data-bag-remove]').forEach((card) => {
        card.addEventListener('click', () => {
          const slotIdx = parseInt(card.dataset.bagRemove || '0', 10);
          this.removeBagSlotAt(slotIdx);
        });
      });
      document.getElementById('btn-clear-bag-modal')?.addEventListener('click', () => {
        sound.playClick();
        this.selectedItems = [];
        localStorage.setItem(STORAGE_ITEMS_KEY, JSON.stringify(this.selectedItems));
        this.renderLobby();
      });
    }

    // Map Selection Modal
    if (this.activeModal === 'map') {
      this.uiRoot.querySelectorAll<HTMLElement>('[data-pick-boss-stage]').forEach((card) => {
        card.addEventListener('click', () => {
          sound.playClick();
          const sId = parseInt(card.dataset.pickBossStage || '101', 10);
          this.selectedCoopBossStageId = sId;
          const st = BOSS_HUNT_STAGES.find((s) => s.id === sId);
          if (st) this.selectedMapId = st.mapId;
          this.activeTab = 'boss_hunt';
          this.broadcastLobbySync();
          this.activeModal = 'none';
          this.renderLobby();
        });
      });
      this.uiRoot.querySelectorAll<HTMLElement>('[data-pick-map]').forEach((card) => {
        card.addEventListener('click', () => {
          sound.playClick();
          this.selectedMapId = parseInt(card.dataset.pickMap || '11', 10);
          this.broadcastLobbySync();
          this.activeModal = 'none';
          this.renderLobby();
        });
      });
    }

    // Online Room Modal
    if (this.activeModal === 'online_room') {
      document.getElementById('btn-modal-host')?.addEventListener('click', async () => {
        sound.playClick();
        try {
          await this.online.hostRoom();
          this.renderLobby();
        } catch {
          this.renderLobby();
        }
      });
      document.getElementById('btn-modal-join')?.addEventListener('click', async () => {
        sound.playClick();
        const inp = document.getElementById('inp-modal-code') as HTMLInputElement | null;
        const code = inp?.value.trim() || '';
        if (!code) return;
        try {
          await this.online.joinRoom(code);
          this.renderLobby();
        } catch {
          this.renderLobby();
        }
      });
      document.getElementById('btn-modal-leave')?.addEventListener('click', () => {
        sound.playClick();
        this.online.leaveRoom('Bạn đã rời phòng');
        this.renderLobby();
      });
      document.getElementById('btn-copy-modal-room')?.addEventListener('click', (e) => {
        sound.playItemUse();
        const url = `${window.location.origin}${window.location.pathname}?room=${this.online.roomCode}`;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(url);
          (e.currentTarget as HTMLButtonElement).textContent = '✅ Đã Copy Link!';
        }
      });
    }
  }

  private addItemToBag(id: BattleItemId): void {
    if (this.selectedItems.length < 6) {
      this.selectedItems.push(id);
    } else {
      this.selectedItems[5] = id;
    }
    sound.playItemUse();
    localStorage.setItem(STORAGE_ITEMS_KEY, JSON.stringify(this.selectedItems));
    this.renderLobby();
  }

  private removeBagSlotAt(slotIdx: number): void {
    if (slotIdx >= 0 && slotIdx < this.selectedItems.length) {
      this.selectedItems.splice(slotIdx, 1);
      sound.playClick();
      localStorage.setItem(STORAGE_ITEMS_KEY, JSON.stringify(this.selectedItems));
      this.renderLobby();
    }
  }

  // ==================== BATTLE HUD & LAUNCH ====================

  private async launchBattle(setup: BattleSetup): Promise<void> {
    if (!setup.selectedItems || setup.selectedItems.length === 0) {
      setup.selectedItems =
        this.selectedItems.length > 0 ? [...this.selectedItems] : ['heal'];
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
    this.battle.onChatMessage = (msg) => {
      this.showChatTicker(msg.sender, msg.text);
    };
    this.battle.start();
  }

  private buildBattleHudDom(setup?: BattleSetup): void {
    const activeItems =
      setup?.selectedItems && setup.selectedItems.length > 0
        ? setup.selectedItems.slice(0, 6)
        : this.battle?.setup.selectedItems && this.battle.setup.selectedItems.length > 0
        ? this.battle.setup.selectedItems.slice(0, 6)
        : this.selectedItems.slice(0, 6);

    const itemsHtml = activeItems
      .map((itemId, idx) => {
        const it = BATTLE_ITEMS.find((b) => b.id === itemId) || BATTLE_ITEMS[0];
        const hotkey = String(idx + 1);
        return `
        <button class="item-btn" data-bag-slot="${idx}" data-item="${it.id}" title="Ô ${hotkey} — ${it.name} (Phím ${hotkey}): ${it.shortDesc} [1 lần dùng]">
          <span class="item-key">${hotkey}</span>
          <div class="item-icon-strip" style="background-image: url('./assets/ui/item.png'); background-position: 0px ${-26 * it.stripIndex}px"></div>
          <span class="item-count" id="slot-cnt-${idx}">1</span>
        </button>
      `;
      })
      .join('');

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
          <button class="ctrl-btn" id="btn-battle-chat" title="Chat Trong Trận (Phím Enter)">💬 Chat</button>
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

        <!-- Thanh thông báo Đang chờ lượt của đối thủ / đồng đội -->
        <div class="hud-bottom-spectator" id="hud-spectator-bar" style="display:none">
          <div class="spectator-pulse-dot"></div>
          <div id="hud-spectator-text" style="font-size:0.95rem;font-weight:800;color:#f8fafc">Đang chờ lượt...</div>
        </div>
      </div>
    `;

    const slotBtns: Array<{ btn: HTMLButtonElement; countEl: HTMLElement; itemId: BattleItemId }> =
      [];
    this.uiRoot.querySelectorAll<HTMLButtonElement>('[data-bag-slot]').forEach((btn) => {
      const slotIdx = parseInt(btn.dataset.bagSlot || '0', 10);
      const id = btn.dataset.item as BattleItemId;
      const countEl = document.getElementById(`slot-cnt-${slotIdx}`)!;
      slotBtns.push({ btn, countEl, itemId: id });
      btn.addEventListener('click', () => this.battle?.useBagSlot(slotIdx));
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
      slotBtns,
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
    document.getElementById('btn-battle-chat')?.addEventListener('click', () => {
      const msg = window.prompt('Nhập tin nhắn chat trong trận (hiển thị trên đầu tướng):');
      if (msg && msg.trim()) {
        this.sendChatMessage(msg.trim());
      }
    });
    document.getElementById('btn-exit-lobby')?.addEventListener('click', () => {
      sound.playClick();
      if (this.battle && this.battle.setup.mode === 'online' && this.online.isConnected) {
        this.online.leaveRoom('Người chơi đã thoát trận');
      }
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
    const displayUnitName =
      u && u.baseHeroId === 'loki' && u.morphedHeroName
        ? `${u.name} [Biến: ${u.morphedHeroName}]`
        : u?.name ?? '';
    r.turnInfo.textContent = u
      ? `Lượt ${snap.turnNumber}: ${displayUnitName}`
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

    // Ẩn/Hiện UI bắn khi chuyển qua lượt đối thủ hoặc đồng đội
    const isPlayerTurn = !!(u && u.isPlayerControlled);
    const dpadEl = this.uiRoot.querySelector('.dpad-cluster') as HTMLElement | null;
    const barsEl = this.uiRoot.querySelector('.bars-center') as HTMLElement | null;
    const fireEl = this.uiRoot.querySelector('.fire-cluster') as HTMLElement | null;
    const specEl = document.getElementById('hud-spectator-bar');
    const specTextEl = document.getElementById('hud-spectator-text');

    if (isPlayerTurn) {
      if (dpadEl) dpadEl.style.display = 'flex';
      if (barsEl) barsEl.style.display = 'flex';
      if (fireEl) fireEl.style.display = 'flex';
      if (specEl) specEl.style.display = 'none';
    } else {
      if (dpadEl) dpadEl.style.display = 'none';
      if (barsEl) barsEl.style.display = 'none';
      if (fireEl) fireEl.style.display = 'none';
      if (specEl) {
        specEl.style.display = 'flex';
        if (specTextEl) {
          specTextEl.innerHTML = `⏳ ĐANG CHỜ LƯỢT: <span style="color:#fde047">${displayUnitName || 'Đối Thủ'}</span> (${snap.turnTimeLeft}s)`;
        }
      }
    }

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

      r.slotBtns.forEach((entry, idx) => {
        const slotState = u.bagSlots?.[idx];
        const available = slotState ? !slotState.used : (u.inventory[entry.itemId] ?? 0) > 0;
        entry.countEl.textContent = available ? '1' : '0';
        entry.btn.disabled = !canControl || !available;
        const armed =
          snap.armedBagSlotIdx === idx ||
          (snap.armedBagSlotIdx === null &&
            (snap.activeItemArmed === entry.itemId ||
              (entry.itemId === 'double' && snap.doubleArmed)));
        entry.btn.classList.toggle('armed', armed);
      });
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
        if (code === 'Enter') {
          const msg = window.prompt('Nhập tin nhắn chat:');
          if (msg && msg.trim()) this.sendChatMessage(msg.trim());
        }
        if (code.startsWith('Digit')) {
          const num = parseInt(code.replace('Digit', ''), 10);
          if (num >= 1 && num <= 6) {
            this.battle.useBagSlot(num - 1);
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
