
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

// ---- Pixel-part factory: logical grid -> canvas at 2x (drawn at half size in game space)
function pixelCanvas(grid, palette) {
  const h = grid.length, w = grid[0].length, S = 2;
  const c = createCanvas(w * S, h * S);
  const x = c.getContext('2d');
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const col = palette[grid[j][i]];
    if (!col) continue;
    x.fillStyle = col;
    x.fillRect(i * S, j * S, S, S);
  }
  return c;
}
const OUT = '#14161c';
const LOKI_BODY = pixelCanvas([
  '........................',
  '.....##.................',
  '....#CC#...#####........',
  '...#CCCC#..#GGGGG#......',
  '...#CCCC#.#GGGGGGG#.....',
  '...#CCC##GGGLGGGGGG#....',
  '....#CC#GGOGGGGGGGG#....',
  '....#CC#GOGGOGGGGGO#....',
  '....#C##GGOGGGGGGOO#....',
  '.....#C#OOOOOOOOOO#.....',
  '.....#C#GGGGGGGGG#......',
  '....#CC#DGGGGGGD#.......',
  '....#CC##DGGGGD##.......',
  '....#CCC#DGGGGD#........',
  '.....#CC#DGGD##.........',
  '......##C#DGD#..........',
  '........#######.........',
  '........................',
], { '#': OUT, C: '#182420', G: '#1e7a46', L: '#3aa763', D: '#0e4d2a', O: '#d9a521' });
const LOKI_LEGS = pixelCanvas([
  '...##############.....',
  '...#NNNNNNNNNNNN#.....',
  '...#NNNNN##NNNNN#.....',
  '...#NNNNN##NNNNN#.....',
  '...#KKKKK##KKKKK#.....',
  '...#KOOOK##KOOOK#.....',
  '..#KKKKKK##KKKKKK#....',
  '..################....',
], { '#': OUT, N: '#23262e', K: '#14161c', O: '#d9a521' });
const STRANGE_BODY = pixelCanvas([
  '.##................##...',
  '.#RR#..............#RR#.',
  '.#RRR#....####....#RRR#.',
  '..#RRR#..#BBBBBB#.#RR#..',
  '..#RRRR#BBBBBBBB##R#....',
  '...#RRR#BBBbBBOBB#......',
  '...#RR#BBBOEOBBBB#......',
  '...#RR#BBBBBBBBBB#......',
  '...#RR#OOOOOOOOOO#......',
  '...#RR#BBBBBBBBBB#......',
  '...#RR#BBBbBBBBBB#......',
  '..#RRR#BBBBBBBBBB#......',
  '..#RRR#NBBBBBBBBN#......',
  '..#RRR##BBBBBBBB##......',
  '...#RR#NBBBBBBN#........',
  '....###NBBBBN##.........',
  '......########..........',
  '........................',
], { '#': OUT, R: '#b91c1c', B: '#274690', b: '#3f66c4', N: '#16294f', O: '#d9a521', E: '#a5f3fc' });
const STRANGE_LEGS = pixelCanvas([
  '..################....',
  '..#BBBBBBBBBBBBBB#....',
  '..#NBBBBBBBBBBBB#.....',
  '..#NBBBBBBBBBBBN#.....',
  '...#BBBBBBBBBBB#......',
  '...#NBBBBBBBBN#.......',
  '....#SSSS#####........',
  '....######............',
], { '#': OUT, B: '#274690', N: '#16294f', S: '#6b4423' });

function drawCustomFigure(ctx, headId, body, legs, heroId, pose) {
  // legs -> body -> head slot (renderer) -> hero extras (mandalas for strange, inside drawCompositeHero)
  ctx.drawImage(legs, -10, -8, legs.width / 2, legs.height / 2);
  ctx.drawImage(body, -12, -18, body.width / 2, body.height / 2);
  renderer.drawCompositeHero(ctx, { hat: headId, legs: -1, body: -1, gun: -1, glass: -1, back: -1 }, pose, false, heroId);
}

function bbox(ctx, W, H) {
  const d = ctx.getImageData(0, 0, W, H).data;
  let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (d[(y * W + x) * 4 + 3] > 10) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  return { x: [minX, maxX], y: [minY, maxY], w: maxX - minX + 1, h: maxY - minY + 1 };
}
function measure(label, drawFn) {
  const c = createCanvas(96, 96);
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.translate(48, 70);
  drawFn(x);
  const b = bbox(x, 96, 96);
  console.log(label, 'bbox x:', b.x, 'y:', b.y, 'w:', b.w, 'h:', b.h, '(feet at y=70, so top rel feet:', b.y[0] - 70, 'bottom rel:', b.y[1] - 70, ')');
}
const eqF = (hat, body, legs) => ({ hat, legs, body, gun: -1, glass: -1, back: -1 });
measure('THOR full', x => renderer.drawCompositeHero(x, eqF(288, 289, 290), 0, false, 'thor'));
measure('THOR head288 only', x => renderer.drawCompositeHero(x, eqF(288, -1, -1), 0, false, 'thor'));
measure('THOR body289 only', x => renderer.drawCompositeHero(x, eqF(-1, 289, -1), 0, false, 'thor'));
measure('THOR legs290 only', x => renderer.drawCompositeHero(x, eqF(-1, -1, 290), 0, false, 'thor'));
measure('head202 only', x => renderer.drawCompositeHero(x, eqF(202, -1, -1), 0, false, 'doctor_strange'));
measure('head198 only', x => renderer.drawCompositeHero(x, eqF(198, -1, -1), 0, false, 'loki'));
measure('LOKI full custom-old (198,1980,1981)', x => renderer.drawCompositeHero(x, eqF(198, 1980, 1981), 0, false, 'loki'));
measure('my STRANGE body alone', x => x.drawImage(STRANGE_BODY, -12, -25, STRANGE_BODY.width / 2, STRANGE_BODY.height / 2));
measure('my STRANGE legs alone', x => x.drawImage(STRANGE_LEGS, -10, -8, STRANGE_LEGS.width / 2, STRANGE_LEGS.height / 2));
measure('my LOKI body alone', x => x.drawImage(LOKI_BODY, -12, -25, LOKI_BODY.width / 2, LOKI_BODY.height / 2));
