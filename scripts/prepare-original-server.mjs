import { cp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const target = join(root, 'server/build/generated/source');
await mkdir(target, { recursive: true });
await cp(join(root, 'upstream/MobiArmy2-Server/src'), target, { recursive: true });
const file = join(target, 'mobiarmy/server/Server.java');
let source = await readFile(file, 'utf8');
source = source.replace('new DBManager("jdbc:mysql://localhost:3306/army", "root", "")',
  'new DBManager(army2.server.HeadlessLauncher.env("ARMY2_JDBC_URL", "jdbc:mysql://127.0.0.1:3306/army"), army2.server.HeadlessLauncher.env("ARMY2_DB_USER", "root"), army2.server.HeadlessLauncher.env("ARMY2_DB_PASSWORD", ""))');
await writeFile(file, source);
const handlerFile = join(target, 'mobiarmy/server/ControlHandler.java');
let handler = await readFile(handlerFile, 'utf8');
handler = handler.replace('switch (msg.getCommand()) {', 'switch (msg.getCommand()) {\n            case -90 -> army2.server.GuestAccess.enter(this.session, msg);\n            case 122 -> army2.server.GiftCode.chargeInfo(this.session, msg);\n            case 77 -> army2.server.GiftCode.redeem(this.session, msg);\n            case -6 -> army2.server.Training.trainingMap(this.session);\n            case 83 -> army2.server.Training.training(this.session, msg);\n            case 84 -> army2.server.Training.fire(this.session, msg);');
// The client pings before login too; answer in both states to prevent a false disconnect dialog.
handler = handler.replace(/case 42 -> \{[\s\S]*?(?=            case 49)/, 'case 42 -> {\n                this.session.sessionHandler.pingPaint();\n            }\n');
await writeFile(handlerFile, handler);
const sessionsFile = join(target, 'mobiarmy/server/SessionManager.java');
let sessions = await readFile(sessionsFile, 'utf8');
sessions = sessions.replace('public static void addUser(User user) {', `public static void renameUser(User user, String name) {
        synchronized (lock) {
            users_name.remove(user.name, user);
            user.name = name;
            users_name.put(name, user);
        }
    }
    public static void addUser(User user) {`);
await writeFile(sessionsFile, sessions);

// Boss maps 36-39 (balloon, poison spider, ghosts) exist in the map_boss and
// room_info tables, but upstream MapData.setBoss() has no case for them: those
// rooms spawned no boss and the war was won instantly. Patch in the missing
// cases (boss classes live in server/src/main/java/mobiarmy/war/Boss/) and
// keep the boss-map list in map order for the client index math.
const mapBossFile = join(target, 'mobiarmy/server/MapBoss.java');
let mapBoss = await readFile(mapBossFile, 'utf8');
mapBoss = mapBoss.replace('SELECT * FROM map_boss', 'SELECT * FROM map_boss ORDER BY mapID ASC');
await writeFile(mapBossFile, mapBoss);
const mapDataFile = join(target, 'mobiarmy/war/MapData.java');
let mapData = await readFile(mapDataFile, 'utf8');
mapData = mapData.replace('import mobiarmy.war.Boss.Ufo;', ['import mobiarmy.war.Boss.Ufo;', 'import mobiarmy.war.Boss.Balloon;', 'import mobiarmy.war.Boss.Ghost;', 'import mobiarmy.war.Boss.PoisonSpider;'].join(String.fromCharCode(10)));
const ufoTail = ['                array[i] = new Ufo(4500, 300, Util.nextInt(100, 300), Util.nextInt(0, 100));', '            }', '        }', '        if (array != null) {'].join(String.fromCharCode(10));
if (!mapData.includes(ufoTail)) {
  throw new Error('setBoss Ufo anchor not found in generated MapData.java');
}
const bossCases = [
  '                array[i] = new Ufo(4500, 300, Util.nextInt(100, 300), Util.nextInt(0, 100));',
  '            }',
  '        }',
  '        //Khi cau',
  '        if (this.mapId == 36) {',
  '            array = new Player[new int[]{4, 4, 5, 5, 6, 6, 8, 8}[this.nPlayer-1]];',
  '            for(int i = 0; i < array.length; i++) {',
  '                array[i] = new Balloon(4000, 300, Util.nextInt(100, 1100), Util.nextInt(0, 120));',
  '            }',
  '        }',
  '        //Nhen doc',
  '        if (this.mapId == 37) {',
  '            array = new Player[new int[]{2, 2, 3, 3, 4, 4, 5, 5}[this.nPlayer-1]];',
  '            int arrX[] = new int[]{300, 900, 600, 450, 1050};',
  '            for(int i = 0; i < array.length; i++) {',
  '                array[i] = new PoisonSpider(5000, 300, arrX[i], 100);',
  '            }',
  '        }',
  '        //Ma 1',
  '        if (this.mapId == 38) {',
  '            array = new Player[new int[]{3, 3, 4, 4, 5, 5, 6, 6}[this.nPlayer-1]];',
  '            for(int i = 0; i < array.length; i++) {',
  '                array[i] = new Ghost(5000, 300, Util.nextInt(150, 1050), Util.nextInt(30, 150), (byte)25);',
  '            }',
  '        }',
  '        //Ma 2',
  '        if (this.mapId == 39) {',
  '            array = new Player[new int[]{3, 3, 4, 4, 5, 5, 6, 6}[this.nPlayer-1]];',
  '            for(int i = 0; i < array.length; i++) {',
  '                array[i] = new Ghost(5000, 300, Util.nextInt(150, 1050), Util.nextInt(30, 150), (byte)26);',
  '            }',
  '        }',
  '        if (array != null) {',
].join(String.fromCharCode(10));
mapData = mapData.replace(ufoTail, bossCases);
await writeFile(mapDataFile, mapData);

// Marvel hero weapons (P4): extra Gun cases for hero bullet types. The
// classes live in server/src/main/java/mobiarmy/war/Boss/bullet/.
const gunFile = join(target, 'mobiarmy/war/Gun.java');
let gun = await readFile(gunFile, 'utf8');
const gunDefault = '                default -> this.bullets.add(new Bullet(this, bulletId, this.isPow == 1 ? att * 2 : att, bx, by, vx, vy, this.windX * 80 / 100, this.windY * 80 / 100, 100));';
const heroCases = [
    '                case 60 -> // Captain America: vibranium shield, 1 bounce then returns',
    '                    this.bullets.add(new HeroShieldBullet(this, att, bx, by, vx, vy, false));',
    '',
    '                case 81 -> // Captain POW: giant shield, 150% damage, 3 bounces',
    '                    this.bullets.add(new HeroShieldBullet(this, att, bx, by, vx, vy, true));',
    '',
    '                case 61 -> { // Iron Man / Mark 50: 2 plasma bolts at 55% each (spec v3)',
    '                    for (int i = 0; i < 2; i++) {',
    '                        int a2 = this.ang - 1 + i * 2;',
    '                        int bx2 = this.gunX + ((width - 4) * GameData.cos(a2) >> 10);',
    '                        int by2 = this.gunY - (height / 2) - ((height - 4) * GameData.sin(a2) >> 10);',
    '                        int vx2 = force * GameData.cos(a2) >> 10;',
    '                        int vy2 = -(force * GameData.sin(a2) >> 10);',
    '                        this.bullets.add(new Bullet(this, 61, att * 55 / 100, bx2, by2, vx2, vy2, this.windX * 10 / 100, this.windY * 10 / 100, 100));',
    '                    }',
    '                }',
    '',
    '                case 63 -> // Red Hulk skill shot: shockwave clap (att pre-scaled 150%)',
    '                    this.bullets.add(new HeroShockwaveBullet(this, att, bx, by, vx, vy));',
    '',
    '                case 64 -> // Thor: hammer throw (lightning arrives with the Phase C cadence)',
    '                    this.bullets.add(new HeroHammerBullet(this, att, bx, by, vx, vy));',
    '',
    '                case 65 -> // Thor Stormbreaker: the axe (lightning is visual only in the original)',
    '                    this.bullets.add(new Bullet(this, bulletId, att, bx, by, vx, vy, this.windX * 45 / 100, this.windY * 45 / 100, 100));',
    '',
    '                case 68 -> // Hulk / Red Hulk normals: leap attack (att pre-scaled 92% / 125% pow, 95% Red Hulk)',
    '                    this.bullets.add(new HeroLeapBullet(this, att, bx, by, vx, vy, this.isPow == 1));',
    '',
    '                case 72 -> { // Hawkeye lock-on: 4 homing arrows at 50% each',
    '                    for (int i = 0; i < 4; i++) {',
    '                        int a2 = this.ang - 3 + i * 2;',
    '                        int bx2 = this.gunX + ((width - 4) * GameData.cos(a2) >> 10);',
    '                        int by2 = this.gunY - (height / 2) - ((height - 4) * GameData.sin(a2) >> 10);',
    '                        int vx2 = force * GameData.cos(a2) >> 10;',
    '                        int vy2 = -(force * GameData.sin(a2) >> 10);',
    '                        this.bullets.add(new HeroHomingBullet(this, 72, att / 2, bx2, by2, vx2, vy2, false));',
    '                    }',
    '                }',
    '',
    '                case 74 -> { // Ultron: 2 energy orbs at 52% (POW: 3 at 62%), electric',
    '                    int count74 = this.isPow == 1 ? 3 : 2;',
    '                    int dmg74 = att * (this.isPow == 1 ? 62 : 52) / 100;',
    '                    for (int i = 0; i < count74; i++) {',
    '                        int a2 = this.ang + (i - (count74 - 1) / 2) * 2;',
    '                        int bx2 = this.gunX + ((width - 4) * GameData.cos(a2) >> 10);',
    '                        int by2 = this.gunY - (height / 2) - ((height - 4) * GameData.sin(a2) >> 10);',
    '                        int vx2 = force * GameData.cos(a2) >> 10;',
    '                        int vy2 = -(force * GameData.sin(a2) >> 10);',
    '                        this.bullets.add(new Bullet(this, 74, dmg74, bx2, by2, vx2, vy2, this.windX * 30 / 100, this.windY * 30 / 100, 100));',
    '                    }',
    '                }',
    '',
    '                case 75 -> { // Ultron Prime: 3 energy orbs at 48% (POW: 4 at 58%), electric',
    '                    int count75 = this.isPow == 1 ? 4 : 3;',
    '                    int dmg75 = att * (this.isPow == 1 ? 58 : 48) / 100;',
    '                    for (int i = 0; i < count75; i++) {',
    '                        int a2 = this.ang + (i - (count75 - 1) / 2) * 2;',
    '                        int bx2 = this.gunX + ((width - 4) * GameData.cos(a2) >> 10);',
    '                        int by2 = this.gunY - (height / 2) - ((height - 4) * GameData.sin(a2) >> 10);',
    '                        int vx2 = force * GameData.cos(a2) >> 10;',
    '                        int vy2 = -(force * GameData.sin(a2) >> 10);',
    '                        this.bullets.add(new Bullet(this, 75, dmg75, bx2, by2, vx2, vy2, this.windX * 30 / 100, this.windY * 30 / 100, 100));',
    '                    }',
    '                }',
    '',
    '                case 76 -> { // Iron Man POW: Jericho storm, 6 homing micro-missiles at 42%',
    '                    int force76 = Math.max(15, force * 88 / 100);',
    '                    for (int i = 0; i < 6; i++) {',
    '                        int a2 = this.ang + (i * 52 - 130) / 10;',
    '                        int bx2 = this.gunX + ((width - 4) * GameData.cos(a2) >> 10);',
    '                        int by2 = this.gunY - (height / 2) - ((height - 4) * GameData.sin(a2) >> 10);',
    '                        int vx2 = force76 * GameData.cos(a2) >> 10;',
    '                        int vy2 = -(force76 * GameData.sin(a2) >> 10);',
    '                        this.bullets.add(new HeroHomingBullet(this, 76, att * 42 / 100, bx2, by2, vx2, vy2, true));',
    '                    }',
    '                }',
    '',
    '                case 77 -> // Plasma beam (att pre-scaled by Training: Ultron 100%, Mark 50 skill 150%)',
    '                    this.bullets.add(new HeroBeamBullet(this, att, bx, by, vx, vy));',
    '',
    '                case 78 -> { // Doctor Strange: twin discs, green (defense-piercing) then yellow',
    '                    int green78 = att * (this.isPow == 1 ? 128 : 90) / 100;',
    '                    int yellow78 = att * (this.isPow == 1 ? 85 : 60) / 100;',
    '                    int ga = this.ang - 2;',
    '                    int ya = this.ang + 2;',
    '                    int gbx = this.gunX + ((width - 4) * GameData.cos(ga) >> 10);',
    '                    int gby = this.gunY - (height / 2) - ((height - 4) * GameData.sin(ga) >> 10);',
    '                    int ybx = this.gunX + ((width - 4) * GameData.cos(ya) >> 10);',
    '                    int yby = this.gunY - (height / 2) - ((height - 4) * GameData.sin(ya) >> 10);',
    '                    this.bullets.add(new Bullet(this, 78, green78, gbx, gby, force * GameData.cos(ga) >> 10, -(force * GameData.sin(ga) >> 10), this.windX * 35 / 100, this.windY * 35 / 100, 100));',
    '                    this.bullets.add(new Bullet(this, 78, yellow78, ybx, yby, force * GameData.cos(ya) >> 10, -(force * GameData.sin(ya) >> 10), this.windX * 35 / 100, this.windY * 35 / 100, 100));',
    '                }',
    '',
    '                case 79 -> { // Winter Soldier (and Loki default): sniper round(s) + Bionic cluster grenade',
    '                    int count79 = this.isPow == 1 ? 3 : 1;',
    '                    int dmg79 = att * (this.isPow == 1 ? 38 : 55) / 100;',
    '                    for (int i = 0; i < count79; i++) {',
    '                        int a2 = this.ang + (i - (count79 - 1) / 2);',
    '                        int bx2 = this.gunX + ((width - 4) * GameData.cos(a2) >> 10);',
    '                        int by2 = this.gunY - (height / 2) - ((height - 4) * GameData.sin(a2) >> 10);',
    '                        int vx2 = force * GameData.cos(a2) >> 10;',
    '                        int vy2 = -(force * GameData.sin(a2) >> 10);',
    '                        this.bullets.add(new Bullet(this, 79, dmg79, bx2, by2, vx2, vy2, this.windX * 25 / 100, this.windY * 25 / 100, 100));',
    '                    }',
    '                    this.bullets.add(new HeroClusterBullet(this, att * (this.isPow == 1 ? 58 : 52) / 100, bx, by, vx, vy, this.isPow == 1 ? 3 : 2));',
    '                }',
    '',
    '                case 80 -> // Hawkeye Tech skill: air support marker at 200% + carpet bombs',
    '                    this.bullets.add(new HeroAirstrikeBullet(this, att * 2, bx, by, vx, vy));',
    '',    '                case 84 -> { // Thor cadence: 3 lightning bolts around the impact point (spec v3 Phase C)',
    '                    for (int i = -1; i <= 1; i++) {',
    '                        this.bullets.add(new HeroLightningBullet(this, att, bx + i * 22, by, vx, vy));',
    '                    }',
    '                }',
    '',
    '                case 82 -> { // Iron Man POW: 2 rockets at 70% each, explosive (spec v3)',
    '                    for (int i = 0; i < 2; i++) {',
    '                        int a2 = this.ang - 2 + i * 4;',
    '                        int bx2 = this.gunX + ((width - 4) * GameData.cos(a2) >> 10);',
    '                        int by2 = this.gunY - (height / 2) - ((height - 4) * GameData.sin(a2) >> 10);',
    '                        int vx2 = force * GameData.cos(a2) >> 10;',
    '                        int vy2 = -(force * GameData.sin(a2) >> 10);',
    '                        this.bullets.add(new Bullet(this, 82, att * 70 / 100, bx2, by2, vx2, vy2, this.windX * 30 / 100, this.windY * 30 / 100, 100));',
    '                    }',
    '                }',
    '',

].join(String.fromCharCode(10));
if (!gun.includes('HeroShieldBullet')) {
    gun = gun.replace(gunDefault, heroCases + gunDefault);
}
await writeFile(gunFile, gun);
