package CLib;

import com.badlogic.gdx.Gdx;
import org.teavm.jso.JSBody;
import java.nio.charset.StandardCharsets;

/** Browser persistence adapter. Binary RMS records keep their original names and bytes. */
public final class RMS {
    public static final String path = "rms/";
    @JSBody(params={"key"}, script="return localStorage.getItem('army2.rms.' + key);")
    private static native String get(String key);
    @JSBody(params={"key", "value"}, script="localStorage.setItem('army2.rms.' + key, value);")
    private static native void put(String key, String value);
    @JSBody(params={"key"}, script="localStorage.removeItem('army2.rms.' + key);")
    private static native void remove(String key);
    public static void saveRMS(String filename, byte[] data) throws Exception {
        StringBuilder value = new StringBuilder();
        for (byte b : data) value.append((char) (b & 255));
        put(filename, value.toString());
    }
    public static byte[] loadRMS(String filename) {
        try {
            String value = get(filename);
            if (value != null) {
                byte[] data = new byte[value.length()];
                for (int i = 0; i < data.length; i++) data[i] = (byte) value.charAt(i);
                return data;
            }
            if (Gdx.files.internal(path + filename).exists()) return Gdx.files.internal(path + filename).readBytes();
        } catch (Exception ignored) { }
        return null;
    }
    public static void saveRMSInt(String file, int x) { try { saveRMS(file, new byte[]{(byte)x}); } catch (Exception ignored) {} }
    public static int loadRMSInt(String file) { byte[] data = loadRMS(file); return data == null || data.length == 0 ? -1 : data[0]; }
    public static void saveRMSString(String file, String value) { try { saveRMS(file, value.getBytes(StandardCharsets.UTF_8)); } catch (Exception ignored) {} }
    public static String loadRMSString(String file) { byte[] data = loadRMS(file); return data == null ? null : new String(data, StandardCharsets.UTF_8); }
    public static void clearRMS(String file) { remove(file); }
    public static String getPathRMS() { return path; }
    @JSBody(script="Object.keys(localStorage).filter(function(k){return k.startsWith('army2.rms.');}).forEach(function(k){localStorage.removeItem(k);});")
    public static native void clearAll();
}
