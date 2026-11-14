package mobiarmy.war.Boss.bullet;

import mobiarmy.war.Gun;
import mobiarmy.war.Player;

// Fragmentation grenade from the original design (Winter Soldier's
// Bionic cluster grenade, also Loki's default schedule): the mother
// grenade explodes normally, then scatters `charges` child bombs at
// 34% of its damage, fanned across -125..-55 degrees.
public class HeroClusterBullet extends Bullet {

    private final int charges;

    public HeroClusterBullet(Gun gun, int att, int x, int y, int vx, int vy, int charges) {
        super(gun, 79, att, x, y, vx, vy, gun.windX * 80 / 100, gun.windY * 80 / 100, 100);
        this.charges = charges;
        this.radius = 42;
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
        int childAtt = this.att * 34 / 100;
        for (int i = 0; i < this.charges; i++) {
            double angDeg = this.charges == 1 ? -90 : -125 + i * (70.0 / (this.charges - 1));
            double rad = Math.toRadians(angDeg);
            int cvx = (int) Math.round(Math.cos(rad) * 12);
            int cvy = (int) Math.round(Math.sin(rad) * 12);
            Bullet child = new Bullet(this.gun, 79, childAtt, this.bX, this.bY, cvx, cvy,
                    this.gun.windX * 60 / 100, this.gun.windY * 60 / 100, 100);
            child.radius = 32;
            this.gun.bullets.add(child);
        }
    }
}
