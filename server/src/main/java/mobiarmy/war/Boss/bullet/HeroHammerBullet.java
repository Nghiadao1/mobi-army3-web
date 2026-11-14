package mobiarmy.war.Boss.bullet;

import mobiarmy.war.Gun;
import mobiarmy.war.Player;

// Thor's hammer. On a POW shot (3 hammers), each hammer's impact also
// calls one real lightning column straight down at the impact point,
// dealing ~72% of Thor's attack (the column damage from the original
// design). Cadence skill hammers (150%) carry their damage in the
// hammer itself; their lightning is visual only in the original code,
// so nothing spawns for them.
public class HeroHammerBullet extends Bullet {

    public HeroHammerBullet(Gun gun, int att, int x, int y, int vx, int vy) {
        super(gun, 64, att, x, y, vx, vy, gun.windX * 45 / 100, gun.windY * 45 / 100, 100);
        this.radius = 48;
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
