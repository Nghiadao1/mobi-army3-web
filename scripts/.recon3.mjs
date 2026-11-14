
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
const parts = await readJson('assets/data/parts.json');
const assets = {
  manifest: await readJson('assets/assets-manifest.json'),
  images: await readJson('assets/data/images.json'),
  parts,
  poses: await readJson('assets/data/poses.json'),
  getImage(url) { return cache.get(url.replace(/^\.\//, '')); },
};
const renderer = new CharacterRenderer(assets);
const heads = [0, 6, 11, 16, 21, 59, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 197, 198, 199, 202, 203, 204, 219, 220, 234, 237, 240, 243, 246, 250, 278, 281, 284, 288, 294, 318, 348, 352, 355];
const bodies = [2, 8, 12, 17, 22, 34, 39, 43, 47, 51, 61, 65, 69, 73, 77, 81, 85, 89, 93, 97, 101, 105, 109, 113, 117, 178, 213, 221, 235, 238, 241, 244, 279, 282, 285, 289, 295, 319, 349, 353, 356];
const legsFor = b => {
  if (parts[b + 1] && parts[b + 1].type === 2) return b + 1;
  if (parts[b - 1] && parts[b - 1].type === 2) return b - 1;
  return 290;
};
const eq = (hat, body, legs) => ({ hat, legs, body, gun: -1, glass: -1, back: -1 });
function sheet(rows, name) {
  const cell = 96, scale = 2, labelW = 170;
  const canvas = createCanvas(labelW + cell * scale, rows.length * cell * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#394048'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  rows.forEach(([label, e, hid], r) => {
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 26px sans-serif';
    ctx.fillText(label, 8, r * cell * scale + 56);
    ctx.save();
    ctx.translate(labelW + 48 * scale, r * cell * scale + 70 * scale);
    ctx.scale(scale, scale);
    renderer.drawCompositeHero(ctx, e, 0, false, hid);
    ctx.restore();
  });
  return writeFile(join(root, 'dist/' + name), canvas.toBuffer('image/png'));
}
await sheet(heads.map(h => ['H' + h, eq(h, 289, 290), 'thor']), 'scan-heads.png');
await sheet(bodies.map(b => ['B' + b + '/L' + legsFor(b), eq(59, b, legsFor(b)), 'captain']), 'scan-bodies.png');
console.log('scans written');
