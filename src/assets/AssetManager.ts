import {
  AssetsManifest,
  ImageSlice,
  MapDef,
  PartDef,
  PoseDef,
} from '../types';

export class AssetManager {
  public manifest!: AssetsManifest;
  public maps: MapDef[] = [];
  public images: ImageSlice[] = [];
  public parts: PartDef[] = [];
  public poses: PoseDef[] = [];

  private imgCache = new Map<string, HTMLImageElement>();
  private loadingPromises = new Map<string, Promise<HTMLImageElement>>();

  public async initCore(onProgress?: (pct: number, label: string) => void): Promise<void> {
    onProgress?.(5, 'Đang đọc cấu hình tài nguyên...');
    const [manifest, maps, images, parts, poses] = await Promise.all([
      this.fetchJson<AssetsManifest>('./assets/assets-manifest.json'),
      this.fetchJson<MapDef[]>('./assets/data/maps.json'),
      this.fetchJson<ImageSlice[]>('./assets/data/images.json'),
      this.fetchJson<PartDef[]>('./assets/data/parts.json'),
      this.fetchJson<PoseDef[]>('./assets/data/poses.json'),
    ]);

    this.manifest = manifest;
    this.maps = maps;
    this.images = images;
    this.parts = parts;
    this.poses = poses;

    // Collect core images to preload immediately
    const urls = new Set<string>();
    for (const s of manifest.heroSheets) urls.add(`./${s}`);
    if (manifest.smallParts) {
      for (const spId of manifest.smallParts) {
        urls.add(`./assets/heroes/small/2Small${spId}.png`);
      }
    }
    for (const ov of Object.values(manifest.heroOverrides)) {
      if (ov?.url) urls.add(`./${ov.url}`);
    }
    for (const b of Object.values(manifest.bullets)) urls.add(`./${b.url}`);
    for (const e of Object.values(manifest.effects)) urls.add(`./${e.url}`);
    for (const boss of Object.values(manifest.bosses)) urls.add(`./${boss.url}`);
    urls.add('./assets/bosses/quat1.png');
    urls.add('./assets/bosses/quat2.png');
    urls.add('./assets/bosses/bat.png');
    urls.add('./assets/bosses/bomnguyentu.png');
    urls.add('./assets/bosses/thuocno.png');
    urls.add('./assets/effects/mb00.png');
    urls.add('./assets/heroes/small/2Small198_body.png');
    urls.add('./assets/heroes/small/2Small198_legs.png');

    // UI sprites
    urls.add(`./${manifest.ui.logo}`);
    urls.add('./assets/ui/logo-army3.png');
    urls.add(`./${manifest.ui.waterTop.url}`);
    urls.add(`./${manifest.ui.waterDeep}`);
    urls.add(`./${manifest.ui.itemsStrip.url}`);
    urls.add(`./${manifest.ui.winBanner}`);
    urls.add(`./${manifest.ui.loseBanner}`);
    urls.add(`./${manifest.ui.drawBanner}`);
    urls.add(`./${manifest.ui.turnArrow}`);
    urls.add(`./${manifest.ui.targetCross.url}`);
    urls.add(`./${manifest.ui.angryFlame0}`);
    urls.add(`./${manifest.ui.angryFlame1}`);

    // Crater masks & scorch borders
    const holeFiles = [
      'smallhole.png',
      'h14x12.png',
      'h32x26.png',
      'h36x30.png',
      'h40x35.png',
      'h44x39.png',
      'h55x50.png',
      'rocket.png',
      'hgrenade.png',
      'hrangcua.png',
      'rangehole.png',
    ];
    for (const hf of holeFiles) {
      urls.add(`./assets/holes/${hf}`);
      urls.add(`./assets/hole2/${hf}`);
    }

    // Parallax clouds
    urls.add('./assets/backgrounds/cl0.png');
    urls.add('./assets/backgrounds/cl1.png');
    urls.add('./assets/backgrounds/cl2.png');
    urls.add('./assets/backgrounds/sun10.png');

    const list = Array.from(urls);
    let done = 0;
    await Promise.all(
      list.map(async (u) => {
        try {
          await this.loadImage(u);
        } catch (err) {
          console.warn('Không tải được ảnh (bỏ qua):', u, err);
        }
        done++;
        const pct = 15 + Math.round((done / list.length) * 85);
        onProgress?.(pct, `Đang nạp đồ họa gốc (${done}/${list.length})...`);
      })
    );
  }

  public async loadMapAssets(map: MapDef): Promise<void> {
    const urls = new Set<string>();
    for (const b of map.bricks) {
      urls.add(`./assets/bricks/${b.brickId}.png`);
    }
    const bgSet = this.pickBackgroundLayers(map.bgType, map.mapId);
    for (const bgUrl of bgSet) {
      urls.add(bgUrl);
    }
    await Promise.all(
      Array.from(urls).map((u) => this.loadImage(u).catch(() => null))
    );
  }

  public pickBackgroundLayers(bgType: number, mapId: number): string[] {
    const sets = [
      ['./assets/backgrounds/b200.png', './assets/backgrounds/b201.png', './assets/backgrounds/b202.png'],
      ['./assets/backgrounds/b210.png', './assets/backgrounds/b211.png', './assets/backgrounds/b212.png'],
      ['./assets/backgrounds/b220.png', './assets/backgrounds/b221.png', './assets/backgrounds/b222.png'],
      ['./assets/backgrounds/b240.png', './assets/backgrounds/b241.png', './assets/backgrounds/b242.png'],
      ['./assets/backgrounds/b250.png', './assets/backgrounds/b251.png', './assets/backgrounds/b252.png'],
      ['./assets/backgrounds/b270.png', './assets/backgrounds/b271.png', './assets/backgrounds/b272.png'],
      ['./assets/backgrounds/b280.png', './assets/backgrounds/b281.png', './assets/backgrounds/b282.png'],
      ['./assets/backgrounds/b290.png', './assets/backgrounds/b291.png', './assets/backgrounds/b292.png'],
    ];
    const idx = Math.abs((bgType || 0) + mapId) % sets.length;
    return sets[idx];
  }

  public getImage(url: string): HTMLImageElement | undefined {
    const normalized = url.startsWith('./') ? url : `./${url}`;
    const cached = this.imgCache.get(normalized);
    if (!cached && !this.loadingPromises.has(normalized)) {
      this.loadImage(normalized).catch(() => {});
    }
    return cached;
  }

  public async loadImage(url: string): Promise<HTMLImageElement> {
    const normalized = url.startsWith('./') ? url : `./${url}`;
    const cached = this.imgCache.get(normalized);
    if (cached) return cached;

    const existing = this.loadingPromises.get(normalized);
    if (existing) return existing;

    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.imgCache.set(normalized, img);
        this.loadingPromises.delete(normalized);
        resolve(img);
      };
      img.onerror = (e) => {
        this.loadingPromises.delete(normalized);
        reject(e);
      };
      img.src = normalized;
    });
    this.loadingPromises.set(normalized, promise);
    return promise;
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} khi tải ${url}`);
    }
    return (await res.json()) as T;
  }
}

