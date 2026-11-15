package army2.server;

import java.util.HashMap;
import java.util.Map;
import java.util.WeakHashMap;
import java.util.concurrent.ThreadLocalRandom;
import mobiarmy.war.Gun;
import mobiarmy.war.MapData;
import mobiarmy.war.Player;
import mobiarmy.war.Boss.bullet.Bullet;

/**
 * Marvel heroes in real battles (spec v3, P3). Mirrors the LoCheo3
 * model: the hero is an identity carried by the player (chosen with
 * command -91, stored on the User for the session), the server applies
 * the hero stats when the battle is built, broadcasts the slot -> hero
 * table with command -92, and drives hero shots through the same
 * translation / cadence tables as Training (army2.server.Training).
 * POW in battle comes from the stock angry meter: item 100 sets
 * Player.isPow, and the next hero shot is the POW shot.
 */
public final class HeroBattle {

    // heroes.json order (8 core Avengers from LoCheo3, avenger = 1..8):
    // 0 ironman, 1 hulk, 2 thor, 3 loki, 4 captain, 5 wintersoldier, 6 hawkeye, 7 ultron.
    public static final int[] ATT = {
        350, 450, 400, 400, 250, 350, 508, 300
    };
    public static final int[] HP_PCT = {
        100, 200, 100, 100, 100, 100, 100, 100
    };
    // Client bullet type each hero fires (same ids as Training).
    public static final int[] BULLET = {
        61, 68, 64, 66, 60, 69, 71, 74
    };

    public static final class State {
        public int hero;
        public final HashMap<Integer, Integer> shots = new HashMap<>();
        public boolean shield;       // Doctor Strange: blocks the next hit
        public boolean marked;       // Winter Soldier: takes +20% damage
        public boolean pierce;       // Strange blue disc: ignore 20% def once
        public boolean discWeakened; // Strange yellow disc: next shot -10%
        public int clones;           // Ultron clone count (cap 5)
        public boolean primeHealed;  // Ultron heal used this battle
        public int morph = -1;       // Loki: hero index he renders as
    }

    private static final Map<MapData, Map<Integer, State>> REG = new WeakHashMap<>();

    private HeroBattle() {
    }

    public static State stateFor(MapData mapData, int index) {
        if (mapData == null) {
            return null;
        }
        synchronized (REG) {
            Map<Integer, State> byIndex = REG.get(mapData);
            return byIndex == null ? null : byIndex.get(index);
        }
    }

    public static boolean isCaptain(int hero) {
        return hero == 4;
    }

    /** Applies hero stats + the Captain aura; called from the MapData
     *  constructor after the stock team bonuses, before loadInfoMap. */
    public static void setup(MapData mapData) {
        Map<Integer, State> byIndex = new HashMap<>();
        for (Player player : mapData.players) {
            if (player == null || player.user == null) {
                continue;
            }
            int hero = player.user.heroIndex;
            if (hero < 0 || hero >= ATT.length) {
                continue;
            }
            State st = new State();
            st.hero = hero;
            byIndex.put((int) player.index, st);
            player.att += ATT[hero];
            player.hpMax = player.hpMax * (100 + HP_PCT[hero]) / 100;
            player.hp = player.hpMax;
        }
        if (byIndex.isEmpty()) {
            return;
        }
        synchronized (REG) {
            REG.put(mapData, byIndex);
        }
        // Captain family aura: teammates gain +20% defense.
        for (Player player : mapData.players) {
            if (player == null) {
                continue;
            }
            State st = byIndex.get((int) player.index);
            if (st == null || !isCaptain(st.hero)) {
                continue;
            }
            for (Player mate : mapData.players) {
                if (mate != null && mate.index != player.index && mate.team == player.team) {
                    mate.def += mate.def / 5;
                }
            }
        }
    }

