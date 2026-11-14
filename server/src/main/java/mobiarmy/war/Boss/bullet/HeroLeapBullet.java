package mobiarmy.war.Boss.bullet;

import mobiarmy.war.Gun;
import mobiarmy.war.Player;

// Hulk / Red Hulk normal shot: the leap itself is the attack, ported
// from the original design: damage grows with the height of the jump:
// heightBonus = min(1.4, max(0.05, peakHeight / 155)) multiplies the
// damage by (1 + bonus) (up to +140%) and widens the blast by up to
// +25. Landing where a fighter stands deals damage without cratering
// the terrain; landing on bare ground craters as usual.
public class HeroLeapBullet extends Bullet {

    private final int startY;

    public HeroLeapBullet(Gun gun, int att, int x, int y, int vx, int vy, boolean pow) {
        super(gun, 68, att, x, y, vx, vy, 0, 0, 100);
        this.startY = y;
        this.radius = 56;
    }

    @Override
    public void collision() {
        int peak = Math.max(0, this.startY - this.maxY);
        double bonus = Math.min(1.4, Math.max(0.05, peak / 155.0));
        int keepAtt = this.att;
        int keepRadius = this.radius;
        this.att = (int) Math.round(keepAtt * (1.0 + bonus));
        this.radius = 56 + (int) Math.round(bonus * 18);
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
        this.radius = keepRadius;
    }
}
