package mobiarmy.war.Boss.bullet;

import mobiarmy.war.Gun;
import mobiarmy.war.Player;

// Thor / Thor Stormbreaker cadence skill (spec v3 Phase C): lightning
// bolts called down from the sky around the hammer's landing point.
// Spawned high above the target with a downward velocity, immune to
// wind; each bolt blasts at the attack value it was given (150%).
public class HeroLightningBullet extends Bullet {

    public HeroLightningBullet(Gun gun, int att, int x, int y, int vx, int vy) {
        super(gun, 84, att, x, y, vx, vy, 0, 0, 100);
        this.radius = 34;
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
