
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
const lokiImg = await loadImage(join(root, 'extensions/marvel/site-clips/loki-f00.png'));
const lokiImg2 = await loadImage(join(root, 'extensions/marvel/site-clips/loki-f02.png'));
const strangeImg = await loadImage(join(root, 'extensions/marvel/site-clips/strange-f00.png'));
const strangeImg2 = await loadImage(join(root, 'extensions/marvel/site-clips/strange-f02.png'));
function drawClip(ctx, img, targetH) {
  const s = targetH / img.height;
  const w = img.width * s;
  ctx.drawImage(img, -w / 2, -targetH, w, targetH);
}
const eq = (hat, body, legs) => ({ hat, legs, body, gun: -1, glass: -1, back: -1 });
const rows = [
  ['THOR ref', (ctx, pose) => renderer.drawCompositeHero(ctx, eq(288, 289, 290), pose, false, 'thor')],
  ['CAPTAIN ref', (ctx, pose) => renderer.drawCompositeHero(ctx, eq(318, 319, 320), pose, false, 'captain')],
  ['LOKI web goc', (ctx, pose) => drawClip(ctx, pose === 0 ? lokiImg : lokiImg2, 42)],
  ['STRANGE web goc', (ctx, pose) => drawClip(ctx, pose === 0 ? strangeImg : strangeImg2, 38)],
];
const poses = [0, 11];
const cell = 96, scale = 4, labelW = 320;
const canvas = createCanvas(labelW + poses.length * cell * scale, rows.length * cell * scale);
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#4a5158'; ctx.fillRect(0, 0, canvas.width, canvas.height);
rows.forEach(([label, draw], r) => {
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 26px sans-serif';
  ctx.fillText(label, 8, r * cell * scale + 60);
  poses.forEach((pose, c) => {
    ctx.save();
    ctx.translate(labelW + c * cell * scale + 48 * scale, r * cell * scale + 70 * scale);
    ctx.scale(scale, scale);
    ctx.imageSmoothingEnabled = true;
    draw(ctx, pose);
    ctx.restore();
  });
});
await writeFile(join(root, 'dist/web-heroes.png'), canvas.toBuffer('image/png'));
console.log('web heroes preview written');
