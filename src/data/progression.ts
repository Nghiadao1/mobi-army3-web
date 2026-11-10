/**
 * Hệ thống Tiến Trình (Progression) — Gói A: port từ Mobi Army 2.
 *
 * Nguồn dữ liệu: bảng `mission` (54 nhiệm vụ, 18 nhóm x 3 cấp) và `nhanvat`
 * (giá mở khóa + chỉ số 10 nhân vật cổ điển) trong dbarmy2.sql của bộ source
 * Army 2 (bản share COFFEE). Thưởng xu/XP/danh dự giữ nguyên văn bản gốc.
 *
 * Các nhóm gốc không có cơ chế tương ứng trên web được ánh xạ lại (ghi rõ):
 * - Nhóm 5 "đấu Ma" -> thắng Boss Dơi (ải 117, Nữ Hoàng Dơi).
 * - Nhóm 6 "Ném B52" -> tổng số kẻ địch tiêu diệt (web không đếm riêng B52).
 * - Nhóm 10-12 "Tạo ngọc cấp 8/9/10" -> chinh phục ải/boss khác nhau + tổng thắng.
 * - Nhóm 13 "phát siêu cao siêu xa" -> tổng số lượt bắn (turnsTaken).
 * - Nhóm 16 "Proton" -> Điện Quang (Electrician, chủ nhân đạn Proton gốc).
 * - Nhóm 18 "đấu trên 5 người" -> thắng Online 1v1 (web tối đa 2 người/phòng).
 * Thưởng "lượng" của bản gốc không dùng trên web (chỉ còn xu/XP/danh dự).
 */
import type { MatchStats } from '../types';

export const PROGRESSION_STORAGE_KEY = 'mobiarmy3_progression_v1';
/** Xu tặng khi tạo hồ sơ mới — đủ mở khóa ngay Granos (20.000) như lời chào. */
export const WELCOME_XU = 20000;

/** Giá mở khóa hero cổ điển (xu) theo bảng `nhanvat` Army 2. Hero không có trong bảng = miễn phí. */
export const HERO_UNLOCK_PRICES: Record<string, number> = {
  granos: 20000,
  rocketer: 30000,
  kingkong: 40000,
  apache: 70000,
  tazang: 90000,
  chicky: 100000,
  magenta: 120000,
};

/** Aỉ Săn Boss có địch UFO (unitKind 'ufo' trong BOSS_HUNT_STAGES). */
export const UFO_STAGE_IDS: number[] = [101, 103, 105, 107, 109, 113];
/** Aỉ Săn Boss dùng map 'Boss Khí cầu' (mapId 52). */
export const BALLOON_STAGE_IDS: number[] = [103];
/** Aỉ Boss Dơi (unitKind 'bat_queen'). */
export const BAT_STAGE_IDS: number[] = [117];

export interface MissionDef {
  iddb: number;
  group: number;
  level: number;
  name: string;
  metric: string;
  require: number;
  rewardText: string;
  rewardXu: number;
  rewardXP: number;
  rewardCup: number;
}

