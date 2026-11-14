package mobiarmy.war.Boss;

import mobiarmy.Util;
import mobiarmy.war.Boss.bullet.BulletTrajectory;
import mobiarmy.war.Player;

/**
 * Ghost boss (glass 25 on map 38, glass 26 on map 39), which the upstream
 * server never implemented: MapData.setBoss() had no case for those maps,
 * so the rooms spawned no boss at all and the war ended instantly.
 * Teleports through the air next to the nearest player, then shoots.
 */
public class Ghost extends Boss {

    public Ghost(int hp, int att, int x, int y, byte glassID) {
        super("Ghost", glassID, hp, att, 0, 0, 0, 30, 40, x, y);
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
                        //Dịch chuyển tới gần đối thủ
                        short toX = (short) (player.x + (Util.nextInt(100) < 50 ? -1 : 1) * Util.nextInt(120, 220));
                        short toY = (short) Math.max(10, player.y - Util.nextInt(120, 220));
                        if (toX < 10) {
                            toX = 10;
                        }
                        if (toX > super.mapData.width - 10) {
                            toX = (short) (super.mapData.width - 10);
                        }
                        while (true) {
                            if (!super.mapData.isCollisionMap(toX, toY)) {
                                break;
                            }
                            toY--;
                        }
                        super.changeLocationFly(toX, toY);
                        int arrBulletId[] = new int[]{26, 10, 33};
                        int bID = arrBulletId[Util.nextInt(arrBulletId.length)];
                        int w = player.width + 20;
                        int h = player.height + 20;
                        this.trajectory = new BulletTrajectory(super.mapData, super.index, bID, super.x, super.y, super.width, super.height, player.x - w / 2, player.y - h, w, h, 60, 10, true, true);
                        this.trajectory.start();
                    } else {
                        super.mapData.isTurn = true;
                    }
                } else if (super.trajectory.complate) {
                    if (super.trajectory.place) {
                        super.mapData.shootBullet(super.index, false, super.trajectory.bulletId, super.x, super.y, super.width, super.height, super.trajectory.ang, super.trajectory.force, super.trajectory.force2, 1, super.att, -1);
                    } else {
                        super.mapData.shootBullet(super.index, false, 42, super.x, super.y, super.width, super.height, 270, 10, 0, 1, super.att, -1);
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
