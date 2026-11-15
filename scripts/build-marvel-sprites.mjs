import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const root = resolve(import.meta.dirname, '..');
const dataDir = join(root, 'extensions/marvel/original/public/assets/data');
const smallDir = join(root, 'extensions/marvel/original/public/assets/heroes/small');
const bulletsSrcDir = join(root, 'extensions/marvel/original/public/assets/bullets');
const effectsSrcDir = join(root, 'extensions/marvel/original/public/assets/effects');
const outMarvel = join(root, 'web-client/src/main/webapp/assets/res/marvel');
const outHero = join(root, 'web-client/src/main/webapp/assets/res/hero');
const outBig = join(root, 'web-client/src/main/webapp/assets/res/bigHero');

mkdirSync(outMarvel, { recursive: true });
mkdirSync(outHero, { recursive: true });
mkdirSync(outBig, { recursive: true });

// 8 core Avengers from LoCheo3 (avenger = 1..8, items 391..398)
const HEROES = [
  {
    id: 'ironman',
    avenger: 1,
    name: 'Iron Man',
    title: 'Người Sắt',
    powName: 'Tên lửa thông minh',
    color: '#e53935',
    head: 204,
    body: 205,
    leg: 206,
    hp: 2000,
    attack: 350,
    reloadTime: 295,
    hpPct: 100,
    defPct: 0,
    movePct: 90,
    teamPct: 0,
    canFly: true,
    siteSkillName: 'Pháo năng lượng: Tia nano xuyên thẳng',
    specialSkillName: 'Bắn 2 tia plasma (POW: 2 tên lửa). Pháo năng lượng mỗi 3 lượt.',
    description: 'Bắn hai tia plasma (POW: 2 tên lửa). Pháo năng lượng tia nano xuyên thẳng sau mỗi 2 lượt bắn. Có thể bay.',
  },
  {
    id: 'hulk',
    avenger: 2,
    name: 'Hulk',
    title: 'Người Khổng Lồ Xanh',
    powName: 'Cú nhảy hủy diệt',
    color: '#43a047',
    head: 220,
    body: 221,
    leg: 222,
    hp: 3000,
    attack: 450,
    reloadTime: 300,
    hpPct: 200,
    defPct: 0,
    movePct: 100,
    teamPct: 0,
    canFly: false,
    siteSkillName: 'Xé gió trái / phải',
    specialSkillName: 'Nhảy chấn động tới mục tiêu. Kỹ năng Xé gió trái/phải.',
    description: 'Nhảy tới mục tiêu và gây chấn động mặt đất; nhảy càng cao sát thương càng lớn. Kỹ năng: Xé gió trái/phải.',
  },
  {
    id: 'thor',
    avenger: 3,
    name: 'Thor',
    title: 'Thần Sấm',
    powName: 'Búa sét Mjolnir',
    color: '#1e88e5',
    head: 219,
    body: 217,
    leg: 218,
    hp: 2000,
    attack: 400,
    reloadTime: 250,
    hpPct: 100,
    defPct: 0,
    movePct: 0,
    teamPct: 0,
    canFly: false,
    siteSkillName: 'Búa sét: Sét đánh xuống chỗ búa rơi',
    specialSkillName: 'Ném búa Mjolnir gọi sấm sét giáng xuống mục tiêu.',
    description: 'Ném búa sét Mjolnir. Kỹ năng Búa sét gọi 3 tia sấm sét giáng thẳng từ bầu trời xuống vị trí búa rơi.',
  },
  {
    id: 'loki',
    avenger: 4,
    name: 'Loki',
    title: 'Thần Lừa Lọc',
    powName: 'Quyền trượng băng giá',
    color: '#00897b',
    head: 198,
    body: 211,
    leg: 212,
    hp: 2000,
    attack: 400,
    reloadTime: 300,
    hpPct: 100,
    defPct: 0,
    movePct: 0,
    teamPct: 0,
    canFly: false,
    siteSkillName: 'Giả dạng: Biến hình thành người khác',
    specialSkillName: 'Cầu phép thuật đóng băng & Giả dạng biến hình thành đối thủ.',
    description: 'Bắn cầu phép thuật từ quyền trượng và đóng băng mục tiêu. Kỹ năng Giả dạng biến hình thành đối thủ.',
  },
  {
    id: 'captain',
    avenger: 5,
    name: 'Captain',
    title: 'Đội Trưởng Mỹ',
    powName: 'Khiên Vibranium khổng lồ',
    color: '#1565c0',
    head: 197,
    body: 207,
    leg: 208,
    hp: 2000,
    attack: 250,
    reloadTime: 295,
    hpPct: 100,
    defPct: 0,
    movePct: 100,
    teamPct: 20,
    canFly: false,
    siteSkillName: 'Khiên Vibranium nảy liên hoàn & quay về',
    specialSkillName: 'Ném khiên nảy quay về. Giảm 20% sát thương, +20% thủ đồng đội.',
    description: 'Ném khiên Vibranium nảy liên hoàn rồi quay về tay. Giảm 20% sát thương nhận vào và +20% phòng thủ đồng đội.',
  },
  {
    id: 'wintersoldier',
    avenger: 6,
    name: 'Winter Soldier',
    title: 'Chiến Binh Mùa Đông',
    powName: 'Đạn xuyên địa hình',
    color: '#546e7a',
    head: 203,
    body: 213,
    leg: 214,
    hp: 2000,
    attack: 350,
    reloadTime: 295,
    hpPct: 100,
    defPct: 0,
    movePct: 100,
    teamPct: 0,
    canFly: false,
    siteSkillName: 'Đạn AK xuyên đất & đánh dấu mục tiêu',
    specialSkillName: 'Bắn đạn xuyên địa hình và đánh dấu tăng 15% sát thương.',
    description: 'Chiến binh mùa đông với cánh tay sinh học và súng trường xuyên địa hình.',
  },
  {
    id: 'hawkeye',
    avenger: 7,
    name: 'Hawk Eyes',
    title: ' Mắt Diều Hâu',
    powName: 'Mưa tên khóa mục tiêu',
    color: '#8e24aa',
    head: 202,
    body: 215,
    leg: 216,
    hp: 2000,
    attack: 508,
    reloadTime: 300,
    hpPct: 100,
    defPct: 0,
    movePct: 100,
    teamPct: 0,
    canFly: false,
    siteSkillName: 'Chọn mục tiêu: 4 mũi tên tự dẫn đường',
    specialSkillName: 'Bắn cung chuẩn xác; mỗi 4 lượt bắn chùm 4 tên khóa mục tiêu.',
    description: 'Xạ thủ cung tên chuẩn xác. Kỹ năng Chọn mục tiêu bắn chùm 4 mũi tên tự động khóa mục tiêu.',
  },
  {
    id: 'ultron',
    avenger: 8,
    name: 'Ultron',
    title: 'Trí Tuệ Nhân Tạo',
    powName: 'Tia hủy diệt & Nhân bản',
    color: '#c62828',
    head: 199,
    body: 209,
    leg: 210,
    hp: 2000,
    attack: 300,
    reloadTime: 295,
    hpPct: 100,
    defPct: 0,
    movePct: 100,
    teamPct: 0,
    canFly: true,
    siteSkillName: 'Nhân bản: Gọi phân thân bắn hỗ trợ',
    specialSkillName: 'Bắn tia laser xuyên địa hình; gọi phân thân bắn bồi. Có thể bay.',
    description: 'Bắn tia laser năng lượng. Kỹ năng Nhân bản gọi phân thân hỗ trợ bắn thêm tia laser. Có thể bay.',
  },
];

