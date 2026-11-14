package mobiarmy.war.Boss.bullet;

import java.util.HashSet;
import mobiarmy.war.Gun;
import mobiarmy.war.Player;

// Captain America: vibranium shield throw. The shield ricochets off
// terrain and enemies (2 bounces, 3 for the giant POW shield), damaging
// each enemy at most once, then flies back to the thrower. It never
// craters terrain.
public class HeroShieldBullet extends Bullet {

    private int bouncesLeft;
    private boolean returning;
    private final HashSet<Integer> hitPlayers = new HashSet<>();

    public HeroShieldBullet(Gun gun, int att, int x, int y, int vx, int vy, boolean pow) {
        super(gun, 60, att, x, y, vx, vy, gun.windX * 30 / 100, gun.windY * 30 / 100, 25);
        this.bouncesLeft = pow ? 3 : 2;
        this.returning = false;
    }

    private void startReturn() {
        this.returning = true;
    }

    @Override
    public void nextXY() {
        this.frame++;
        this.frames.add(new Frame(this.frame, this.bX, this.bY, this.bX - this.xOld, this.bY - this.yOld));
        if (this.bX < -100 || this.bX > this.gun.mapData.width + 100
                || this.bY > this.gun.mapData.height + 100 || this.frame > 500) {
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
            this.vx = dx * 16 / Math.max(1, dist);
            this.vy = dy * 16 / Math.max(1, dist);
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
        Player victim = null;
        for (Player p : this.gun.mapData.players) {
            if (p != null && !p.isDie && p.index != this.gun.index
                    && !this.hitPlayers.contains((int) p.index)
                    && p.isCollision(this.bX, this.bY, this.radius)
                    && p.countInvisible2 == 0) {
                victim = p;
                break;
            }
        }
        if (victim != null) {
            this.hitPlayers.add((int) victim.index);
            this.gun.setEff.add(victim);
            victim.attBullet(this);
            if (this.returning || this.bouncesLeft <= 0) {
                startReturn();
            } else {
                this.bouncesLeft--;
                this.vx = -this.vx;
                this.vy = this.vy / 2;
            }
            return;
        }
        if (this.gun.mapData.isCollisionMap(this.bX, this.bY)) {
            if (this.returning) {
                this.collect = true;
                return;
            }
            if (this.bouncesLeft <= 0) {
                startReturn();
            } else {
                this.bouncesLeft--;
                boolean xHit = this.gun.mapData.isCollisionMap(this.bX, this.yOld);
                boolean yHit = this.gun.mapData.isCollisionMap(this.xOld, this.bY);
                if (xHit && !yHit) {
                    this.vx = -this.vx;
                } else if (yHit && !xHit) {
                    this.vy = -this.vy;
                } else {
                    this.vx = -this.vx;
                    this.vy = -this.vy;
                }
                this.bX += Integer.signum(this.vx) * 2;
                this.bY += Integer.signum(this.vy) * 2;
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
