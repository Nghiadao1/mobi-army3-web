import type Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { BattleItemId } from '../types';

export type OnlineBattleAction =
  | {
    action: 'sync_pos';
    unitId: string;
    x: number;
    y: number;
    facingLeft: boolean;
    aimAngle: number;
    stamina: number;
  }
  | {
    action: 'use_item';
    unitId: string;
    itemId: BattleItemId;
  }
  | {
    action: 'toggle_pow';
    unitId: string;
    active: boolean;
  }
  | {
    action: 'fire';
    unitId: string;
    x: number;
    y: number;
    facingLeft: boolean;
    aimAngle: number;
    power: number;
    activeShotMod: BattleItemId | null;
    powQueued: boolean;
    nextWind: number;
  }
  | {
    action: 'skip_turn';
    unitId: string;
    nextWind: number;
  }
  | {
    action: 'loki_morph';
    unitId: string;
    morphHeroId: string;
  }
  | {
    action: 'ultron_clone';
    unitId: string;
    cloneId: string;
    spawnX: number;
    spawnY: number;
    cloneHp: number;
    cloneAttack: number;
  }
  | {
    action: 'chat';
    unitId: string;
    text: string;
  };

export type OnlinePacket =
  | {
    type: 'lobby_sync';
    hostHeroId: string;
    guestHeroId: string;
    mapId: number;
    hostName: string;
    guestName: string;
    coopStageId?: number;
  }
  | {
    type: 'guest_select';
    guestHeroId: string;
    guestName: string;
  }
  | {
    type: 'start_match';
    hostHeroId: string;
    guestHeroId: string;
    mapId: number;
    seed: number;
    initialWind: number;
    coopStageId?: number;
  }
  | {
    type: 'battle_action';
    payload: OnlineBattleAction;
  }
  | {
    type: 'chat';
    senderName: string;
    text: string;
    isLobby?: boolean;
  }
  | {
    type: 'player_left';
    role: 'host' | 'guest';
    reason: string;
  };

const PEER_PREFIX = 'mobiarmy3-solo-';

// --- Độ tin cậy kết nối (P2) ---
const CONNECT_TIMEOUT_MS = 15000; // Tối đa chờ tạo/vào phòng, tránh treo vô hạn ở "Đang kết nối..."
const HEARTBEAT_INTERVAL_MS = 5000; // Chu kỳ gửi ping giữ kết nối
const HEARTBEAT_TIMEOUT_MS = 15000; // Quá thời gian này không nghe tin đối thủ -> coi như mất liên lạc
const MAX_HOST_ATTEMPTS = 5; // Số lần thử mã phòng mới khi bị trùng mã (unavailable-id)

type PeerErrorLike = Error & { type?: string };

export class OnlineManager {
  public role: 'host' | 'guest' | null = null;
  public roomCode = '';
  public isConnected = false;

  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private heartbeatTimer: number | null = null;
  private lastHeardAt = 0;
  private peerOpenReject: ((err: unknown) => void) | null = null;
  private peerOpenTimer: number | null = null;
  private joinReject: ((err: unknown) => void) | null = null;

  public onStatusChange?: (status: string, connected: boolean) => void;
  public onPacket?: (packet: OnlinePacket) => void;
  public onDisconnect?: () => void;

  // PeerJS được nạp lười (dynamic import) để không nặng bundle trang đầu:
  // chỉ khi người chơi tạo/vào phòng thì thư viện mới tải về.
  private async loadPeerCtor(): Promise<typeof Peer> {
    const mod = await import('peerjs');
    return mod.default;
  }

  private clearPeerOpenWait(): void {
    this.peerOpenReject = null;
    if (this.peerOpenTimer !== null) {
      window.clearTimeout(this.peerOpenTimer);
      this.peerOpenTimer = null;
    }
  }

