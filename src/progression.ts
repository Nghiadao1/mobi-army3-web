import type { BattleResult, Profile } from './types';

const STORAGE_KEY = 'army2-web-profile-v2';
const DEFAULT_PROFILE: Profile = {
  level: 1, xp: 0, coins: 500, wins: 0, losses: 0, selectedHero: 'army-0',
  unlockedHeroes: ['army-0', 'army-1', 'army-2', 'army-3', 'army-4', 'army-5', 'army-6', 'army-7', 'army-8', 'army-9', 'ironman'],
  music: true, sfx: true,
};

export const xpForLevel = (level: number) => 300 + Math.max(0, level - 1) * 180;

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE, unlockedHeroes: [...DEFAULT_PROFILE.unlockedHeroes] };
    const saved = JSON.parse(raw) as Partial<Profile>;
    return { ...DEFAULT_PROFILE, ...saved, unlockedHeroes: Array.from(new Set([...DEFAULT_PROFILE.unlockedHeroes, ...(saved.unlockedHeroes ?? [])])) };
  } catch {
    return { ...DEFAULT_PROFILE, unlockedHeroes: [...DEFAULT_PROFILE.unlockedHeroes] };
  }
}

export function saveProfile(profile: Profile): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function applyBattleResult(profile: Profile, result: BattleResult): { profile: Profile; leveledUp: boolean } {
  const next: Profile = { ...profile, unlockedHeroes: [...profile.unlockedHeroes] };
  next.coins += result.coins;
  next.xp += result.xp;
  result.victory ? next.wins++ : next.losses++;
  let leveledUp = false;
  while (next.xp >= xpForLevel(next.level)) {
    next.xp -= xpForLevel(next.level);
    next.level++;
    next.coins += 250;
    leveledUp = true;
  }
  saveProfile(next);
  return { profile: next, leveledUp };
}
