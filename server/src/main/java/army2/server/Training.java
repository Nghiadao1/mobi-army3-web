package army2.server;

import java.util.concurrent.ConcurrentHashMap;
import mobiarmy.io.Message;
import mobiarmy.server.Map;
import mobiarmy.server.Session;
import mobiarmy.war.Boss.bullet.Bullet;
import mobiarmy.war.Gun;
import mobiarmy.war.MapData;
import mobiarmy.war.Player;

// Training (practice) mode for the original Army 2 web port.
// The stock server never implemented the practice requests:
//   command -6 (trainingMap): reply -6 with the practice map id.
//   command 83 type 0 (map loaded): reply command 20 in the training layout
//     (5 equip shorts, map id, turn seconds, team, spawn slots) and open a
//     server-side physics arena for the practice battle.
//   command 83 type 1 (leave): drop the arena, reply command 83 so the
//     client exits to the menu.
//   command 84 (fire): the client sends its shot and waits for the server
//     to answer with the trajectory (Message 22, same format as a real
//     battle). The trajectory is computed with the real war engine (Gun)
//     on a private MapData holding the shooter and the target dummy, so
//     terrain destruction stays consistent across shots in one session.
public final class Training {

    private Training() {
    }

    private static byte mapId = -1;

    // One fixed practice map: the first server map with at least two spawn
    // points. Deterministic, so the -6 reply and the command 20 start
    // message always name the same map.
    private static byte trainingMapId() {
        if (mapId != -1) {
            return mapId;
        }
        if (Map.entrys != null) {
            for (Map entry : Map.entrys) {
                if (entry != null && entry.data != null && entry.data.points != null
                        && entry.data.points.length >= 2) {
                    mapId = entry.id;
                    return mapId;
                }
            }
        }
        mapId = 0;
        return mapId;
    }

    // Server-side practice battlefield for one user.
    private static final class Arena {
        MapData mapData;
        Player shooter;
        Player dummy;
        final java.util.Map<Integer, Integer> shotCounts = new java.util.HashMap<>();
        boolean marked;
    }

    private static final ConcurrentHashMap<Integer, Arena> ARENAS = new ConcurrentHashMap<>();

