package army2.server;

import mobiarmy.io.Message;
import mobiarmy.server.Map;
import mobiarmy.server.Session;

// Training (practice) mode for the original Army 2 web port.
// The stock client runs the practice battle locally; the server only has to
// answer three requests the stock server never implemented:
//   command -6 (trainingMap): reply -6 with the practice map id.
//   command 83 type 0 (map loaded): reply command 20 in the training layout
//     (5 equip shorts, map id, turn seconds, team, spawn slots).
//   command 83 type 1 (leave): reply command 83 so the client exits to menu.
public final class Training {

    private Training() {
    }

    private static byte mapId = -1;

    // One fixed practice map: the first server map with at least two spawn
    // points. Deterministic, so the -6 reply and the command 20 start
    // message always name the same map.
    private static byte trainingMapId() {
        if (mapId != -1) {
            return mapId;
        }
        if (Map.entrys != null) {
            for (Map entry : Map.entrys) {
                if (entry != null && entry.data != null && entry.data.points != null
                        && entry.data.points.length >= 2) {
                    mapId = entry.id;
                    return mapId;
                }
            }
        }
        mapId = 0;
        return mapId;
    }

    // Command -6: hand the client its practice map.
    public static void trainingMap(Session session) {
        try {
            Message res = new Message(-6);
            res.writer().writeByte(trainingMapId());
            session.sendMessage(res);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // Command 83: type 0 starts the practice battle, anything else leaves.
    public static void training(Session session, Message msg) {
        try {
            byte type = msg.reader().readByte();
            if (type != 0 || session.user == null) {
                session.sendMessage(new Message(83));
                return;
            }
            byte map = trainingMapId();
            Map entry = Map.get(map);
            Message res = new Message(20);
            short[] equip = session.user.glass().equipID;
            for (int i = 0; i < 5; i++) {
                res.writer().writeShort(equip != null && i < equip.length ? equip[i] : -1);
            }
            res.writer().writeByte(map);
            res.writer().writeByte(25); // seconds per turn (MapData default)
            res.writer().writeShort(0); // team bits (unused by the client here)
            int hp = session.user.glass().createAbility()[0];
            Map.Point[] points = entry != null && entry.data != null ? entry.data.points : null;
            for (int slot = 0; slot < 8; slot++) {
                if (points != null && points.length >= 2 && slot == 0) {
                    res.writer().writeShort(points[0].x);
                    res.writer().writeShort(points[0].y);
                    res.writer().writeShort(hp);
                } else if (points != null && points.length >= 2 && slot == 1) {
                    res.writer().writeShort(points[points.length - 1].x);
                    res.writer().writeShort(points[points.length - 1].y);
                    res.writer().writeShort(hp);
                } else {
                    res.writer().writeShort(-1);
                }
            }
            session.sendMessage(res);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
