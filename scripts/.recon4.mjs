
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import ts from 'typescript';
import { createCanvas, loadImage } from '@napi-rs/canvas';
const root = resolve(import.meta.dirname, '..');
const legacy = join(root, 'extensions/marvel/original');
async function importSource(path) {
  const source = await readFile(path, 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
}
const { CharacterRenderer } = await importSource(join(legacy, 'src/engine/CharacterRenderer.ts'));
const assetRoot = join(legacy, 'public');
const readJson = async p => JSON.parse(await readFile(join(assetRoot, p), 'utf8'));
const cache = new Map();
async function loadDirectory(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await loadDirectory(path);
    else if (entry.name.endsWith('.png')) cache.set(relative(assetRoot, path).replaceAll('\\', '/'), await loadImage(path));
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
const eq = (hat, body, legs, back = -1) => ({ hat, legs, body, gun: -1, glass: -1, back });
// Sheet A: backs scan on a neutral figure
const backs = [4, 10, 15, 20, 25, 36, 41, 45, 49, 53, 63, 67, 71, 75, 79, 83, 87, 91, 95, 99, 103, 107, 111, 115, 119, 180];
{
  const cell = 96, scale = 2, labelW = 150;
  const canvas = createCanvas(labelW + cell * scale, backs.length * cell * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#394048'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  backs.forEach((bk, r) => {
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 26px sans-serif';
    ctx.fillText('BK' + bk, 8, r * cell * scale + 56);
    ctx.save();
    ctx.translate(labelW + 48 * scale, r * cell * scale + 70 * scale);
    ctx.scale(scale, scale);
    renderer.drawCompositeHero(ctx, eq(202, 282, 283, bk), 0, false, 'doctor_strange');
    ctx.restore();
  });
  await writeFile(join(root, 'dist/scan-backs.png'), canvas.toBuffer('image/png'));
}
// Sheet B: final candidates, 3x, poses 0 + 11
const GOLD = 'sepia(0.85) saturate(2.8) hue-rotate(15deg) brightness(1.1)';
const rows = [
  ['IM-1 204/295/296', eq(204, 295, 296), 'ironman', null],
  ['IM-2 ultron-body + gold', eq(294, 353, 354), 'ironman', GOLD],
  ['IM-3 ultron-body 204/353/354', eq(204, 353, 354), 'ironman', null],
  ['DS-1 202/thor-body', eq(202, 289, 290), 'doctor_strange', null],
  ['DS-2 202/coat279', eq(202, 279, 280), 'doctor_strange', null],
  ['DS-3 202/blue282', eq(202, 282, 283), 'doctor_strange', null],
  ['LK-1 current custom', eq(198, 1980, 1981), 'loki', null],
  ['LK-2 198/hawkeye349', eq(198, 349, 350), 'loki', null],
  ['LK-3 198/thor289', eq(198, 289, 290), 'loki', null],
];
{
  const poses = [0, 11];
  const cell = 96, scale = 3, labelW = 330;
  const canvas = createCanvas(labelW + poses.length * cell * scale, rows.length * cell * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#4a5158'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  rows.forEach(([label, e, hid, filter], r) => {
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 25px sans-serif';
    ctx.fillText(label, 8, r * cell * scale + 60);
    poses.forEach((pose, c) => {
      ctx.save();
      ctx.translate(labelW + c * cell * scale + 48 * scale, r * cell * scale + 70 * scale);
      ctx.scale(scale, scale);
      if (filter) ctx.filter = filter;
      renderer.drawCompositeHero(ctx, e, pose, false, hid);
      ctx.restore();
    });
  });
  await writeFile(join(root, 'dist/candidates.png'), canvas.toBuffer('image/png'));
}
console.log('sheets written');
