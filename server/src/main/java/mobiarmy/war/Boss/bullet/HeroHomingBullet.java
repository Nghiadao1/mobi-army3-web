package mobiarmy.war.Boss.bullet;

import mobiarmy.war.Gun;
import mobiarmy.war.Player;

// Guided projectiles from the original design:
//  - Hawkeye lock-on arrows (missileMode = false): ballistic for the
//    first 15 frames, then steer straight at the nearest living enemy
//    at a fixed speed and detonate within 24 px of the target.
//  - Iron Man Jericho micro-missiles (missileMode = true): ballistic,
//    but while falling (frames 10-120) they bend toward the nearest
//    living enemy within 260 px.
public class HeroHomingBullet extends Bullet {

    private final boolean missileMode;

    public HeroHomingBullet(Gun gun, int bulletId, int att, int x, int y, int vx, int vy, boolean missileMode) {
        super(gun, bulletId, att, x, y, vx, vy, gun.windX * 30 / 100, gun.windY * 30 / 100, missileMode ? 100 : 0);
        this.missileMode = missileMode;
        this.radius = 36;
    }

    private Player target() {
        Player best = null;
        int bestDist = Integer.MAX_VALUE;
        for (Player p : this.gun.mapData.players) {
            if (p != null && !p.isDie && p.index != this.gun.index && p.countInvisible2 == 0) {
                int dx = p.x - this.bX;
                int dy = (p.y - 14) - this.bY;
                int d = dx * dx + dy * dy;
                if (d < bestDist) {
                    bestDist = d;
                    best = p;
                }
            }
        }
        return best;
    }

    @Override
    public void nextXY() {
        Player t = this.target();
        if (t != null) {
            int dx = t.x - this.bX;
            int dy = (t.y - 14) - this.bY;
            int dist = (int) Math.sqrt((double) (dx * dx + dy * dy));
            if (!this.missileMode) {
                if (this.frame >= 16 && dist <= 24) {
                    this.collision();
                    this.collect = true;
                    this.frames.add(new Frame(this.frame + 1, this.bX, this.bY, 0, 0));
                    return;
                }
                if (this.frame >= 16 && dist > 0) {
                    this.vx = dx * 16 / dist;
                    this.vy = dy * 16 / dist;
                }
            } else if (this.vy > 0 && this.frame >= 10 && this.frame <= 120 && dist <= 260 && dist > 0) {
                this.vx += Integer.signum(dx) * 1;
            }
        }
        super.nextXY();
    }

    @Override
    public void collision() {
        this.gun.mapData.makeHole(this.bX, this.bY, this.bulletId);
        for (Player player : this.gun.mapData.players) {
            if (player != null && !player.isDie
                    && player.isCollision(this.bX, this.bY, this.radius)
                    && player.countInvisible2 == 0) {
                this.gun.setEff.add(player);
                player.attBullet(this);
            }
        }
    }
}
