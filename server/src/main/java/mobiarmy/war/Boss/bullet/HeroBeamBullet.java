package mobiarmy.war.Boss.bullet;

import mobiarmy.war.Gun;
import mobiarmy.war.Player;

// Iron Man Mark 50 energy beam, ported from the original design: the
// beam flies ballistically, passes through terrain without exploding,
// and detonates (150% damage, blast radius 52) on the first fighter it
// touches directly.
public class HeroBeamBullet extends Bullet {

    public HeroBeamBullet(Gun gun, int att, int x, int y, int vx, int vy) {
        super(gun, 77, att, x, y, vx, vy, gun.windX * 5 / 100, gun.windY * 5 / 100, 100);
        this.radius = 52;
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
        this.xOld = this.bX;
        this.yOld = this.bY;
        int nx = this.bX + this.vx;
        int ny = this.bY + this.vy;
        int[] hit = this.getCollision(this.bX, this.bY, nx, ny);
        if (hit != null) {
            this.bX = hit[0];
            this.bY = hit[1];
            Player victim = null;
            for (Player p : this.gun.mapData.players) {
                if (p != null && !p.isDie && p.index != this.gun.index
                        && p.isCollision(this.bX, this.bY, 6)
                        && p.countInvisible2 == 0) {
                    victim = p;
                    break;
                }
            }
            if (victim != null) {
                for (Player p : this.gun.mapData.players) {
                    if (p != null && !p.isDie && p.index != this.gun.index
                            && p.isCollision(this.bX, this.bY, this.radius)
                            && p.countInvisible2 == 0) {
                        this.gun.setEff.add(p);
                        p.attBullet(this);
                    }
                }
                this.frames.add(new Frame(this.frame, this.bX, this.bY, this.bX - this.xOld, this.bY - this.yOld));
                this.collect = true;
                return;
            }
            // Terrain: fly through.
            this.bX = nx;
            this.bY = ny;
        } else {
            this.bX = nx;
            this.bY = ny;
        }
        this.lastX = this.bX;
        this.lastY = this.bY;
        applyAirPhysics();
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