  // Tạo 1 Peer và chờ sự kiện 'open' với timeout + bắt lỗi (vd trùng mã phòng).
  private async createPeerAndWaitOpen(peerId?: string): Promise<Peer> {
    const PeerCtor = await this.loadPeerCtor();
    return new Promise<Peer>((resolve, reject) => {
      const peer: Peer = peerId ? new PeerCtor(peerId) : new PeerCtor();
      let settled = false;

      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        this.clearPeerOpenWait();
        fn();
      };

      this.peerOpenTimer = window.setTimeout(() => {
        settle(() => {
          try {
            peer.destroy();
          } catch {
            // ignore
          }
          const err = new Error(
            'Quá thời gian chờ máy chủ kết nối (15 giây). Kiểm tra mạng rồi thử lại.'
          ) as PeerErrorLike;
          err.type = 'connect-timeout';
          reject(err);
        });
      }, CONNECT_TIMEOUT_MS);

      this.peerOpenReject = (err) => {
        settle(() => {
          try {
            peer.destroy();
          } catch {
            // ignore
          }
          reject(err);
        });
      };

      peer.on('open', () => {
        settle(() => resolve(peer));
      });

      peer.on('error', (err: PeerErrorLike) => {
        console.warn('PeerJS error:', err);
        if (!settled && this.peerOpenReject) {
          this.peerOpenReject(err);
        } else if (err.type === 'peer-unavailable' && this.joinReject) {
          // Vào phòng không tồn tại: PeerJS báo lỗi ở Peer chứ không phải ở DataConnection.
          this.joinReject(err);
        } else if (this.peer === peer) {
          this.onStatusChange?.(`Lỗi kết nối: ${err.message || err.type || 'không rõ'}`, this.isConnected);
        }
      });

      // Rớt khỏi broker PeerJS (mạng chập chờn) -> tự reconnect giữ nguyên mã phòng,
      // thay vì chết hẳn như trước.
      peer.on('disconnected', () => {
        if (this.peer !== peer || peer.destroyed) return;
        this.onStatusChange?.('Mất kết nối tới máy chủ, đang tự kết nối lại...', this.isConnected);
        try {
          peer.reconnect();
        } catch {
          // ignore
        }
      });
    });
  }

  public async hostRoom(): Promise<string> {
    this.disconnect();
    this.role = 'host';

    let lastError: unknown = null;
    for (let attempt = 1; attempt <= MAX_HOST_ATTEMPTS; attempt++) {
      this.roomCode = String(Math.floor(1000 + Math.random() * 9000));
      this.onStatusChange?.(
        attempt === 1
          ? `Đang khởi tạo phòng #${this.roomCode}...`
          : `Mã phòng bị trùng, đang thử mã mới (#${this.roomCode})...`,
        false
      );
      try {
        const peer = await this.createPeerAndWaitOpen(`${PEER_PREFIX}${this.roomCode}`);
        this.peer = peer;

        peer.on('connection', (conn) => {
          if (this.conn && this.conn.open) {
            conn.close();
            return;
          }
          this.setupConnection(conn);
        });

        this.onStatusChange?.(
          `Phòng #${this.roomCode} đã sẵn sàng! Hãy gửi Mã Phòng cho đối thủ.`,
          false
        );
        return this.roomCode;
      } catch (err) {
        lastError = err;
        // Chỉ thử lại khi trùng mã phòng; lỗi khác (mạng, timeout) thì dừng ngay.
        if ((err as PeerErrorLike)?.type !== 'unavailable-id') {
          this.onStatusChange?.(
            `Lỗi kết nối phòng: ${(err as PeerErrorLike)?.message || (err as PeerErrorLike)?.type || 'không rõ'}`,
            false
          );
          throw err;
        }
      }
    }

    this.onStatusChange?.('Không tạo được phòng sau nhiều lần thử. Thử lại sau ít phút.', false);
    throw lastError ?? new Error('Không tạo được phòng!');
  }

  public async joinRoom(rawCode: string): Promise<void> {
    const cleanCode = rawCode.replace(/\D/g, '').slice(0, 6);
    if (!cleanCode) {
      throw new Error('Mã phòng không hợp lệ!');
    }
    this.disconnect();
    this.role = 'guest';
    this.roomCode = cleanCode;

    this.onStatusChange?.(`Đang kết nối tới phòng #${this.roomCode}...`, false);

    const peer = await this.createPeerAndWaitOpen().catch((err: PeerErrorLike) => {
      this.onStatusChange?.(
        `Không kết nối được máy chủ (${err.type || err.message || 'lỗi mạng'}).`,
        false
      );
      throw err;
    });
    this.peer = peer;

    // Chờ DataConnection mở hẳn, có timeout riêng: trước đây bước này có thể treo mãi
    // khi mã phòng không tồn tại.
    await new Promise<void>((resolve, reject) => {
      const conn = peer.connect(`${PEER_PREFIX}${this.roomCode}`, {
        reliable: true,
      });
      let settled = false;
      this.joinReject = (err) => {
        if (settled) return;
        settled = true;
        this.joinReject = null;
        window.clearTimeout(timer);
        this.onStatusChange?.(`Không tìm thấy phòng #${this.roomCode}.`, false);
        try {
          conn.close();
        } catch {
          // ignore
        }
        reject(err);
      };
      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        this.joinReject = null;
        this.onStatusChange?.(
          `Không tìm thấy phòng #${this.roomCode} hoặc phòng không phản hồi (quá 15 giây).`,
          false
        );
        try {
          conn.close();
        } catch {
          // ignore
        }
        reject(new Error('join-timeout'));
      }, CONNECT_TIMEOUT_MS);

      this.setupConnection(
        conn,
        () => {
          if (settled) return;
          settled = true;
          this.joinReject = null;
          window.clearTimeout(timer);
          resolve();
        },
        (err) => {
          if (settled) return;
          settled = true;
          this.joinReject = null;
          window.clearTimeout(timer);
          this.onStatusChange?.(
            `Không vào được phòng #${this.roomCode} (${(err as PeerErrorLike)?.type || 'lỗi kết nối'}).`,
            false
          );
          reject(err);
        }
      );
    });
  }

  private setupConnection(
    conn: DataConnection,
    onOpenResolve?: () => void,
    onOpenError?: (err: unknown) => void
  ): void {
    this.conn = conn;

    conn.on('open', () => {
      this.isConnected = true;
      this.lastHeardAt = Date.now();
      this.onStatusChange?.(
        `Đã kết nối 1v1 Trực Tuyến tại Phòng #${this.roomCode}!`,
        true
      );
      this.startHeartbeat(conn);
      onOpenResolve?.();
    });

    conn.on('data', (data) => {
      // Bất kỳ dữ liệu nào từ đối thủ cũng là dấu hiệu kết nối còn sống.
      this.lastHeardAt = Date.now();
      if (data && typeof data === 'object' && 'type' in data) {
        const packetType = (data as { type: string }).type;
        // Heartbeat nội bộ: xử lý ngay tại đây, không chuyển lên tầng game.
        if (packetType === '__ping') {
          try {
            conn.send({ type: '__pong' });
          } catch {
            // ignore
          }
          return;
        }
        if (packetType === '__pong') {
          return;
        }
        this.onPacket?.(data as OnlinePacket);
      }
    });

    conn.on('close', () => {
      this.stopHeartbeat();
      this.isConnected = false;
      this.onStatusChange?.('Đối thủ đã ngắt kết nối.', false);
      this.onDisconnect?.();
    });

    conn.on('error', (err) => {
      console.warn('DataConnection error:', err);
      onOpenError?.(err);
    });
  }

  private startHeartbeat(conn: DataConnection): void {
    this.stopHeartbeat();
    this.heartbeatTimer = window.setInterval(() => {
      if (this.conn !== conn || !this.isConnected) return;
      if (Date.now() - this.lastHeardAt > HEARTBEAT_TIMEOUT_MS) {
        // Đối thủ mất liên lạc đột ngột (rớt mạng, khóa máy) mà không đóng kết nối sạch:
        // chủ động kết thúc thay vì treo trận vô hạn.
        this.onStatusChange?.('Mất liên lạc với đối thủ quá lâu, kết thúc kết nối.', false);
        const cb = this.onDisconnect;
        this.disconnect();
        cb?.();
        return;
      }
      try {
        conn.send({ type: '__ping' });
      } catch {
        // ignore
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  public send(packet: OnlinePacket): boolean {
    if (this.conn && this.conn.open && this.isConnected) {
      this.conn.send(packet);
      return true;
    }
    // Không nuốt im lặng nữa: log rõ gói tin bị rơi để còn truy được lỗi lệch trận.
    console.warn('OnlineManager: bỏ qua gói tin vì chưa/mất kết nối:', packet.type);
    return false;
  }

  public leaveRoom(reason = 'left_room'): void {
    if (this.conn && this.isConnected) {
      try {
        this.conn.send({
          type: 'player_left',
          role: this.role ?? 'guest',
          reason,
        });
      } catch {
        // ignore
      }
    }
    this.disconnect();
  }

  public disconnect(): void {
    this.stopHeartbeat();
    this.clearPeerOpenWait();
    this.joinReject = null;
    this.isConnected = false;
    if (this.conn) {
      try {
        this.conn.close();
      } catch {
        // ignore
      }
      this.conn = null;
    }
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {
        // ignore
      }
      this.peer = null;
    }
    this.role = null;
  }
}
