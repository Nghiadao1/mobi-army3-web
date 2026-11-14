package mobiarmy.war.Boss.bullet;

import mobiarmy.war.Gun;
import mobiarmy.war.Player;

// Hawkeye Tech air support, ported from the original design: the
// marker shell explodes for 200% damage and calls a carpet of 5 bombs
// at x offsets -88/-44/0/+44/+88 around the impact point, dropped
// from the top of the map, each dealing 28% of the marker's damage
// (= 56% of the hero's attack).
public class HeroAirstrikeBullet extends Bullet {

    public HeroAirstrikeBullet(Gun gun, int att, int x, int y, int vx, int vy) {
        super(gun, 80, att, x, y, vx, vy, gun.windX * 20 / 100, gun.windY * 20 / 100, 100);
        this.radius = 62;
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
        int bombAtt = this.att * 28 / 100;
        int width = this.gun.mapData.width;
        for (int i = 0; i < 5; i++) {
            int bx2 = this.bX + (i - 2) * 44;
            if (bx2 < 10) {
                bx2 = 10;
            }
            if (bx2 > width - 10) {
                bx2 = width - 10;
            }
            Bullet bomb = new Bullet(this.gun, 80, bombAtt, bx2, 16, 0, 5 + i, 0, 0, 100);
            bomb.radius = 46;
            this.gun.bullets.add(bomb);
        }
    }
}
