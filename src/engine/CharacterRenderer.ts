import { AssetManager } from '../assets/AssetManager';
import { HeroDef, HeroEquipment, UnitKind } from '../types';

export interface CharacterRenderState {
  unitKind: UnitKind;
  hero: HeroDef;
  x: number;
  y: number;
  facingLeft: boolean;
  aimAngleDeg: number; // góc ngắm so với phương ngang của hướng mặt (-45 .. 89)
  animMode: 'idle' | 'walk' | 'jump' | 'aim' | 'shoot' | 'hurt';
  animTick: number;
  isPowReady: boolean;
  hasShield: boolean;
  scale?: number;
}

const IDLE_SEQ = [0, 1, 1, 0];
const WALK_SEQ = [2, 3, 4, 5, 6];
const JUMP_SEQ = [7, 8, 9, 10];
const HURT_SEQ = [18, 19, 20, 21, 22, 21, 20, 19];

export class CharacterRenderer {
  constructor(private readonly assets: AssetManager) {}

  /**
   * Chuyển góc ngắm (-45..89) thành pose chuẩn 11..17 (hoặc 23..29 khi giật nòng bắn) của Mobi Army 3.
   */
  public getAimPoseIndex(aimAngleDeg: number, shooting = false): number {
    let basePose = 11;
    if (aimAngleDeg < -26) {
      basePose = 17; // chúc sâu -45
    } else if (aimAngleDeg < -8) {
      basePose = 16; // chúc nhẹ
    } else if (aimAngleDeg < 14) {
      basePose = 11; // ngang
    } else if (aimAngleDeg < 32) {
      basePose = 12; // chếch 25
    } else if (aimAngleDeg < 52) {
      basePose = 13; // chếch 45
    } else if (aimAngleDeg < 72) {
      basePose = 14; // cao 65
    } else {
      basePose = 15; // thẳng đứng 85
    }
    return shooting ? basePose + 12 : basePose; // 23..29 là pose giật lùi 2px khi khai hỏa!
  }

  public resolvePoseIndex(state: CharacterRenderState): number {
    switch (state.animMode) {
      case 'walk':
        return WALK_SEQ[Math.floor(state.animTick / 4) % WALK_SEQ.length];
      case 'jump':
        return JUMP_SEQ[Math.min(JUMP_SEQ.length - 1, Math.floor(state.animTick / 5))];
      case 'hurt':
        return HURT_SEQ[Math.floor(state.animTick / 3) % HURT_SEQ.length];
      case 'shoot':
        return this.getAimPoseIndex(state.aimAngleDeg, true);
      case 'aim':
        return this.getAimPoseIndex(state.aimAngleDeg, false);
      case 'idle':
      default: {
        // Khi đứng yên trong trận, hiển thị tư thế cầm súng theo góc ngắm kết hợp nhịp thở nhẹ
        return this.getAimPoseIndex(state.aimAngleDeg, false);
      }
    }
  }

