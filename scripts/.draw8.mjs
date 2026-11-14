
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
// v7: color-only grids + AUTO silhouette outline (1px), vivid catalog-sampled colors.
function pixelCanvas(grid, palette) {
  const h = grid.length, w = grid[0].length, S = 2;
  const at = (i, j) => (j < 0 || j >= h || i < 0 || i >= w) ? '.' : grid[j][i];
  const c = createCanvas(w * S, h * S);
  const x = c.getContext('2d');
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    let ch = grid[j][i];
    if (ch === '.') {
      const near = [at(i - 1, j), at(i + 1, j), at(i, j - 1), at(i, j + 1)];
      if (near.some(n => n !== '.')) ch = '#';
      else continue;
    }
    x.fillStyle = palette[ch];
    x.fillRect(i * S, j * S, S, S);
  }
  return c;
}
// Loki v7 — sampled from the old body + Hulk greens: base #228b3b, light #4ade80, dark #165b26, gold #d4a83c + #f6e172
const LOKI_BODY = pixelCanvas([
  '............................',
  '.......KK...................',
  '......KDDK....GGGGG.........',
  '.....KDDDDK..GGGGGGG........',
  '.....KDDDGGGGGGGllGG........',
  '.....KDDGGGGGGGGGGGG........',
  '......KDGGGGGGGGGGG.........',
  '......KGGGGGGGGGGGG.........',
  '.......GGGGGGGGGGG..........',
  '.......OOPPPPPPPOO..........',
  '.......OOPPPPPPPOO..........',
  '......GGGGGGGGGGGGG.........',
  '.....KGGGGllllGGGGG K.......'.replace(' ', ''),
  '.....KKGGGllllGGGGKK........',
  '....KKKGGGllllGGGKKK........',
  '....KKKGGGllllGGGKKK........',
  '...KKKKDDGllllGDDKKKK.......',
  '...KKKKDDGGGGGGDDKKKK.......',
  '....KKKDDDDDDDDDDKKK........',
  '....KKKOOOOOOOOOOKKK........',
  '.....KKKKKKKKKKKKKK.........',
  '............................',
  '............................',
  '............................',
], { '#': '#14161c', K: '#141418', D: '#165b26', G: '#228b3b', l: '#4ade80', O: '#d4a83c', P: '#f6e172' });
const LOKI_LEGS = pixelCanvas([
  '..NNNNNNNNNNNNNN....',
  '..DDDDDDDDDDDDDD....',
  '..NNNNNN..NNNNNN....',
  '..NNNNNN..NNNNNN....',
  '..NNNNNN..NNNNNN....',
  '..KKKKKK..KKKKKK....',
  '..KOOOOO..KOOOOO....',
  '.KKKKKKK..KKKKKKK...',
  '....................',
  '....................',
  '....................',
  '....................',
], { '#': '#14161c', D: '#165b26', N: '#24242a', K: '#141418', O: '#d4a83c' });
// Strange v7 — vivid cloak red + royal blue robe + big glowing amulet
const STRANGE_BODY = pixelCanvas([
  '.RR.................RR..',
  '.RRR...............RRR..',
  '.RRRR....KKKK.....RRR...',
  '..RRRR..KBBBBBBK..RRR...',
  '..RRRRRKBBBBBBBBBKR.....',
  '..RRRRKBBBbbBBBBBK......',
  '..RRRKBBBOGOBBBBK.......',
  '..RRRKBBOGEGOBBBK.......',
  '..RRRKBBBOGOBBBBK.......',
  '..RRRKOOOOOOOOOOK.......',
  '..RRRRKBBBBBBBBBK.......',
  '..RRRRKBBbbBBBBBK.......',
  '.RRRRRKBBBBBBBBBK.......',
  '.RWWRRKNNBBBBNNBK.......',
  '.RWWRRKKBBBBBBKK........',
  '.RWWRRKNNBBBBNNK........',
  '..RWRRKBBBBBBBK.........',
  '..RRRRKKBBBBKK..........',
  '...RRRKBBBBK............',
  '....KKKKKKKK............',
], { '#': '#14161c', R: '#d92323', W: '#8c1d18', B: '#2563eb', b: '#60a5fa', N: '#1e3a8a', O: '#d4a83c', G: '#f6e172', E: '#67e8f9', K: '#1b3263' });
const STRANGE_LEGS = pixelCanvas([
  '...SSSSSSSSSSSSSSS...',
  '...SSSSSSS..SSSSSSS..',
  '..SSSSSSSS..SSSSSSSS.',
  '..KKKKKKKK..KKKKKKKK.',
  '.....................',
], { '#': '#14161c', S: '#7a4a21', K: '#4a2c14' });
function drawFigure(ctx, kind, pose) {
  if (kind === 'loki') {
    ctx.drawImage(LOKI_LEGS, -9, -5, LOKI_LEGS.width / 2, LOKI_LEGS.height / 2);
    ctx.drawImage(LOKI_BODY, -14, -18, LOKI_BODY.width / 2, LOKI_BODY.height / 2);
    renderer.drawCompositeHero(ctx, { hat: 198, legs: -1, body: -1, gun: -1, glass: -1, back: -1 }, pose, false, 'loki');
  } else {
    ctx.drawImage(STRANGE_LEGS, -10, -2, STRANGE_LEGS.width / 2, STRANGE_LEGS.height / 2);
    ctx.drawImage(STRANGE_BODY, -12, -18, STRANGE_BODY.width / 2, STRANGE_BODY.height / 2);
    renderer.drawCompositeHero(ctx, { hat: 202, legs: -1, body: -1, gun: -1, glass: -1, back: -1 }, pose, false, 'doctor_strange');
  }
}
const eq = (hat, body, legs) => ({ hat, legs, body, gun: -1, glass: -1, back: -1 });
const rows = [
  ['THOR ref', (ctx, pose) => renderer.drawCompositeHero(ctx, eq(288, 289, 290), pose, false, 'thor')],
  ['CAPTAIN ref', (ctx, pose) => renderer.drawCompositeHero(ctx, eq(318, 319, 320), pose, false, 'captain')],
  ['LOKI than moi v8', (ctx, pose) => drawFigure(ctx, 'loki', pose)],
  ['STRANGE than moi v7', (ctx, pose) => drawFigure(ctx, 'strange', pose)],
];
const poses = [0, 3, 11, 23];
const cell = 96, scale = 4, labelW = 320;
const canvas = createCanvas(labelW + poses.length * cell * scale, rows.length * cell * scale);
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#4a5158'; ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.imageSmoothingEnabled = false;
rows.forEach(([label, draw], r) => {
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 26px sans-serif';
  ctx.fillText(label, 8, r * cell * scale + 60);
  poses.forEach((pose, c) => {
    ctx.save();
    ctx.translate(labelW + c * cell * scale + 48 * scale, r * cell * scale + 70 * scale);
    ctx.scale(scale, scale);
    draw(ctx, pose);
    ctx.restore();
  });
});
await writeFile(join(root, 'dist/bodies-v8.png'), canvas.toBuffer('image/png'));
console.log('bodies v7 written');