const parts = JSON.parse(readFileSync(join(dataDir, 'parts.json'), 'utf8'));
const poses = JSON.parse(readFileSync(join(dataDir, 'poses.json'), 'utf8'));
const smallCache = new Map();

async function loadSmall(imgId) {
  if (smallCache.has(imgId)) return smallCache.get(imgId);
  const file = join(smallDir, `2Small${imgId}.png`);
  if (!existsSync(file)) {
    throw new Error(`Missing LoCheo3 sprite frame: ${file}`);
  }
  const img = await loadImage(file);
  smallCache.set(imgId, img);
  return img;
}

// Render a single pose of a hero onto `ctx` with foot anchor at (anchorX, anchorY).
// In LoCheo3 ($GdA in GameLogic.Full.utf8.cs), zoom=2 Small*.png sprites are drawn
// at 2x scale around the foot anchor:
//   slot 0 = head ($VMb, type 0)
//   slot 1 = leg  ($wMb, type 2)
//   slot 2 = body ($WMb, type 1)
async function drawHeroPose(ctx, hero, poseIdx, anchorX, anchorY) {
  const pose = poses[poseIdx] || poses[0];
  const slots = [
    { partId: hero.head, slotIdx: 0 },
    { partId: hero.leg, slotIdx: 1 },
    { partId: hero.body, slotIdx: 2 },
  ];
  for (const { partId, slotIdx } of slots) {
    const part = parts[String(partId)];
    const poseSlot = pose[slotIdx];
    if (!part || !poseSlot) continue;
    const [frameIdx, px, py] = poseSlot;
    const frame = part.frames[frameIdx];
    if (!frame || !frame.imgId) continue;
    const img = await loadSmall(frame.imgId);
    const dx = Math.round(anchorX + (px + frame.dx) * 2);
    const dy = Math.round(anchorY + (py + frame.dy) * 2);
    ctx.drawImage(img, dx, dy);
  }
}

