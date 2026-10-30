import { AssetManager } from '../assets/AssetManager';
import { MapDef } from '../types';

export class Terrain {
  public readonly width: number;
  public readonly height: number;
  public readonly waterY: number;
  public readonly scale = 2; // 2x HD internal resolution matching x2 bricks

  public readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly solid: Uint8Array;

  constructor(public readonly map: MapDef, private readonly assets: AssetManager) {
    this.width = map.width;
    this.height = map.height;
    this.waterY = map.waterY;

    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width * this.scale;
    this.canvas.height = this.height * this.scale;
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Không thể khởi tạo Canvas2D cho địa hình');
    this.ctx = ctx;
    this.solid = new Uint8Array(this.width * this.height);

    this.buildFromBricks();
  }

  private buildFromBricks(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (const placement of this.map.bricks) {
      const img = this.assets.getImage(`./assets/bricks/${placement.brickId}.png`);
      if (!img) continue;
      // Bricks in x2/brick/ are 2x resolution, so drawing at (x*2, y*2) with natural width/height matches 1x logical space!
      this.ctx.drawImage(img, placement.x * this.scale, placement.y * this.scale);
    }
    this.syncSolidRect(0, 0, this.width, this.height);
  }

  private syncSolidRect(x0: number, y0: number, w: number, h: number): void {
    const cx0 = Math.max(0, Math.floor(x0));
    const cy0 = Math.max(0, Math.floor(y0));
    const cx1 = Math.min(this.width, Math.ceil(x0 + w));
    const cy1 = Math.min(this.height, Math.ceil(y0 + h));
    const cw = cx1 - cx0;
    const ch = cy1 - cy0;
    if (cw <= 0 || ch <= 0) return;

    const imgData = this.ctx.getImageData(
      cx0 * this.scale,
      cy0 * this.scale,
      cw * this.scale,
      ch * this.scale
    ).data;
    const stride = cw * this.scale;

    for (let ly = 0; ly < ch; ly++) {
      const py = ly * this.scale;
      const rowOffset = (cy0 + ly) * this.width + cx0;
      for (let lx = 0; lx < cw; lx++) {
        const px = lx * this.scale;
        const idx = (py * stride + px) * 4;
        const a = imgData[idx + 3];
        this.solid[rowOffset + lx] = a > 45 ? 1 : 0;
      }
    }
  }

