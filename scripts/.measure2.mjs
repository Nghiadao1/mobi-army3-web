
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
// Loki body v2: 24x22 drawn at (-12,-17). Rows 0-5 hide behind the helmet;
// the visible story is rows 6+ (chest X in the helmet opening, belt, flared skirt).
const LOKI_BODY = pixelCanvas([
  '........................',
  '.....##.................',
  '....#CC#...#####........',
  '...#CCCC#..#GGGGG#......',
  '...#CCCC#.#GGGGGGG#.....',
  '...#CCC##GGGGGGGGG#.....',
  '....#CC#GOGGGGOGGG#.....',
  '....#CC#GGOGGOGGGO#.....',
  '....#C##GGGOGGGGOO#.....',
  '.....#C#GGGGGGGGG#......',
  '.....#C#OOOOOOOOO#......',
  '....#CC#GGGGGGGG#.......',
  '....#CC#DGGGGGGD#.......',
  '...#CCC#DGGGGGGD#.......',
  '...#CCC##DGGGGD##.......',
  '...#CCCC#DGGGGD#........',
  '....#CCC#DGGGD#.........',
  '....#CC##DGGD##.........',
  '.....#CC#DGD#...........',
  '.....#C##D##............',
  '......#######...........',
  '........................',
], { '#': OUT, C: '#182420', G: '#1e7a46', D: '#0e4d2a', O: '#d9a521' });
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
  ctx.drawImage(legs, -10, -8, legs.width / 2, legs.height / 2);
  ctx.drawImage(body, -12, -17, body.width / 2, body.height / 2);
  renderer.drawCompositeHero(ctx, { hat: headId, legs: -1, body: -1, gun: -1, glass: -1, back: -1 }, pose, false, heroId);
}

const fs2 = await import("node:fs");
console.log("old loki body png:", (() => { const b = fs2.readFileSync("extensions/marvel/original/public/assets/heroes/small/2Small198_body.png"); return b.readUInt32BE(16) + "x" + b.readUInt32BE(20); })());
console.log("old loki legs png:", (() => { const b = fs2.readFileSync("extensions/marvel/original/public/assets/heroes/small/2Small198_legs.png"); return b.readUInt32BE(16) + "x" + b.readUInt32BE(20); })());
function spans(label, drawFn) {
  const c = createCanvas(96, 96);
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.translate(48, 70);
  drawFn(x);
  const d = x.getImageData(0, 0, 96, 96).data;
  console.log("== " + label);
  for (let y = 34; y < 78; y += 2) {
    let minX = 1e9, maxX = -1;
    for (let xx = 0; xx < 96; xx++) if (d[(y * 96 + xx) * 4 + 3] > 10) { if (xx < minX) minX = xx; if (xx > maxX) maxX = xx; }
    if (maxX >= 0) console.log("  y=" + (y - 70), "x rel: [" + (minX - 48) + "," + (maxX - 48) + "]");
  }
}
const eqF = (hat, body, legs) => ({ hat, legs, body, gun: -1, glass: -1, back: -1 });
spans("OLD loki composite", x => renderer.drawCompositeHero(x, eqF(198, 1980, 1981), 0, false, 'loki'));
spans("MY loki v2", x => drawCustomFigure(x, 198, LOKI_BODY, LOKI_LEGS, 'loki', 0));
spans("MY strange v2", x => drawCustomFigure(x, 202, STRANGE_BODY, STRANGE_LEGS, 'doctor_strange', 0));
