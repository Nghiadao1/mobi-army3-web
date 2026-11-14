
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
const items = [
  ['body289 thor', 289], ['body319 cap', 319], ['body349 hawk', 349], ['body353 ultron', 353],
  ['body295 IM', 295], ['legs290', 290], ['legs320', 320], ['legs354', 354], ['legs296', 296],
  ['head198 loki', 198], ['head202', 202], ['head204 IM', 204],
  ['loki body custom', 1980], ['loki legs custom', 1981],
];
const cell = 170, scale = 6, cols = 7;
const rows = Math.ceil(items.length / cols);
const canvas = createCanvas(cols * cell, rows * cell);
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#808a94'; ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.imageSmoothingEnabled = false;
items.forEach(([label, pid], i) => {
  const cx = (i % cols) * cell, cy = Math.floor(i / cols) * cell;
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 15px sans-serif';
  ctx.fillText(label, cx + 6, cy + 18);
  ctx.save();
  ctx.translate(cx + cell / 2, cy + cell - 30);
  ctx.scale(scale, scale);
  renderer.drawPartSlot(ctx, pid, [0, 0, 0], false);
  ctx.restore();
});
await writeFile(join(root, 'dist/parts-ref.png'), canvas.toBuffer('image/png'));
console.log('parts ref written');