const CELL = 96;
const SMALL = 77;
const POSES_COUNT = 30;

for (const hero of HEROES) {
  // MarvelRender & MarvelPickScr expect horizontal strips:
  //   preview: (POSES_COUNT * 96) x 96, feet at (48, 70)
  //   battle:  (POSES_COUNT * 77) x 77, feet at (38, 56) (drawn at y + 21 with BOTTOM|HCENTER)
  const bigCanvas = createCanvas(CELL * POSES_COUNT, CELL);
  const bigCtx = bigCanvas.getContext('2d');
  bigCtx.imageSmoothingEnabled = false;

  const smallCanvas = createCanvas(SMALL * POSES_COUNT, SMALL);
  const smallCtx = smallCanvas.getContext('2d');
  smallCtx.imageSmoothingEnabled = true;

  for (let p = 0; p < POSES_COUNT; p++) {
    const cellCanvas = createCanvas(CELL, CELL);
    const cellCtx = cellCanvas.getContext('2d');
    cellCtx.imageSmoothingEnabled = false;

    // Feet at (48, 70) so scaled to 77x77 feet are at (38.5, 56), matching p.y + 21 (77 - 56 = 21).
    await drawHeroPose(cellCtx, hero, p, Math.floor(CELL / 2), 70);
    bigCtx.drawImage(cellCanvas, p * CELL, 0);
    smallCtx.drawImage(cellCanvas, p * SMALL, 0, SMALL, SMALL);
  }

  const bigBuf = bigCanvas.toBuffer('image/png');
  const smallBuf = smallCanvas.toBuffer('image/png');
  writeFileSync(join(outMarvel, `${hero.id}.png`), bigBuf);
  writeFileSync(join(outMarvel, `${hero.id}_b.png`), smallBuf);
  writeFileSync(join(outBig, `${hero.id}.png`), bigBuf);
  writeFileSync(join(outHero, `${hero.id}_b.png`), smallBuf);
}

