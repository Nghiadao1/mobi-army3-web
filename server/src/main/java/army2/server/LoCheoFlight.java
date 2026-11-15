package army2.server;

import mobiarmy.war.Boss.bullet.Bullet;
import mobiarmy.war.Gun;

/**
 * LoCheo3 flight model for hero shots, cloned from the fan server's
 * LoQuanLyChien.taoDuongDan: the trajectory is a plain parabola sampled
 * in at most 36 steps - speed = max(8, force) * 0.85 px/step, gravity
 * adds 0.33 * i^2 px of drop at step i (a constant 0.66/step^2
 * acceleration, g100 = 66 in this engine's units), and there is no
 * wind. A bullet still airborne at step 36 detonates where it stops,
 * the way a LoCheo path end counts as the impact point. Sky-fall
 * specials keep the stock engine: lightning (84) and airstrike (80)
 * are exempt.
 */
public final class LoCheoFlight {

    public static final int MAX_STEPS = 36;

    private LoCheoFlight() {
    }

    /**
     * Bullet types whose flight is a plain ballistic arc, so the global
     * Gun.fillXY hook routes them through the LoCheo model. Exotic item
     * rounds keep their own motion: B52 (4), teleports (5, 36), silk
     * (8, 56), tornado (13), lasers (14, 40, 42), Apache (17), Chicky
     * (19), Tarzan (21), mouse bomb (22), meteor (23), bullet rain (28),
     * earth holes (30, 52), muzzle booms (31, 32), add-boom (34),
     * bicycle (35), big rocket (37), mirror (49), suicide (50), UFO
     * (53), time bomb (57), plus the sky-fall hero specials (80, 84).
     */
    public static boolean isBallistic(int bulletId) {
        switch (bulletId) {
            case 4: case 5: case 8: case 13: case 14: case 17: case 19:
            case 21: case 22: case 23: case 28: case 30: case 31: case 32:
            case 34: case 35: case 36: case 37: case 40: case 42: case 49:
            case 50: case 52: case 53: case 56: case 57: case 80: case 84:
                return false;
            default:
                return true;
        }
    }

    /** Re-aim every bullet of a freshly fired hero gun at LoCheo physics. */
    public static void apply(Gun gun) {
        if (gun.bulletId == 80 || gun.bulletId == 84) {
            return;
        }
        double rad = Math.toRadians(gun.ang);
        double speed = Math.max(8, gun.force) * 0.85D;
        int vx = (int) Math.round(Math.cos(rad) * speed);
        int vy = (int) Math.round(-Math.sin(rad) * speed);
        for (Bullet b : gun.bullets) {
            b.vx = vx;
            b.vy = vy;
            b.ax100 = 0;
            b.ay100 = 0;
            b.g100 = 66;
            b.vxTemp = 0;
            b.vyTemp = 0;
            b.vyTemp2 = 0;
        }
    }

    /** Gun.fillXY with the LoCheo 36-step flight cap on top. */
    public static void fillXY(Gun gun) {
        if (gun.bulletId == 80 || gun.bulletId == 84) {
            gun.fillXY();
            return;
        }
        boolean hasNext;
        do {
            hasNext = false;
            Bullet[] bs = gun.bullets.toArray(new Bullet[0]);
            for (Bullet bullet : bs) {
                if (bullet.collect) {
                    continue;
                }
                hasNext = true;
                bullet.nextXY();
                if (!bullet.collect && bullet.frame >= MAX_STEPS) {
                    bullet.collect = true;
                    if (bullet.isCanCollision) {
                        bullet.collision();
                    }
                }
            }
        } while (hasNext);
    }
}
