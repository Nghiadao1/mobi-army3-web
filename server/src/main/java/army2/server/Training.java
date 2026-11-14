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
        boolean strangeShield;
        boolean dummyWeakened;
        int cloneCount;
        boolean primeHealed;
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
            // POW flag (spec v3): the client's POW button arms the shot
            // and the flag trails heroAtt. Absent on stock-gun shots.
            int powFlag = 0;
            try {
                powFlag = msg.reader().readByte();
            } catch (Exception ignored) {
                powFlag = 0;
            }
            int baseAtt = heroAtt > 0 ? heroAtt : shooter.att;
            int effAtt = baseAtt;
            int effBullet = bulletId;
            int effNshoot = 1;
            // POW is an explicit choice now (user rule 2026-11-14):
            // force no longer implies POW, and a POW shot is charged
            // at any force exactly like a normal shot.
            boolean powShot = powFlag == 1 && bulletId >= 60 && bulletId <= 75;
            // The cadence counter increments on every hero shot (POW
            // included); Phase C triggers are resolved further below.
            int heroShots = arena.shotCounts.merge((int) bulletId, 1, Integer::sum);
            // Spec v3 Phase A translations: core shots only. Cadence
            // specials (lightning, beam, lock-on, airstrike...) and the
            // remaining passives arrive in Phase C; flight and the Hulk
            // leap rework in Phase B.
            switch (bulletId) {
                case 60 -> { // Captain: POW = giant shield (wire 81) at 150%
                    if (powShot) {
                        effBullet = 81;
                        effAtt = baseAtt * 3 / 2;
                    }
                }
                case 61, 62 -> // Iron Man / Mark 50: POW = rockets (82), else plasma (61)
                    effBullet = powShot ? 82 : 61;
                case 67 -> // Doctor Strange: discs alternate blue (67) / yellow (83)
                    effBullet = heroShots % 2 == 1 ? 67 : 83;
                case 69, 70 -> { // Winter Soldier: piercing AK round (stock 25 self-scales x1.5)
                    effBullet = 25;
                    effAtt = baseAtt * 2 / 3;
                }
                case 74, 75 -> // Ultron / Ultron Prime: plasma beam
                    effBullet = 77;
                default -> {
                }
            }
            // Cadence specials (spec v3 Phase C, per the official
            // site): after N normal shots the NEXT shot becomes the
            // special. POW shots keep their Phase A behavior and
            // never trigger cadence. Lightning (Thor/Stormbreaker),
            // the Red Hulk back-blast and the Ultron clone are
            // companion shots resolved after the main shot below.
            int cadenceKind = 0; // 1 = lightning, 2 = clap back-blast, 3 = clone
            if (!powShot) {
                switch (bulletId) {
                    case 62 -> { // Mark 50: energy beam at 150%
                        if (heroShots % 3 == 0) {
                            effBullet = 77;
                            effAtt = baseAtt * 3 / 2;
                        }
                    }
                    case 63 -> { // Red Hulk: Xe gio clap at 150%, both ways
                        if (heroShots % 3 == 0) {
                            effAtt = baseAtt * 3 / 2;
                            cadenceKind = 2;
                        }
                    }
                    case 64, 65 -> { // Thor / Stormbreaker: lightning on landing
                        if (heroShots % 3 == 0) {
                            cadenceKind = 1;
                        }
                    }
                    case 67 -> { // Doctor Strange: shield arms after 3 shots
                        if (heroShots % 3 == 0) {
                            arena.strangeShield = true;
                        }
                    }
                    case 71 -> { // Hawkeye: lock-on volley (Gun case 72)
                        if (heroShots % 4 == 0) {
                            effBullet = 72;
                        }
                    }
                    case 73 -> { // Hawkeye Tech: air support (Gun case 80)
                        if (heroShots % 3 == 0) {
                            effBullet = 80;
                        }
                    }
                    case 74, 75 -> { // Ultron / Prime: a clone fires along
                        if (heroShots >= 2) {
                            cadenceKind = 3;
                            arena.cloneCount = Math.min(5, heroShots - 1);
                        }
                    }
                    default -> {
                    }
                }
            }
            if (arena.marked) {
                // A marked target takes +20% damage from every source.
                effAtt = effAtt * 6 / 5;
            }
            final int dummyHpBefore = arena.dummy.hp;
            boolean gunPow = powShot && bulletId == 60;
            Gun gun = new Gun(arena.mapData, 0, gunPow);
            gun.shootBullet(effBullet, x, y, shooter.width, shooter.height,
                    ang, force, force2, effNshoot, effAtt, -1);
            gun.fillXY();
            session.sessionHandler.shoot(gun);
            int dummyHpAfter = arena.dummy.hp;
            if (dummyHpAfter < dummyHpBefore) {
                if (bulletId == 67 && effBullet == 83) {
                    arena.dummyWeakened = true;
                }
                if (bulletId == 66
                        && java.util.concurrent.ThreadLocalRandom.current().nextInt(100) < 20) {
                    arena.dummy.nextFreeze = true;
                    arena.dummy.countFreeze = 1;
                }
                if (bulletId == 70) {
                    arena.marked = true;
                }
            }
            // Hulk leap resolution (spec v3 Phase B): the leap bullet IS
            // Hulk - where it ends, he ends. Off the map, or over a pit
            // with no ground below the landing point, he dies (the water
            // case); otherwise his arena position moves to the landing.
            boolean shooterDied = false;
            if (bulletId == 68 && !gun.bullets.isEmpty()) {
                Bullet leap = gun.bullets.get(0);
                int lx = leap.lastX;
                int ly = leap.lastY;
                if (lx < 0 || lx > arena.mapData.width || ly > arena.mapData.height) {
                    shooter.die();
                    shooterDied = true;
                } else {
                    shooter.x = (short) lx;
                    shooter.y = (short) ly;
                    shooter.chuanHoaXY();
                    if (shooter.y >= arena.mapData.height) {
                        shooter.die();
                        shooterDied = true;
                    }
                }
            }
            // Companion shots for cadence skills: computed now (their
            // damage applies immediately, like the main shot) but only
            // SENT to the client after the main shot's animation has
            // played, so the trajectories never overlap on screen.
            Gun extraGun = null;
            int extraFrames = 0;
            if (cadenceKind == 1 && !gun.bullets.isEmpty()) {
                Bullet main = gun.bullets.get(0);
                extraGun = new Gun(arena.mapData, 0, false);
                extraGun.shootBullet(84, main.lastX, Math.max(40, main.lastY - 320),
                        shooter.width, shooter.height, 270, 8, 0, 1, baseAtt * 3 / 2, -1);
                extraGun.fillXY();
            } else if (cadenceKind == 2) {
                extraGun = new Gun(arena.mapData, 0, false);
                extraGun.shootBullet(63, x, y, shooter.width, shooter.height,
                        (ang + 180) % 360, force, 0, 1, baseAtt * 3 / 2, -1);
                extraGun.fillXY();
            } else if (cadenceKind == 3) {
                extraGun = new Gun(arena.mapData, 0, false);
                extraGun.shootBullet(77, x - 24, y, shooter.width, shooter.height,
                        ang, force, 0, 1, baseAtt * 33 / 100, -1);
                extraGun.fillXY();
            }
            if (extraGun != null) {
                for (Bullet b : extraGun.bullets) {
                    extraFrames = Math.max(extraFrames, b.frames.size());
                }
            }
            final Gun extraGunFin = extraGun;
            final int extraFramesFin = extraFrames;
            // Ultron Prime: below half HP, absorb a clone to heal,
            // once per match (free action). Dormant in training while
            // the dummy cannot hurt the shooter; live for real battles.
            boolean primeHealed = false;
            if (bulletId == 75 && cadenceKind == 3 && !arena.primeHealed
                    && shooter.hp > 0 && shooter.hp < shooter.hpMax / 2) {
                shooter.updateHP(shooter.hpMax * 33 / 100);
                arena.primeHealed = true;
                arena.cloneCount = Math.max(0, arena.cloneCount - 1);
                primeHealed = true;
            }
            final boolean primeHealedFin = primeHealed;
            final int shooterHpFin = shooter.hp;
            final int shooterPixelFin = shooter.pixel;
            final boolean shooterDiedFin = shooterDied;
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
                    if (extraGunFin != null) {
                        if (session.user == null || ARENAS.get(session.user.id) != current) {
                            return;
                        }
                        session.sessionHandler.shoot(extraGunFin);
                        Thread.sleep(extraFramesFin * 50L + 250L);
                    }
                } catch (InterruptedException ie) {
                    return;
                }
                if (session.user == null || ARENAS.get(session.user.id) != current) {
                    return;
                }
                if (shooterDiedFin) {
                    session.sessionHandler.updateHP(0, 0, 0);
                }
                if (primeHealedFin) {
                    session.sessionHandler.updateHP(0, shooterHpFin, shooterPixelFin);
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