export const MISSIONS: MissionDef[] = [
  { iddb: 1, group: 1, level: 1, name: 'Lv 1: Thắng 100 ván solo', metric: 'soloWins', require: 100, rewardText: '5k xu, +1k xp, +100 danh dự', rewardXu: 5000, rewardXP: 1000, rewardCup: 100 },
  { iddb: 2, group: 1, level: 2, name: 'Lv 2: Thắng 1000 ván solo', metric: 'soloWins', require: 1000, rewardText: '5k xu, +10k xp, +500 danh dự', rewardXu: 5000, rewardXP: 10000, rewardCup: 500 },
  { iddb: 3, group: 1, level: 3, name: 'Lv 3: Thắng 10000 ván solo', metric: 'soloWins', require: 10000, rewardText: '5k xu,+100k xp, +1k danh dự', rewardXu: 5000, rewardXP: 100000, rewardCup: 1000 },
  { iddb: 4, group: 2, level: 1, name: 'Lv 1: Bắn 100.000 điểm HP', metric: 'damage', require: 100000, rewardText: '5k xu,+5k xp, +50 danh dự', rewardXu: 5000, rewardXP: 5000, rewardCup: 50 },
  { iddb: 5, group: 2, level: 2, name: 'Lv 2: Bắn 1.000.000 điểm HP', metric: 'damage', require: 1000000, rewardText: '5k xu,+50k xp, +100 danh dự', rewardXu: 5000, rewardXP: 50000, rewardCup: 100 },
  { iddb: 6, group: 2, level: 3, name: 'Lv 3: Bắn 1.000.000.000 điểm HP', metric: 'damage', require: 1000000000, rewardText: '5k xu,+500k xp, +500 danh dự', rewardXu: 5000, rewardXP: 500000, rewardCup: 500 },
  { iddb: 7, group: 3, level: 1, name: 'Lv 1: Thắng 50 ván đấu UFO', metric: 'ufoWins', require: 50, rewardText: '5k xu,+2k xp, +50 danh dự', rewardXu: 5000, rewardXP: 2000, rewardCup: 50 },
  { iddb: 8, group: 3, level: 2, name: 'Lv 2: Thắng 100 ván đấu UFO', metric: 'ufoWins', require: 100, rewardText: '5k xu,+20k xp, +200 danh dự', rewardXu: 5000, rewardXP: 20000, rewardCup: 200 },
  { iddb: 9, group: 3, level: 3, name: 'Lv 3: Thắng 200 ván đấu UFO', metric: 'ufoWins', require: 200, rewardText: '5k xu,+200k xp, +400 danh dự', rewardXu: 5000, rewardXP: 200000, rewardCup: 400 },
  { iddb: 10, group: 4, level: 1, name: 'Lv 1: Thắng 50 ván đấu Khí Cầu', metric: 'balloonWins', require: 50, rewardText: '5k xu,+2k xp, +50 danh dự', rewardXu: 5000, rewardXP: 2000, rewardCup: 50 },
  { iddb: 11, group: 4, level: 2, name: 'Lv 2: Thắng 100 ván đấu Khí Cầu', metric: 'balloonWins', require: 100, rewardText: '5k xu,+20k xp, +200 danh dự', rewardXu: 5000, rewardXP: 20000, rewardCup: 200 },
  { iddb: 12, group: 4, level: 3, name: 'Lv 3: Thắng 200 ván đấu Khí Cầu', metric: 'balloonWins', require: 200, rewardText: '5k xu,+200k xp, +400 danh dự', rewardXu: 5000, rewardXP: 200000, rewardCup: 400 },
  { iddb: 13, group: 5, level: 1, name: 'Lv 1: Thắng 50 ván đấu Dơi Ma', metric: 'batWins', require: 50, rewardText: '5k xu, +2k xp, +50 danh dự', rewardXu: 5000, rewardXP: 2000, rewardCup: 50 },
  { iddb: 14, group: 5, level: 2, name: 'Lv 2: Thắng 100 ván đấu Dơi Ma', metric: 'batWins', require: 100, rewardText: '5k xu,+20k xp, +200 danh dự', rewardXu: 5000, rewardXP: 20000, rewardCup: 200 },
  { iddb: 15, group: 5, level: 3, name: 'Lv 3: Thắng 200 ván đấu Dơi Ma', metric: 'batWins', require: 200, rewardText: '5k xu,+200k xp, +400 danh dự', rewardXu: 5000, rewardXP: 200000, rewardCup: 400 },
  { iddb: 16, group: 6, level: 1, name: 'Lv 1: Tiêu diệt 200 kẻ địch', metric: 'kills', require: 200, rewardText: '5k xu,+2k xp, +200 danh dự', rewardXu: 5000, rewardXP: 2000, rewardCup: 200 },
  { iddb: 17, group: 6, level: 2, name: 'Lv 2: Tiêu diệt 2000 kẻ địch', metric: 'kills', require: 2000, rewardText: '5k xu,+20k xp, +1k danh dự', rewardXu: 5000, rewardXP: 20000, rewardCup: 1000 },
  { iddb: 18, group: 6, level: 3, name: 'Lv 3: Tiêu diệt 20000 kẻ địch', metric: 'kills', require: 20000, rewardText: '5k xu,+200k xp, +5k danh dự', rewardXu: 5000, rewardXP: 200000, rewardCup: 5000 },
  { iddb: 19, group: 7, level: 1, name: 'Lv 1: Tiêu diệt 200 Tarzan', metric: 'kill_tazang', require: 200, rewardText: '5k xu,+2k xp, +200 danh dự', rewardXu: 5000, rewardXP: 2000, rewardCup: 200 },
  { iddb: 20, group: 7, level: 2, name: 'Lv 2: Tiêu diệt 2000 Tarzan', metric: 'kill_tazang', require: 2000, rewardText: '5k xu,+20k xp, +1k danh dự', rewardXu: 5000, rewardXP: 20000, rewardCup: 1000 },
  { iddb: 21, group: 7, level: 3, name: 'Lv 3: Tiêu diệt 20000 Tarzan', metric: 'kill_tazang', require: 20000, rewardText: '5k xu,+200k xp, +5k danh dự', rewardXu: 5000, rewardXP: 200000, rewardCup: 5000 },
  { iddb: 22, group: 8, level: 1, name: 'Lv 1: Tiêu diệt 200 Chicky', metric: 'kill_chicky', require: 200, rewardText: '5k xu,+2k xp, +200 danh dự', rewardXu: 5000, rewardXP: 2000, rewardCup: 200 },
  { iddb: 23, group: 8, level: 2, name: 'Lv 2: Tiêu diệt 2000 Chicky', metric: 'kill_chicky', require: 2000, rewardText: '5k xu,+20k xp, +1k danh dự', rewardXu: 5000, rewardXP: 20000, rewardCup: 1000 },
  { iddb: 24, group: 8, level: 3, name: 'Lv 3: Tiêu diệt 20000 Chicky', metric: 'kill_chicky', require: 20000, rewardText: '5k xu,+200k xp, +5k danh dự', rewardXu: 5000, rewardXP: 200000, rewardCup: 5000 },
  { iddb: 25, group: 9, level: 1, name: 'Lv 1: Tiêu diệt 200 Magenta', metric: 'kill_magenta', require: 200, rewardText: '5k xu,+2k xp, +200 danh dự', rewardXu: 5000, rewardXP: 2000, rewardCup: 200 },
  { iddb: 26, group: 9, level: 2, name: 'Lv 2: Tiêu diệt 2000 Magenta', metric: 'kill_magenta', require: 2000, rewardText: '5k xu,+20k xp, +1k danh dự', rewardXu: 5000, rewardXP: 20000, rewardCup: 1000 },
  { iddb: 27, group: 9, level: 3, name: 'Lv 3: Tiêu diệt 20000 Magenta', metric: 'kill_magenta', require: 20000, rewardText: '5k xu,+200k xp, +5k danh dự', rewardXu: 5000, rewardXP: 200000, rewardCup: 5000 },
  { iddb: 28, group: 10, level: 1, name: 'Lv 1: Chinh phục 5 ải Vượt Ải khác nhau', metric: 'distinctCampaign', require: 5, rewardText: '5k xu,+1k xp, +100 danh dự', rewardXu: 5000, rewardXP: 1000, rewardCup: 100 },
  { iddb: 29, group: 10, level: 2, name: 'Lv 2: Chinh phục 15 ải Vượt Ải khác nhau', metric: 'distinctCampaign', require: 15, rewardText: '5k xu,+10k xp, +200 danh dự', rewardXu: 5000, rewardXP: 10000, rewardCup: 200 },
  { iddb: 30, group: 10, level: 3, name: 'Lv 3: Chinh phục 31 ải Vượt Ải khác nhau', metric: 'distinctCampaign', require: 31, rewardText: '5k xu,+100k xp, +400 danh dự', rewardXu: 5000, rewardXP: 100000, rewardCup: 400 },
  { iddb: 31, group: 11, level: 1, name: 'Lv 1: Hạ 3 con Boss khác nhau', metric: 'distinctBoss', require: 3, rewardText: '5k xu,+5k xp, +250 danh dự', rewardXu: 5000, rewardXP: 5000, rewardCup: 250 },
  { iddb: 32, group: 11, level: 2, name: 'Lv 2: Hạ 9 con Boss khác nhau', metric: 'distinctBoss', require: 9, rewardText: '5k xu,+50k xp, +500 danh dự', rewardXu: 5000, rewardXP: 50000, rewardCup: 500 },
  { iddb: 33, group: 11, level: 3, name: 'Lv 3: Hạ 18 con Boss khác nhau', metric: 'distinctBoss', require: 18, rewardText: '5k xu,+50k xp, +1k danh dự', rewardXu: 5000, rewardXP: 50000, rewardCup: 1000 },
  { iddb: 34, group: 12, level: 1, name: 'Lv 1: Thắng 50 ván tổng cộng', metric: 'totalWins', require: 50, rewardText: '5k xu,+50k xp, +500 danh dự', rewardXu: 5000, rewardXP: 50000, rewardCup: 500 },
  { iddb: 35, group: 12, level: 2, name: 'Lv 2: Thắng 200 ván tổng cộng', metric: 'totalWins', require: 200, rewardText: '5k xu,+500k xp, +1k danh dự', rewardXu: 5000, rewardXP: 500000, rewardCup: 1000 },
  { iddb: 36, group: 12, level: 3, name: 'Lv 3: Thắng 500 ván tổng cộng', metric: 'totalWins', require: 500, rewardText: '5k xu,+1Tr xp, +5k danh dự', rewardXu: 5000, rewardXP: 1000000, rewardCup: 5000 },
  { iddb: 37, group: 13, level: 1, name: 'Lv 1: Ra 100 lượt bắn', metric: 'turns', require: 100, rewardText: '5k xu,+5k xp, +100 danh dự', rewardXu: 5000, rewardXP: 5000, rewardCup: 100 },
  { iddb: 38, group: 13, level: 2, name: 'Lv 2: Ra 1.000 lượt bắn', metric: 'turns', require: 1000, rewardText: '5k xu,+25k xp, +500 danh dự', rewardXu: 5000, rewardXP: 25000, rewardCup: 500 },
  { iddb: 39, group: 13, level: 3, name: 'Lv 3: Ra 10.000 lượt bắn', metric: 'turns', require: 10000, rewardText: '5k xu,+125k xp, +1k danh dự', rewardXu: 5000, rewardXP: 125000, rewardCup: 1000 },
  { iddb: 40, group: 14, level: 1, name: 'Lv 1: Dùng Gunner thắng 200 ván', metric: 'win_gunner', require: 200, rewardText: '5k xu,+2k xp, +20 danh dự', rewardXu: 5000, rewardXP: 2000, rewardCup: 20 },
  { iddb: 41, group: 14, level: 2, name: 'Lv 2: Dùng Gunner thắng 2.000 ván', metric: 'win_gunner', require: 2000, rewardText: '5k xu,+20k xp, +100 danh dự', rewardXu: 5000, rewardXP: 20000, rewardCup: 100 },
  { iddb: 42, group: 14, level: 3, name: 'Lv 3: Dùng Gunner thắng 20.000 ván', metric: 'win_gunner', require: 20000, rewardText: '5k xu,+200k xp, +250 danh dự', rewardXu: 5000, rewardXP: 200000, rewardCup: 250 },
  { iddb: 43, group: 15, level: 1, name: 'Lv 1: Dùng Miss 6 thắng 200 ván', metric: 'win_aka', require: 200, rewardText: '5k xu,+2k xp, +20 danh dự', rewardXu: 5000, rewardXP: 2000, rewardCup: 20 },
  { iddb: 44, group: 15, level: 2, name: 'Lv 2: Dùng Miss 6 thắng 2.000 ván', metric: 'win_aka', require: 2000, rewardText: '5k xu,+20k xp, +100 danh dự', rewardXu: 5000, rewardXP: 20000, rewardCup: 100 },
  { iddb: 45, group: 15, level: 3, name: 'Lv 3: Dùng Miss 6 thắng 20.000 ván', metric: 'win_aka', require: 20000, rewardText: '5k xu,+200k xp, +250 danh dự', rewardXu: 5000, rewardXP: 200000, rewardCup: 250 },
  { iddb: 46, group: 16, level: 1, name: 'Lv 1: Dùng Điện Quang thắng 200 ván', metric: 'win_electrician', require: 200, rewardText: '5k xu,+2k xp, +20 danh dự', rewardXu: 5000, rewardXP: 2000, rewardCup: 20 },
  { iddb: 47, group: 16, level: 2, name: 'Lv 2: Dùng Điện Quang thắng 2.000 ván', metric: 'win_electrician', require: 2000, rewardText: '5k xu,+20k xp, +100 danh dự', rewardXu: 5000, rewardXP: 20000, rewardCup: 100 },
  { iddb: 48, group: 16, level: 3, name: 'Lv 3: Dùng Điện Quang thắng 20.000 ván', metric: 'win_electrician', require: 20000, rewardText: '5k xu,+200k xp, +250 danh dự', rewardXu: 5000, rewardXP: 200000, rewardCup: 250 },
  { iddb: 49, group: 17, level: 1, name: 'Lv 1: Đăng nhập 10 ngày', metric: 'loginDays', require: 10, rewardText: '50k xu,+20k xp, +500 danh dự', rewardXu: 500000, rewardXP: 20000, rewardCup: 500 },
  { iddb: 50, group: 17, level: 2, name: 'Lv 2: Đăng nhập 30 ngày', metric: 'loginDays', require: 30, rewardText: '50k xu,+50k xp, +1,5k danh dự', rewardXu: 50000, rewardXP: 50000, rewardCup: 1500 },
  { iddb: 51, group: 17, level: 3, name: 'Lv 3: Đăng nhập 90 ngày', metric: 'loginDays', require: 90, rewardText: '200k xu,+500 lượng, +500k xp, +2k danh dự', rewardXu: 200000, rewardXP: 250000, rewardCup: 2000 },
  { iddb: 52, group: 18, level: 1, name: 'Lv 1: Thắng 25 ván Online 1v1', metric: 'onlineWins', require: 25, rewardText: '5k xu,+5k xp, +500 danh dự', rewardXu: 5000, rewardXP: 5000, rewardCup: 500 },
  { iddb: 53, group: 18, level: 2, name: 'Lv 2: Thắng 100 ván Online 1v1', metric: 'onlineWins', require: 100, rewardText: '5k xu,+10k xp, +1k danh dự', rewardXu: 5000, rewardXP: 10000, rewardCup: 1000 },
  { iddb: 54, group: 18, level: 3, name: 'Lv 3: Thắng 500 ván Online 1v1', metric: 'onlineWins', require: 500, rewardText: '5k xu,+20k xp, +2k danh dự', rewardXu: 5000, rewardXP: 20000, rewardCup: 2000 },
];

