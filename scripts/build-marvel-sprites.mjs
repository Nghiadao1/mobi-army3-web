import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import ts from 'typescript';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const root = resolve(import.meta.dirname, '..');
const legacy = join(root, 'extensions/marvel/original');
const output = join(root, 'web-client/build/generated/assets/res/marvel');
await mkdir(output, { recursive: true });
async function importSource(path) {
  const source = await readFile(path, 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
}
const { HEROES } = await importSource(join(legacy, 'src/data/gameContent.ts'));
const { CharacterRenderer } = await importSource(join(legacy, 'src/engine/CharacterRenderer.ts'));
const heroes = HEROES.filter(hero => hero.faction === 'marvel');
const assetRoot = join(legacy, 'public');
const readJson = async path => JSON.parse(await readFile(join(assetRoot, path), 'utf8'));
const cache = new Map();
async function loadDirectory(directory) {
  for (const entry of await readdir(directory, {withFileTypes:true})) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await loadDirectory(path);
    else if (entry.name.endsWith('.png')) cache.set(relative(assetRoot, path).replaceAll('\\','/'), await loadImage(path));
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
const frameSize = 96;
for (const hero of heroes) {
  const canvas = createCanvas(frameSize * 30, frameSize);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  for (let pose = 0; pose < 30; pose++) {
    ctx.save(); ctx.translate(pose * frameSize + 48, 70);
    // Use the user's existing composite renderer, parts, poses, filters and equipment IDs unchanged.
    renderer.drawCompositeHero(ctx, hero.equipment, pose, false, hero.id);
    ctx.restore();
  }
  await writeFile(join(output, `${hero.id}.png`), canvas.toBuffer('image/png'));
}
await writeFile(join(output, 'heroes.json'), JSON.stringify(heroes, null, 2));
console.log(`Built ${heroes.length} Marvel spritesheets from original equipment and renderer; 30 poses each.`);
