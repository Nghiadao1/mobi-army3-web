package army2.web;

import CLib.RMS;
import coreLG.CCanvas;
import network.Message;
import network.Session_ME;
import screen.LoginScr;
import org.teavm.jso.JSBody;

public final class GuestEntry {
    public static void openDefaultServer() {
        CCanvas.serverListScreen.show();
        if (screen.ServerListScreen.nameServer != null && screen.ServerListScreen.nameServer.length == 1) {
            CCanvas.serverListScreen.selected = 0;
            com.teamobi.mobiarmy2.GameMidlet.server = 2;
            CCanvas.serverListScreen.center.action.perform();
        }
    }
    @JSBody(script="var b=new Uint8Array(32);crypto.getRandomValues(b);return Array.from(b,function(v){return v.toString(16).padStart(2,'0');}).join('');")
    private static native String randomToken();
    public static String savedName() { String name=RMS.loadRMSString("guest-name"); return name==null ? "" : name; }
    public static void enter(String rawName) {
        String name = rawName.trim();
        if (name.length() < 2 || name.length() > 20) { CCanvas.startOKDlg("Tên nhân vật cần từ 2 đến 20 ký tự."); return; }
        for (int i = 0; i < name.length(); i++) {
            if (Character.isISOControl(name.charAt(i))) { CCanvas.startOKDlg("Tên nhân vật không được chứa ký tự điều khiển."); return; }
        }
        if (!Session_ME.gI().isConnected()) {
            Session_ME.gI().connect(Session_ME.h, Session_ME.p);
            CCanvas.startOKDlg("Đang kết nối máy chủ. Vui lòng thử lại."); return;
        }
        try {
            String identity = RMS.loadRMSString("guest-id");
            String token = RMS.loadRMSString("guest-token");
            if (identity == null || token == null) {
                identity=randomToken().substring(0,32); token=randomToken();
                RMS.saveRMSString("guest-id",identity); RMS.saveRMSString("guest-token",token);
            }
            RMS.saveRMSString("guest-name",name);
            LoginScr.user=name; LoginScr.pass=""; LoginScr.remember=0;
            Message message=new Message(-90);
            message.writer().writeUTF(name); message.writer().writeUTF(identity); message.writer().writeUTF(token);
            message.writer().writeUTF(com.teamobi.mobiarmy2.GameMidlet.version);
            Session_ME.gI().sendMessage(message);
            CCanvas.startWaitDlg("Đang vào game...");
        } catch (Exception error) { CCanvas.startOKDlg("Không thể lưu hồ sơ nhân vật trên trình duyệt này."); }
    }
}
