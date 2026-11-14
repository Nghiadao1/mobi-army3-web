// Renders approval previews for the vector hero redesigns: per hero a
// contact sheet comparing the CURRENT composite sprite (top row) with
// the NEW vector drawing (bottom row) over key poses, plus full
// 30-pose sheets of the new designs. Output goes to a preview folder
// only; the live game assets are untouched until the redesign is
// approved and wired into build-marvel-sprites.mjs.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import ts from 'typescript';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { drawVectorHero, REDESIGN_IDS } from '../extensions/marvel/redesign/vectorHeroes.mjs';

const root = resolve(import.meta.dirname, '..');
const legacy = join(root, 'extensions/marvel/original');
const assetsDir = join(root, 'web-client/build/generated/assets/res/marvel');
const output = join(root, 'web-client/build/generated/redesign-preview');
await mkdir(output, { recursive: true });

async function importSource(path) {
  const source = await readFile(path, 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
}
const { HEROES } = await importSource(join(legacy, 'src/data/gameContent.ts'));
const { CharacterRenderer } = await importSource(join(legacy, 'src/engine/CharacterRenderer.ts'));
const { readdir } = await import('node:fs/promises');
const { relative } = await import('node:path');
const assetRoot = join(legacy, 'public');
const readJson = async path => JSON.parse(await readFile(join(assetRoot, path), 'utf8'));
const cache = new Map();
async function loadDirectory(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await loadDirectory(path);
    else if (entry.name.endsWith('.png')) cache.set(relative(assetRoot, path).replaceAll('\\', '/'), await loadImage(path));
  }
}
await loadDirectory(join(assetRoot, 'assets/heroes'));
const renderer = new CharacterRenderer({
  manifest: await readJson('assets/assets-manifest.json'),
  images: await readJson('assets/data/images.json'),
  parts: await readJson('assets/data/parts.json'),
  poses: await readJson('assets/data/poses.json'),
  getImage(url) { return cache.get(url.replace(/^\.\//, '')); },
});

const POSES = [0, 3, 11, 13, 23, 19];
const LABELS = ['idle', 'walk', 'aim 0', 'aim +40', 'shoot', 'hurt'];
const CELL = 96;
const SCALE = 2;

function drawOld(ctx, hero, pose) {
  ctx.save();
  ctx.translate(48, 70);
  renderer.drawCompositeHero(ctx, hero.equipment, pose, false, hero.id);
  ctx.restore();
}
function drawNew(ctx, heroId, pose) {
  ctx.save();
  ctx.translate(48, 70);
  drawVectorHero(ctx, heroId, pose);
  ctx.restore();
}

for (const hero of HEROES.filter(h => REDESIGN_IDS.includes(h.id))) {
  // Full 30-pose sheet of the new design.
  const sheet = createCanvas(CELL * 30, CELL);
  const sctx = sheet.getContext('2d');
  for (let pose = 0; pose < 30; pose++) {
    sctx.save();
    sctx.translate(pose * CELL, 0);
    drawNew(sctx, hero.id, pose);
    sctx.restore();
  }
  await writeFile(join(output, `${hero.id}-new-sheet.png`), sheet.toBuffer('image/png'));

  // Contact sheet: old vs new over key poses.
  const W = CELL * POSES.length * SCALE;
  const H = CELL * 2 * SCALE + 28;
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#20303c';
  ctx.fillRect(0, 0, W, 28);
  ctx.fillStyle = '#7dd3fc';
  ctx.fillRect(0, 28 + CELL * SCALE, W, CELL * SCALE);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 28, W, CELL * SCALE);
  ctx.font = 'bold 15px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${hero.id} — TOP: current sprite   BOTTOM: new vector design`, 10, 19);
  POSES.forEach((pose, i) => {
    ctx.save();
    ctx.translate(i * CELL * SCALE, 28);
    ctx.scale(SCALE, SCALE);
    drawOld(ctx, hero, pose);
    ctx.restore();
    ctx.save();
    ctx.translate(i * CELL * SCALE, 28 + CELL * SCALE);
    ctx.scale(SCALE, SCALE);
    drawNew(ctx, hero.id, pose);
    ctx.restore();
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(LABELS[i], i * CELL * SCALE + 8, 28 + CELL * SCALE * 2 + 16 - CELL * SCALE);
  });
  await writeFile(join(output, `${hero.id}-compare.png`), c.toBuffer('image/png'));
  console.log('preview written for', hero.id);
}
console.log('done');
