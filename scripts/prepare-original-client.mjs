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
    // The web client reports versionByte 241, which makes command 122 expect a
    // single "napWeb" URL entry. Drop that branch so the classic top-up method
    // list is parsed instead; the server returns a giftcode entry in that list.
    text = text.replace(/if \(GameMidlet\.versionByte >= 240\) \{\s*MoneyInfo _money = new MoneyInfo\(\);\s*_money\.id = "napWeb";[\s\S]*?this\.gameLogicHandler\.onMoneyInfo\(avs\);\s*break;\s*\}/, '');
    text = text.replace('block7:\n                switch (msg.command) {', 'army2.web.BrowserPlatform.trace("Receive command " + msg.command);\n                block7:\n                switch (msg.command) {');
    text = text.replace('byte fileType = msg.reader().readByte();', 'byte fileType = msg.reader().readByte(); army2.web.BrowserPlatform.trace("Asset pack " + fileType);');
    text = text.replace('} catch (Exception e) {\n                e.printStackTrace();', '} catch (Exception e) {\n                army2.web.BrowserPlatform.trace("Handler error " + msg.command + ": " + e);\n                e.printStackTrace();');
  }
  if (name === 'screen/LevelScreen.java') {
    // The stock release handler hit-tests CCanvas.isPointer (the stale press
    // position) against boxes that ignore paint()'s -15,-33 translate and
    // 30px row spacing, so taps on the +/- arrows never registered on web.
    // Hit-test the release point against the painted rows instead, and let
    // the arrow keys drive this screen too (Up/Down select, Left/Right -/+).
    text = replaceMethod(text, 'public void onPointerReleased(int xReleased, int yReleased, int index)', `
        super.onPointerReleased(xReleased, yReleased, index);
        int row = (yReleased - (this.yPaint + 17)) / 30;
        if (row >= 0 && row <= 4 && xReleased >= this.xPaint - 15 && xReleased <= this.xPaint + 175) {
            this.select = row;
            if (xReleased <= this.xPaint + 92) {
                this.doDown();
            } else {
                this.doUp();
            }
        }
    `);
    text = text.replace('      super.update();\n      GameScr.sm.update();', `        super.update();
        if (CCanvas.keyPressed[2]) {
            CCanvas.keyPressed[2] = false;
            if (this.select > 0) {
                --this.select;
            }
        }

        if (CCanvas.keyPressed[8]) {
            CCanvas.keyPressed[8] = false;
            if (this.select < 4) {
                ++this.select;
            }
        }

        if (CCanvas.keyPressed[4]) {
            CCanvas.keyPressed[4] = false;
            this.doDown();
        }

        if (CCanvas.keyPressed[6]) {
            CCanvas.keyPressed[6] = false;
            this.doUp();
        }

        GameScr.sm.update();`);
  }
  if (name === 'screen/LevelScreen.java') {
    // Closing this screen silently discarded unconfirmed point allocations
    // (restartPoint), which reads as a reset. Auto-commit pending deltas on
    // close instead; "Lam lai" stays the explicit discard path.
    text = text.replace('LevelScreen.this.restartPoint();\n            LevelScreen.this.doClose();', 'LevelScreen.this.commitPoint();\n            LevelScreen.this.doClose();');
    text = text.replace('   public void doUp() {', `   public void commitPoint() {
      boolean any = false;
      for (int i = 0; i < 5; ++i) {
         if (this.deltaA[i] != 0) {
            any = true;
         }
      }
      if (any) {
         GameService.gI().addPoint(this.deltaA);
         for (int i = 0; i < 5; ++i) {
            this.deltaA[i] = 0;
         }
      }
   }

   public void doUp() {`);
  }
  if (name === 'screen/LevelScreen.java') {
    // Bulk allocation: a step selector (x1/x10/x50/x100) so hundreds of
    // points do not need hundreds of taps. Tap the "Cong: xN" label on the
    // Point line or press Tab / 1-4 to change the step; the +/- taps and
    // arrow keys then apply the whole step, clamped to what is available.
    // deltaA becomes short[] because a byte overflows past +127.
    text = text.replace('import network.GameService;', 'import network.GameService;\nimport com.badlogic.gdx.Gdx;\nimport com.badlogic.gdx.Input;');
    text = text.replace('byte[] deltaA = new byte[5];', 'short[] deltaA = new short[5];\n   int stepIdx = 0;\n   static final int[] STEPS = new int[]{1, 10, 50, 100};');
    text = text.replace('this.deltaA = new byte[5];', 'this.deltaA = new short[5];');
    text = replaceMethod(text, 'public void doUp()', `
        if (TerrainMidlet.myInfo.point > 0) {
            int n = LevelScreen.STEPS[this.stepIdx];
            if (n > TerrainMidlet.myInfo.point) {
                n = TerrainMidlet.myInfo.point;
            }
            this.deltaA[this.select] += n;
            TerrainMidlet.myInfo.point -= n;
            this.currAbility[this.select] += n;
            this.canDown[this.select] = 1;
        }

        if (TerrainMidlet.myInfo.point == 0) {
            for (int i = 0; i < 5; ++i) {
                this.canUp[i] = 0;
            }
        }
    `);
    text = replaceMethod(text, 'public void doDown()', `
        int ability = TerrainMidlet.myInfo.ability[this.select];
        if (this.currAbility[this.select] > ability) {
            int n = LevelScreen.STEPS[this.stepIdx];
            if (n > this.deltaA[this.select]) {
                n = this.deltaA[this.select];
            }
            if (n > 0) {
                this.deltaA[this.select] -= n;
                TerrainMidlet.myInfo.point += n;
                this.currAbility[this.select] -= n;
                this.canUp[this.select] = 1;
            }
        }

        if (this.currAbility[this.select] == ability) {
            this.canDown[this.select] = 0;
        }

        if (TerrainMidlet.myInfo.point > 0) {
            for (int i = 0; i < 5; ++i) {
                this.canUp[i] = 1;
            }
        }
    `);
    text = text.replace('Font.borderFont.drawString(g, "Point: " + m.point, this.xPaint + W / 2 - i, this.yPaint + 57 + 90 + 2 + i, 3);', 'Font.borderFont.drawString(g, "Point: " + m.point, this.xPaint + W / 2 - i, this.yPaint + 57 + 90 + 2 + i, 3);\n      Font.borderFont.drawString(g, "Cong: x" + LevelScreen.STEPS[this.stepIdx], this.xPaint + 150, this.yPaint + 57 + 90 + 2 + i, 3);');
    text = text.replace('int row = (yReleased - (this.yPaint + 17)) / 30;', `
        if (xReleased >= this.xPaint + 100 && yReleased >= this.yPaint + 156 && yReleased <= this.yPaint + 184) {
            this.stepIdx = (this.stepIdx + 1) % LevelScreen.STEPS.length;
            return;
        }
        int row = (yReleased - (this.yPaint + 17)) / 30;`);
    text = text.replace('        GameScr.sm.update();', `
        if (Gdx.input.isKeyJustPressed(Input.Keys.TAB)) {
            this.stepIdx = (this.stepIdx + 1) % LevelScreen.STEPS.length;
        }
        if (Gdx.input.isKeyJustPressed(Input.Keys.NUM_1)) {
            this.stepIdx = 0;
        }
        if (Gdx.input.isKeyJustPressed(Input.Keys.NUM_2)) {
            this.stepIdx = 1;
        }
        if (Gdx.input.isKeyJustPressed(Input.Keys.NUM_3)) {
            this.stepIdx = 2;
        }
        if (Gdx.input.isKeyJustPressed(Input.Keys.NUM_4)) {
            this.stepIdx = 3;
        }
        GameScr.sm.update();`);
  }
  if (name === 'network/GameService.java') {
    // addPoint must carry short deltas: bulk steps exceed a byte.
    text = text.replace('public void addPoint(byte[] point) {', 'public void addPoint(short[] point) {');
  }
  if (name === 'screen/EquipScreen.java') {
    // Same trap as LevelScreen: closing asked "save?" and discarded on No,
    // and other exits restored the previous set. Auto-commit changes on
    // close instead; wearing gear is freely reversible, so no prompt.
    text = text.replace(/if \(EquipScreen\.this\.dbKeyChange\[i\] != EquipScreen\.this\.lastDb\[i\]\) \{\s*CCanvas\.startYesNoDlg\(Language\.saveEquip\(\), new IAction\(\) \{\s*public void perform\(\) \{\s*EquipScreen\.this\.doAgree\(\);\s*\}\s*\}, new IAction\(\) \{\s*public void perform\(\) \{\s*EquipScreen\.this\.doClose\(\);\s*\}\s*\}\);\s*return;/, 'if (EquipScreen.this.dbKeyChange[i] != EquipScreen.this.lastDb[i]) {\n                  EquipScreen.this.doAgree();\n                  return;');
    text = replaceMethod(text, 'public void doClose()', `
        for (int i = 0; i < this.lastDb.length; ++i) {
            if (this.dbKeyChange[i] != this.lastDb[i]) {
                this.doAgree();
                return;
            }
        }
        this.isClose = true;
        CCanvas.endDlg();
        this.resetEquip();
    `);
    // Reopening the screen rebuilds the worn set from templates
    // (PlayerInfo.getMyEquip): template equips carry dbKey 0 and zero
    // rolled stats, so the stock match against the inventory instance's
    // dbKey never succeeds and the worn bonuses silently vanish from the
    // totals. myInfo.dbKey is filled from the same cmd 101 trailer with
    // the same raw dbKey the inventory instances carry - match on it.
    text = text.replace('if (info.myEquip.equips[tam.type] != null && info.myEquip.equips[tam.type].dbKey == tam.dbKey) {', 'if (info.myEquip.equips[tam.type] != null && info.dbKey[tam.type] == tam.dbKey) {');
  }
  if (name === 'screen/PrepareScr.java') {
    // Boss rooms (type 5) are exempt from the ready/team checks on the
    // server, but this client gate also demanded a ready teammate, so a
    // solo boss run could never start. Allow boss rooms to start solo.
    text = text.replace('if (readyCount != 0 && unReadyCount <= 0) {', 'if ((readyCount != 0 || isBossRoom || currLevel == 5) && unReadyCount <= 0) {');
  }
  if (name === 'screen/GameScr.java') {
    text = text.replace('import com.teamobi.mobiarmy2.MainGame;', 'import com.teamobi.mobiarmy2.MainGame;\nimport com.badlogic.gdx.Gdx;\nimport com.badlogic.gdx.Input;');
    text = text.replace(/boolean isPressXF;/, 'boolean isPressXF;\n    boolean kbFire;\n    boolean kbMoved;\n    long kbLast;');
    text = text.replace('        pm.update();', `        pm.update();
        // Web keyboard controls: A/D or Left/Right move, W/S or Up/Down aim,
        // hold Space to charge a shot and release to fire.
        if (pm != null && pm.isYourTurn() && CCanvas.currentDialog == null && !this.isShowPausemenu && !this.isSelectItem && !this.isChat && (CCanvas.pausemenu == null || !CCanvas.pausemenu.isShow)) {
            CPlayer kbPlayer = PM.getMyPlayer();
            if (kbPlayer != null && kbPlayer.getState() != 5 && !kbPlayer.falling) {
                boolean kbLeft = Gdx.input.isKeyPressed(Input.Keys.A) || Gdx.input.isKeyPressed(Input.Keys.LEFT);
                boolean kbRight = Gdx.input.isKeyPressed(Input.Keys.D) || Gdx.input.isKeyPressed(Input.Keys.RIGHT);
                boolean kbUp = Gdx.input.isKeyPressed(Input.Keys.W) || Gdx.input.isKeyPressed(Input.Keys.UP);
                boolean kbDown = Gdx.input.isKeyPressed(Input.Keys.S) || Gdx.input.isKeyPressed(Input.Keys.DOWN);
                long kbNow = mSystem.currentTimeMillis();
                if (kbNow - this.kbLast >= 50L && (kbLeft || kbRight || kbUp || kbDown)) {
                    this.kbLast = kbNow;
                    if (kbLeft) {
                        kbPlayer.move(0);
                        this.kbMoved = true;
                    } else if (kbRight) {
                        kbPlayer.move(2);
                        this.kbMoved = true;
                    }

                    if (kbUp || kbDown) {
                        int kbDir = kbUp ? 1 : -1;
                        if (kbPlayer.look == 0) {
                            kbDir = -kbDir;
                        }

                        kbPlayer.angle += kbDir;
                        kbPlayer.angleReset();
                        kbPlayer.angleUpdate();
                    }
                }

                if (!kbLeft && !kbRight && this.kbMoved) {
                    this.kbMoved = false;
                    GameService.gI().move((short) kbPlayer.x, (short) kbPlayer.y);
                }

                if (Gdx.input.isKeyPressed(Input.Keys.SPACE)) {
                    kbPlayer.holdFire();
                    this.kbFire = true;
                } else if (this.kbFire) {
                    this.kbFire = false;
                    kbPlayer.fire();
                }
            }
        }`);
  }
  if (name === 'screen/GameScr.java') {
    // Quick item bar + POW button on the battle screen: using an item used
    // to mean pause menu -> item panel -> double-tap, and max force was a
    // text dialog buried in the same menu. The bar mirrors the panel's
    // slots; one tap uses the item. POW fires one shot at full force.
    text = text.replace('    public void selectedItemPanelRealeased(int x, int y2, int index) {', `
    public boolean isQuickZone(int x, int y) {
        if (x >= CCanvas.width - 78 && x <= CCanvas.width - 16 && y >= CCanvas.hieght - 88 && y <= CCanvas.hieght - 64) {
            return true;
        }
        int qx = CCanvas.hw - 96;
        int qy = CCanvas.hieght - 54;
        return x >= qx && x < qx + 192 && y >= qy && y < qy + 24;
    }

    public void paintQuickBar(mGraphics g) {
        CPlayer me = PM.getMyPlayer();
        if (me == null || me.item == null) {
            return;
        }
        int qx = CCanvas.hw - 96;
        int qy = CCanvas.hieght - 54;
        g.setColor(0, 0.45F);
        g.fillRect(qx - 3, qy - 3, 198, 30, false);
        for (int qi = 0; qi < me.item.length && qi < 8; ++qi) {
            int sx = qx + qi * 24;
            g.setColor(10526880);
            g.drawRect(sx, qy, 23, 23, false);
            int itemId = me.item[qi];
            if (itemId >= 0) {
                try {
                    g.drawRegion(s_imgITEM, 0, (itemId + 2) * 16, 16, 16, 0, sx + 4, qy + 4, 0, false);
                } catch (Exception e) {
                }
                if (PrepareScr.currLevel == 7 && num != null && num[qi] != 100) {
                    Font.smallFontYellow.drawString(g, String.valueOf(num[qi]), sx + 12, qy + 12, 0);
                }
            }
        }
        g.setColor(13631488);
        g.fillRect(CCanvas.width - 78, CCanvas.hieght - 88, 62, 24, false);
        g.setColor(16777215);
        g.drawRect(CCanvas.width - 78, CCanvas.hieght - 88, 62, 24, false);
        Font.borderFont.drawString(g, "POW", CCanvas.width - 47, CCanvas.hieght - 82, 3);
    }

    public void quickUseItem(int slot) {
        try {
            CPlayer me = PM.getMyPlayer();
            if (me == null || me.item == null || slot < 0 || slot >= me.item.length) {
                return;
            }
            int itemId = me.item[slot];
            if (trainingMode) {
                me.UseItem(itemId, true, slot);
                if (itemId == 0) {
                    PM.p[0].hp += 30;
                }
                return;
            }
            if (me.itemUsed != -1 || itemId == -2 || itemId == -1) {
                return;
            }
            if (!pm.isYourTurn()) {
                return;
            }
            if (PrepareScr.currLevel == 7 && GameScr.num[slot] == 0) {
                return;
            }
            me.UseItem(itemId, false, slot);
        } catch (Exception e) {
        }
    }

    public void quickPow() {
        try {
            CPlayer p = PM.getMyPlayer();
            if (p == null || !pm.isYourTurn() || p.getState() == 5 || p.falling) {
                return;
            }
            p.holdFire();
            p.holdFire();
            if (p.getState() != 3) {
                return;
            }
            if (p.isDoublePower) {
                p.force = (byte)p.maxforce;
                p.isSecondPower = true;
                p.force_2 = (byte)(p.maxforce2 > 1 ? p.maxforce2 - 1 : 1);
            } else {
                p.force = (byte)(p.maxforce > 1 ? p.maxforce - 1 : 1);
            }
            p.holdFire();
        } catch (Exception e) {
        }
    }

    public void selectedItemPanelRealeased(int x, int y2, int index) {`);
    text = text.replace('                this.paintTouch(g);', '                this.paintTouch(g);\n                this.paintQuickBar(g);');
    text = text.replace('            pm.onPointerPressed(xScreen, yScreen, index);', '            if (!(pm != null && pm.isYourTurn() && this.isQuickZone(xScreen, yScreen))) {\n                pm.onPointerPressed(xScreen, yScreen, index);\n            }');
    text = text.replace('        this.isPressXL = this.isPressXR = this.isPressXF = false;\n        if (Camera.mode == 1 && !this.isSelectItem) {', `        this.isPressXL = this.isPressXR = this.isPressXF = false;
        if (!this.isSelectItem && CCanvas.currentDialog == null && pm != null && pm.isYourTurn()) {
            if (x >= CCanvas.width - 78 && x <= CCanvas.width - 16 && y2 >= CCanvas.hieght - 88 && y2 <= CCanvas.hieght - 64) {
                this.quickPow();
                return;
            }
            int qx = CCanvas.hw - 96;
            int qy = CCanvas.hieght - 54;
            if (x >= qx && x < qx + 192 && y2 >= qy && y2 < qy + 24) {
                this.quickUseItem((x - qx) / 24);
                return;
            }
        }
        if (Camera.mode == 1 && !this.isSelectItem) {`);
    text = text.replace('                if (Gdx.input.isKeyPressed(Input.Keys.SPACE)) {', `                if (Gdx.input.isKeyJustPressed(Input.Keys.P)) {
                    this.quickPow();
                }
                for (int qi = 0; qi < 8; ++qi) {
                    if (Gdx.input.isKeyJustPressed(Input.Keys.NUM_1 + qi)) {
                        this.quickUseItem(qi);
                    }
                }
                if (Gdx.input.isKeyPressed(Input.Keys.SPACE)) {`);
  }
  if (name === 'shop/ShopItem.java') {
    // Ask how many to buy instead of always taking the fixed package size;
    // the typed amount feeds the existing xu/luong payment step unchanged.
    text = text.replace(new RegExp("if \\(ShopItem\\.getCurI\\(\\)\\.num < 99\\) \\{\\s*ShopItem\\.this\\.isChooseAItem = true;\\s*if \\(99 - ShopItem\\.getCurI\\(\\)\\.num < ShopItem\\.getCurI\\(\\)\\.nCurBuyPackage\\) \\{\\s*ShopItem\\.numItemMua = 99 - ShopItem\\.getCurI\\(\\)\\.num;\\s*\\} else \\{\\s*ShopItem\\.numItemMua = ShopItem\\.getCurI\\(\\)\\.nCurBuyPackage;\\s*\\}\\s*ShopItem\\.checkTongTien\\(ShopItem\\.ItemIcon\\.select, ShopItem\\.numItemMua\\);\\s*\\} else \\{"), `                   if (ShopItem.getCurI().num < 99) {
                      final int maxBuy = 99 - ShopItem.getCurI().num;
                      int defBuy = maxBuy < ShopItem.getCurI().nCurBuyPackage ? maxBuy : ShopItem.getCurI().nCurBuyPackage;
                      ShopItem.numItemMua = defBuy;
                      CCanvas.inputDlg.setInfo("Nhập số lượng muốn mua (1-" + maxBuy + "):", new IAction() {
                         public void perform() {
                            int qty = ShopItem.numItemMua;
                            try {
                               qty = Integer.parseInt(CCanvas.inputDlg.tfInput.getText().trim());
                            } catch (Exception e) {
                            }

                            if (qty < 1) {
                               qty = 1;
                            }

                            if (qty > maxBuy) {
                               qty = maxBuy;
                            }

                            ShopItem.numItemMua = qty;
                            ShopItem.this.isChooseAItem = true;
                            ShopItem.checkTongTien(ShopItem.ItemIcon.select, ShopItem.numItemMua);
                            CCanvas.endDlg();
                            ShopItem.this.center.action.perform();
                         }
                      }, new IAction() {
                         public void perform() {
                            CCanvas.endDlg();
                         }
                      }, 0);
                      CCanvas.inputDlg.tfInput.setText(String.valueOf(defBuy));
                      CCanvas.inputDlg.show();
                   } else {`);
    // One-tap purchase that fills every buyable shop item up to 99.
    text = text.replace(/this\.right = this\.cmdTroRa;/, `this.right = this.cmdTroRa;
       this.left = new Command("Mua x99 hết", new IAction() {
          public void perform() {
             CCanvas.startYesNoDlg("Mua toàn bộ vật phẩm trong shop lên 99?", new IAction() {
                public void perform() {
                   CCanvas.endDlg();
                   long xu = TerrainMidlet.myInfo.xu;
                   long luong = TerrainMidlet.myInfo.luong;
                   for (int i = 0; i < ShopItem.sellItem.size(); ++i) {
                      Item it = ShopItem.getI(i);
                      if (it.isCannotBuy || it.isFreeItem || it.type == 36 || it.type == 37) {
                         continue;
                      }

                      int qty = 99 - it.num;
                      if (qty <= 0) {
                         continue;
                      }

                      if (it.price != -1 && (long) it.price * qty <= xu) {
                         GameService.gI().requestBuyItem((byte) 0, it.type, (byte) qty);
                         xu -= (long) it.price * qty;
                         it.num = (byte) (it.num + qty);
                      } else if (it.price2 != -1 && (long) it.price2 * qty <= luong) {
                         GameService.gI().requestBuyItem((byte) 1, it.type, (byte) qty);
                         luong -= (long) it.price2 * qty;
                         it.num = (byte) (it.num + qty);
                      } else if (it.price != -1 && xu >= it.price) {
                         int part = (int) (xu / it.price);
                         if (part > qty) {
                            part = qty;
                         }

                         GameService.gI().requestBuyItem((byte) 0, it.type, (byte) part);
                         xu -= (long) it.price * part;
                         it.num = (byte) (it.num + part);
                      } else if (it.price2 != -1 && luong >= it.price2) {
                         int part = (int) (luong / it.price2);
                         if (part > qty) {
                            part = qty;
                         }

                         GameService.gI().requestBuyItem((byte) 1, it.type, (byte) part);
                         luong -= (long) it.price2 * part;
                         it.num = (byte) (it.num + part);
                      }
                   }

                   CCanvas.startOKDlg("Đã mua xong!");
                }
             }, new IAction() {
                public void perform() {
                   CCanvas.endDlg();
                }
             });
          }
       });`);
  }


  if (name === 'screen/PrepareScr.java') {
    // Boss rooms showed only the terrain name of the current map, which does
    // not say which boss the room fights. Add a glass-id -> boss-name lookup
    // (same index math as the boss sprite painted in the waiting room) and
    // use it for the map label in boss rooms (currLevel == 5).
    const helper = [
      '   public static String bossNameForMap(int map) {',
      '      if (mapBossID == null || bossID == null) {',
      '         return "";',
      '      }',
      '',
      '      int i = mapBossID.length - (MM.NUM_MAP - map);',
      '      if (i < 0 || i >= bossID.length) {',
      '         return "";',
      '      }',
      '',
      '      switch (bossID[i]) {',
      '         case 12:',
      '            return "Bom";',
      '         case 13:',
      '            return "Nhện máy";',
      '         case 14:',
      '            return "Người máy";',
      '         case 15:',
      '            return "T-rex máy";',
      '         case 16:',
      '            return "UFO";',
      '         case 17:',
      '            return "Khí cầu";',
      '         case 22:',
      '            return "Nhện độc";',
      '         case 25:',
      '         case 26:',
      '            return "Ma";',
      '         default:',
      '            return "";',
      '      }',
      '   }',
      '',
      '   public static boolean isBossRoom;'
    ].join('\n');
    if (!text.includes('public static boolean isBossRoom;')) {
      throw new Error('PrepareScr isBossRoom anchor not found');
    }
    text = text.replace('public static boolean isBossRoom;', helper);
    const label = 'curMap + 1 + ". " + MM.mapName[curMap]';
    if (!text.includes(label)) {
      throw new Error('PrepareScr map label anchor not found');
    }
    text = text.split(label).join('(currLevel == 5 && bossNameForMap(curMap).length() > 0 ? "Boss: " + bossNameForMap(curMap) : curMap + 1 + ". " + MM.mapName[curMap])');
  }

  if (name === 'screen/RoomListScr.java') {
    // Same boss-name label in the map picker header when browsing boss maps.
    const label = 'MM.mapName[curMapIndex + tem]';
    if (!text.includes(label)) {
      throw new Error('RoomListScr map label anchor not found');
    }
    text = text.split(label).join('(this.isBoss && PrepareScr.bossNameForMap(curMapIndex + tem).length() > 0 ? "Boss: " + PrepareScr.bossNameForMap(curMapIndex + tem) : MM.mapName[curMapIndex + tem])');
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
