export type Team = 'player' | 'enemy';
export type HeroFaction = 'army2' | 'marvel';
export type ShotPattern = 'single' | 'burst' | 'spread' | 'boomerang' | 'laser' | 'cluster' | 'lightning' | 'melee';

export interface HeroDef {
  id: string; name: string; title: string; faction: HeroFaction;
  hp: number; attack: number; armor: number; move: number;
  pattern: ShotPattern; shots: number; blast: number;
  color: string; accent: string; skillName: string; skillDescription: string;
  passive?: 'fly' | 'shield' | 'pierce' | 'mark' | 'clone' | 'rage' | 'freeze' | 'ricochet';
  unlockLevel: number; sprite?: string;
}

export interface ArenaDef {
  id: string; name: string; subtitle: string; sky: [string, string];
  ground: string; accent: string; seed: number; difficulty: 1 | 2 | 3;
}

export interface Fighter {
  id: number; hero: HeroDef; team: Team; x: number; y: number; vx: number; vy: number;
  hp: number; maxHp: number; angle: number; facing: 1 | -1; shield: number; power: number;
  marked: boolean; frozenTurns: number; alive: boolean;
}

export interface Projectile {
  x: number; y: number; vx: number; vy: number; ownerId: number; damage: number;
  radius: number; color: string; pattern: ShotPattern; age: number; maxAge: number; pierce: boolean;
}

export interface BattleResult { victory: boolean; coins: number; xp: number; heroId: string; }

export interface Profile {
  level: number; xp: number; coins: number; wins: number; losses: number;
  selectedHero: string; unlockedHeroes: string[]; music: boolean; sfx: boolean;
}