    /** Rows for the -92 broadcast: {playerIndex, heroIndex, morphIndex}. */
    public static int[][] entries(MapData mapData) {
        synchronized (REG) {
            Map<Integer, State> byIndex = REG.get(mapData);
            if (byIndex == null || byIndex.isEmpty()) {
                return new int[0][];
            }
            int[][] rows = new int[byIndex.size()][3];
            int i = 0;
            for (Map.Entry<Integer, State> e : byIndex.entrySet()) {
                rows[i][0] = e.getKey();
                rows[i][1] = e.getValue().hero;
                rows[i][2] = e.getValue().morph;
                i++;
            }
            return rows;
        }
    }

    /** Strange's yellow disc weakens the victim's next shot by 10%.
     *  Called from the stock MapData.shoot for every shooter and from
     *  handleShoot below. */
    public static int modifyAtt(MapData mapData, Player player, int att) {
        State st = stateFor(mapData, player.index);
        if (st != null && st.discWeakened) {
            st.discWeakened = false;
            return att * 90 / 100;
        }
        return att;
    }

    /** Target-side hero modifiers on incoming damage, called from
     *  Player.updateAllAffect after the stock defense reduction. */
    public static int modifyDamage(MapData mapData, Player attacker, Player target, int dmg) {
        if (dmg <= 0 || mapData == null) {
            return dmg;
        }
        // Falling out of the world is not a hit: never reduced or blocked.
        if (target.y > mapData.height + 100) {
            return dmg;
        }
        State ts = stateFor(mapData, target.index);
        if (ts == null) {
            return dmg;
        }
        if (ts.shield) {
            ts.shield = false;
            return 0;
        }
        if (ts.pierce) {
            ts.pierce = false;
            double red = 1.0 - Math.exp(-target.def / 6000.0);
            double redPierce = 1.0 - Math.exp(-target.def * 0.8 / 6000.0);
            if (red > 0.001 && red < 0.999) {
                dmg = (int) Math.round(dmg * (1.0 - redPierce) / (1.0 - red));
            }
        }
        if (isCaptain(ts.hero)) {
            dmg = dmg * 80 / 100;
        }
        if (ts.marked) {
            dmg = dmg * 6 / 5;
        }
        return dmg;
    }

    /** On-hit hero effects, called from Player.attBullet. */
    public static void onBulletHit(MapData mapData, Player target, Bullet bullet) {
        if (mapData == null || bullet == null || bullet.gun == null) {
            return;
        }
        int type = bullet.bulletId;
        // Loki's scepter bolt: 20% chance to freeze for a turn (the
        // stock freeze machinery consumes nextFreeze).
        if (type == 66 && ThreadLocalRandom.current().nextInt(100) < 20) {
            target.nextFreeze = true;
        }
        State ts = stateFor(mapData, target.index);
        if (ts == null) {
            return;
        }
        if (type == 67) {
            ts.pierce = true;
        }
        if (type == 83) {
            ts.discWeakened = true;
        }
        if (type == 25 && bullet.gun.index >= 0 && bullet.gun.index < mapData.players.length) {
            State ss = stateFor(mapData, bullet.gun.index);
            if (ss != null && ss.hero == 5) {
                ts.marked = true;
            }
        }
    }

