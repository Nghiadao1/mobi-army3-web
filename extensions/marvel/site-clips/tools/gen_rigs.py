from PIL import Image
import os, json, sys

FINAL = "final"
OUT = "anim"
os.makedirs(OUT, exist_ok=True)

def load(hero):
    return Image.open(f"{FINAL}/{hero}-a.png").convert("RGBA")

def alpha_map(img):
    W, H = img.size
    px = img.load()
    return [[px[x, y][3] > 10 for x in range(W)] for y in range(H)]

def detect_split(img):
    W, H = img.size
    am = alpha_map(img)
    band = range(int(H * 0.86), H)
    best_x, best_c = W // 2, 10 ** 9
    for x in range(int(W * 0.30), int(W * 0.72)):
        c = sum(1 for y in band if am[y][x])
        if c < best_c:
            best_c, best_x = c, x
    return best_x

def part(img, pred):
    W, H = img.size
    px = img.load()
    m = Image.new("L", (W, H), 0)
    mp = m.load()
    for y in range(H):
        for x in range(W):
            if px[x, y][3] > 10 and pred(x, y):
                mp[x, y] = 255
    p = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    p.paste(img, (0, 0), m)
    return p

def shear(img, pivot_y, max_shift):
    W, H = img.size
    out = Image.new("RGBA", (W + 10, H), (0, 0, 0, 0))
    for y in range(H):
        t = max(0.0, (y - pivot_y) / max(1, H - pivot_y))
        dx = round(max_shift * t)
        row = img.crop((0, y, W, y + 1))
        out.paste(row, (5 + dx, y), row)
    return out.crop((5, 0, 5 + W, H))

def shift(img, dx, dy):
    W, H = img.size
    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    out.alpha_composite(img, (dx, dy))
    return out

def gen_hero(hero, cfg):
    img = load(hero)
    W, H = img.size
    mode = cfg.get("mode", "walk")
    os.makedirs(f"{OUT}/{hero}", exist_ok=True)
    if mode == "hover":
        dys = cfg.get("hover_dys", [0, 2, 3, 2, 0])
        for i, dy in enumerate(dys):
            shift(img, 0, dy).save(f"{OUT}/{hero}/walk{i+1}.png")
        lean = cfg.get("shoot_lean", 4)
        shift(shear(img, int(H * 0.45), lean), 0, -1).save(f"{OUT}/{hero}/shoot.png")
        return {"mode": mode}
    leg_top = cfg.get("leg_top", int(H * 0.82))
    split = cfg.get("split", detect_split(img))
    swing = cfg.get("swing", max(3, round(W * 0.09)))
    prop_pred = cfg.get("prop")
    def is_prop(x, y):
        return prop_pred(x, y, W, H) if prop_pred else False
    legL = part(img, lambda x, y: y >= leg_top and x < split and not is_prop(x, y))
    legR = part(img, lambda x, y: y >= leg_top and x >= split and not is_prop(x, y))
    upper = part(img, lambda x, y: y < leg_top and not is_prop(x, y))
    prop = part(img, is_prop) if prop_pred else None
    def compose(lL, lR, bob=0, sway=0, lean=0, pdx=0, pdy=0):
        c = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        c.alpha_composite(lL, (0, 0))
        c.alpha_composite(lR, (0, 0))
        up = shear(upper, int(H * 0.55), lean) if lean else upper
        c.alpha_composite(up, (sway, bob))
        if prop is not None:
            c.alpha_composite(prop, (sway + pdx, bob + pdy))
        return c
    specs = [(swing, -swing, 0, 1), (0, 0, -1, 0), (-swing, swing, 0, -1), (0, 0, -1, 0), (swing, -swing, 0, 1)]
    for i, (sl, sr, bob, sway) in enumerate(specs):
        compose(shear(legL, leg_top, sl), shear(legR, leg_top, sr), bob=bob, sway=sway).save(f"{OUT}/{hero}/walk{i+1}.png")
    # shoot
    arch = cfg.get("shoot", "generic")
    if arch == "prop":
        pdx, pdy = cfg.get("prop_shift", (5, -3))
        compose(shear(legL, leg_top, -3), shear(legR, leg_top, 2), lean=cfg.get("shoot_lean", 2), pdx=pdx, pdy=pdy).save(f"{OUT}/{hero}/shoot.png")
    elif arch == "recoil":
        compose(shear(legL, leg_top, -3), shear(legR, leg_top, 2), lean=-3).save(f"{OUT}/{hero}/shoot.png")
    elif arch == "lunge":
        compose(shear(legL, leg_top, -4), shear(legR, leg_top, 3), lean=5, bob=1).save(f"{OUT}/{hero}/shoot.png")
    else:
        compose(shear(legL, leg_top, -3), shear(legR, leg_top, 2), lean=3).save(f"{OUT}/{hero}/shoot.png")
    return {"mode": mode, "leg_top": leg_top, "split": split, "swing": swing}

def captain_shield(x, y, W, H):
    return y >= 26 and ((x <= 20) or (x <= 24 and y <= 64))

RIGS = {
    "captain": {"leg_top": 57, "split": 29, "swing": 5, "prop": captain_shield, "shoot": "prop", "prop_shift": (15, -7)},
    "captain_nomad": {"leg_top": 57, "split": 29, "swing": 5, "prop": captain_shield, "shoot": "prop", "prop_shift": (15, -7)},
    "captain_gold": {"leg_top": 57, "split": 29, "swing": 5, "prop": captain_shield, "shoot": "prop", "prop_shift": (15, -7)},
    "hulk": {"shoot": "lunge"},
    "red_hulk": {"shoot": "lunge"},
    "thor": {"prop": lambda x, y, W, H: x >= int(W * 0.62) and y <= int(H * 0.52), "shoot": "prop", "prop_shift": (1, -6)},
    "thor_stormbreaker": {},
    "loki": {"leg_top": 80, "prop": lambda x, y, W, H: x >= int(W * 0.68) and y >= int(H * 0.30), "shoot": "prop", "prop_shift": (4, -3)},
    "doctor_strange": {"prop": lambda x, y, W, H: x >= int(W * 0.70) and y >= int(H * 0.22), "shoot": "prop", "prop_shift": (4, -1)},
    "wintersoldier": {"shoot": "recoil"},
    "wintersoldier_winter": {"shoot": "recoil"},
    "hawkeye": {},
    "hawkeye_tech": {},
    "ultron": {},
    "ultron_prime": {},
    "ironman": {"mode": "hover"},
    "ironman_mark50": {"mode": "hover"},
}

if __name__ == "__main__":
    report = {}
    for hero, cfg in RIGS.items():
        report[hero] = gen_hero(hero, cfg)
        print(hero, report[hero])
    json.dump(report, open(f"{OUT}/rigs-report.json", "w"), indent=1)
