import { cp, mkdir, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve, relative, dirname, join } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const upstream = join(root, 'upstream/MobiArmy2-Client');
const generated = join(root, 'web-client/build/generated');
await mkdir(generated, { recursive: true });
await cp(join(upstream, 'desktop/assets'), join(generated, 'assets'), { recursive: true });
// Never load upstream's saved login or account settings into a visitor's browser.
for (const file of ['caroun', 'caropass', 'remember', 'ipArmy2']) {
  await rm(join(generated, 'assets/rms', file), { force: true });
}
async function walk(directory) {
  let files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    files.push(...(entry.isDirectory() ? await walk(path) : [path]));
  }
  return files;
}
const source = join(upstream, 'core/src');
const adapted = [];
for (const path of await walk(source)) {
  const name = relative(source, path);
  if (!name.endsWith('.java') || name === 'CLib/mSocket.java' || name === 'CLib/RMS.java') continue;
  let text = await readFile(path, 'utf8');
  const original = text;
  text = text.replace(/^import java\.awt\.event\.KeyEvent;\s*$/m, '');
  text = text.replace('Gdx.input.setCatchBackKey(true)', 'Gdx.input.setCatchKey(com.badlogic.gdx.Input.Keys.BACK, true)');
  if (name === 'com/teamobi/mobiarmy2/MainGame.java') text = text.replace('GameMidlet.gameCanvas.keyHold(character);', 'GameMidlet.gameCanvas.keyPressed(character);');
  text = text.replaceAll('System.exit(', 'army2.web.BrowserPlatform.exit(');
  text = text.replace('import java.net.SocketException;', 'import army2.web.WebSocketException;').replaceAll('catch (SocketException ', 'catch (WebSocketException ');
  text = text.replaceAll('javax.swing.JOptionPane', 'army2.web.BrowserInputDialog').replaceAll('JOptionPane', 'BrowserInputDialog');
  if (name === 'model/TField.java') text = text.replace('import javax.swing.*;', 'import army2.web.BrowserInputDialog;');
  if (name === 'CLib/Image.java' || name === 'CLib/SoundSystem.java') text = text.replaceAll('Gdx.files.local(', 'Gdx.files.internal(');
  if (name === 'model/Language.java') {
    // TeaVM's compact runtime does not expose native JVM stack frames.
    text = text.replace(/        StackTraceElement\[\] stackTrace = Thread.currentThread\(\).getStackTrace\(\);\s*StackTraceElement caller = stackTrace\[2\];\s*System.out.println\("Called by: " \+ caller\);/, '');
  }
  if (name === 'model/CRes.java') {
    text = text.replace(/^import (java\.awt\.image\.BufferedImage|javax\.imageio\.ImageIO);\s*$/gm, '');
    // These two unused desktop export helpers cannot link to AWT in a browser.
    text = text.replace(/    public static byte\[\] toByteArray\(BufferedImage[\s\S]*?(?=    public static byte\[\] screenShot)/, '');
  }
  if (name === 'model/FilePack.java') {
    text = text.replace('this.getClass().getResourceAsStream(this.name)', 'Gdx.files.internal(this.name.startsWith("/") ? this.name.substring(1) : this.name).read()');
  }
  if (name === 'com/teamobi/mobiarmy2/GameMidlet.java') {
    text = text.replace('this.getClass().getResourceAsStream("/provider.txt")', 'com.badlogic.gdx.Gdx.files.internal("res/provider.txt").read()');
  }
  const output = join(generated, 'source', name);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, text);
  if (text !== original) adapted.push(name);
}
await writeFile(join(generated, 'adaptations.json'), JSON.stringify({
  preservedSource: 'upstream/MobiArmy2-Client/core/src',
  platformAdapters: ['CLib/mSocket.java', 'CLib/RMS.java'],
  generatedAdaptations: adapted,
}, null, 2));
console.log(`Original Java client prepared; ${adapted.length} platform-only source adaptations.`);
