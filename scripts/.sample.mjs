
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
// Loki v3: body 24x24 drawn at (-12,-18) -> spans y[-18,+6]; legs 18x12 at (-9,-5) -> y[-5,+7]
const LOKI_BODY = pixelCanvas([
  '........................',
  '.....##.................',
  '....#C#....#####........',
  '...#CCC#...#GGGGG#......',
  '...#CCC#..#GGGGGGG#.....',
  '...#CC###GGGGGGGGG#.....',
  '....#C#GGOGGGGOGGG#.....',
  '....#C#GGGOGGOGGGO#.....',
  '....#C#GGGGOGGGGOO#.....',
  '.....##GGGGGGGGG#.......',
  '......#OOOOOOOOO#.......',
  '.....#GGGGGGGGGG#.......',
  '....#GGGLGGGGLGGG#......',
  '....#GGGGGGGGGGGG#......',
  '....##GGGGGGGGG##.......',
  '....#GGGGGGGGGGG#.......',
  '....#DGGGGGGGGGD#.......',
  '....#DDGGGGGGDD#........',
  '.....#DDGGGDD#..........',
  '.....#OOOOOO#...........',
  '.....#######............',
  '........................',
  '........................',
  '........................',
], { '#': OUT, C: '#1d2a23', G: '#1fa055', L: '#37c978', D: '#136636', O: '#f0b429' });
const LOKI_LEGS = pixelCanvas([
  '..##############....',
  '..#DDDDDDDDDDDD#....',
  '..#DDDDDDDDDDDD#....',
  '..#NNNN##NNNNNN#....',
  '..#NNNN##NNNNNN#....',
  '..#NNNN##NNNNNN#....',
  '..#KKKK##KKKKKK#....',
  '..#KOOO##KOOOOK#....',
  '.#KKKKK##KKKKKK#....',
  '.###############....',
  '....................',
  '....................',
], { '#': OUT, D: '#136636', N: '#2a2e37', K: '#14161c', O: '#f0b429' });
// Strange v3: body 24x20 drawn at (-13,-18) -> spans y[-18,+2], wider cloak; legs = boot tips 20x5 at (-10,-2)
const STRANGE_BODY = pixelCanvas([
  '.##.................##..',
  '.#RR#...............#RR#',
  '.#RRR#....####.....#RR#.',
  '..#RRR#..#BBBBBB#..#RR#.',
  '.#RRRR##BBBBBBBBB##R#...',
  '.#RRRR#BBBbBBBBBB#......',
  '.#RRR#BBBB.O.BBBB#......',
  '.#RRR#BBBOEOBBBBB#......',
  '.#RR##BBBB.O.BBBB#......',
  '.#RR##OOOOOOOOOOO#......',
  '.#RRR#BBBBBBBBBBB#......',
  '.#RRR#BBBbBBBBBBB#......',
  '#RRRR#BBBBBBBBBBB#......',
  '#RRRR#NBBBBBBBBBN#......',
  '#RRRr##BBBBBBBB##.......',
  '#RRRr#NBBBBBBN#.........',
  '.#RRr#NBBBBBBN#.........',
  '.#RRr##BBBBBB##.........',
  '..#Rr#NBBBBN#...........',
  '...##########...........',
], { '#': OUT, R: '#c22424', r: '#e03434', B: '#2f5cb8', b: '#4a7dd4', N: '#1b3263', O: '#f0b429', E: '#a5f3fc' });
const STRANGE_LEGS = pixelCanvas([
  '...#################...',
  '...#SSSSSS##SSSSSSS#...',
  '..#SSSSSSS##SSSSSSSS#..',
  '..###################..',
  '.......................',
], { '#': OUT, S: '#6b4423' });
function drawFigure(ctx, kind, pose) {
  if (kind === 'loki') {
    ctx.drawImage(LOKI_LEGS, -9, -5, LOKI_LEGS.width / 2, LOKI_LEGS.height / 2);
    ctx.drawImage(LOKI_BODY, -12, -18, LOKI_BODY.width / 2, LOKI_BODY.height / 2);
    renderer.drawCompositeHero(ctx, { hat: 198, legs: -1, body: -1, gun: -1, glass: -1, back: -1 }, pose, false, 'loki');
  } else {
    ctx.drawImage(STRANGE_LEGS, -10, -2, STRANGE_LEGS.width / 2, STRANGE_LEGS.height / 2);
    ctx.drawImage(STRANGE_BODY, -12, -18, STRANGE_BODY.width / 2, STRANGE_BODY.height / 2);
    renderer.drawCompositeHero(ctx, { hat: 202, legs: -1, body: -1, gun: -1, glass: -1, back: -1 }, pose, false, 'doctor_strange');
  }
}

function topColors(label, drawFn) {
  const c = createCanvas(96, 96);
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.translate(48, 70);
  drawFn(x);
  const d = x.getImageData(0, 0, 96, 96).data;
  const hist = new Map();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 200) continue;
    const hex = '#' + [d[i], d[i + 1], d[i + 2]].map(v => v.toString(16).padStart(2, '0')).join('');
    hist.set(hex, (hist.get(hex) || 0) + 1);
  }
  const top = [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log(label, top.map(([h, n]) => h + ':' + n).join(' '));
}
const eqF = (hat, body, legs) => ({ hat, legs, body, gun: -1, glass: -1, back: -1 });
topColors('THOR body289', x => renderer.drawCompositeHero(x, eqF(-1, 289, -1), 0, false, 'thor'));
topColors('CAPTAIN body319', x => renderer.drawCompositeHero(x, eqF(-1, 319, -1), 0, false, 'captain'));
topColors('HULK body221', x => renderer.drawCompositeHero(x, eqF(-1, 221, -1), 0, false, 'hulk'));
topColors('OLD LOKI body1980', x => renderer.drawCompositeHero(x, eqF(-1, 1980, -1), 0, false, 'loki'));
topColors('ULTRON body353', x => renderer.drawCompositeHero(x, eqF(-1, 353, -1), 0, false, 'ultron'));