  public drawUnit(ctx: CanvasRenderingContext2D, state: CharacterRenderState): void {
    const scale = state.scale ?? 1;

    ctx.save();
    ctx.translate(state.x, state.y);
    if (scale !== 1) {
      ctx.scale(scale, scale);
    }

    // Hào quang lửa đỏ khi đầy thanh Nộ (POW 100%) giống hệt Mobi Army 3 ($Clu line 17917)
    if (state.isPowReady) {
      const fIdx = Math.floor(state.animTick / 4) % 2;
      const flameUrl =
        fIdx === 0 ? this.assets.manifest.ui.angryFlame0 : this.assets.manifest.ui.angryFlame1;
      const flameImg = this.assets.getImage(flameUrl);
      if (flameImg) {
        ctx.save();
        ctx.globalAlpha = 0.92;
        ctx.drawImage(flameImg, -14, -28, flameImg.width * 0.9, flameImg.height * 0.9);
        ctx.drawImage(flameImg, 2, -26, flameImg.width * 0.85, flameImg.height * 0.85);
        ctx.restore();
      }
    }

    if (state.unitKind === 'ufo') {
      this.drawUfoBoss(ctx, state);
    } else if (state.unitKind === 'mech') {
      this.drawMechBoss(ctx, state);
    } else if (state.unitKind === 'bomber') {
      this.drawBomberUnit(ctx, state);
    } else {
      // Kiểm tra nếu user đã thay thế bằng PNG nhân vật mới trong heroOverrides
      const override = this.assets.manifest.heroOverrides[state.hero.id];
      if (override?.url && this.assets.getImage(override.url)) {
        this.drawOverrideHero(ctx, state, override.url, override.frameWidth, override.frameHeight, override.anchorY);
      } else {
        const poseIdx =
          state.animMode === 'idle' && Math.floor(state.animTick / 25) % 4 === 3
            ? IDLE_SEQ[Math.floor(state.animTick / 8) % IDLE_SEQ.length]
            : this.resolvePoseIndex(state);
        this.drawCompositeHero(ctx, state.hero.equipment, poseIdx, state.facingLeft);
      }
    }

    // Vòng Khiên bảo vệ nếu bật item Khiên
    if (state.hasShield) {
      const shieldImg = this.assets.getImage(this.assets.manifest.bullets.shield.url);
      ctx.save();
      ctx.globalAlpha = 0.72 + 0.15 * Math.sin(state.animTick * 0.2);
      if (shieldImg) {
        ctx.drawImage(shieldImg, -22, -40, 44, 42);
      } else {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, -18, 22, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * Vẽ chân dung Tướng lên Canvas nhỏ cho màn hình Chọn Tướng & HUD.
   */
  public drawHeroPreview(canvas: HTMLCanvasElement, hero: HeroDef, poseIdx = 12): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    const scale = Math.min(canvas.width / 56, canvas.height / 58);
    ctx.translate(canvas.width * 0.52, canvas.height * 0.86);
    ctx.scale(scale, scale);

    const override = this.assets.manifest.heroOverrides[hero.id];
    if (override?.url && this.assets.getImage(override.url)) {
      const img = this.assets.getImage(override.url)!;
      ctx.drawImage(
        img,
        0,
        0,
        override.frameWidth,
        override.frameHeight,
        -override.frameWidth / 4,
        -(override.anchorY ?? override.frameHeight / 2),
        override.frameWidth / 2,
        override.frameHeight / 2
      );
    } else {
      this.drawCompositeHero(ctx, hero.equipment, poseIdx, false);
    }
    ctx.restore();
  }

  /**
   * Lắp ghép 6 bộ phận chuẩn từ Big0..Big4.png + 2Small*.png + parts.json + poses.json ($Clu & $rXx trong GameLogic.dll).
   */
  private drawCompositeHero(
    ctx: CanvasRenderingContext2D,
    eq: HeroEquipment,
    poseIdx: number,
    facingLeft: boolean
  ): void {
    // Các bộ giáp Marvel nguyên khối (body >= 220) dùng frame 0..5 (idle & walk), nên khi ngắm/bắn (pose >= 11) ánh xạ về pose 0/1 để khớp hoàn hảo đầu-thân-chân
    let effectivePoseIdx = poseIdx;
    if (eq.body >= 220 && poseIdx >= 11) {
      effectivePoseIdx = poseIdx >= 23 ? 1 : 0;
    }

    const pose = this.assets.poses[effectivePoseIdx] ?? this.assets.poses[0];
    if (!pose) return;

    // Thứ tự vẽ chuẩn từ sau ra trước theo $gvm.$Clu (lines 17888..17916):
    // 1. Súng (slot 3) -> 2. Balo/Cánh (slot 5) -> 3. Đầu/Mũ (slot 0) + Kính (slot 4) -> 4. Chân (slot 1) -> 5. Áo giáp (slot 2)
    if (eq.gun !== -1) {
      this.drawPartSlot(ctx, eq.gun, pose[3], facingLeft);
    }
    if (eq.back !== -1) {
      this.drawPartSlot(ctx, eq.back, pose[5], facingLeft);
    }
    if (eq.hat !== -1) {
      this.drawPartSlot(ctx, eq.hat, pose[0], facingLeft);
    } else if (eq.glass !== -1) {
      // Tướng đeo mặt nạ/mũ đặc biệt (Granos, Chicky, Apache) dùng đầu nền part 59 + slot 4
      this.drawPartSlot(ctx, 59, pose[0], facingLeft);
      this.drawPartSlot(ctx, eq.glass, pose[4], facingLeft);
    }
    if (eq.legs !== -1) {
      this.drawPartSlot(ctx, eq.legs, pose[1], facingLeft);
    }
    if (eq.body !== -1) {
      this.drawPartSlot(ctx, eq.body, pose[2], facingLeft);
    }
  }

  private drawPartSlot(
    ctx: CanvasRenderingContext2D,
    partId: number,
    slot: [number, number, number],
    facingLeft: boolean
  ): void {
    const part = this.assets.parts[partId];
    if (!part || !part.frames) return;
    const [frameIdx, poseDx, poseDy] = slot;
    let frame = part.frames[frameIdx] ?? part.frames[0];
    if (!frame) return;

    const slice = this.assets.images[frame.imgId];
    const isValidBigSlice =
      slice && slice.x < 256 && slice.y < 256 && slice.w < 256 && slice.h < 256;

    if (!isValidBigSlice) {
      // Bộ phận đặc biệt (Marvel / trang bị cao cấp) được lưu trong 2Small{imgId}.png ($Kfp.$XLH)
      let smallImg = this.assets.getImage(`./assets/heroes/small/2Small${frame.imgId}.png`);
      if (!smallImg) {
        for (const candIdx of [0, 5, 1, 2, 3, 4]) {
          const cf = part.frames[candIdx];
          if (!cf) continue;
          const cImg = this.assets.getImage(`./assets/heroes/small/2Small${cf.imgId}.png`);
          if (cImg) {
            frame = cf;
            smallImg = cImg;
            break;
          }
        }
      }
      if (!smallImg) return;

      const lw = smallImg.width / 2;
      const lh = smallImg.height / 2;
      const dy = poseDy + frame.dy;
      if (!facingLeft) {
        const dx = poseDx + frame.dx;
        ctx.drawImage(smallImg, 0, 0, smallImg.width, smallImg.height, dx, dy, lw, lh);
      } else {
        const anchorRightX = -poseDx - frame.dx;
        ctx.save();
        ctx.translate(anchorRightX, dy);
        ctx.scale(-1, 1);
        ctx.drawImage(smallImg, 0, 0, smallImg.width, smallImg.height, 0, 0, lw, lh);
        ctx.restore();
      }
      return;
    }

    const sheetUrl = this.assets.manifest.heroSheets[slice.sheet];
    const sheetImg = sheetUrl ? this.assets.getImage(sheetUrl) : undefined;
    if (!sheetImg) return;

    // Trên Big0..4.png (510x510), mỗi đơn vị trong images.json tương ứng 2x2 pixel HD!
    const sx = slice.x * 2;
    const sy = slice.y * 2;
    const sw = slice.w * 2;
    const sh = slice.h * 2;

    const dy = poseDy + frame.dy;
    if (!facingLeft) {
      const dx = poseDx + frame.dx;
      ctx.drawImage(sheetImg, sx, sy, sw, sh, dx, dy, slice.w, slice.h);
    } else {
      const anchorRightX = -poseDx - frame.dx;
      ctx.save();
      ctx.translate(anchorRightX, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(sheetImg, sx, sy, sw, sh, 0, 0, slice.w, slice.h);
      ctx.restore();
    }
  }

  private drawOverrideHero(
    ctx: CanvasRenderingContext2D,
    state: CharacterRenderState,
    url: string,
    fw: number,
    fh: number,
    anchorY?: number
  ): void {
    const img = this.assets.getImage(url);
    if (!img) return;
    const cols = Math.max(1, Math.floor(img.width / fw));
    const frame = Math.floor(state.animTick / 6) % cols;
    const drawW = fw / 2;
    const drawH = fh / 2;
    const oy = anchorY ?? drawH;
    ctx.save();
    if (state.facingLeft) ctx.scale(-1, 1);
    ctx.drawImage(img, frame * fw, 0, fw, fh, -drawW / 2, -oy, drawW, drawH);
    ctx.restore();
  }

  private drawUfoBoss(ctx: CanvasRenderingContext2D, state: CharacterRenderState): void {
    const entry = this.assets.manifest.bosses.ufo;
    const img = this.assets.getImage(entry.url);
    const bob = Math.sin(state.animTick * 0.08) * 4;
    if (!img) return;

    const frames = entry.frames || 3;
    const fh = Math.floor(img.height / frames);
    const frame = Math.floor(state.animTick / 5) % frames;
    const w = img.width * 0.62;
    const h = fh * 0.62;

    // Tia năng lượng dưới đáy UFO
    ctx.save();
    const grad = ctx.createRadialGradient(0, bob + 8, 2, 0, bob + 20, 32);
    grad.addColorStop(0, 'rgba(56, 189, 248, 0.55)');
    grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, bob + 12, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.drawImage(img, 0, frame * fh, img.width, fh, -w / 2, -h * 0.72 + bob, w, h);
  }

  private drawMechBoss(ctx: CanvasRenderingContext2D, state: CharacterRenderState): void {
    const bodyImg = this.assets.getImage(this.assets.manifest.bosses.mechBody.url);
    const hangerImg = this.assets.getImage(this.assets.manifest.bosses.mechHanger.url);
    const q1 = this.assets.getImage('./assets/bosses/quat1.png');
    const q2 = this.assets.getImage('./assets/bosses/quat2.png');
    const bob = Math.sin(state.animTick * 0.07) * 3.5;

    ctx.save();
    if (state.facingLeft) ctx.scale(-1, 1);

    // Giá treo + cánh quạt đôi phía trên thân cỗ máy
    if (hangerImg) {
      const hw = hangerImg.width * 0.55;
      const hh = hangerImg.height * 0.55;
      ctx.drawImage(hangerImg, -hw / 2, -82 + bob, hw, hh);
    }
    const rotor = Math.floor(state.animTick / 2) % 2 === 0 ? q1 : q2;
    if (rotor) {
      ctx.drawImage(rotor, -34, -95 + bob, rotor.width * 1.2, rotor.height * 0.9);
      ctx.drawImage(rotor, 24, -95 + bob, rotor.width * 1.2, rotor.height * 0.9);
    }

    if (bodyImg) {
      const bw = bodyImg.width * 0.58;
      const bh = bodyImg.height * 0.58;
      ctx.drawImage(bodyImg, -bw / 2, -bh * 0.82 + bob, bw, bh);
    }
    ctx.restore();
  }

  private drawBomberUnit(ctx: CanvasRenderingContext2D, state: CharacterRenderState): void {
    const entry = this.assets.manifest.bosses.bomber;
    const img = this.assets.getImage(entry.url);
    const bob = Math.sin(state.animTick * 0.11) * 3;
    if (!img) return;

    const frames = entry.frames || 2;
    const fh = Math.floor(img.height / frames);
    const frame = Math.floor(state.animTick / 3) % frames;
    const w = img.width * 0.65;
    const h = fh * 0.65;

    ctx.save();
    // Ảnh mb00.png mặc định quay sang trái, nên lật ngược khi quay phải!
    if (!state.facingLeft) {
      ctx.scale(-1, 1);
    }
    ctx.drawImage(img, 0, frame * fh, img.width, fh, -w / 2, -h * 0.7 + bob, w, h);
    ctx.restore();
  }
}
