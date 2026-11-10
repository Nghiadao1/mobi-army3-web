/**
 * Phong nen tran dau theo dung Background.java cua Mobi Army 2 (client goc):
 *  - Bau troi la MAU PHANG rieng cho tung loai nen (khong gradient).
 *  - Canh quan la cac manh silhouette trong res/map/bgItem, lap gach ngang
 *    voi parallax lop xa 1/8 (>>3), lop gan 1/4 (>>2) nhu code goc.
 *  - Mat troi (sun0/sun1) va may (cl1/cl2) lay tu FilePack "bg" da giai ma.
 * Bang duoi day trich nguyen van: mau setColor + cap manh xa/gan cua tung
 * BACKGR type 0-15 trong Background.java (loadImage + drawBackGround).
 */
export interface Army2BgSpec {
  sky: string;
  ground?: string;
  far?: string;
  near?: string;
  sun?: 'sun0' | 'sun1';
  clouds?: boolean;
}

const PIECE_DIR = './assets/backgrounds/army2/';
const PACK_DIR = './assets/backgrounds/army2/pack/';

export const ARMY2_BG_SPECS: Record<number, Army2BgSpec> = {
  // 0 HALONG: halongkaka lap 128px, mat troi + may, chan canh mau nuoc
  0: { sky: '#86c3fa', ground: '#1e8cee', near: 'halongkaka.png', sun: 'sun0', clouds: true },
  // 1 RUONGLUA (canh dong): manh canhdong 64px
  1: { sky: '#7cd2eb', near: 'canhdong.png', sun: 'sun0', clouds: true },
  // 2 SIMPLESKY: manh bang (tinh the bang), duoi la nuoc sau
  2: { sky: '#7cd2eb', ground: '#00496d', near: 'bang.png', sun: 'sun0', clouds: true },
  // 3 RUNGRAM: rung ram, khong troi/may
  3: { sky: '#84eefc', near: 'rungRam.png' },
  // 4 HOANGTAN: xa back2, gan back1
  4: { sky: '#d9effe', ground: '#717171', far: 'back2.png', near: 'back1.png', clouds: true },
  // 5 SONGNUI: xa back4, gan back3
  5: { sky: '#fff7f0', ground: '#789fcf', far: 'back4.png', near: 'back3.png' },
  // 6 CITY: xa back6, gan back5
  6: { sky: '#feeadc', ground: '#9cade4', far: 'back6.png', near: 'back5.png', clouds: true },
  // 7 ICE: hai hang back8 + back7 phia truoc
  7: { sky: '#e8f5ff', far: 'back8.png', near: 'back7.png' },
  // 9 BOSS_1: cung cap manh voi CITY nhung troi cam gay gat
  9: { sky: '#ff9f40', ground: '#bcccff', far: 'back6.png', near: 'back5.png', clouds: true },
  // 10 CITY_NIGHT: xa back12, gan back11, troi dem
  10: { sky: '#6c7195', ground: '#2f3445', far: 'back12.png', near: 'back11.png' },
  // 12 NIGHT_FORREST: xa back15, gan back14, troi gan nhu den (goc co ca tuyet + set)
  12: { sky: '#081816', far: 'back15.png', near: 'back14.png' },
  // 13 CAVE (hang nhen): rock_up/rock_down + layout mang nhen (rut gon thanh 2 lop)
  13: { sky: '#7d93a2', ground: '#94726c', far: 'map_spider_layout.png', near: 'rock_down.png' },
  // 14 CLOUD: ca hai lop deu la may o chan troi + mat troi
  14: { sky: '#64cffd', far: 'bg_cloud1.png', near: 'bg-cloud.png', sun: 'sun0' },
  // 15 GREY: xa back16, gan back17, mat troi sun1
  15: { sky: '#febe96', ground: '#260606', far: 'back16.png', near: 'back17.png', sun: 'sun1' },
};

export function army2BgSpec(bgType: number): Army2BgSpec {
  return ARMY2_BG_SPECS[bgType] ?? ARMY2_BG_SPECS[5];
}

export function army2BgPieceUrl(file: string): string {
  return PIECE_DIR + file;
}

export function army2BgPackUrl(file: string): string {
  return PACK_DIR + file;
}

/** Danh sach anh can nap truoc cho mot map theo bgType cua no. */
export function army2BgPreloadUrls(bgType: number): string[] {
  const s = army2BgSpec(bgType);
  const urls: string[] = [];
  if (s.far) urls.push(army2BgPieceUrl(s.far));
  if (s.near) urls.push(army2BgPieceUrl(s.near));
  if (s.sun) urls.push(army2BgPackUrl(`${s.sun}.png`));
  if (s.clouds) {
    urls.push(army2BgPackUrl('cl1.png'));
    urls.push(army2BgPackUrl('cl2.png'));
  }
  return urls;
}
