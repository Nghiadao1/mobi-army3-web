import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { BATTLE_ITEMS, BOSS_HUNT_STAGES, CAMPAIGN_STAGES, HEROES } from './gameContent';

interface MapJsonEntry {
  mapId: number;
  name: string;
  width: number;
  height: number;
  waterY: number;
  bricks: Array<{ brickId: number; x: number; y: number }>;
}

const maps = JSON.parse(
  readFileSync('public/assets/data/maps.json', 'utf-8')
) as MapJsonEntry[];

const heroIds = new Set(HEROES.map((h) => h.id));
const mapIds = new Set(maps.map((m) => m.mapId));
const allStages = [...CAMPAIGN_STAGES, ...BOSS_HUNT_STAGES];

describe('dữ liệu hero & stage', () => {
  it('id hero không trùng nhau', () => {
    expect(heroIds.size).toBe(HEROES.length);
  });

  it('id stage không trùng nhau trên cả 2 danh sách', () => {
    const ids = allStages.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('mọi stage đều trỏ tới map tồn tại trong maps.json', () => {
    for (const s of allStages) {
      expect(mapIds.has(s.mapId), `Stage ${s.id} (${s.name}) dùng mapId ${s.mapId} không tồn tại`).toBe(true);
    }
  });

  it('đồng minh và mọi kẻ địch của stage đều là hero có thật', () => {
    // Bắt lỗi kiểu heroId: 'winter' / 'chick' (không tồn tại, bị rơi về hero mặc định khi chơi).
    for (const s of allStages) {
      if (s.allyHeroId) {
        expect(heroIds.has(s.allyHeroId), `Stage ${s.id} allyHeroId=${s.allyHeroId}`).toBe(true);
      }
      for (const e of s.enemies) {
        expect(heroIds.has(e.heroId), `Stage ${s.id} địch "${e.name}" heroId=${e.heroId}`).toBe(true);
      }
    }
  });

  it('kẻ địch có chỉ số và vị trí spawn hợp lệ', () => {
    for (const s of allStages) {
      expect(s.enemies.length, `Stage ${s.id} không có địch`).toBeGreaterThan(0);
      for (const e of s.enemies) {
        expect(e.hp).toBeGreaterThan(0);
        expect(e.attack).toBeGreaterThan(0);
        expect(e.spawnXRatio).toBeGreaterThan(0);
        expect(e.spawnXRatio).toBeLessThan(1);
      }
    }
  });
});

describe('map mới & content mới (P2)', () => {
  it('maps.json có map 43 Kim Tự Tháp Đảo Chiều với gạch nằm gọn trong khung map', () => {
    const m = maps.find((x) => x.mapId === 43);
    expect(m, 'Chưa có map 43 trong maps.json').toBeTruthy();
    expect(m!.bricks.length).toBeGreaterThan(0);
    expect(m!.waterY).toBeLessThan(m!.height);
    for (const b of m!.bricks) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x).toBeLessThan(m!.width);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeLessThan(m!.height);
    }
  });

  it('có Ải 31 ở map 43 và Boss 118 gồm 2 đại boss', () => {
    const stage31 = CAMPAIGN_STAGES.find((s) => s.id === 31);
    expect(stage31).toBeTruthy();
    expect(stage31!.mapId).toBe(43);

    const boss118 = BOSS_HUNT_STAGES.find((s) => s.id === 118);
    expect(boss118).toBeTruthy();
    expect(boss118!.enemies.filter((e) => e.isBoss).length).toBe(2);
  });
});

