package army2.server;

import java.util.ArrayList;
import mobiarmy.io.Message;
import mobiarmy.server.DBManager;
import mobiarmy.server.Server;
import mobiarmy.server.Session;

// Giftcode support for the original Army 2 web port.
// The stock client already ships the UI: Menu -> Nap tien asks the server for
// top-up methods (command 122), and a method whose smsContent is
// "napthe:giftcode" opens a single-field code prompt that submits command 77.
// The stock server never implemented either command; this class adds both.
// Codes live in the `giftcode` table (xu / luong / exp rewards); each
// redemption is recorded in `giftcode_redeem` (one row per code + user,
// enforced by a unique key). EXP is granted to the player's currently
// selected character and capped by Glass.addExp at the game's max level.
public final class GiftCode {

    private GiftCode() {
    }

    // Command 122: return the top-up method list (a single giftcode entry).
    public static void chargeInfo(Session session, Message msg) {
        try {
            Message res = new Message(122);
            res.writer().writeByte(0); // action 0 = method list
            res.writer().writeUTF("giftcode");
            res.writer().writeUTF("Giftcode - nhập mã nhận xu và lượng");
            res.writer().writeUTF("napthe:giftcode");
            session.sendMessage(res);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // Command 77: redeem a giftcode. Other card types are not supported.
    public static void redeem(Session session, Message msg) {
        try {
            String type = msg.reader().readUTF();
            String rawCode = msg.reader().readUTF();
            msg.reader().readUTF(); // pin / link field, unused for giftcode
            if (session.user == null) {
                return;
            }
            if (type == null || !"giftcode".equals(type.trim())) {
                session.sessionHandler.log("Bản web hiện chỉ hỗ trợ nhập giftcode.");
                return;
            }
            String code = rawCode == null ? "" : rawCode.trim().toUpperCase();
            if (code.isEmpty()) {
                session.sessionHandler.log("Bạn chưa nhập mã giftcode.");
                return;
            }
            ArrayList<DBManager.DataRow> rows = Server.dbManager.selectColumnName(
                    "SELECT xu, luong, exp, UNIX_TIMESTAMP(expires_at) AS expires_ts FROM giftcode WHERE code = ?",
                    code);
            if (rows.isEmpty()) {
                session.sessionHandler.log("Mã giftcode không tồn tại.");
                return;
            }
            DBManager.DataRow row = rows.get(0);
            Object expires = row.get("expires_ts");
            if (expires != null && ((Number) expires).longValue() > 0
                    && ((Number) expires).longValue() * 1000L < System.currentTimeMillis()) {
                session.sessionHandler.log("Mã giftcode đã hết hạn.");
                return;
            }
            ArrayList<DBManager.DataRow> used = Server.dbManager.selectColumnName(
                    "SELECT id FROM giftcode_redeem WHERE code = ? AND user_id = ?",
                    code, session.user.id);
            if (!used.isEmpty()) {
                session.sessionHandler.log("Bạn đã dùng mã giftcode này rồi.");
                return;
            }
            // Atomic claim: succeeds only while a use remains (max_uses = 0 means unlimited).
            int claimed = Server.dbManager.update(
                    "UPDATE giftcode SET used_count = used_count + 1 WHERE code = ? AND (max_uses = 0 OR used_count < max_uses)",
                    code);
            if (claimed == 0) {
                session.sessionHandler.log("Mã giftcode đã được sử dụng hết.");
                return;
            }
            Server.dbManager.update(
                    "INSERT INTO giftcode_redeem (code, user_id, user_name) VALUES (?, ?, ?)",
                    code, session.user.id, session.user.name);
            int xu = row.getInt("xu");
            int luong = row.getInt("luong");
            int exp = row.getInt("exp");
            if (xu > 0) {
                session.user.addXu(xu, false);
            }
            if (luong > 0) {
                session.user.addLuong(luong, false);
            }
            if (xu > 0 || luong > 0) {
                session.sessionHandler.setXuLuong(session.user.xu, session.user.luong);
            }
            if (exp > 0) {
                session.user.glass().addExp(exp, true);
            }
            StringBuilder reward = new StringBuilder();
            if (xu > 0) {
                reward.append(fmt(xu)).append(" xu");
            }
            if (luong > 0) {
                if (reward.length() > 0) {
                    reward.append(", ");
                }
                reward.append(fmt(luong)).append(" lượng");
            }
            if (exp > 0) {
                if (reward.length() > 0) {
                    reward.append(", ");
                }
                reward.append(fmt(exp)).append(" EXP");
            }
            session.sessionHandler.log("Đổi giftcode thành công! Bạn nhận được " + reward + ".");
        } catch (Exception e) {
            e.printStackTrace();
            try {
                session.sessionHandler.log("Có lỗi xảy ra, vui lòng thử lại sau.");
            } catch (Exception ignored) {
            }
        }
    }

    // 2000000000 -> "2.000.000.000" (vi-VN grouping).
    private static String fmt(int value) {
        String digits = Integer.toString(value);
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < digits.length(); i++) {
            if (i > 0 && (digits.length() - i) % 3 == 0) {
                out.append('.');
            }
            out.append(digits.charAt(i));
        }
        return out.toString();
    }
}
