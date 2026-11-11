package army2.web;

import org.teavm.jso.JSBody;

public final class BrowserPlatform {
    @JSBody(params={"message"}, script="if(new URLSearchParams(location.search).get('debug')==='1')console.log('[Army2] '+message);")
    public static native void trace(String message);
    @JSBody(script="return window.ARMY2_SERVER_LIST || 'Army 2 Web:127.0.0.1:8122';")
    private static native String serverList();
    public static void prepareServerList() {
        try {
            java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream();
            java.io.DataOutputStream writer = new java.io.DataOutputStream(bytes);
            String[] servers = serverList().split(",");
            writer.writeByte(servers.length);
            for (String server : servers) {
                String[] fields = server.split(":");
                writer.writeUTF(fields[0]); writer.writeUTF(fields[1]); writer.writeShort(Integer.parseInt(fields[2]));
            }
            writer.flush(); CLib.RMS.saveRMS("ipArmy2", bytes.toByteArray());
        } catch (Exception error) { throw new IllegalArgumentException("Invalid Army 2 server list", error); }
    }
    @JSBody(params={"code"}, script="window.dispatchEvent(new CustomEvent('army2-exit',{detail:code}));")
    public static native void exit(int code);
}