  public isSolid(x: number, y: number): boolean {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || ix >= this.width || iy < 0) return false;
    if (iy >= this.height) return false;
    return this.solid[iy * this.width + ix] === 1;
  }

  /**
   * Bresenham line raycast ($nMi trong Mobi Army 3 gốc) để không bao giờ xuyên gạch khi đạn bay nhanh.
   */
  public raycast(x0: number, y0: number, x1: number, y1: number): { x: number; y: number } | null {
    let ix0 = Math.round(x0);
    let iy0 = Math.round(y0);
    const ix1 = Math.round(x1);
    const iy1 = Math.round(y1);

    const dx = Math.abs(ix1 - ix0);
    const dy = Math.abs(iy1 - iy0);
    const sx = ix0 < ix1 ? 1 : -1;
    const sy = iy0 < iy1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
      if (this.isSolid(ix0, iy0)) {
        return { x: ix0, y: iy0 };
      }
      if (ix0 === ix1 && iy0 === iy1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        ix0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        iy0 += sy;
      }
    }
    return null;
  }

  /**
   * Khoét hố đạn bằng alpha mask gốc (res/hole/*.png) + viền cháy đen (res/hole2/*.png).
   * Giảm 30% khả năng đào đất theo yêu cầu cân bằng mới.
   */
  public carveCrater(cx: number, cy: number, maskFile = 'h40x35.png', radiusScale = 1): void {
    const effectiveScale = radiusScale * 0.7;
    const holeImg =
      this.assets.getImage(`./assets/holes/${maskFile}`) ??
      this.assets.getImage('./assets/holes/h40x35.png');
    const scorchImg = this.assets.getImage(`./assets/hole2/${maskFile}`);

    const px = cx * this.scale;
    const py = cy * this.scale;

    this.ctx.save();

    // 1. Phủ viền cháy sém lên phần đất còn tồn tại xung quanh miệng hố
    if (scorchImg) {
      const sw = scorchImg.width * effectiveScale;
      const sh = scorchImg.height * effectiveScale;
      this.ctx.globalCompositeOperation = 'source-atop';
      this.ctx.globalAlpha = 0.85;
      this.ctx.drawImage(scorchImg, px - sw / 2, py - sh / 2, sw, sh);
    }

    // 2. Đục thủng địa hình theo đúng hình dáng hố đạn gốc (holeImg ở 1x nên nhân this.scale)
    let logicalW = 44 * effectiveScale;
    let logicalH = 40 * effectiveScale;
    if (holeImg) {
      logicalW = holeImg.width * effectiveScale;
      logicalH = holeImg.height * effectiveScale;
      const hw = logicalW * this.scale;
      const hh = logicalH * this.scale;
      this.ctx.globalCompositeOperation = 'destination-out';
      this.ctx.globalAlpha = 1;
      this.ctx.drawImage(holeImg, px - hw / 2, py - hh / 2, hw, hh);
    } else {
      this.ctx.globalCompositeOperation = 'destination-out';
      this.ctx.globalAlpha = 1;
      this.ctx.beginPath();
      this.ctx.arc(px, py, 22 * effectiveScale * this.scale, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.restore();

    const pad = 8;
    this.syncSolidRect(
      cx - logicalW / 2 - pad,
      cy - logicalH / 2 - pad,
      logicalW + pad * 2,
      logicalH + pad * 2
    );
  }

  /**
   * Tạo cục tơ nhện đặc dính vào địa hình (tính thành địa hình rắn chắn đạn & cản đường, có thể bị phá hủy).
   */
  public addWebTerrain(cx: number, cy: number, radius = 25): void {
    const px = cx * this.scale;
    const py = cy * this.scale;
    const pr = radius * this.scale;

    this.ctx.save();
    this.ctx.globalCompositeOperation = 'source-over';

    // Nền kén tơ nhện đặc (alpha > 45 để tính là solid = 1)
    const grad = this.ctx.createRadialGradient(px, py, pr * 0.1, px, py, pr);
    grad.addColorStop(0, 'rgba(248, 250, 252, 0.96)');
    grad.addColorStop(0.65, 'rgba(226, 232, 240, 0.90)');
    grad.addColorStop(0.92, 'rgba(203, 213, 225, 0.78)');
    grad.addColorStop(1, 'rgba(148, 163, 184, 0.0)');

    this.ctx.fillStyle = grad;
    this.ctx.beginPath();
    const lobes = 10;
    for (let i = 0; i <= lobes * 4; i++) {
      const a = (i / (lobes * 4)) * Math.PI * 2;
      const wave = 0.88 + 0.12 * Math.cos(a * lobes);
      const rx = px + Math.cos(a) * pr * wave;
      const ry = py + Math.sin(a) * pr * wave;
      if (i === 0) this.ctx.moveTo(rx, ry);
      else this.ctx.lineTo(rx, ry);
    }
    this.ctx.closePath();
    this.ctx.fill();

    // Vẽ các vòng tơ đồng tâm & sợi tơ hướng tâm
    this.ctx.strokeStyle = 'rgba(100, 116, 139, 0.65)';
    this.ctx.lineWidth = 1.6 * this.scale;
    for (const ringRatio of [0.32, 0.58, 0.82]) {
      this.ctx.beginPath();
      this.ctx.arc(px, py, pr * ringRatio, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
    this.ctx.lineWidth = 1.4 * this.scale;
    const spokes = 8;
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2;
      this.ctx.beginPath();
      this.ctx.moveTo(px, py);
      this.ctx.lineTo(px + Math.cos(a) * pr * 0.94, py + Math.sin(a) * pr * 0.94);
      this.ctx.stroke();
    }

    // Viền kén tơ nhện
    this.ctx.strokeStyle = 'rgba(148, 163, 184, 0.85)';
    this.ctx.lineWidth = 1.8 * this.scale;
    this.ctx.beginPath();
    this.ctx.arc(px, py, pr * 0.88, 0, Math.PI * 2);
    this.ctx.stroke();

    this.ctx.restore();

    const pad = 6;
    this.syncSolidRect(
      cx - radius - pad,
      cy - radius - pad,
      (radius + pad) * 2,
      (radius + pad) * 2
    );
  }

  /**
   * Tìm mặt đất hợp lệ để đặt nhân vật lúc vào trận.
   */
  public findSpawnPoint(preferredX: number): { x: number; y: number } {
    const maxRadius = Math.floor(this.width * 0.85);
    for (let offset = 0; offset <= maxRadius; offset += 4) {
      const candidates = offset === 0 ? [preferredX] : [preferredX + offset, preferredX - offset];
      for (const rawX of candidates) {
        const x = Math.round(rawX);
        if (x < 24 || x > this.width - 24) continue;
        // Quét từ trên xuống trước mực nước
        for (let y = 8; y < this.waterY - 2; y++) {
          if (this.isSolid(x, y) && !this.isSolid(x, y - 1) && !this.isSolid(x, y - 12)) {
            return { x, y: y - 1 };
          }
        }
      }
    }
    return { x: Math.max(40, Math.min(this.width - 40, Math.round(preferredX))), y: 80 };
  }
}

