import Peer, { DataConnection } from 'peerjs';
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
  };

export type OnlinePacket =
  | {
    type: 'lobby_sync';
    hostHeroId: string;
    guestHeroId: string;
    mapId: number;
    hostName: string;
    guestName: string;
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
  }
  | {
    type: 'battle_action';
    payload: OnlineBattleAction;
  };

const PEER_PREFIX = 'mobiarmy3-solo-';

export class OnlineManager {
  public role: 'host' | 'guest' | null = null;
  public roomCode = '';
  public isConnected = false;

  private peer: Peer | null = null;
  private conn: DataConnection | null = null;

  public onStatusChange?: (status: string, connected: boolean) => void;
  public onPacket?: (packet: OnlinePacket) => void;
  public onDisconnect?: () => void;

  public async hostRoom(): Promise<string> {
    this.disconnect();
    this.role = 'host';
    this.roomCode = String(Math.floor(1000 + Math.random() * 9000));
    const peerId = `${PEER_PREFIX}${this.roomCode}`;

    this.onStatusChange?.(`Đang khởi tạo phòng #${this.roomCode}...`, false);

    return new Promise<string>((resolve, reject) => {
      const peer = new Peer(peerId);
      this.peer = peer;

      peer.on('open', () => {
        this.onStatusChange?.(
          `Phòng #${this.roomCode} đã sẵn sàng! Hãy gửi Mã Phòng cho đối thủ.`,
          false
        );
        resolve(this.roomCode);
      });

      peer.on('connection', (conn) => {
        if (this.conn && this.conn.open) {
          conn.close();
          return;
        }
        this.setupConnection(conn);
      });

      peer.on('error', (err) => {
        console.warn('PeerJS Host error:', err);
        this.onStatusChange?.(`Lỗi kết nối phòng: ${err.message || err.type}`, false);
        reject(err);
      });
    });
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

    return new Promise<void>((resolve, reject) => {
      const peer = new Peer();
      this.peer = peer;

      peer.on('open', () => {
        const conn = peer.connect(`${PEER_PREFIX}${this.roomCode}`, {
          reliable: true,
        });
        this.setupConnection(conn, resolve);
      });

      peer.on('error', (err) => {
        console.warn('PeerJS Guest error:', err);
        this.onStatusChange?.(
          `Không tìm thấy phòng #${this.roomCode} hoặc lỗi mạng (${err.type}).`,
          false
        );
        reject(err);
      });
    });
  }

  private setupConnection(conn: DataConnection, onOpenResolve?: () => void): void {
    this.conn = conn;

    conn.on('open', () => {
      this.isConnected = true;
      this.onStatusChange?.(
        `Đã kết nối 1v1 Trực Tuyến tại Phòng #${this.roomCode}!`,
        true
      );
      onOpenResolve?.();
    });

    conn.on('data', (data) => {
      if (data && typeof data === 'object' && 'type' in data) {
        this.onPacket?.(data as OnlinePacket);
      }
    });

    conn.on('close', () => {
      this.isConnected = false;
      this.onStatusChange?.('Đối thủ đã ngắt kết nối.', false);
      this.onDisconnect?.();
    });

    conn.on('error', (err) => {
      console.warn('DataConnection error:', err);
    });
  }

  public send(packet: OnlinePacket): void {
    if (this.conn && this.isConnected) {
      this.conn.send(packet);
    }
  }

  public disconnect(): void {
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

