package mobiarmy.war.Boss;

import mobiarmy.Util;
import mobiarmy.war.Boss.bullet.BulletTrajectory;
import mobiarmy.war.Player;

/**
 * Balloon boss (glass 17) for the boss map 36, which the upstream server
 * never implemented: MapData.setBoss() had no case for it, so the room
 * spawned no boss at all and the war ended instantly. Flies like the UFO,
 * repositions above the nearest player, then lobs a bomb at them.
 */
public class Balloon extends Boss {

    public Balloon(int hp, int att, int x, int y) {
        super("Balloon", (byte) 17, hp, att, 0, 0, 0, 46, 42, x, y);
        super.isFly = true;
    }

    @Override
    public void update() {
        super.update();
        //Đến lượt chưa
        if (super.index == super.mapData.getTurn() && System.currentTimeMillis() > super.mapData.timeUntilAction2) {
            //Bắn
            if (!super.isShoot) {
                if (super.trajectory == null) {
                    //Tìm đối thủ gần
                    Player player = super.mapData.getPlayerNear(super.index);
                    if (player != null) {
                        //Bay tới phía trên đối thủ
                        short toX = player.x;
                        short toY = (short) Math.max(10, player.y - Util.nextInt(220, 320));
                        while (true) {
                            if (!super.mapData.isCollisionMap(toX, toY)) {
                                break;
                            }
                            toY--;
                        }
                        super.changeLocationFly(toX, toY);
                        int w = player.width + 30;
                        int h = player.height + 30;
                        this.trajectory = new BulletTrajectory(super.mapData, super.index, 16, super.x, super.y, super.width, super.height, player.x - w / 2, player.y - h, w, h, 60, 10, true, true);
                        this.trajectory.start();
                    } else {
                        super.mapData.isTurn = true;
                    }
                } else if (super.trajectory.complate) {
                    if (super.trajectory.place) {
                        super.mapData.shootBullet(super.index, false, super.trajectory.bulletId, super.x, super.y, super.width, super.height, super.trajectory.ang, super.trajectory.force, super.trajectory.force2, 1, super.att, -1);
                    } else {
                        //Thả bom thẳng xuống nếu không tính được quỹ đạo
                        super.mapData.shootBullet(super.index, false, 34, super.x, super.y, super.width, super.height, 270, 5, 0, 1, super.att, -1);
                    }
                    super.mapData.updateAffect(super.index);
                    super.isShoot = true;
                    super.mapData.isTurn = true;
                }
            }
        }
    }

    @Override
    public void die() {
        super.die();
        super.isCollision = false;
    }

}
