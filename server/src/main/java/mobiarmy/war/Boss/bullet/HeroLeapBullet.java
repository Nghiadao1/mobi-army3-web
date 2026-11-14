package mobiarmy.war.Boss.bullet;

import mobiarmy.war.Gun;
import mobiarmy.war.Player;

// Hulk: the leap itself is the attack. Landing on a fighter deals
// damage that grows with the height of the fall and destroys no
// terrain; landing on bare ground craters it as usual.
public class HeroLeapBullet extends Bullet {

    public HeroLeapBullet(Gun gun, int att, int x, int y, int vx, int vy, boolean pow) {
        super(gun, 68, att, x, y, vx, vy, gun.windX * 50 / 100, gun.windY * 50 / 100, 100);
        this.radius = pow ? 56 : 44;
    }

    @Override
    public void collision() {
        int fall = Math.max(0, this.bY - this.maxY);
        int keepAtt = this.att;
        this.att = keepAtt * (100 + Math.min(100, fall / 3)) / 100;
        boolean hitPlayer = false;
        for (Player player : this.gun.mapData.players) {
            if (player != null && !player.isDie
                    && player.isCollision(this.bX, this.bY, this.radius)) {
                hitPlayer = true;
                break;
            }
        }
        if (!hitPlayer) {
            this.gun.mapData.makeHole(this.bX, this.bY, this.bulletId);
        }
        for (Player player : this.gun.mapData.players) {
            if (player != null && !player.isDie
                    && player.isCollision(this.bX, this.bY, this.radius)
                    && player.countInvisible2 == 0) {
                this.gun.setEff.add(player);
                player.attBullet(this);
            }
        }
        this.att = keepAtt;
    }
}
