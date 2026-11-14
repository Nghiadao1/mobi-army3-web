package mobiarmy.war.Boss.bullet;

import mobiarmy.war.Gun;
import mobiarmy.war.Player;

// Red Hulk: clap shockwave. A flat, fast air blast with a very wide
// damage zone that tears no terrain.
public class HeroShockwaveBullet extends Bullet {

    public HeroShockwaveBullet(Gun gun, int att, int x, int y, int vx, int vy) {
        super(gun, 63, att, x, y, vx, vy, 0, 0, 100);
        this.radius = 65;
    }

    @Override
    public void collision() {
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
