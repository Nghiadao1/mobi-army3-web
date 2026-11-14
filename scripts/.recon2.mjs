
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
  ['IM legs296 base', eq(204, 295, 296), 'ironman'],
  ['IM legs293', eq(204, 295, 293), 'ironman'],
  ['IM legs298', eq(204, 295, 298), 'ironman'],
  ['IM legs290 thor', eq(204, 295, 290), 'ironman'],
  ['IM legs354 ultron', eq(204, 295, 354), 'ironman'],
  ['SET 291/292/293', eq(291, 292, 293), 'ironman'],
  ['SET 287/285/286', eq(287, 285, 286), 'ironman'],
  ['DS thor-body 59/289/290', eq(59, 289, 290), 'doctor_strange'],
  ['DS cap-body 59/319/320', eq(59, 319, 320), 'doctor_strange'],
  ['DS head195 thor-body', eq(195, 289, 290), 'doctor_strange'],
  ['DS head196 thor-body', eq(196, 289, 290), 'doctor_strange'],
  ['DS head197 thor-body', eq(197, 289, 290), 'doctor_strange'],
  ['DS head199 thor-body', eq(199, 289, 290), 'doctor_strange'],
  ['DS head200 thor-body', eq(200, 289, 290), 'doctor_strange'],
  ['DS head201 thor-body', eq(201, 289, 290), 'doctor_strange'],
  ['DS head202 thor-body', eq(202, 289, 290), 'doctor_strange'],
  ['DS head203 thor-body', eq(203, 289, 290), 'doctor_strange'],
  ['LK thor-body 198/289/290', eq(198, 289, 290), 'loki'],
  ['LK ws-body 198/356/357', eq(198, 356, 357), 'loki'],
  ['LK hawk-body 198/349/350', eq(198, 349, 350), 'loki'],
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
const { writeFile: wf } = await import('node:fs/promises');
await wf(join(root, 'dist/recon2.png'), canvas.toBuffer('image/png'));
console.log('recon2 written', canvas.width, canvas.height);
