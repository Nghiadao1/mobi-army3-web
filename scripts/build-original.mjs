import { spawn } from 'node:child_process';
import { cp, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const wrapper = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
const child = spawn(wrapper, ['--no-daemon', '--console', 'plain', 'gdx_teavm_web_js_build'], {
  cwd: resolve(root, 'web-client'), stdio: 'inherit', shell: process.platform === 'win32',
});
const code = await new Promise((done, reject) => { child.on('error', reject); child.on('exit', done); });
if (code !== 0) process.exit(code || 1);
await mkdir(resolve(root, 'dist'), {recursive:true});
await cp(resolve(root, 'web-client/build/dist/js/webapp'), resolve(root, 'dist'), {recursive:true});
await cp(resolve(root, 'index.html'), resolve(root, 'dist/index.html'));
console.log('Original Java/LibGDX client built into dist/.');
