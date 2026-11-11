package army2.server;

import java.io.IOException;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashMap;
import mobiarmy.io.Message;
import mobiarmy.server.*;
import org.mindrot.jbcrypt.BCrypt;

public final class GuestAccess {
    public static synchronized void enter(Session session, Message message) throws IOException {
        if (session.user != null) return;
        String name=message.reader().readUTF().trim();
        String identity=message.reader().readUTF();
        String token=message.reader().readUTF();
        String version=message.reader().readUTF();
        if (name.length()<2 || name.length()>20 || !identity.matches("[0-9a-f]{32}") || !token.matches("[0-9a-f]{64}")) {
            session.sessionHandler.log("Tên nhân vật không hợp lệ."); return;
        }
        for (int i=0;i<name.length();i++) {
            if (Character.isISOControl(name.charAt(i))) {session.sessionHandler.log("Tên nhân vật không hợp lệ.");return;}
        }
        String username="guest_"+identity;
        try {
            ArrayList<DBManager.DataRow> rows=Server.dbManager.selectColumnName("SELECT id,password FROM user WHERE username=?",username);
            int id;
            if (rows.isEmpty()) {
                HashMap<String,Object> values=new HashMap<>(); values.put("username",username);values.put("password",BCrypt.hashpw(token,BCrypt.gensalt()));
                id=Server.dbManager.insertWithMap("user",values);
                if (id<0) throw new SQLException("Guest profile insert failed");
            } else {
                if (!BCrypt.checkpw(token, rows.get(0).getString("password"))) { session.sessionHandler.log("Hồ sơ nhân vật không khớp trình duyệt này."); return; }
                id=rows.get(0).getInt("id");
            }
            User named=SessionManager.findUserByName(name);
            if (named!=null && named.id!=id) {session.sessionHandler.log("Tên nhân vật đã được sử dụng. Hãy chọn tên khác.");return;}
            User user=SessionManager.findUserById(id);
            if (user==null) {user=new User(id,name);SessionManager.addUser(user);}
            if (!user.connect(session)) {session.sessionHandler.log("Nhân vật đang chơi ở một tab khác.");return;}
            SessionManager.renameUser(user,name);session.version=version;
            user.glass().updateAll();
            session.sessionHandler.loadInfoAll();session.sessionHandler.layerData();session.sessionHandler.idNotColision();
        } catch(SQLException error) {error.printStackTrace();session.sessionHandler.log("Chưa thể lưu hồ sơ nhân vật. Vui lòng thử lại.");}
    }
}
