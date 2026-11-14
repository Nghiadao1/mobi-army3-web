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
    if (REDESIGN_IDS.includes(hero.id)) drawVectorHero(ctx, hero.id, pose);
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
    if (REDESIGN_IDS.includes(hero.id)) drawVectorHero(bCtx, hero.id, pose);
    else renderer.drawCompositeHero(bCtx, hero.equipment, pose, false, hero.id);
    bCtx.restore();
  }
  await writeFile(join(output, `${hero.id}_b.png`), bCanvas.toBuffer('image/png'));
  // Half-size battle sheet (48px cells, feet at (24, 35)): matches the
  // Army 2 world scale so in-battle HUD offsets stay correct.
}
// Captain's vibranium shield as a standalone projectile sprite.
{
  const sCanvas = createCanvas(56, 56);
  const sCtx = sCanvas.getContext('2d');
  const ring = (r, color) => {
    sCtx.fillStyle = color;
    sCtx.beginPath();
    sCtx.arc(28, 28, r, 0, Math.PI * 2);
    sCtx.fill();
  };
  ring(27, '#b91c1c');
  ring(21, '#f8fafc');
  ring(15, '#b91c1c');
  ring(10, '#1d4ed8');
  sCtx.fillStyle = '#f8fafc';
  sCtx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 8 : 3.4;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = 28 + r * Math.cos(a);
    const py = 28 + r * Math.sin(a);
    if (i === 0) sCtx.moveTo(px, py);
    else sCtx.lineTo(px, py);
  }
  sCtx.closePath();
  sCtx.fill();
  await writeFile(join(output, 'shield.png'), sCanvas.toBuffer('image/png'));
}
await writeFile(join(output, 'heroes.json'), JSON.stringify(heroes, null, 2));
console.log(`Built ${heroes.length} Marvel spritesheets from original equipment and renderer; 30 poses each.`);
