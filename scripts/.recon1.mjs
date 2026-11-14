
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
const eq = (hat, body, legs, glass = -1) => ({ hat, legs, body, gun: -1, glass, back: -1 });
const rows = [
  ['CAPTAIN ref', eq(318, 319, 320), 'captain'],
  ['THOR ref', eq(288, 289, 290), 'thor'],
  ['ULTRON ref', eq(352, 353, 354), 'ultron'],
  ['IM-A current 204/295/296', eq(204, 295, 296), 'ironman'],
  ['IM-B set 294/295/296', eq(294, 295, 296), 'ironman'],
  ['IM-C 204/205/206', eq(204, 205, 206), 'ironman'],
  ['IM-D 204/207/208', eq(204, 207, 208), 'ironman'],
  ['DS-A current 59/210/209 g3', eq(59, 210, 209, 3), 'doctor_strange'],
  ['DS-B swap 59/209/210 g3', eq(59, 209, 210, 3), 'doctor_strange'],
  ['DS-C 59/211/212 g3', eq(59, 211, 212, 3), 'doctor_strange'],
  ['LK-A current 198/custom', eq(198, 1980, 1981), 'loki'],
  ['LK-B 198/205/206', eq(198, 205, 206), 'loki'],
  ['LK-C 198/207/208', eq(198, 207, 208), 'loki'],
  ['LK-D 198/209/210', eq(198, 209, 210), 'loki'],
  ['LK-E 198/211/212', eq(198, 211, 212), 'loki'],
];
const poses = [0, 3, 11];
const cell = 96, scale = 2, labelW = 300;
const canvas = createCanvas(labelW + poses.length * cell * scale, rows.length * cell * scale);
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#2b2f36'; ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.imageSmoothingEnabled = false;
rows.forEach(([label, e, hid], r) => {
  ctx.fillStyle = '#ffffff'; ctx.font = '22px sans-serif';
  ctx.fillText(label, 8, r * cell * scale + 52);
  poses.forEach((pose, c) => {
    ctx.save();
    ctx.translate(labelW + c * cell * scale + 48 * scale, r * cell * scale + 70 * scale);
    ctx.scale(scale, scale);
    renderer.drawCompositeHero(ctx, e, pose, false, hid);
    ctx.restore();
  });
});
await writeFile(join(root, 'dist/recon1.png'), canvas.toBuffer('image/png'));
console.log('recon written', canvas.width, canvas.height);
