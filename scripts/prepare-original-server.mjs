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
handler = handler.replace('switch (msg.getCommand()) {', 'switch (msg.getCommand()) {\n            case -90 -> army2.server.GuestAccess.enter(this.session, msg);');
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
