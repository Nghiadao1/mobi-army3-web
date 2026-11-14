package mobiarmy.war.Boss.bullet;

import java.util.HashMap;
import mobiarmy.war.Gun;
import mobiarmy.war.Player;

// Captain America: vibranium shield throw, ported from the original
// design (backup branch heroWeapons/BattleEngine): the shield EXPLODES
// at every contact while it still has bounces, and each new flight leg
// deals base x (1 + bounces x 10%) damage. Normal shield: base 85% of
// attack, 2 bounces. Giant POW shield: base 148%, 3 bounces. When the
// bounces run out it flies back to the thrower (no damage on return).
public class HeroShieldBullet extends Bullet {

    private final int baseAtt;
    private final int blastRadius;
    private int bouncesLeft;
    private int bounceCount;
    private boolean returning;
    private final HashMap<Integer, Integer> lastHitFrame = new HashMap<>();

    public HeroShieldBullet(Gun gun, int att, int x, int y, int vx, int vy, boolean pow) {
        super(gun, pow ? 81 : 60, att, x, y, vx, vy, gun.windX * 50 / 100, gun.windY * 50 / 100, 25);
        this.baseAtt = att;
        this.blastRadius = pow ? 58 : 34;
        this.radius = this.blastRadius;
        this.bouncesLeft = pow ? 3 : 1;
        this.bounceCount = 0;
        this.returning = false;
    }

    private void blast() {
        for (Player p : this.gun.mapData.players) {
            if (p != null && !p.isDie && p.index != this.gun.index
                    && p.isCollision(this.bX, this.bY, this.blastRadius)
                    && p.countInvisible2 == 0) {
                this.gun.setEff.add(p);
                p.attBullet(this);
            }
        }
    }

    @Override
    public void nextXY() {
        this.frame++;
        this.frames.add(new Frame(this.frame, this.bX, this.bY, this.bX - this.xOld, this.bY - this.yOld));
        if (this.bX < -100 || this.bX > this.gun.mapData.width + 100
                || this.bY > this.gun.mapData.height + 100 || this.frame > 500
                || (this.returning && this.frame > 400)) {
            this.collect = true;
            return;
        }
        Player shooter = this.gun.index >= 0 && this.gun.index < this.gun.mapData.players.length
                ? this.gun.mapData.players[this.gun.index] : null;
        if (this.returning && shooter != null) {
            int dx = shooter.x - this.bX;
            int dy = (shooter.y - 12) - this.bY;
            int dist = (int) Math.sqrt((double) (dx * dx + dy * dy));
            if (dist < 18) {
                this.collect = true;
                return;
            }
            this.vx = dx * 15 / Math.max(1, dist);
            this.vy = dy * 15 / Math.max(1, dist);
        }
        this.xOld = this.bX;
        this.yOld = this.bY;
        int nx = this.bX + this.vx;
        int ny = this.bY + this.vy;
        int[] hit = this.getCollision(this.bX, this.bY, nx, ny);
        if (hit == null) {
            this.bX = nx;
            this.bY = ny;
            this.lastX = this.bX;
            this.lastY = this.bY;
            if (!this.returning) {
                applyAirPhysics();
            }
            return;
        }
        this.bX = hit[0];
        this.bY = hit[1];
        this.frames.add(new Frame(this.frame, this.bX, this.bY, this.bX - this.xOld, this.bY - this.yOld));
        this.lastX = this.bX;
        this.lastY = this.bY;
        if (this.returning) {
            this.collect = true;
            return;
        }
        Player victim = null;
        for (Player p : this.gun.mapData.players) {
            if (p != null && !p.isDie && p.index != this.gun.index
                    && p.isCollision(this.bX, this.bY, this.radius)
                    && p.countInvisible2 == 0) {
                Integer last = this.lastHitFrame.get((int) p.index);
                if (last == null || this.frame - last >= 16) {
                    victim = p;
                    break;
                }
            }
        }
        if (victim != null) {
            this.lastHitFrame.put((int) victim.index, this.frame);
            blast();
            if (this.bouncesLeft <= 0) {
                this.returning = true;
            } else {
                this.bouncesLeft--;
                this.bounceCount++;
                int dir = this.bX >= victim.x ? 1 : -1;
                this.bX = victim.x + dir * 18;
                this.bY = victim.y - 30;
                this.vx = dir * Math.max(5, Math.abs(this.vx) * 82 / 100);
                this.vy = -Math.max(6, Math.abs(this.vy) * 88 / 100);
            }
            return;
        }
        if (this.gun.mapData.isCollisionMap(this.bX, this.bY)) {
            blast();
            if (this.bouncesLeft <= 0) {
                this.returning = true;
            } else {
                this.bouncesLeft--;
                this.bounceCount++;
                this.vx = this.vx * 84 / 100;
                this.vy = -Math.max(6, Math.abs(this.vy) * 78 / 100);
                this.bY -= 7;
            }
            return;
        }
        // The only obstacle was the thrower: pass through.
        this.bX = nx;
        this.bY = ny;
        this.lastX = this.bX;
        this.lastY = this.bY;
    }

    private void applyAirPhysics() {
        this.vxTemp += Math.abs(this.ax100);
        this.vyTemp += Math.abs(this.ay100);
        this.vyTemp2 += this.g100;
        if (Math.abs(this.vxTemp) >= 100) {
            if (this.ax100 > 0) {
                this.vx += this.vxTemp / 100;
            } else {
                this.vx -= this.vxTemp / 100;
            }
            this.vxTemp %= 100;
        }
        if (Math.abs(this.vyTemp) >= 100) {
            if (this.ay100 > 0) {
                this.vy += this.vyTemp / 100;
            } else {
                this.vy -= this.vyTemp / 100;
            }
            this.vyTemp %= 100;
        }
        if (Math.abs(this.vyTemp2) >= 100) {
            this.vy += this.vyTemp2 / 100;
            this.vyTemp2 %= 100;
        }
        if (this.vy > 0 && !this.isMaxY) {
            this.isMaxY = true;
            this.maxYX = this.bX;
            this.maxY = this.bY;
        }
    }
}
