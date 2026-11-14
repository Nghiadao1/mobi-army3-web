from PIL import Image
from collections import deque

def extract(im):
    im = im.convert("RGB")
    W, H = im.size
    px = im.load()
    def plate(x, y):
        l = px[8, y]; r = px[W - 9, y]
        t = x / (W - 1)
        return (l[0] + (r[0]-l[0])*t, l[1] + (r[1]-l[1])*t, l[2] + (r[2]-l[2])*t)
    def dist(x, y):
        p = plate(x, y); c = px[x, y]
        return abs(c[0]-p[0]) + abs(c[1]-p[1]) + abs(c[2]-p[2])
    bg = [[False]*W for _ in range(H)]
    dq = deque()
    for x in range(W):
        for y in (0, H-1):
            if dist(x, y) < 60 and not bg[y][x]:
                bg[y][x] = True; dq.append((x, y))
    for y in range(H):
        for x in (0, W-1):
            if dist(x, y) < 60 and not bg[y][x]:
                bg[y][x] = True; dq.append((x, y))
    while dq:
        x, y = dq.popleft()
        for nx, ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
            if 0 <= nx < W and 0 <= ny < H and not bg[ny][nx] and dist(nx, ny) < 60:
                bg[ny][nx] = True; dq.append((nx, ny))
    for y in range(H):
        for x in range(W):
            if not bg[y][x] and dist(x, y) < 30:
                bg[y][x] = True
    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    op = out.load(); src = im.convert("RGBA").load()
    for y in range(H):
        for x in range(W):
            if not bg[y][x]: op[x, y] = src[x, y]
    a = out.getchannel("A"); ap = a.load()
    seen = [[False]*W for _ in range(H)]; best = []
    for y0 in range(H):
        for x0 in range(W):
            if ap[x0, y0] > 10 and not seen[y0][x0]:
                comp = []; dq = deque([(x0, y0)]); seen[y0][x0] = True
                while dq:
                    x, y = dq.popleft(); comp.append((x, y))
                    for nx, ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
                        if 0 <= nx < W and 0 <= ny < H and not seen[ny][nx] and ap[nx, ny] > 10:
                            seen[ny][nx] = True; dq.append((nx, ny))
                if len(comp) > len(best): best = comp
    keep = set(best)
    out2 = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    op2 = out2.load()
    for (x, y) in keep: op2[x, y] = src[x, y]
    bbox = out2.getchannel("A").getbbox()
    return out2.crop(bbox), bbox
