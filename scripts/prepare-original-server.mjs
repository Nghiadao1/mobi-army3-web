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
    '                case 60 -> // Captain America: vibranium shield throw',
    '                    this.bullets.add(new HeroShieldBullet(this, this.isPow == 1 ? att * 3 / 2 : att, bx, by, vx, vy, this.isPow == 1));',
    '',
    '                case 61 -> { // Iron Man: repulsor burst, Jericho storm on pow',
    '                    int count = this.isPow == 1 ? 8 : 4;',
    '                    int spread = this.isPow == 1 ? 4 : 2;',
    '                    int dmg = this.isPow == 1 ? att / 3 : att / 2;',
    '                    for (int i = 0; i < count; i++) {',
    '                        int a2 = this.ang - spread * (count - 1) / 2 + i * spread;',
    '                        int bx2 = this.gunX + ((width - 4) * GameData.cos(a2) >> 10);',
    '                        int by2 = this.gunY - (height / 2) - ((height - 4) * GameData.sin(a2) >> 10);',
    '                        int vx2 = force * GameData.cos(a2) >> 10;',
    '                        int vy2 = -(force * GameData.sin(a2) >> 10);',
    '                        this.bullets.add(new Bullet(this, 61, dmg, bx2, by2, vx2, vy2, this.windX * 80 / 100, this.windY * 80 / 100, 100));',
    '                    }',
    '                }',
    '',
    '                case 63 -> // Red Hulk: clap shockwave',
    '                    this.bullets.add(new HeroShockwaveBullet(this, att * 3 / 2, bx, by, vx, vy));',
    '',
    '                case 64, 65 -> { // Thor / Stormbreaker: lightning at impact on skill shots',
    '                    if (this.isPow == 1) {',
    '                        this.bullets.add(new HeroStormCarrierBullet(this, bulletId, att, bx, by, vx, vy, bulletId == 65 ? 4 : 3));',
    '                    } else {',
    '                        this.bullets.add(new Bullet(this, bulletId, att, bx, by, vx, vy, this.windX * 80 / 100, this.windY * 80 / 100, 100));',
    '                    }',
    '                }',
    '',
    '                case 68 -> // Hulk: leap attack',
    '                    this.bullets.add(new HeroLeapBullet(this, this.isPow == 1 ? att * 3 / 2 : att, bx, by, vx, vy, this.isPow == 1));',
    '',
    '                case 72 -> { // Hawkeye: lock-on volley, 4 arrows at 50% damage',
    '                    for (int i = 0; i < 4; i++) {',
    '                        int a2 = this.ang - 3 + i * 2;',
    '                        int bx2 = this.gunX + ((width - 4) * GameData.cos(a2) >> 10);',
    '                        int by2 = this.gunY - (height / 2) - ((height - 4) * GameData.sin(a2) >> 10);',
    '                        int vx2 = force * GameData.cos(a2) >> 10;',
    '                        int vy2 = -(force * GameData.sin(a2) >> 10);',
    '                        this.bullets.add(new Bullet(this, 72, att / 2, bx2, by2, vx2, vy2, this.windX * 80 / 100, this.windY * 80 / 100, 100));',
    '                    }',
    '                }',
    '',
].join(String.fromCharCode(10));
if (!gun.includes('HeroShieldBullet')) {
    gun = gun.replace(gunDefault, heroCases + gunDefault);
}
await writeFile(gunFile, gun);
