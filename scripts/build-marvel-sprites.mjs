import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import ts from 'typescript';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const root = resolve(import.meta.dirname, '..');
const legacy = join(root, 'extensions/marvel/original');
const output = join(root, 'web-client/build/generated/assets/res/marvel');
await mkdir(output, { recursive: true });
async function importSource(path) {
  const source = await readFile(path, 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
}
const { HEROES } = await importSource(join(legacy, 'src/data/gameContent.ts'));
const { CharacterRenderer } = await importSource(join(legacy, 'src/engine/CharacterRenderer.ts'));
const { drawVectorHero, REDESIGN_IDS } = await import('../extensions/marvel/redesign/vectorHeroes.mjs');
const heroes = HEROES.filter(hero => hero.faction === 'marvel');
// User-approved composite overrides (2026-11-14): Iron Man's stock body part
// 295 is a legless torso column, so he (and Mark 50) get Ultron's full robot
// body/legs (353/354) with their own helmets (204 / 294). Heroes with an
// override always render as composites, never via the vector redesign.
const EQUIP_OVERRIDES = {
  ironman: { hat: 204, legs: 354, body: 353, gun: -1, glass: -1, back: -1 },
  ironman_mark50: { hat: 294, legs: 354, body: 353, gun: -1, glass: -1, back: -1 },
};
for (const hero of heroes) {
  if (EQUIP_OVERRIDES[hero.id]) hero.equipment = EQUIP_OVERRIDES[hero.id];
}
const VECTOR_IDS = REDESIGN_IDS.filter(id => !EQUIP_OVERRIDES[id]);
// Official character art extracted from the animated clips on
// mobiarmy3.me/nhan-vat (user-approved 2026-11-14): every hero's sheet is
// drawn from these cutouts (extensions/marvel/site-clips/<id>-a/-b.png,
// two idle variants) instead of composites or the vector redraws.
// CLIP_H = sprite height in the 96px sheet, near each hero's previous
// in-game height so proportions vs stock characters stay put.
const CLIP_H = {
  ironman: 46, ironman_mark50: 44, hulk: 39, red_hulk: 39, thor: 34,
  thor_stormbreaker: 34, loki: 42, doctor_strange: 38, captain: 34,
  captain_nomad: 34, captain_gold: 34, wintersoldier: 36,
  wintersoldier_winter: 36, hawkeye: 34, hawkeye_tech: 34, ultron: 42,
  ultron_prime: 42,
};
const clipImgs = new Map();
for (const hero of heroes) {
  if (!CLIP_H[hero.id]) continue;
  const dir = join(root, 'extensions/marvel/site-clips');
  const a = await loadImage(join(dir, `${hero.id}-a.png`));
  const b = await loadImage(join(dir, `${hero.id}-b.png`));
  // Optional shoot stance cut from the clip's action phase; only some
  // clips have one (the rest are idle loops / covered by effects).
  let s = null;
  try { s = await loadImage(join(dir, `${hero.id}-s.png`)); } catch { /* no shoot frame */ }
  // Synthesized frames (part-rig animation from the official cutouts,
  // tools/gen_rigs.py): shoot stance only when the clip has no real one,
  // plus a 5-frame walk cycle (poses 2-6) since no clip contains one.
  let sh = null;
  if (!s) { try { sh = await loadImage(join(dir, `${hero.id}-shoot.png`)); } catch { /* no synth shoot */ } }
  const wk = [];
  for (let wi = 1; wi <= 5; wi += 1) {
    try { wk.push(await loadImage(join(dir, `${hero.id}-w${wi}.png`))); } catch { wk.push(null); }
  }
  clipImgs.set(hero.id, [a, b, s, sh, wk]);
  if (hero.id === 'hulk') {
    const flyCanvas = createCanvas(a.width, a.height);
    flyCanvas.getContext('2d').drawImage(a, 0, 0);
    await writeFile(join(output, 'hulk_fly.png'), flyCanvas.toBuffer('image/png'));
  }
}
// Pose 1 uses the second idle variant so the idle cycle (0,1,1,0) breathes;
// every other pose reuses the main stance (the clips are single-stance).
function drawClipHero(ctx, heroId, pose) {
  const [a, b, s, sh, wk] = clipImgs.get(heroId);
  let img = a;
  if (pose === 1) img = b;
  else if (pose >= 23) img = s || sh || a;
  else if (pose >= 2 && pose <= 6 && wk && wk[pose - 2]) img = wk[pose - 2];
  const h = CLIP_H[heroId];
  const w = (img.width * h) / img.height;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, -w / 2, -h, w, h);
}
const assetRoot = join(legacy, 'public');
const readJson = async path => JSON.parse(await readFile(join(assetRoot, path), 'utf8'));
const cache = new Map();
async function loadDirectory(directory) {
  for (const entry of await readdir(directory, {withFileTypes:true})) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await loadDirectory(path);
    else if (entry.name.endsWith('.png')) cache.set(relative(assetRoot, path).replaceAll('\\','/'), await loadImage(path));
  }
}
await loadDirectory(join(assetRoot, 'assets/heroes'));
const assets = {
  manifest: await readJson('assets/assets-manifest.json'),
  images: await readJson('assets/data/images.json'),
  parts: await readJson('assets/data/parts.json'),
  poses: await readJson('assets/data/poses.json'),
  getImage(url) { return cache.get(url.replace(/^\.\//, '')); },
};
const renderer = new CharacterRenderer(assets);
const frameSize = 96;
for (const hero of heroes) {
  const canvas = createCanvas(frameSize * 30, frameSize);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  for (let pose = 0; pose < 30; pose++) {
    ctx.save(); ctx.translate(pose * frameSize + 48, 70);
    // Use the user's existing composite renderer, parts, poses, filters and equipment IDs unchanged.
    if (clipImgs.has(hero.id)) drawClipHero(ctx, hero.id, pose);
    else if (VECTOR_IDS.includes(hero.id)) drawVectorHero(ctx, hero.id, pose);
    else renderer.drawCompositeHero(ctx, hero.equipment, pose, false, hero.id);
    ctx.restore();
  }
  await writeFile(join(output, `${hero.id}.png`), canvas.toBuffer('image/png'));
  // Battle sheet at ~80% size (77px cells, feet at (38.5, 56)): full-size
  // heroes towered over the stock Army 2 characters in battle.
  const bSize = 77;
  const bCanvas = createCanvas(bSize * 30, bSize);
  const bCtx = bCanvas.getContext('2d');
  for (let pose = 0; pose < 30; pose++) {
    bCtx.save(); bCtx.translate(pose * bSize + 38.5, 56); bCtx.scale(bSize / 96, bSize / 96);
    if (clipImgs.has(hero.id)) drawClipHero(bCtx, hero.id, pose);
    else if (VECTOR_IDS.includes(hero.id)) drawVectorHero(bCtx, hero.id, pose);
    else renderer.drawCompositeHero(bCtx, hero.equipment, pose, false, hero.id);
    bCtx.restore();
  }
  await writeFile(join(output, `${hero.id}_b.png`), bCanvas.toBuffer('image/png'));
  // Half-size battle sheet (48px cells, feet at (24, 35)): matches the
  // Army 2 world scale so in-battle HUD offsets stay correct.
}
// Hero projectile sprites (spec v3). Captain's shield shrunk to 38px
// (the 56px version read as oversized in battle); the giant POW shield
// is a separate 64px sprite. The rest are small canvas-drawn icons.
function shieldSprite(size, file) {
  const c = createCanvas(size, size);
  const x = c.getContext('2d');
  const ctr = size / 2;
  const ring = (r, color) => {
    x.fillStyle = color;
    x.beginPath();
    x.arc(ctr, ctr, r, 0, Math.PI * 2);
    x.fill();
  };
  ring(ctr - 1, '#b91c1c');
  ring(ctr * 0.74, '#f8fafc');
  ring(ctr * 0.5, '#b91c1c');
  ring(ctr * 0.33, '#1d4ed8');
  x.fillStyle = '#f8fafc';
  x.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? ctr * 0.28 : ctr * 0.12;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = ctr + r * Math.cos(a);
    const py = ctr + r * Math.sin(a);
    if (i === 0) x.moveTo(px, py);
    else x.lineTo(px, py);
  }
  x.closePath();
  x.fill();
  return writeFile(join(output, file), c.toBuffer('image/png'));
}
await shieldSprite(38, 'shield.png');
await shieldSprite(64, 'giant_shield.png');
async function projSprite(file, w, h, draw) {
  const c = createCanvas(w, h);
  const x = c.getContext('2d');
  draw(x, w, h);
  await writeFile(join(output, file), c.toBuffer('image/png'));
}
const circ = (x, cx, cy, r, color) => { x.fillStyle = color; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill(); };
await projSprite('plasma.png', 18, 18, (x) => {
  circ(x, 9, 9, 8, 'rgba(34,211,238,0.35)');
  circ(x, 9, 9, 5.5, '#22d3ee');
  circ(x, 9, 9, 2.6, '#ffffff');
});
await projSprite('rocket.png', 26, 12, (x) => {
  x.fillStyle = '#f97316';
  x.beginPath(); x.moveTo(0, 6); x.lineTo(6, 3); x.lineTo(6, 9); x.closePath(); x.fill();
  x.fillStyle = '#e2e8f0'; x.fillRect(5, 3, 13, 6);
  x.fillStyle = '#b91c1c';
  x.beginPath(); x.moveTo(18, 3); x.lineTo(25, 6); x.lineTo(18, 9); x.closePath(); x.fill();
  x.fillStyle = '#dc2626'; x.fillRect(5, 1, 4, 2); x.fillRect(5, 9, 4, 2);
});
await projSprite('arrow.png', 24, 8, (x) => {
  x.fillStyle = '#92400e'; x.fillRect(3, 3, 15, 2);
  x.fillStyle = '#cbd5e1';
  x.beginPath(); x.moveTo(18, 1); x.lineTo(24, 4); x.lineTo(18, 7); x.closePath(); x.fill();
  x.fillStyle = '#dc2626';
  x.beginPath(); x.moveTo(0, 0); x.lineTo(5, 3); x.lineTo(5, 5); x.lineTo(0, 8); x.closePath(); x.fill();
});
await projSprite('hammer.png', 22, 22, (x) => {
  x.strokeStyle = '#92400e'; x.lineWidth = 3;
  x.beginPath(); x.moveTo(6, 17); x.lineTo(15, 8); x.stroke();
  x.fillStyle = '#9ca3af'; x.fillRect(10, 1, 11, 8);
  x.fillStyle = '#6b7280'; x.fillRect(10, 1, 11, 2);
});
await projSprite('axe.png', 24, 24, (x) => {
  x.strokeStyle = '#78350f'; x.lineWidth = 3;
  x.beginPath(); x.moveTo(5, 20); x.lineTo(17, 6); x.stroke();
  x.fillStyle = '#d1d5db';
  x.beginPath(); x.moveTo(12, 2); x.lineTo(22, 4); x.lineTo(21, 13); x.lineTo(14, 10); x.closePath(); x.fill();
  x.fillStyle = '#38bdf8'; circ(x, 16, 7, 1.8, '#38bdf8');
});
const disc = (file, main, core) => projSprite(file, 16, 16, (x) => {
  circ(x, 8, 8, 7.5, main);
  circ(x, 8, 8, 4, core);
  circ(x, 8, 8, 1.8, '#ffffff');
});
await disc('disc_blue.png', 'rgba(59,130,246,0.85)', '#93c5fd');
await disc('disc_yellow.png', 'rgba(234,179,8,0.85)', '#fde68a');
await projSprite('bolt.png', 14, 14, (x) => {
  x.fillStyle = '#2dd4bf';
  x.beginPath(); x.moveTo(8, 0); x.lineTo(13, 6); x.lineTo(9, 7); x.lineTo(11, 14); x.lineTo(4, 6); x.lineTo(7, 5); x.closePath(); x.fill();
});
await projSprite('fist.png', 30, 30, (x) => {
  x.strokeStyle = 'rgba(249,115,22,0.55)'; x.lineWidth = 2;
  x.beginPath(); x.arc(15, 15, 13, -0.6, 0.9); x.stroke();
  x.beginPath(); x.arc(15, 15, 10.5, -0.6, 0.9); x.stroke();
  x.fillStyle = '#ea580c';
  x.beginPath(); x.ellipse(13, 16, 8, 7, 0, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#f97316';
  for (let i = 0; i < 4; i++) circ(x, 8 + i * 4.4, 9.5, 2.6, '#f97316');
});
await projSprite('beam.png', 28, 10, (x) => {
  const g = x.createLinearGradient(0, 0, 0, 10);
  g.addColorStop(0, '#7c3aed'); g.addColorStop(0.5, '#e0f2fe'); g.addColorStop(1, '#7c3aed');
  x.fillStyle = g; x.fillRect(0, 1, 28, 8);
  x.fillStyle = '#ffffff'; x.fillRect(0, 4, 28, 2);
});
await writeFile(join(output, 'heroes.json'), JSON.stringify(heroes, null, 2));
console.log(`Built ${heroes.length} Marvel spritesheets from original equipment and renderer; 30 poses each.`);