export interface PlayerProfile {
  xu: number;
  xp: number;
  cup: number;
  unlockedHeroes: string[];
  claimedMissions: number[];
  notifiedMissions: number[];
  stats: Record<string, number>;
  distinctCampaign: number[];
  distinctBoss: number[];
  loginDays: number;
  lastLoginDay: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function heroPrice(heroId: string): number {
  return HERO_UNLOCK_PRICES[heroId] ?? 0;
}

export function isHeroUnlocked(profile: PlayerProfile, heroId: string): boolean {
  return heroPrice(heroId) <= 0 || profile.unlockedHeroes.includes(heroId);
}

export function buyHero(profile: PlayerProfile, heroId: string): boolean {
  const price = heroPrice(heroId);
  if (price <= 0 || profile.unlockedHeroes.includes(heroId)) return false;
  if (profile.xu < price) return false;
  profile.xu -= price;
  profile.unlockedHeroes.push(heroId);
  return true;
}

export function createProfile(todayKey: string): PlayerProfile {
  return {
    xu: WELCOME_XU,
    xp: 0,
    cup: 0,
    unlockedHeroes: [],
    claimedMissions: [],
    notifiedMissions: [],
    stats: {},
    distinctCampaign: [],
    distinctBoss: [],
    loginDays: 1,
    lastLoginDay: todayKey,
  };
}

export function loadProfile(storage: StorageLike, todayKey: string): PlayerProfile {
  try {
    const raw = storage.getItem(PROGRESSION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PlayerProfile;
      if (parsed && typeof parsed.xu === 'number' && parsed.stats) {
        registerLoginDay(parsed, todayKey);
        return parsed;
      }
    }
  } catch {}
  return createProfile(todayKey);
}

export function saveProfile(storage: StorageLike, profile: PlayerProfile): void {
  try {
    storage.setItem(PROGRESSION_STORAGE_KEY, JSON.stringify(profile));
  } catch {}
}

/** Đếm ngày đăng nhập khác nhau (cho nhóm nhiệm vụ 17). Trả về true nếu là ngày mới. */
export function registerLoginDay(profile: PlayerProfile, todayKey: string): boolean {
  if (profile.lastLoginDay === todayKey) return false;
  profile.lastLoginDay = todayKey;
  profile.loginDays += 1;
  return true;
}

export function missionProgress(profile: PlayerProfile, mission: MissionDef): number {
  switch (mission.metric) {
    case 'distinctCampaign':
      return profile.distinctCampaign.length;
    case 'distinctBoss':
      return profile.distinctBoss.length;
    case 'loginDays':
      return profile.loginDays;
    default:
      return profile.stats[mission.metric] ?? 0;
  }
}

export function isMissionComplete(profile: PlayerProfile, mission: MissionDef): boolean {
  return missionProgress(profile, mission) >= mission.require;
}

export function claimableMissions(profile: PlayerProfile): MissionDef[] {
  return MISSIONS.filter(
    (m) => isMissionComplete(profile, m) && !profile.claimedMissions.includes(m.iddb)
  );
}

export function claimMission(profile: PlayerProfile, iddb: number): MissionDef | null {
  const mission = MISSIONS.find((m) => m.iddb === iddb);
  if (!mission) return null;
  if (profile.claimedMissions.includes(iddb)) return null;
  if (!isMissionComplete(profile, mission)) return null;
  profile.claimedMissions.push(iddb);
  profile.xu += mission.rewardXu;
  profile.xp += mission.rewardXP;
  profile.cup += mission.rewardCup;
  return mission;
}

export interface MatchApplyContext {
  playerHeroId: string;
  /** heroId của các kẻ địch trong ải (chỉ tính khi thắng, cho nhiệm vụ tiêu diệt hero). */
  enemyHeroIds: string[];
  stageId?: number;
}

export interface MatchApplyResult {
  xuEarned: number;
  newlyCompleted: MissionDef[];
}

function bump(profile: PlayerProfile, key: string, by: number): void {
  profile.stats[key] = (profile.stats[key] ?? 0) + by;
}

/**
 * Cộng kết quả 1 trận vào hồ sơ: xu thưởng trận + mọi bộ đếm nhiệm vụ.
 * Xu/trận: thắng Skirmish 500, Campaign 800, Boss 1500, Online 600;
 * hòa 200, thua 100; cộng thêm sát thương/50 (tối đa 500).
 */
export function applyMatchResult(
  profile: PlayerProfile,
  stats: MatchStats,
  ctx: MatchApplyContext
): MatchApplyResult {
  const isBoss = (ctx.stageId ?? 0) >= 101;
  let xuEarned: number;
  if (stats.draw) xuEarned = 200;
  else if (!stats.won) xuEarned = 100;
  else if (stats.mode === 'online') xuEarned = 600;
  else if (isBoss) xuEarned = 1500;
  else if (stats.mode === 'campaign') xuEarned = 800;
  else xuEarned = 500;
  xuEarned += Math.min(500, Math.floor(stats.damageDealt / 50));
  profile.xu += xuEarned;

  bump(profile, 'battles', 1);
  bump(profile, 'turns', stats.turnsTaken);
  bump(profile, 'damage', stats.damageDealt);
  bump(profile, 'kills', stats.enemiesDefeated);

  if (stats.won) {
    bump(profile, 'totalWins', 1);
    bump(profile, `win_${ctx.playerHeroId}`, 1);
    if (stats.mode === 'skirmish') bump(profile, 'soloWins', 1);
    if (stats.mode === 'online') bump(profile, 'onlineWins', 1);
    if (ctx.stageId !== undefined) {
      if (isBoss) {
        bump(profile, 'bossWins', 1);
        if (UFO_STAGE_IDS.includes(ctx.stageId)) bump(profile, 'ufoWins', 1);
        if (BALLOON_STAGE_IDS.includes(ctx.stageId)) bump(profile, 'balloonWins', 1);
        if (BAT_STAGE_IDS.includes(ctx.stageId)) bump(profile, 'batWins', 1);
        if (!profile.distinctBoss.includes(ctx.stageId)) profile.distinctBoss.push(ctx.stageId);
      } else {
        bump(profile, 'campaignWins', 1);
        if (!profile.distinctCampaign.includes(ctx.stageId)) {
          profile.distinctCampaign.push(ctx.stageId);
        }
      }
    }
    for (const enemyId of ctx.enemyHeroIds) {
      bump(profile, `kill_${enemyId}`, 1);
    }
  }

  const newlyCompleted = MISSIONS.filter(
    (m) =>
      isMissionComplete(profile, m) &&
      !profile.claimedMissions.includes(m.iddb) &&
      !profile.notifiedMissions.includes(m.iddb)
  );
  for (const m of newlyCompleted) profile.notifiedMissions.push(m.iddb);
  return { xuEarned, newlyCompleted };
}
