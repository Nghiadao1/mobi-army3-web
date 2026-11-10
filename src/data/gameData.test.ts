import { describe, expect, it } from 'vitest';
import { ARENAS } from './arenas';
import { CLASSIC_HEROES, getHero, HEROES, MARVEL_HEROES } from './heroes';

describe('roster Army 2 Web Reforged', () => {
  it('giữ đủ 10 xạ thủ gốc và 17 thành viên Marvel', () => {
    expect(CLASSIC_HEROES).toHaveLength(10);
    expect(MARVEL_HEROES).toHaveLength(17);
    expect(HEROES).toHaveLength(27);
  });

  it('mọi hero có id riêng và chỉ số chiến đấu hợp lệ', () => {
    expect(new Set(HEROES.map((hero) => hero.id)).size).toBe(HEROES.length);
    for (const hero of HEROES) {
      expect(hero.hp, hero.id).toBeGreaterThan(0);
      expect(hero.attack, hero.id).toBeGreaterThan(0);
      expect(hero.shots, hero.id).toBeGreaterThan(0);
      expect(hero.blast, hero.id).toBeGreaterThan(0);
      expect(hero.unlockLevel, hero.id).toBeGreaterThan(0);
    }
  });

  it('các hero đại diện giữ đúng nội tại Marvel', () => {
    expect(getHero('ironman').passive).toBe('fly');
    expect(getHero('doctor-strange').passive).toBe('shield');
    expect(getHero('winter-mark').passive).toBe('mark');
    expect(getHero('ultron-prime').passive).toBe('clone');
  });

  it('có đủ đấu trường ở ba cấp khó', () => {
    expect(ARENAS.length).toBeGreaterThanOrEqual(6);
    expect(new Set(ARENAS.map((arena) => arena.difficulty))).toEqual(new Set([1, 2, 3]));
  });
});