// Generate hulk_fly.png from Hulk's leap pose (pose 4 in LoCheo3)
const hulkHero = HEROES.find((h) => h.id === 'hulk');
const hulkFlyCell = createCanvas(CELL, CELL);
const hulkFlyCtx = hulkFlyCell.getContext('2d');
hulkFlyCtx.imageSmoothingEnabled = false;
await drawHeroPose(hulkFlyCtx, hulkHero, 4, Math.floor(CELL / 2), 70);
const hulkFlySmall = createCanvas(64, 64);
const hulkFlySmallCtx = hulkFlySmall.getContext('2d');
hulkFlySmallCtx.imageSmoothingEnabled = true;
hulkFlySmallCtx.drawImage(hulkFlyCell, 0, 0, 64, 64);
const hulkFlyBuf = hulkFlySmall.toBuffer('image/png');
writeFileSync(join(outMarvel, 'hulk_fly.png'), hulkFlyBuf);
writeFileSync(join(outHero, 'hulk_fly.png'), hulkFlyBuf);

// Copy/prepare LoCheo3 projectile sprites into outMarvel and outHero:
// 1. Captain shield: khien.png -> shield.png & giant_shield.png
const khienFile = join(bulletsSrcDir, 'khien.png');
if (existsSync(khienFile)) {
  copyFileSync(khienFile, join(outMarvel, 'shield.png'));
  copyFileSync(khienFile, join(outHero, 'shield.png'));
  const khienImg = await loadImage(khienFile);
  const bigShield = createCanvas(32, 32);
  const bCtx = bigShield.getContext('2d');
  bCtx.imageSmoothingEnabled = false;
  bCtx.drawImage(khienImg, 0, 0, 32, 32);
  const bigShieldBuf = bigShield.toBuffer('image/png');
  writeFileSync(join(outMarvel, 'giant_shield.png'), bigShieldBuf);
  writeFileSync(join(outHero, 'shield_big.png'), bigShieldBuf);
}

// 2. Loki orb: effects/loki.png is 32x128 (4 frames of 32x32). Extract frame 0 as bolt.png.
const lokiEffFile = join(effectsSrcDir, 'loki.png');
if (existsSync(lokiEffFile)) {
  const lokiImg = await loadImage(lokiEffFile);
  const boltCanvas = createCanvas(32, 32);
  const boltCtx = boltCanvas.getContext('2d');
  boltCtx.imageSmoothingEnabled = false;
  boltCtx.drawImage(lokiImg, 0, 0, 32, 32, 0, 0, 32, 32);
  const boltBuf = boltCanvas.toBuffer('image/png');
  writeFileSync(join(outMarvel, 'bolt.png'), boltBuf);
  writeFileSync(join(outHero, 'bolt.png'), boltBuf);
}

// 3. Hawkeye arrow: bullets/muiten.png -> arrow.png
const muitenFile = join(bulletsSrcDir, 'muiten.png');
if (existsSync(muitenFile)) {
  copyFileSync(muitenFile, join(outMarvel, 'arrow.png'));
  copyFileSync(muitenFile, join(outHero, 'arrow.png'));
}

// 4. Thor hammer: extract Mjolnir from Small1829.png (Thor's raised hammer hand) into hammer.png
const thorArm = await loadSmall(1829);
const hammerCanvas = createCanvas(28, 28);
const hammerCtx = hammerCanvas.getContext('2d');
hammerCtx.imageSmoothingEnabled = false;
hammerCtx.drawImage(thorArm, 4, 2);
const hammerBuf = hammerCanvas.toBuffer('image/png');
writeFileSync(join(outMarvel, 'hammer.png'), hammerBuf);
writeFileSync(join(outHero, 'hammer.png'), hammerBuf);

// Write heroes.json with the 8 LoCheo3 Avengers
const heroesJson = JSON.stringify(HEROES, null, 2);
writeFileSync(join(outMarvel, 'heroes.json'), heroesJson);
writeFileSync(join(outHero, 'heroes.json'), heroesJson);
console.log(`Built ${HEROES.length} LoCheo3 Avengers (30 poses each) into ${outMarvel}.`);
