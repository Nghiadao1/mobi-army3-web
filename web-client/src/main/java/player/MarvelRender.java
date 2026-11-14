package player;

import CLib.mGraphics;
import CLib.mImage;
import army2.web.MarvelRoster;
import coreLG.CCanvas;
import screen.GameScr;

/**
 * Draws the local player with a Marvel spritesheet instead of the stock
 * part/pose body. Active only in training battles (GameScr.trainingMode)
 * when a hero is picked in the Marvel picker; every other case falls back
 * to the stock renderer. Pose indices mirror the legacy TS
 * CharacterRenderer (extensions/marvel/original): idle 0-1, walk 2-6,
 * jump 7-10, aim 11-17 by elevation, hurt 18-22, shoot = aim + 12 (23-29).
 * Battle rendering uses the ~80% sheets (77px cells, feet at (38.5, 56)).
 */
public final class MarvelRender {
    private static final int[] IDLE_SEQ = {0, 1, 1, 0};
    private static final int[] WALK_SEQ = {2, 3, 4, 5, 6};
    private static final int[] HURT_SEQ = {18, 19, 20, 21, 22, 21, 20, 19};

    private MarvelRender() {
    }

    public static boolean paintPlayer(mGraphics g, CPlayer p, int look) {
        try {
            if (!GameScr.trainingMode || p.index != GameScr.myIndex || MarvelRoster.selectedId == null) {
                return false;
            }
            mImage sheet = MarvelRoster.sheet(MarvelRoster.selectedId, true);
            if (sheet == null) {
                return false;
            }
            int pose = poseFor(p, look);
            int flip = look == 0 ? 2 : 0;
            g.drawRegion(sheet, pose * 77, 0, 77, 77, flip, p.x, p.y + 21, 33, false);
            return true;
        } catch (Throwable t) {
            return false;
        }
    }

    private static int elevation(CPlayer p, int look) {
        int ang = p.angle;
        if (look == 0) {
            ang = 180 - ang;
        }
        if (ang > 180) {
            ang -= 360;
        }
        if (ang < -180) {
            ang += 360;
        }
        return ang;
    }

    private static int aimPose(int elev, boolean shooting) {
        int base;
        if (elev < -26) {
            base = 17;
        } else if (elev < -8) {
            base = 16;
        } else if (elev < 14) {
            base = 11;
        } else if (elev < 32) {
            base = 12;
        } else if (elev < 52) {
            base = 13;
        } else if (elev < 72) {
            base = 14;
        } else {
            base = 15;
        }
        return shooting ? base + 12 : base;
    }

    private static int poseFor(CPlayer p, int look) {
        int tick = CCanvas.gameTick;
        if (p.state == 5) {
            return 22;
        }
        if (p.state == 8) {
            return HURT_SEQ[(tick / 3) % HURT_SEQ.length];
        }
        if (p.falling) {
            return 9;
        }
        if (p.state == 1) {
            return WALK_SEQ[(tick / 4) % WALK_SEQ.length];
        }
        if (p.state == 4) {
            return aimPose(elevation(p, look), true);
        }
        if (p.state == 0) {
            return IDLE_SEQ[(tick / 8) % IDLE_SEQ.length];
        }
        return aimPose(elevation(p, look), false);
    }
}
