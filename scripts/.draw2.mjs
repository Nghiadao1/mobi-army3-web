
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

function drawCustomFigure(ctx, headId, body, legs, heroId, pose, dyB = -25) {
  ctx.drawImage(legs, -10, -8, legs.width / 2, legs.height / 2);
  ctx.drawImage(body, -12, dyB, body.width / 2, body.height / 2);
  renderer.drawCompositeHero(ctx, { hat: headId, legs: -1, body: -1, gun: -1, glass: -1, back: -1 }, pose, false, heroId);
}
const eq = (hat, body, legs) => ({ hat, legs, body, gun: -1, glass: -1, back: -1 });
const rows = [
  ['THOR ref', (ctx, pose) => renderer.drawCompositeHero(ctx, eq(288, 289, 290), pose, false, 'thor')],
  ['LOKI dy-22', (ctx, pose) => drawCustomFigure(ctx, 198, LOKI_BODY, LOKI_LEGS, 'loki', pose, -22)],
  ['LOKI dy-25', (ctx, pose) => drawCustomFigure(ctx, 198, LOKI_BODY, LOKI_LEGS, 'loki', pose, -25)],
  ['LOKI dy-28', (ctx, pose) => drawCustomFigure(ctx, 198, LOKI_BODY, LOKI_LEGS, 'loki', pose, -28)],
  ['STRANGE dy-22', (ctx, pose) => drawCustomFigure(ctx, 202, STRANGE_BODY, STRANGE_LEGS, 'doctor_strange', pose, -22)],
  ['STRANGE dy-25', (ctx, pose) => drawCustomFigure(ctx, 202, STRANGE_BODY, STRANGE_LEGS, 'doctor_strange', pose, -25)],
  ['STRANGE dy-28', (ctx, pose) => drawCustomFigure(ctx, 202, STRANGE_BODY, STRANGE_LEGS, 'doctor_strange', pose, -28)],
];
const poses = [0];
const cell = 96, scale = 4, labelW = 300;
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
await writeFile(join(root, 'dist/bodies-v2.png'), canvas.toBuffer('image/png'));
console.log('bodies v1 written');
