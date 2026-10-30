export interface ImageSlice {
  id: number;
  sheet: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PartFrame {
  imgId: number;
  dx: number;
  dy: number;
}

export interface PartDef {
  partId: number;
  type: number;
  frames: PartFrame[];
}

// Each pose has 7 slots: [frameIdx, dx, dy]
export type PoseSlot = [number, number, number];
export type PoseDef = PoseSlot[];

export interface MapBrickPlacement {
  brickId?: number;
  imageId?: number;
  x: number;
  y: number;
  collide?: boolean;
}

export interface MapDef {
  id?: number;
  index: number;
  mapId: number;
  name: string;
  width: number;
  height: number;
  waterY: number;
  bgType: number;
  inWater: number;
  bricks: MapBrickPlacement[];
}

export interface SpriteStripEntry {
  url: string;
  frames: number;
}

export interface HeroOverrideSheet {
  /** Đường dẫn file PNG ngang (idle, walk, aim, hurt) nếu muốn thay thế nhân vật gốc */
  url: string;
  frameWidth: number;
  frameHeight: number;
  framesPerRow?: number;
  anchorY?: number;
}

export interface AssetsManifest {
  version: number;
  note: string;
  heroSheets: string[];
  smallParts?: number[];
  heroOverrides: Record<string, HeroOverrideSheet | null>;
  bullets: Record<string, SpriteStripEntry>;
  effects: Record<string, SpriteStripEntry>;
  bosses: Record<string, SpriteStripEntry>;
  ui: {
    logo: string;
    waterTop: SpriteStripEntry;
    waterDeep: string;
    itemsStrip: SpriteStripEntry;
    winBanner: string;
    loseBanner: string;
    drawBanner: string;
    turnArrow: string;
    targetCross: SpriteStripEntry;
    angryFlame0: string;
    angryFlame1: string;
  };
}

export type WeaponPattern =
  | 'cannon'
  | 'ak'
  | 'electric'
  | 'boomerang'
  | 'banana_cluster'
  | 'rocket'
  | 'grenade'
  | 'chicky'
  | 'apache'
  | 'repulsor'
  | 'vibranium_shield'
  | 'mjolnir'
  | 'hulk_smash'
  | 'hulk_leap'
  | 'hawkeye_bow'
  | 'winter_sniper'
  | 'ultron_beam'
  | 'loki_morph'
  | 'ufo_beam'
  | 'bomber_drop'
  | 'mech_barrage';

export interface HeroEquipment {
  hat: number;   // slot 0 ($JZQ)
  legs: number;  // slot 1 ($NrF)
  body: number;  // slot 2 ($VUd)
  gun: number;   // slot 3 ($siL)
  glass: number; // slot 4 ($gns)
  back: number;  // slot 5 ($Xlw)
}

export interface HeroDef {
  id: string;
  name: string;
  title: string;
  description: string;
  powName: string;
  color: string;
  faction?: 'army' | 'marvel';
  canFly?: boolean;
  hp: number;
  attack: number;
  moveSpeed: number;
  staminaMax: number;
  minAngle: number;
  maxAngle: number;
  weapon: WeaponPattern;
  holeMask: string;
  powHoleMask: string;
  equipment: HeroEquipment;
}

export type BattleItemId =
  | 'heal'
  | 'team_heal'
  | 'teleport'
  | 'double'
  | 'airstrike'
  | 'suicide'
  | 'vampire'
  | 'mouse'
  | 'shield'
  | 'windstop'
  | 'digger'
  | 'web'
  | 'freeze'
  | 'poison'
  | 'nuke'
  | 'stealth';

export interface BattleItemDef {
  id: BattleItemId;
  name: string;
  shortDesc: string;
  /** Chỉ số icon trong dải 40x1640 item.png gốc (0..40) */
  stripIndex: number;
  endsTurnImmediately: boolean;
  hotkey: string;
}

export type BotDifficulty = 'easy' | 'normal' | 'hard';

export type UnitKind = 'hero' | 'bomber' | 'ufo' | 'mech' | 'spider' | 'dragon' | 'fortress';

export interface StageEnemySpec {
  name: string;
  unitKind: UnitKind;
  heroId: string;
  hp: number;
  attack: number;
  difficulty: BotDifficulty;
  spawnXRatio: number;
  spawnY?: number;
  isBoss?: boolean;
  scale?: number;
}

export interface CampaignStage {
  id: number;
  name: string;
  subtitle: string;
  description: string;
  mapId: number;
  allyHeroId?: string;
  windMax: number;
  rewardTitle: string;
  enemies: StageEnemySpec[];
}

export interface BattleSetup {
  mode: 'skirmish' | 'campaign' | 'online';
  playerHeroId: string;
  allyHeroId?: string | null;
  teamSize: 1 | 2;
  mapId: number;
  difficulty: BotDifficulty;
  stage?: CampaignStage;
  onlineRole?: 'host' | 'guest';
  onlineCoopStage?: CampaignStage;
  remoteHeroId?: string;
  remotePeerName?: string;
  seed?: number;
  selectedItems?: BattleItemId[];
}

export interface MatchStats {
  won: boolean;
  draw: boolean;
  turnsTaken: number;
  damageDealt: number;
  enemiesDefeated: number;
  mode: 'skirmish' | 'campaign' | 'online';
  stageId?: number;
}
