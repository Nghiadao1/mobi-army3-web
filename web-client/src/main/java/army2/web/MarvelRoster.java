package army2.web;

import CLib.mImage;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.files.FileHandle;
import com.badlogic.gdx.utils.JsonReader;
import com.badlogic.gdx.utils.JsonValue;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Marvel hero roster loaded from the generated asset res/marvel/heroes.json.
 * The asset (plus one 30-pose spritesheet per hero) is produced by
 * scripts/build-marvel-sprites.mjs during the client build; see
 * extensions/marvel/MERGE_PLAN.md. Loading is failure-soft: any problem is
 * traced and the game continues without the roster.
 */
public final class MarvelRoster {

    public static final class Hero {
        public String id = "";
        public String name = "";
        public String title = "";
        public String powName = "";
        public String color = "";
        public boolean canFly;
        public int hp;
        public int attack;
        public int reloadTime;
        public float moveSpeed;
        public int staminaMax;
        public int minAngle;
        public int maxAngle;
        public String weapon = "";
        public String holeMask = "";
        public String powHoleMask = "";
        public String siteSkillName = "";
        public String specialSkillName = "";
    }

    private static final List<Hero> HEROES = new ArrayList<Hero>();
    private static final Map<String, Hero> BY_ID = new HashMap<String, Hero>();
    private static final Map<String, mImage> SHEETS = new HashMap<String, mImage>();
    private static boolean loaded;

    /** Hero picked in the Marvel picker (P2); null = original character. */
    public static volatile String selectedId;

    /** Captain's shield projectile sprite, preloaded with the roster. */
    public static mImage shieldImage;

    /**
     * Spritesheet for a hero: the full 96px-cell sheet for previews, or the
     * half-size 48px-cell sheet (id_b.png) for in-battle rendering. Loaded
     * lazily through the stock image pipeline and cached; null on failure.
     */
    public static mImage sheet(String id, boolean battle) {
        if (id == null) {
            return null;
        }
        String key = id + (battle ? "#b" : "#p");
        mImage img = SHEETS.get(key);
        if (img == null) {
            try {
                img = mImage.createImage("/marvel/" + id + (battle ? "_b.png" : ".png"));
            } catch (Throwable t) {
                BrowserPlatform.trace("Marvel sheet load failed: " + id + " " + t);
            }
            if (img != null) {
                SHEETS.put(key, img);
            }
        }
        return img;
    }

    private MarvelRoster() {
    }

    public static synchronized void load() {
        if (loaded) return;
        loaded = true;
        try {
            FileHandle file = Gdx.files.internal("res/marvel/heroes.json");
            if (file == null || !file.exists()) {
                BrowserPlatform.trace("Marvel roster: res/marvel/heroes.json not found");
                return;
            }
            JsonValue root = new JsonReader().parse(file.readString("UTF-8"));
            if (root == null || !root.isArray()) {
                BrowserPlatform.trace("Marvel roster: heroes.json is not an array");
                return;
            }
            for (JsonValue v = root.child; v != null; v = v.next) {
                Hero hero = new Hero();
                hero.id = v.getString("id", "");
                if (hero.id.length() == 0) continue;
                hero.name = v.getString("name", hero.id);
                hero.title = v.getString("title", "");
                hero.powName = v.getString("powName", "");
                hero.color = v.getString("color", "");
                hero.canFly = v.getBoolean("canFly", false);
                hero.hp = v.getInt("hp", 0);
                hero.attack = v.getInt("attack", 0);
                hero.reloadTime = v.getInt("reloadTime", 0);
                hero.moveSpeed = v.getFloat("moveSpeed", 0f);
                hero.staminaMax = v.getInt("staminaMax", 0);
                hero.minAngle = v.getInt("minAngle", 0);
                hero.maxAngle = v.getInt("maxAngle", 0);
                hero.weapon = v.getString("weapon", "");
                hero.holeMask = v.getString("holeMask", "");
                hero.powHoleMask = v.getString("powHoleMask", "");
                hero.siteSkillName = v.getString("siteSkillName", "");
                hero.specialSkillName = v.getString("specialSkillName", "");
                HEROES.add(hero);
                BY_ID.put(hero.id, hero);
            }
            try {
                shieldImage = mImage.createImage("/marvel/shield.png");
            } catch (Throwable t) {
                BrowserPlatform.trace("Marvel shield load failed: " + t);
            }
            BrowserPlatform.trace("Marvel roster loaded: " + HEROES.size() + " heroes");
        } catch (Throwable t) {
            BrowserPlatform.trace("Marvel roster load failed: " + t);
        }
    }

    public static List<Hero> heroes() {
        return Collections.unmodifiableList(HEROES);
    }

    public static Hero byId(String id) {
        return id == null ? null : BY_ID.get(id);
    }

    /** Bullet type the hero's weapon fires (P4 skills); 0 = stock gun. */
    public static int bulletTypeOf(String id) {
        if (id == null) {
            return 0;
        }
        if (id.equals("captain") || id.equals("captain_nomad") || id.equals("captain_gold")) {
            return 60;
        }
        if (id.equals("ironman")) {
            return 61;
        }
        if (id.equals("ironman_mark50")) {
            return 62;
        }
        if (id.equals("red_hulk")) {
            return 63;
        }
        if (id.equals("thor")) {
            return 64;
        }
        if (id.equals("thor_stormbreaker")) {
            return 65;
        }
        if (id.equals("loki")) {
            return 66;
        }
        if (id.equals("doctor_strange")) {
            return 67;
        }
        if (id.equals("hulk")) {
            return 68;
        }
        if (id.equals("wintersoldier")) {
            return 69;
        }
        if (id.equals("wintersoldier_winter")) {
            return 70;
        }
        if (id.equals("hawkeye")) {
            return 71;
        }
        if (id.equals("hawkeye_tech")) {
            return 73;
        }
        if (id.equals("ultron")) {
            return 74;
        }
        if (id.equals("ultron_prime")) {
            return 75;
        }
        return 0;
    }

    /** The hero's attack stat from heroes.json; 0 when unknown. */
    public static int attackOf(String id) {
        Hero hero = byId(id);
        return hero == null ? 0 : hero.attack;
    }

    public static int count() {
        return HEROES.size();
    }
}
