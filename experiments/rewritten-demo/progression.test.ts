import { beforeEach, describe, expect, it } from 'vitest';
import { applyBattleResult, loadProfile, saveProfile, xpForLevel } from './progression';

const memory = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => void memory.set(key, value) },
  configurable: true,
});

describe('progression offline', () => {
  beforeEach(() => memory.clear());

  it('hồ sơ mới mở 10 xạ thủ gốc và Iron Man', () => {
    const profile = loadProfile();
    expect(profile.level).toBe(1);
    expect(profile.unlockedHeroes).toHaveLength(11);
    expect(profile.unlockedHeroes).toContain('ironman');
  });

  it('lưu và nạp lại lựa chọn hero', () => {
    const profile = loadProfile();
    profile.selectedHero = 'ironman';
    saveProfile(profile);
    expect(loadProfile().selectedHero).toBe('ironman');
  });

  it('chiến thắng cộng thưởng và có thể thăng cấp', () => {
    const profile = loadProfile();
    profile.xp = xpForLevel(1) - 10;
    const outcome = applyBattleResult(profile, { victory: true, coins: 200, xp: 50, heroId: 'ironman' });
    expect(outcome.leveledUp).toBe(true);
    expect(outcome.profile.level).toBe(2);
    expect(outcome.profile.wins).toBe(1);
    expect(outcome.profile.coins).toBe(950);
  });
});
