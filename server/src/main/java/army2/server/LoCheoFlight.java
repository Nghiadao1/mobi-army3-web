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