    // Command -6: hand the client its practice map.
    public static void trainingMap(Session session) {
        try {
            Message res = new Message(-6);
            res.writer().writeByte(trainingMapId());
            session.sendMessage(res);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // Command 83: type 0 starts the practice battle, anything else leaves.
    public static void training(Session session, Message msg) {
        try {
            byte type = msg.reader().readByte();
            if (type != 0 || session.user == null) {
                if (session.user != null) {
                    ARENAS.remove(session.user.id);
                }
                session.sendMessage(new Message(83));
                return;
            }
            byte map = trainingMapId();
            Map entry = Map.get(map);
            Message res = new Message(20);
            short[] equip = session.user.glass().equipID;
            for (int i = 0; i < 5; i++) {
                res.writer().writeShort(equip != null && i < equip.length ? equip[i] : -1);
            }
            res.writer().writeByte(map);
            res.writer().writeByte(25); // seconds per turn (MapData default)
            res.writer().writeShort(0); // team bits (unused by the client here)
            int hp = session.user.glass().createAbility()[0];
            Map.Point[] points = entry != null && entry.data != null ? entry.data.points : null;
            for (int slot = 0; slot < 8; slot++) {
                if (points != null && points.length >= 2 && slot == 0) {
                    res.writer().writeShort(points[0].x);
                    res.writer().writeShort(points[0].y);
                    res.writer().writeShort(hp);
                } else if (points != null && points.length >= 2 && slot == 1) {
                    res.writer().writeShort(points[points.length - 1].x);
                    res.writer().writeShort(points[points.length - 1].y);
                    res.writer().writeShort(hp);
                } else {
                    res.writer().writeShort(-1);
                }
            }
            session.sendMessage(res);
            openArena(session, map, points);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // Build the physics arena matching the start message: the shooter on
    // the first spawn point, the target dummy on the last one. Both war
    // players have no User attached, so engine side effects (HP updates,
    // luck, exp) never leak messages into the practice session; only the
    // trajectory reply is sent, by fire().
    private static void openArena(Session session, byte map, Map.Point[] points) {
        try {
            if (points == null || points.length < 2) {
                return;
            }
            MapData mapData = new MapData(null, map);
            int[] ability = session.user.glass().createAbility();
            Player shooter = new Player(mapData, null, session.user.name,
                    session.user.glass().id, session.user.glass().level,
                    ability[0], ability[1], ability[2], ability[3], ability[4],
                    24, 24, null);
            shooter.index = 0;
            shooter.team = 0;
            shooter.x = points[0].x;
            shooter.y = points[0].y;
            Player dummy = new Player(mapData, null, "ENEMY", 0, 1,
                    ability[0], 0, 0, 0, 0, 24, 24, null);
            dummy.index = 1;
            dummy.team = 1;
            dummy.x = points[points.length - 1].x;
            dummy.y = points[points.length - 1].y;
            mapData.players[0] = shooter;
            mapData.players[1] = dummy;
            mapData.nPlayer = 2;
            Arena arena = new Arena();
            arena.mapData = mapData;
            arena.shooter = shooter;
            arena.dummy = dummy;
            ARENAS.put(session.user.id, arena);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // Command 84: a practice shot. Compute the trajectory with the war
    // engine and answer exactly like a real battle shot (SessionHandler
    // .shoot writes Message 22 with the gun's bullet frames).
    public static void fire(Session session, Message msg) {
        try {
            byte bulletId = msg.reader().readByte();
            short x = msg.reader().readShort();
            short y = msg.reader().readShort();
            short ang = msg.reader().readShort();
            byte force = msg.reader().readByte();
            byte force2 = 0;
            if (bulletId == 17 || bulletId == 19) {
                force2 = msg.reader().readByte();
            }
            msg.reader().readByte(); // nshoot (a practice shot is always one)
            if (session.user == null) {
                return;
            }
            Arena arena = ARENAS.get(session.user.id);
            if (arena == null) {
                return;
            }
            if (force > 30) {
                force = 30;
            }
            if (force < 1) {
                force = 1;
            }
            if (force2 > 30) {
                force2 = 30;
            }
            if (force2 < 0) {
                force2 = 0;
            }
            Player shooter = arena.shooter;
            shooter.x = x;
            shooter.y = y;
            // Marvel heroes (P4): the client appends the hero's attack
            // value after nshoot when a hero is picked. Hero bullet types
            // (60-75) are translated here into engine shots: signature
            // behaviors live in Gun cases / Hero* bullet classes, cadence
            // skills ("after N normal shots") and on-hit effects (mark,
            // freeze chance, lifesteal) are resolved against the arena.
            int heroAtt = 0;
            try {
                heroAtt = msg.reader().readShort();
            } catch (Exception ignored) {
                heroAtt = 0;
            }
            int effAtt = heroAtt > 0 ? heroAtt : shooter.att;
            int effBullet = bulletId;
            boolean pow = false;
            int effNshoot = 1;
            int heroShots = arena.shotCounts.merge((int) bulletId, 1, Integer::sum);
            switch (bulletId) {
                case 60, 61 -> pow = force >= 25;
                case 62 -> { // Iron Man Mark 50: every 3rd shot is the 150% energy beam
                    if (heroShots % 3 == 0) {
                        effBullet = 14;
                        effAtt = effAtt * 3 / 2;
                    } else {
                        effBullet = 0;
                    }
                }
                case 63 -> effBullet = heroShots % 3 == 0 ? 63 : 0; // Red Hulk: clap on the 3rd
                case 64, 65 -> pow = heroShots % 3 == 0; // Thor: lightning on the 3rd
                case 66 -> { // Loki: full-force shot becomes the frost blast
                    if (force >= 25) {
                        effBullet = 54;
                    }
                }
                case 67 -> { // Doctor Strange: green discs bite harder; full force = mirror blast
                    if (force >= 25) {
                        effBullet = 16;
                        effAtt = effAtt * 3 / 2;
                    } else if (heroShots % 2 == 0) {
                        effAtt = effAtt * 6 / 5;
                    }
                }
                case 69 -> { // Winter Soldier: piercing round (stock 25 adds x1.5; normalize)
                    effBullet = 25;
                    effAtt = effAtt * 2 / 3;
                }
                case 70 -> { // Winter Soldier (Winter): piercing + mark
                    effBullet = 25;
                    effAtt = effAtt * 2 / 3;
                    if (arena.marked) {
                        effAtt = effAtt * 6 / 5;
                    }
                }
                case 71 -> { // Hawkeye: every 4th shot is the lock-on volley
                    if (heroShots % 4 == 0) {
                        effBullet = 72;
                    }
                }
                case 73 -> { // Hawkeye Tech: every 3rd shot calls the air strike
                    if (heroShots % 3 == 0) {
                        effBullet = 28;
                        effAtt = effAtt * 2;
                    } else {
                        effBullet = 0;
                    }
                }
                case 74 -> { // Ultron: full-force shot splits into a volley
                    if (force >= 25) {
                        effNshoot = 3;
                    }
                }
                default -> {
                }
            }
            final int dummyHpBefore = arena.dummy.hp;
            Gun gun = new Gun(arena.mapData, 0, pow);
            gun.shootBullet(effBullet, x, y, shooter.width, shooter.height,
                    ang, force, force2, effNshoot, effAtt, -1);
            gun.fillXY();
            session.sessionHandler.shoot(gun);
            int dummyHpAfter = arena.dummy.hp;
            if (dummyHpAfter < dummyHpBefore) {
                if (bulletId == 66
                        && java.util.concurrent.ThreadLocalRandom.current().nextInt(100) < 20) {
                    arena.dummy.nextFreeze = true;
                    arena.dummy.countFreeze = 1;
                }
                if (bulletId == 70) {
                    arena.marked = true;
                }
                if (bulletId == 75) { // Ultron Prime: lifesteal
                    int heal = (dummyHpBefore - dummyHpAfter) * 15 / 100;
                    shooter.hp = Math.min(shooter.hpMax, shooter.hp + heal);
                }
            }
            // The client ends the shot when the server hands the turn back
            // (command 24), like a real battle: after the bullet has flown
            // (the war engine budgets 50 ms per trajectory frame), report
            // the dummy's new HP if it changed and return the turn to the
            // shooter. Without this the practice battle soft-locks with
            // no HUD and no way to move.
            int frames = 0;
            for (Bullet b : gun.bullets) {
                frames = Math.max(frames, b.frames.size());
            }
            final Arena current = arena;
            final int dummyHp = arena.dummy.hp;
            final int dummyPixel = arena.dummy.pixel;
            final long delayMs = frames * 50L + 250L;
            Thread finisher = new Thread(() -> {
                try {
                    Thread.sleep(delayMs);
                } catch (InterruptedException ie) {
                    return;
                }
                if (session.user == null || ARENAS.get(session.user.id) != current) {
                    return;
                }
                if (dummyHp != dummyHpBefore) {
                    session.sessionHandler.updateHP(1, dummyHp, dummyPixel);
                }
                session.sessionHandler.setTurn(0);
            });
            finisher.setDaemon(true);
            finisher.start();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
