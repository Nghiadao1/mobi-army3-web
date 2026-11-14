package mobiarmy.war.Boss.bullet;

import mobiarmy.war.Gun;

// Thor / Thor Stormbreaker: the thrown weapon itself is an ordinary
// heavy projectile, but on a skill shot its impact calls lightning
// columns down around the impact point (each column is a fast falling
// bullet of its own, dealing the skill damage on impact).
public class HeroStormCarrierBullet extends Bullet {

    private final int lightningCount;
    private boolean spawned;

    public HeroStormCarrierBullet(Gun gun, int bulletId, int att, int x, int y, int vx, int vy, int lightningCount) {
        super(gun, bulletId, att, x, y, vx, vy, gun.windX * 80 / 100, gun.windY * 80 / 100, 100);
        this.lightningCount = lightningCount;
        this.spawned = false;
    }

    @Override
    public void nextXY() {
        super.nextXY();
        if (this.collect && !this.spawned) {
            this.spawned = true;
            boolean impacted = this.gun.mapData.isCollisionMap(this.bX, this.bY)
                    || this.gun.mapData.isCollisionPlayer(this.bX, this.bY);
            if (!impacted) {
                return;
            }
            int boltAtt = this.att * 3 / 2;
            for (int i = 0; i < this.lightningCount; i++) {
                int lx = this.bX + (i - (this.lightningCount - 1) / 2) * 36;
                Bullet bolt = new Bullet(this.gun, this.bulletId, boltAtt, lx, -10, 0, 26, 0, 0, 150);
                this.gun.bullets.add(bolt);
            }
        }
    }
}
