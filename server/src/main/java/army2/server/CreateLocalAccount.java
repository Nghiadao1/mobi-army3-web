package army2.server;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import mobiarmy.server.DBManager;
import org.mindrot.jbcrypt.BCrypt;

/** Creates a test account only in the explicitly configured database. Password arrives on stdin. */
public final class CreateLocalAccount {
    public static void main(String[] args) throws Exception {
        if (args.length != 1 || System.getenv("ARMY2_JDBC_URL") == null) throw new IllegalArgumentException("Explicit database and username required");
        String password = new BufferedReader(new InputStreamReader(System.in)).readLine();
        if (password == null || password.length() < 8) throw new IllegalArgumentException("Password must contain at least eight characters");
        DBManager db = new DBManager(System.getenv("ARMY2_JDBC_URL"), HeadlessLauncher.env("ARMY2_DB_USER", "root"), HeadlessLauncher.env("ARMY2_DB_PASSWORD", ""));
        try {
            if (!db.selectColumnName("SELECT id FROM user WHERE username = ?", args[0]).isEmpty()) throw new IllegalArgumentException("Account already exists");
            if (db.update("INSERT INTO user(username,password) VALUES (?,?)", args[0], BCrypt.hashpw(password, BCrypt.gensalt())) != 1) throw new IllegalStateException("Could not create test account");
            System.out.println("Local test account created");
        } finally { db.close(); }
    }
}