describe('thông tin gốc mobiarmy3.me của Avenger', () => {
  it('mọi Avenger đều có reloadTime và các dòng chỉ số cộng thêm khớp chỉ số thật', () => {
    const avengers = HEROES.filter((h) => h.faction === 'marvel');
    expect(avengers.length).toBe(17);
    for (const h of avengers) {
      expect(h.reloadTime, `${h.id} thiếu reloadTime`).toBeGreaterThan(0);
      expect(h.siteBonuses, `${h.id} thiếu siteBonuses`).toBeTruthy();
      expect(h.siteBonuses!.length).toBeGreaterThanOrEqual(3);
      // Dòng "Tấn công +X" và "Thời gian nạp đạn N" trên web phải khớp attack/reloadTime trong game.
      expect(h.siteBonuses).toContain(`Tấn công +${h.attack}`);
      expect(h.siteBonuses).toContain(`Thời gian nạp đạn ${h.reloadTime}`);
    }
  });
});

describe('ảnh gạch địa hình của map', () => {
  it('mọi viên gạch trong maps.json đều resolve được tới file tồn tại theo chuỗi fallback của Terrain', () => {
    // Terrain: bricks/<id>.png, nếu thiếu thì id < 173 -> 173 + (id % 82), cuối cùng là 173.png.
    // Test này giữ cho map không bao giờ bị "không có đất" vì thiếu ảnh gạch nữa.
    const brickExists = (id: number) => existsSync(`public/assets/bricks/${id}.png`);
    for (let id = 173; id <= 254; id++) {
      expect(brickExists(id), `Thiếu file gạch nền public/assets/bricks/${id}.png`).toBe(true);
    }
    for (const m of maps) {
      for (const b of m.bricks) {
        const resolved = brickExists(b.brickId)
          ? b.brickId
          : b.brickId >= 173
            ? b.brickId
            : 173 + (b.brickId % 82);
        expect(
          brickExists(resolved) || brickExists(173),
          `Map ${m.mapId} (${m.name}): gạch ${b.brickId} không resolve được ảnh nào`
        ).toBe(true);
      }
    }
  });
});

describe('map Army 2 (Gói B)', () => {
  it('có đủ 11 map convert từ Army 2 (mapId 57-67), gạch nằm gọn trong khung', () => {
    const expected: Record<number, string> = {
      57: 'Halloween', 58: 'Halloween 2', 59: 'Bom 1', 60: 'Bom 2',
      61: 'Thành phố nhện', 62: 'Thành phố máy', 63: 'Khủng long máy',
      64: 'Khu vực cấm', 65: 'Đỉnh Hi Mã Lạp Sơn', 66: 'Hang nhện', 67: 'Nghĩa trang 2',
    };
    for (const [idStr, name] of Object.entries(expected)) {
      const m = maps.find((x) => x.mapId === Number(idStr));
      expect(m, `Thiếu map Army 2 ${idStr} (${name})`).toBeTruthy();
      expect(m!.name).toBe(name);
      expect(m!.bricks.length).toBeGreaterThanOrEqual(20);
      expect(m!.waterY).toBeLessThan(m!.height);
      for (const b of m!.bricks) {
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.x).toBeLessThan(m!.width);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.y).toBeLessThan(m!.height);
      }
    }
  });
});

describe('item Army 2 (Gói C)', () => {
  it('có đủ 7 item mới, tổng 27 item, stripIndex và hotkey không trùng', () => {
    expect(BATTLE_ITEMS.length).toBe(27);
    const newIds = ['move_x2', 'pierce', 'bullet_rain', 'smoke', 'timebomb', 'rocket', 'drill'];
    for (const id of newIds) {
      expect(BATTLE_ITEMS.some((b) => b.id === id), `Thiếu item ${id}`).toBe(true);
    }
    expect(new Set(BATTLE_ITEMS.map((b) => b.stripIndex)).size).toBe(BATTLE_ITEMS.length);
    expect(new Set(BATTLE_ITEMS.map((b) => b.hotkey)).size).toBe(BATTLE_ITEMS.length);
    for (const b of BATTLE_ITEMS) {
      expect(b.stripIndex).toBeGreaterThanOrEqual(0);
      expect(b.stripIndex).toBeLessThanOrEqual(40);
    }
  });
});
