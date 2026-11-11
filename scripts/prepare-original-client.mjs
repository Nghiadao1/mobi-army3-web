import { cp, mkdir, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve, relative, dirname, join } from 'node:path';
import { replaceMethod } from './java-source.mjs';

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
  if (name === 'model/TField.java') {
    text = text.replace('import javax.swing.*;', 'import army2.web.BrowserInputDialog;');
    text = text.replace('BrowserInputDialog.showInputDialog(null, "Nhập thông tin:")', 'BrowserInputDialog.showInputDialog(null, this.title.isEmpty() ? "Nhập thông tin:" : this.title, this.text)');
    text = text.replace('input != null && !input.isEmpty()', 'input != null');
    text = text.replace('public void doChangeToTextBox() {', `public void doChangeToTextBox() {
        new Thread(new Runnable() { public void run() { TField.this.doChangeToTextBoxOnThread(); } }).start();
    }
    private void doChangeToTextBoxOnThread() {`);
  }
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
  if (name === 'screen/LoginScr.java') {
    text = replaceMethod(text, 'public void doLogin()', '        army2.web.GuestEntry.enter(this.tUser.getText());');
    text = text.replace('new Command(Language.signIn(),', 'new Command("Vào game",');
    text = text.replace('this.resetTF();', 'this.resetTF();\n        this.tUser.setText(army2.web.GuestEntry.savedName());');
    text = text.replace('this.tUser.name = "TUser";', 'this.tUser.name = "TUser"; this.tUser.title = "Tên nhân vật (2–20 ký tự)"; this.tUser.setMaxTextLenght(20); this.tUser.setIputType(0);');
    text = replaceMethod(text, 'public void focusUpdate()', `
        this.focus = 0;
        this.tUser.setisFocus(true);
        this.tPass.setisFocus(false);
        this.tEmail.setisFocus(false);
        this.right = this.tUser.cmdClear;
        this.center = this.cmdSignIn;
    `);
    text = replaceMethod(text, 'public void keyPressed(int keyCode)', `
        if (CCanvas.currentDialog == null && this.isMenu && !this.isDemo) {
            this.focus = 0;
            this.tUser.keyPressed(keyCode);
        }
        super.keyPressed(keyCode);
    `);
    text = replaceMethod(text, 'public void paintMenuLogin(mGraphics g)', `
        this.paintBackG(g);
        Cloud.paintBalloonWithCloud(g);
        Background.paintTree(g);
        paintBorderRect(g, this.yLog, 4, 120, "");
        g.drawImage(lgGame, this.lX, this.lY, 3, false);
        g.drawImage(GameScr.logoII, lgGame.image.getWidth() + this.lX, this.tUser.y - 50, 3, false);
        this.tUser.paint(g);
        Font.borderFont.drawString(g, "Tên nhân vật", this.tUser.x, this.tUser.y - 20, 0, false);
        Font.normalFont.drawString(g, "Nhập tên rồi chọn Vào game", CCanvas.width / 2, this.tUser.y + 35, 2, false);
        if (this.isMenu && !this.isDemo) {
            this.left = new Command("Đổi tên", new IAction() { public void perform() { LoginScr.this.tUser.doChangeToTextBox(); } });
            this.center = this.cmdSignIn;
            this.right = this.tUser.cmdClear;
        }
    `);
    text = text.replace('public void onPointerPressed(int x, int y2, int index) {', `public void onPointerPressed(int x, int y2, int index) {
        if (this.isMenu && CCanvas.currentDialog == null) {
            super.onPointerPressed(x, y2, index);
            this.focus = 0; this.tUser.setisFocus(true);
            if (CCanvas.isPointer(this.tUser.x, this.tUser.y, this.tUser.width, this.tUser.height, index)) this.tUser.doChangeToTextBox();
            return;
        }`);
    // Account links and password fields are deliberately removed at the user's request.
    text = text.replace('if (!this.isDemo) {\n            if', 'if (!this.isDemo && !this.isMenu) {\n            if');
    // The intro's skip button shares the right softkey. Do not let its release erase a saved name.
    text = text.replaceAll('this.right = this.tUser.cmdClear;', 'this.right = null;')
      .replaceAll('LoginScr.this.right = LoginScr.this.tUser.cmdClear;', 'LoginScr.this.right = null;');
  }
  if (name === 'screen/SplashScr.java') text = text.replace('CCanvas.serverListScreen.show();', 'army2.web.GuestEntry.openDefaultServer();');
  if (name === 'network/Session_ME.java') {
    text = text.replace('int datalen = this.dis.readInt();', 'int datalen = this.dis.readInt(); army2.web.BrowserPlatform.trace("Stream pack " + cmd + " bytes " + datalen);');
    text = text.replace('Message msg = new Message(cmd, data);', 'army2.web.BrowserPlatform.trace("Stream read " + cmd + " bytes " + data.length);\n                Message msg = new Message(cmd, data);');
    text = text.replace('CRes.out("exception ");', 'army2.web.BrowserPlatform.trace("Stream error: " + var8); CRes.out("exception ");');
    text = text.replace('Session_ME.this.errip = 14;', 'army2.web.BrowserPlatform.trace("Collector error: " + var5); Session_ME.this.errip = 14;');
  }
  if (name === 'network/MessageHandler.java') {
    text = text.replace('TerrainMidlet.myInfo.name = LoginScr.user.toLowerCase();', 'TerrainMidlet.myInfo.name = LoginScr.user;');
    text = text.replace('block7:\n                switch (msg.command) {', 'army2.web.BrowserPlatform.trace("Receive command " + msg.command);\n                block7:\n                switch (msg.command) {');
    text = text.replace('byte fileType = msg.reader().readByte();', 'byte fileType = msg.reader().readByte(); army2.web.BrowserPlatform.trace("Asset pack " + fileType);');
    text = text.replace('} catch (Exception e) {\n                e.printStackTrace();', '} catch (Exception e) {\n                army2.web.BrowserPlatform.trace("Handler error " + msg.command + ": " + e);\n                e.printStackTrace();');
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
console.log(`Original Java client prepared; ${adapted.length} browser and guest-entry adaptations.`);
await import('./build-marvel-sprites.mjs');
