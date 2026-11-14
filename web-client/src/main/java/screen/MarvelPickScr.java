package screen;

import CLib.mGraphics;
import CLib.mImage;
import army2.web.BrowserPlatform;
import army2.web.MarvelRoster;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Input;
import coreLG.CCanvas;
import java.util.List;
import model.Font;
import model.IAction;
import model.Language;
import network.Command;
import network.GameService;

/**
 * Marvel hero picker (P2 of extensions/marvel/MERGE_PLAN.md). Opened from
 * the menu training entry: picking a hero stores it in
 * MarvelRoster.selectedId and starts the stock training flow; the battle
 * renderer (player.MarvelRender) then draws the local player with the
 * hero spritesheet. Row 0 keeps the original Army 2 character.
 */
public class MarvelPickScr extends CScreen {
    private static final int ROW_H = 34;
    private static final int LIST_TOP = 48;

    private static MarvelPickScr instance;

    private List<MarvelRoster.Hero> heroes;
    private int selected;
    private int cmy;
    private int cmtoY;
    private int cmyLim;
    private int pa;
    private boolean trans;

    public static void open() {
        if (instance == null) {
            instance = new MarvelPickScr();
        }
        instance.refresh();
        instance.show(CCanvas.menuScr);
    }

    private void refresh() {
        MarvelRoster.load();
        this.heroes = MarvelRoster.heroes();
        this.selected = 0;
        if (MarvelRoster.selectedId != null) {
            for (int i = 0; i < this.heroes.size(); ++i) {
                if (this.heroes.get(i).id.equals(MarvelRoster.selectedId)) {
                    this.selected = i + 1;
                    break;
                }
            }
        }
        this.cmy = 0;
        this.cmtoY = 0;
        this.cmyLim = this.rows() * ROW_H - (CCanvas.hieght - LIST_TOP - 70);
        if (this.cmyLim < 0) {
            this.cmyLim = 0;
        }
        this.center = new Command("Chon", new IAction() {
            public void perform() {
                MarvelPickScr.this.confirm();
            }
        });
        this.right = new Command(Language.close(), new IAction() {
            public void perform() {
                MarvelPickScr.this.back();
            }
        });
        this.left = null;
    }

    private int rows() {
        return this.heroes == null ? 1 : this.heroes.size() + 1;
    }

    private void back() {
        CCanvas.curScr = null;
        lastSCreen.show();
    }

    private void confirm() {
        if (this.heroes == null || this.selected <= 0 || this.selected > this.heroes.size()) {
            MarvelRoster.selectedId = null;
        } else {
            MarvelRoster.selectedId = this.heroes.get(this.selected - 1).id;
        }
        BrowserPlatform.trace("Marvel hero selected: " + MarvelRoster.selectedId);
        GameScr.trainingMode = true;
        MenuScr.isTraining = true;
        GameService.gI().trainingMap();
        CCanvas.startOKDlg(Language.pleaseWait());
    }

    private void moveSel(int delta) {
        this.selected += delta;
        if (this.selected < 0) {
            this.selected = 0;
        }
        if (this.selected > this.rows() - 1) {
            this.selected = this.rows() - 1;
        }
        int visH = CCanvas.hieght - LIST_TOP - 70;
        int top = this.selected * ROW_H;
        if (top < this.cmtoY) {
            this.cmtoY = top;
        }
        if (top + ROW_H > this.cmtoY + visH) {
            this.cmtoY = top + ROW_H - visH;
        }
        if (this.cmtoY > this.cmyLim) {
            this.cmtoY = this.cmyLim;
        }
        if (this.cmtoY < 0) {
            this.cmtoY = 0;
        }
    }

    public void update() {
        if (this.cmy != this.cmtoY) {
            int v = (this.cmtoY - this.cmy) >> 2;
            if (v == 0) {
                v = this.cmtoY > this.cmy ? 1 : -1;
            }
            this.cmy += v;
        }
        if (Gdx.input.isKeyJustPressed(Input.Keys.UP)) {
            this.moveSel(-1);
        }
        if (Gdx.input.isKeyJustPressed(Input.Keys.DOWN)) {
            this.moveSel(1);
        }
        if (Gdx.input.isKeyJustPressed(Input.Keys.ENTER)) {
            this.confirm();
        }
        if (Gdx.input.isKeyJustPressed(Input.Keys.ESCAPE)) {
            this.back();
        }
    }

