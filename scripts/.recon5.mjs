
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
const { drawVectorHero } = await import('../extensions/marvel/redesign/vectorHeroes.mjs');
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
const eq = (hat, body, legs) => ({ hat, legs, body, gun: -1, glass: -1, back: -1 });
const rows = [
  ['CAPTAIN (chuan phong cach)', 'comp', eq(318, 319, 320), 'captain', null],
  ['THOR (chuan phong cach)', 'comp', eq(288, 289, 290), 'thor', null],
  ['IRON MAN - vector hien tai', 'vec', null, 'ironman', null],
  ['IRON MAN - composite MOI', 'comp', eq(204, 353, 354), 'ironman', null],
  ['IRON MAN - composite + sang do', 'comp', eq(204, 353, 354), 'ironman', 'saturate(1.6) brightness(1.18)'],
  ['MARK 50 - composite goc', 'comp', eq(294, 295, 296), 'ironman_mark50', null],
  ['DR STRANGE - vector hien tai', 'vec', null, 'doctor_strange', null],
  ['DR STRANGE - composite MOI', 'comp', eq(202, 289, 290), 'doctor_strange', null],
  ['LOKI - vector hien tai', 'vec', null, 'loki', null],
  ['LOKI - composite goc', 'comp', eq(198, 1980, 1981), 'loki', null],
];
const poses = [0, 3, 11, 23];
const cell = 96, scale = 3, labelW = 400;
const canvas = createCanvas(labelW + poses.length * cell * scale, rows.length * cell * scale);
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#4a5158'; ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.imageSmoothingEnabled = false;
rows.forEach(([label, kind, e, hid, filter], r) => {
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 25px sans-serif';
  ctx.fillText(label, 8, r * cell * scale + 60);
  poses.forEach((pose, c) => {
    ctx.save();
    ctx.translate(labelW + c * cell * scale + 48 * scale, r * cell * scale + 70 * scale);
    ctx.scale(scale, scale);
    if (kind === 'vec') drawVectorHero(ctx, hid, pose);
    else {
      if (filter) ctx.filter = filter;
      renderer.drawCompositeHero(ctx, e, pose, false, hid);
    }
    ctx.restore();
  });
});
await writeFile(join(root, 'dist/final-preview.png'), canvas.toBuffer('image/png'));
console.log('final preview written', canvas.width, canvas.height);
