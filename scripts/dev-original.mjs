import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
if (!existsSync(resolve(root, 'dist/app.js'))) {
  const build = spawn(process.execPath, ['scripts/build-original.mjs'], {cwd:root, stdio:'inherit'});
  const code = await new Promise((done,reject) => { build.on('error',reject); build.on('exit',done); });
  if (code) process.exit(code);
}
process.env.ARMY2_WEB_ROOT = resolve(root, 'dist');
await import('./serve-original.mjs');
