import { describe, expect, it } from 'vitest';
import {
  applyMatchResult,
  buyHero,
  claimMission,
  claimableMissions,
  createProfile,
  heroPrice,
  isHeroUnlocked,
  loadProfile,
  missionProgress,
  MISSIONS,
  registerLoginDay,
  saveProfile,
  WELCOME_XU,
} from './progression';
import type { MatchStats } from '../types';

describe('progression data (Army 2 port)', () => {
  it('has all 54 Army 2 missions in 18 groups x 3 levels', () => {
    expect(MISSIONS.length).toBe(54);
    const groups = new Set(MISSIONS.map((m) => m.group));
    expect(groups.size).toBe(18);
    for (const g of groups) {
      expect(MISSIONS.filter((m) => m.group === g).length).toBe(3);
    }
  });

  it('keeps Army 2 unlock prices for classic heroes', () => {
    expect(heroPrice('gunner')).toBe(0);
    expect(heroPrice('aka')).toBe(0);
    expect(heroPrice('electrician')).toBe(0);
    expect(heroPrice('granos')).toBe(20000);
    expect(heroPrice('chicky')).toBe(100000);
    expect(heroPrice('magenta')).toBe(120000);
    expect(heroPrice('thor')).toBe(0); // Avenger miễn phí
  });
});

describe('hero unlock flow', () => {
  it('welcome xu buys Granos exactly, not Rocketer', () => {
    const p = createProfile('2026-11-10');
    expect(p.xu).toBe(WELCOME_XU);
    expect(isHeroUnlocked(p, 'granos')).toBe(false);
    expect(buyHero(p, 'rocketer')).toBe(false);
    expect(buyHero(p, 'granos')).toBe(true);
    expect(p.xu).toBe(0);
    expect(isHeroUnlocked(p, 'granos')).toBe(true);
    expect(buyHero(p, 'granos')).toBe(false); // đã mua rồi
  });
});

describe('missions claim flow', () => {
  it('damage mission Lv1 (iddb 4) claims Army 2 rewards once', () => {
    const p = createProfile('2026-11-10');
    p.stats['damage'] = 100000;
    const m = MISSIONS.find((x) => x.iddb === 4)!;
    expect(missionProgress(p, m)).toBe(100000);
    expect(claimableMissions(p).map((x) => x.iddb)).toContain(4);
    const claimed = claimMission(p, 4);
    expect(claimed?.rewardXu).toBe(5000);
    expect(p.xu).toBe(WELCOME_XU + 5000);
    expect(p.xp).toBe(5000);
    expect(p.cup).toBe(50);
    expect(claimMission(p, 4)).toBeNull();
  });

  it('cannot claim an incomplete mission', () => {
    const p = createProfile('2026-11-10');
    expect(claimMission(p, 1)).toBeNull(); // cần 100 solo wins
  });
});

describe('applyMatchResult', () => {
  const winSkirmish: MatchStats = {
    won: true,
    draw: false,
    turnsTaken: 8,
    damageDealt: 1000,
    enemiesDefeated: 1,
    mode: 'skirmish',
  };

  it('skirmish win: 500 xu + damage bonus, soloWins counter', () => {
    const p = createProfile('2026-11-10');
    const r = applyMatchResult(p, winSkirmish, { playerHeroId: 'gunner', enemyHeroIds: [] });
    expect(r.xuEarned).toBe(500 + 20);
    expect(p.stats['soloWins']).toBe(1);
    expect(p.stats['win_gunner']).toBe(1);
    expect(p.stats['damage']).toBe(1000);
  });

  it('boss win on UFO stage 101 counts boss + ufo + distinct boss + hero kills', () => {
    const p = createProfile('2026-11-10');
    const stats: MatchStats = { ...winSkirmish, mode: 'campaign', stageId: 101 };
    applyMatchResult(p, stats, {
      playerHeroId: 'captain',
      enemyHeroIds: ['tazang', 'chicky'],
      stageId: 101,
    });
    expect(p.stats['bossWins']).toBe(1);
    expect(p.stats['ufoWins']).toBe(1);
    expect(p.stats['kill_tazang']).toBe(1);
    expect(p.stats['kill_chicky']).toBe(1);
    expect(p.distinctBoss).toEqual([101]);
    expect(p.stats['campaignWins']).toBeUndefined();
  });

  it('loss gives 100 xu and no win counters', () => {
    const p = createProfile('2026-11-10');
    const r = applyMatchResult(
      p,
      { ...winSkirmish, won: false, damageDealt: 0 },
      { playerHeroId: 'gunner', enemyHeroIds: [] }
    );
    expect(r.xuEarned).toBe(100);
    expect(p.stats['totalWins']).toBeUndefined();
  });

  it('newly completed mission is reported once', () => {
    const p = createProfile('2026-11-10');
    p.stats['damage'] = 99999;
    const stats: MatchStats = { ...winSkirmish, damageDealt: 1 };
    const r1 = applyMatchResult(p, stats, { playerHeroId: 'gunner', enemyHeroIds: [] });
    expect(r1.newlyCompleted.map((m) => m.iddb)).toContain(4);
    const r2 = applyMatchResult(p, stats, { playerHeroId: 'gunner', enemyHeroIds: [] });
    expect(r2.newlyCompleted.map((m) => m.iddb)).not.toContain(4);
  });
});

describe('login days + persistence', () => {
  it('registerLoginDay counts distinct days only', () => {
    const p = createProfile('2026-11-10');
    expect(registerLoginDay(p, '2026-11-10')).toBe(false);
    expect(registerLoginDay(p, '2026-11-11')).toBe(true);
    expect(p.loginDays).toBe(2);
  });

  it('loadProfile round-trips through storage and registers a new day', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
    const p1 = loadProfile(storage, '2026-11-10');
    p1.xu = 777;
    saveProfile(storage, p1);
    const p2 = loadProfile(storage, '2026-11-12');
    expect(p2.xu).toBe(777);
    expect(p2.loginDays).toBe(2);
  });
});
