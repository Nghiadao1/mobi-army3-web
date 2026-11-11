package army2.server;

import mobiarmy.server.Server;

public final class HeadlessLauncher {
    public static String env(String name, String fallback) {
        String value = System.getenv(name); return value == null ? fallback : value;
    }
    public static void main(String[] args) {
        System.setProperty("java.awt.headless", "true");
        Server server = new Server(Integer.parseInt(env("ARMY2_TCP_PORT", "8122")));
        Runtime.getRuntime().addShutdownHook(new Thread(server::stop));
        server.start();
    }
}