    /**
     * Hero shot resolution for real battles. Returns false when the
     * shooter has no hero (the stock MapData.shoot body then runs).
     * The translation and cadence tables mirror Training.fire exactly;
     * the base attack is the battle player's own att (hero bonus
     * already applied in setup).
     */
    public static boolean handleShoot(MapData mapData, int index, int ang, int force, int force2) {
        Player player = mapData.players[index];
        if (player == null) {
            return false;
        }
        State st = stateFor(mapData, index);
        if (st == null) {
            return false;
        }
        if (player.index != mapData.getTurn() || player.isShoot) {
            return true; // a hero shot out of turn: swallow like stock
        }
        player.isShoot = true;
        int baseAtt = modifyAtt(mapData, player, player.att);
        if (player.countBlind > 0) {
            baseAtt /= 2;
        }
        int bulletId = BULLET[st.hero];
        int effAtt = baseAtt;
        int effBullet = bulletId;
        boolean powShot = player.isPow;
        int heroShots = st.shots.merge(bulletId, 1, Integer::sum);
        switch (bulletId) {
            case 60 -> { // Captain: POW = giant shield (wire 81) at 150%
                if (powShot) {
                    effBullet = 81;
                    effAtt = baseAtt * 3 / 2;
                }
            }
            case 61, 62 -> // Iron Man: POW = rockets (82)
                effBullet = powShot ? 82 : 61;
            case 67 -> // Doctor Strange: discs alternate blue / yellow
                effBullet = heroShots % 2 == 1 ? 67 : 83;
            case 69, 70 -> { // Winter Soldier: piercing round (25 self-scales)
                effBullet = 25;
                effAtt = baseAtt * 2 / 3;
            }
            case 74, 75 -> // Ultron: plasma beam
                effBullet = 77;
            default -> {
            }
        }
        int cadenceKind = 0; // 1 = lightning, 2 = clap back-blast, 3 = clone, 4 = Hulk Xe gio shockwave
        if (!powShot) {
            switch (bulletId) {
                case 61, 62 -> { // Iron Man: Phao nang luong energy beam at 150%
                    if (heroShots % 3 == 0) {
                        effBullet = 77;
                        effAtt = baseAtt * 3 / 2;
                    }
                }
                case 68 -> { // Hulk: Xe gio shockwave companion
                    if (heroShots % 3 == 0) {
                        cadenceKind = 4;
                    }
                }
                case 63 -> { // Red Hulk: Xe gio clap at 150%, both ways
                    if (heroShots % 3 == 0) {
                        effAtt = baseAtt * 3 / 2;
                        cadenceKind = 2;
                    }
                }
                case 64, 65 -> { // Thor: Bua set lightning on landing
                    if (heroShots % 3 == 0) {
                        cadenceKind = 1;
                    }
                }
                case 67 -> { // Doctor Strange: shield arms after 3 shots
                    if (heroShots % 3 == 0) {
                        st.shield = true;
                    }
                }
                case 71 -> { // Hawkeye: Chon muc tieu lock-on volley (Gun case 72)
                    if (heroShots % 4 == 0) {
                        effBullet = 72;
                    }
                }
                case 73 -> { // Hawkeye Tech: air support (Gun case 80)
                    if (heroShots % 3 == 0) {
                        effBullet = 80;
                    }
                }
                case 74, 75 -> { // Ultron: Nhan ban clone fires along
                    if (heroShots >= 2) {
                        cadenceKind = 3;
                        st.clones = Math.min(5, heroShots - 1);
                    }
                }
                default -> {
                }
            }
        }
        // Loki's POW is his Giả dạng: morph into another hero in the
        // battle (rendering only; the shot itself stays a normal bolt).
        if (powShot && st.hero == 3) {
            morphLoki(mapData, player, st);
        }
        boolean gunPow = powShot && bulletId == 60;
        Gun gun = new Gun(mapData, index, gunPow);
        gun.shootBullet(effBullet, player.x, player.y, player.width, player.height,
                ang, force, force2, 1, effAtt, -1);
        gun.fillXY();
        int mainFrames = 0;
        for (Bullet b : gun.bullets) {
            mainFrames = Math.max(mainFrames, b.frames.size());
            mapData.addTimeUntilAction(50 * b.frames.size());
        }
        mapData.nextLuck();
        mapData.updateLuck();
        mapData.shoot(gun);
        // Hulk leap resolution (spec v3 Phase B, battle version): the
        // leap bullet IS Hulk - where it ends, he ends.
        if (bulletId == 68 && !gun.bullets.isEmpty()) {
            resolveLeap(mapData, player, gun.bullets.get(0));
        }
        mapData.updateAffect(index);
        mapData.isTurn = true;
        // Ultron Prime: below half HP, absorb a clone to heal, once
        // per battle (free action).
        if (bulletId == 75 && cadenceKind == 3 && !st.primeHealed
                && player.hp > 0 && player.hp < player.hpMax / 2) {
            player.updateHP(player.hpMax * 33 / 100);
            st.primeHealed = true;
            st.clones = Math.max(0, st.clones - 1);
            mapData.updateHP(player.index, player.hp, player.pixel);
            mapData.updateAngry(player.index, player.angry);
        }
        // Companion shots: built and sent after the main shot's
        // animation window, then their damage is applied.
        if (cadenceKind != 0) {
            final int kind = cadenceKind;
            final int landX = gun.bullets.isEmpty() ? player.x : gun.bullets.get(0).lastX;
            final int landY = gun.bullets.isEmpty() ? player.y : gun.bullets.get(0).lastY;
            final int sx = player.x;
            final int sy = player.y;
            final int attFin = baseAtt;
            final int angFin = ang;
            final int forceFin = force;
            final long delayMs = mainFrames * 50L + 250L;
            Thread companion = new Thread(() -> {
                try {
                    Thread.sleep(delayMs);
                } catch (InterruptedException ie) {
                    return;
                }
                if (mapData.players[index] != player || player.isDie) {
                    return;
                }
                Gun extra = new Gun(mapData, index, false);
                if (kind == 1) {
                    extra.shootBullet(84, landX, Math.max(40, landY - 320),
                            player.width, player.height, 270, 8, 0, 1, attFin * 3 / 2, -1);
                } else if (kind == 2) {
                    extra.shootBullet(63, sx, sy, player.width, player.height,
                            (angFin + 180) % 360, forceFin, 0, 1, attFin * 3 / 2, -1);
                } else if (kind == 4) {
                    extra.shootBullet(63, player.x, player.y, player.width, player.height,
                            angFin, forceFin, 0, 1, attFin * 3 / 2, -1);
                } else {
                    extra.shootBullet(77, sx - 24, sy, player.width, player.height,
                            angFin, forceFin, 0, 1, attFin * 33 / 100, -1);
                }
                extra.fillXY();
                for (Bullet b : extra.bullets) {
                    mapData.addTimeUntilAction(50 * b.frames.size());
                }
                mapData.shoot(extra);
                mapData.updateAffect(index);
            });
            companion.setDaemon(true);
            companion.start();
        }
        return true;
    }

