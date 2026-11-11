import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { BATTLE_ITEMS, BOSS_HUNT_STAGES, CAMPAIGN_STAGES, HEROES } from './gameContent';
import { ARMY2_BG_SPECS, army2BgSpec } from '../engine/army2Background';

interface MapJsonEntry {
  mapId: number;
  name: string;
  width: number;
  height: number;
  waterY: number;
  bgType?: number;
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

describe('nền Army 2 (GĐ2)', () => {
  it('mọi map đều có bgType 0-15 và spec nền tương ứng có đủ file mảnh ghép', () => {
    for (const m of maps) {
      expect(typeof m.bgType, `map ${m.mapId} thiếu bgType`).toBe('number');
      expect(m.bgType!).toBeGreaterThanOrEqual(0);
      expect(m.bgType!).toBeLessThanOrEqual(15);
      const spec = army2BgSpec(m.bgType!);
      expect(spec.sky).toMatch(/^#[0-9a-f]{6}$/i);
      for (const piece of [spec.far, spec.near]) {
        if (piece) {
          expect(
            existsSync(`public/assets/backgrounds/army2/${piece}`),
            `Thiếu mảnh nền ${piece} cho bgType ${m.bgType}`
          ).toBe(true);
        }
      }
      if (spec.sun) {
        expect(
          existsSync(`public/assets/backgrounds/army2/pack/${spec.sun}.png`),
          `Thiếu ${spec.sun}.png trong bg pack`
        ).toBe(true);
      }
    }
    // Mọi type đã khai báo đều trỏ tới file tồn tại
    for (const spec of Object.values(ARMY2_BG_SPECS)) {
      for (const piece of [spec.far, spec.near]) {
        if (piece) expect(existsSync(`public/assets/backgrounds/army2/${piece}`)).toBe(true);
      }
    }
  });

  it('39 map khớp DB Army 2 giữ đúng bg gốc (điểm kiểm chứng: Sinh Tử=2, Halloween=15, Hang nhện=13)', () => {
    const byId = new Map(maps.map((m) => [m.mapId, m]));
    expect(byId.get(21)?.bgType).toBe(2);
    expect(byId.get(57)?.bgType).toBe(15);
    expect(byId.get(66)?.bgType).toBe(13);
    expect(byId.get(11)?.bgType).toBe(7);
  });
});

describe('boss Army 2 (GĐ3)', () => {
  it('có 10 màn săn boss Army 2 (119-128), unitKind a2_* và đủ sprite gốc trên đĩa', () => {
    const stages = BOSS_HUNT_STAGES.filter((s) => s.id >= 119 && s.id <= 128);
    expect(stages.length).toBe(10);
    const spriteOf: Record<string, string[]> = {
      a2_ufo: ['parts/UFO.png', 'parts/UFOFire.png'],
      a2_robot: ['parts/leg.png', 'parts/body.png', 'parts/body_injured.png', 'parts/arm.png'],
      a2_trex: ['parts/bug_leg.png', 'parts/bug_body.png', 'parts/bug_gun.png'],
      a2_spider: ['parts/spider.png'],
      a2_balloon: ['parts/khicau.png', 'parts/fan1.png', 'parts/fan2.png', 'parts/front_fan.png'],
      a2_ghost: ['parts/ma.png'],
      a2_ghost2: ['parts/ma2.png'],
      a2_gift: [],
      a2_snowman: ['snowman/fullBody.png', 'snowman/body_injured.png', 'snowman/arm.png'],
    };
    const kinds = new Set<string>();
    for (const st of stages) {
      expect(heroIds.has(st.allyHeroId!), `stage ${st.id}: ally ${st.allyHeroId} không tồn tại`).toBe(true);
      expect(mapIds.has(st.mapId!), `stage ${st.id}: map ${st.mapId} không tồn tại`).toBe(true);
      for (const e of st.enemies) {
        expect(heroIds.has(e.heroId), `stage ${st.id}: heroId ${e.heroId} không tồn tại`).toBe(true);
        if (e.unitKind.startsWith('a2_')) {
          kinds.add(e.unitKind);
          for (const f of spriteOf[e.unitKind] ?? []) {
            expect(
              existsSync(`public/assets/bosses/army2/${f}`),
              `stage ${st.id}: thiếu sprite ${f} cho ${e.unitKind}`
            ).toBe(true);
          }
        }
      }
    }
    expect(kinds.size).toBe(9); // đủ 9 loại boss Army 2
  });
});