    public void paint(mGraphics g) {
        paintDefaultBg(g);
        g.setColor(6606845);
        g.fillRect(0, 0, CCanvas.width, 25 + ITEM_HEIGHT, false);
        g.setColor(1407674);
        g.fillRect(0, 25, CCanvas.width, ITEM_HEIGHT, false);
        Font.bigFont.drawString(g, "CHON HERO MARVEL", CCanvas.width / 2, 3, mGraphics.HCENTER | mGraphics.TOP);
        Font.normalYFont.drawString(g, "Chon hero de luyen tap, hoac nhan vat goc", 10, 28, 0);
        int listW = CCanvas.width - 210;
        if (listW < 200) {
            listW = CCanvas.width;
        }
        g.translate(0, LIST_TOP);
        g.translate(0, -this.cmy);
        for (int i = 0; i < this.rows(); ++i) {
            int y = i * ROW_H;
            if (i == this.selected) {
                g.setColor(16767817);
                g.fillRect(0, y, listW, ROW_H - 2, true);
            }
            String label;
            String sub;
            if (i == 0) {
                label = "Nhan vat goc";
                sub = "Nhan vat Army 2 mac dinh";
            } else {
                MarvelRoster.Hero hero = this.heroes.get(i - 1);
                label = hero.name;
                sub = "HP " + hero.hp + "  ATK " + hero.attack + (hero.canFly ? "  Bay duoc" : "");
            }
            Font.borderFont.drawString(g, label, 14, y + 3, 0);
            Font.normalFont.drawString(g, sub, 14, y + 18, 0);
        }
        g.translate(0, -g.getTranslateY());
        if (this.heroes != null && this.selected > 0 && this.selected <= this.heroes.size()) {
            MarvelRoster.Hero hero = this.heroes.get(this.selected - 1);
            int px = CCanvas.width - 196;
            int py = 64;
            g.setColor(0, 0.4F);
            g.fillRect(px - 4, py - 4, 104, 158, false);
            g.setColor(16777215);
            mImage img = MarvelRoster.sheet(hero.id, false);
            if (img != null) {
                g.drawRegion(img, 11 * 96, 0, 96, 96, 0, px, py, 0, false);
            }
            Font.borderFont.drawString(g, hero.name, px + 48, py + 100, 2);
            Font.normalFont.drawString(g, "HP " + hero.hp + "  ATK " + hero.attack, px + 48, py + 117, 2);
            String skillName = hero.siteSkillName != null && hero.siteSkillName.length() > 0 ? hero.siteSkillName : hero.specialSkillName;
            if (skillName != null && skillName.length() > 0) {
                String[] parts = Font.normalFont.splitFontBStrInLine(skillName, 180);
                if (parts != null && parts.length > 0) {
                    Font.normalFont.drawString(g, parts[0], px + 48, py + 132, 2);
                }
            }
        }
        super.paint(g);
    }

    public void onPointerDragged(int xDrag, int yDrag, int index) {
        super.onPointerDragged(xDrag, yDrag, index);
        if (!this.trans) {
            this.pa = this.cmy;
            this.trans = true;
        }
        this.cmtoY = this.pa + (CCanvas.pyFirst[index] - yDrag);
        if (this.cmtoY < 0) {
            this.cmtoY = 0;
        }
        if (this.cmtoY > this.cmyLim) {
            this.cmtoY = this.cmyLim;
        }
    }

    public void onPointerReleased(int xReleased, int yReleased, int index) {
        super.onPointerReleased(xReleased, yReleased, index);
        this.trans = false;
        if (yReleased < LIST_TOP || yReleased > CCanvas.hieght - cmdH) {
            return;
        }
        int row = (this.cmtoY + yReleased - LIST_TOP) / ROW_H;
        if (row >= 0 && row < this.rows()) {
            if (row == this.selected && CCanvas.isDoubleClick) {
                this.confirm();
            } else {
                this.selected = row;
            }
        }
    }
}