    private static void resolveLeap(MapData mapData, Player player, Bullet leap) {
        int lx = leap.lastX;
        int ly = leap.lastY;
        if (lx < 0 || lx > mapData.width || ly > mapData.height) {
            player.updateHP(-player.hp);
            mapData.updateHP(player.index, player.hp, player.pixel);
            mapData.updateAngry(player.index, player.angry);
            return;
        }
        player.x = (short) lx;
        player.y = (short) ly;
        player.chuanHoaXY();
        if (player.y >= mapData.height) {
            player.updateHP(-player.hp);
            mapData.updateHP(player.index, player.hp, player.pixel);
            mapData.updateAngry(player.index, player.angry);
            return;
        }
        mapData.setXY(player.index, player.x, player.y);
    }

    private static void morphLoki(MapData mapData, Player player, State st) {
        java.util.ArrayList<Integer> candidates = new java.util.ArrayList<>();
        for (Player other : mapData.players) {
            if (other == null || other.index == player.index || other.isDie) {
                continue;
            }
            State os = stateFor(mapData, other.index);
            if (os != null) {
                candidates.add(os.hero);
            }
        }
        if (candidates.isEmpty()) {
            return;
        }
        st.morph = candidates.get(ThreadLocalRandom.current().nextInt(candidates.size()));
        for (Player other : mapData.players) {
            if (other != null && other.user != null && other.user.session != null) {
                other.user.session.sessionHandler.sendHeroBattle(mapData);
            }
        }
    }
}
