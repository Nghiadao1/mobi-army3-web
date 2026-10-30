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
  isFrozen?: boolean;
  isPoisoned?: boolean;
  isWebbed?: boolean;
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
    } else if (state.unitKind === 'spider') {
      this.drawSpiderBoss(ctx, state);
    } else if (state.unitKind === 'dragon') {
      this.drawDragonBoss(ctx, state);
    } else if (state.unitKind === 'fortress') {
      this.drawFortressBoss(ctx, state);
    } else if (state.unitKind === 'bomber') {
      this.drawBomberUnit(ctx, state);
    } else {
      // Kiểm tra nếu user đã thay thế bằng PNG nhân vật mới trong heroOverrides
      const override = this.assets.manifest.heroOverrides[state.hero.id];
      if (override?.url && this.assets.getImage(override.url)) {
        this.drawOverrideHero(ctx, state, override.url, override.frameWidth, override.frameHeight, override.anchorY);
      } else {
        // Phản lực bay dưới chân cho Iron Man & Ultron
        if (state.hero.canFly) {
          const pulse = 0.75 + 0.25 * Math.sin(state.animTick * 0.35);
          ctx.save();
          const grad = ctx.createRadialGradient(0, 2, 1, 0, 8, 16 * pulse);
          grad.addColorStop(0, state.hero.id === 'ultron' ? 'rgba(244, 63, 94, 0.9)' : 'rgba(56, 189, 248, 0.92)');
          grad.addColorStop(0.5, state.hero.id === 'ultron' ? 'rgba(251, 113, 133, 0.45)' : 'rgba(249, 115, 22, 0.5)');
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.ellipse(0, 6, 11 * pulse, 15 * pulse, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        const poseIdx =
          state.animMode === 'idle' && Math.floor(state.animTick / 25) % 4 === 3
            ? IDLE_SEQ[Math.floor(state.animTick / 8) % IDLE_SEQ.length]
            : this.resolvePoseIndex(state);
        this.drawCompositeHero(ctx, state.hero.equipment, poseIdx, state.facingLeft);
      }
    }

    // Hiệu ứng trúng Tơ Nhện quấn quanh người
    if (state.isWebbed) {
      this.drawWebOverlay(ctx, state.animTick);
    }

    // Hiệu ứng trúng Độc Axit bao quanh mục tiêu
    if (state.isPoisoned) {
      this.drawPoisonOverlay(ctx, state.animTick);
    }

    // Hiệu ứng Đóng Băng tạo tảng băng pha lê bao quanh mục tiêu
    if (state.isFrozen) {
      this.drawFrozenOverlay(ctx, state.animTick);
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
  public drawHeroPreview(canvas: HTMLCanvasElement, hero: HeroDef, poseIdx = 12, facingLeft = false): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    const scale = Math.min(canvas.width / 56, canvas.height / 58);
    ctx.translate(canvas.width * 0.52, canvas.height * 0.86);
    ctx.scale(facingLeft ? -scale : scale, scale);

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
    // Các bộ giáp Marvel / Tướng đặc biệt (body >= 220 hoặc Ironman / Loki) dùng pose 0/1 để khớp hoàn hảo đầu-thân-chân
    let effectivePoseIdx = poseIdx;
    if ((eq.body >= 220 || eq.hat === 294 || eq.hat === 220 || eq.hat === 198) && poseIdx >= 11) {
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
      if (eq.hat === 198) {
        // Loki: Mũ 198 là sừng vàng Asgard đội lên đầu chuẩn part 59
        this.drawPartSlot(ctx, 59, pose[0], facingLeft);
      }
      this.drawPartSlot(ctx, eq.hat, pose[0], facingLeft);
    } else if (eq.glass !== -1) {
      // Tướng đeo mặt nạ/mũ đặc biệt (Granos, Chicky, Apache) dùng đầu nền part 59 + slot 4.
      // Riêng King Kong (glass = 179) là đầu Khỉ nguyên khối nên không vẽ đầu người 59 bên dưới.
      if (eq.glass !== 179) {
        this.drawPartSlot(ctx, 59, pose[0], facingLeft);
      }
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
        for (const candIdx of [0, 6, 7, 8, 9, 5, 1, 2, 3, 4]) {
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
      let frameDx = partId === 198 ? -4 : frame.dx;
      let frameDy = partId === 198 ? -6 : frame.dy;
      if (partId === 295) {
        // Iron Man Body (2Small3319.png) căn chuẩn tâm ngực & khớp cổ mũ 3315
        frameDx = -5;
        frameDy = -6;
      } else if (partId === 296) {
        // Iron Man Legs (2Small3329.png) căn chuẩn hông & tiếp đất
        frameDx = -4;
        frameDy = -2;
      } else if (partId === 220) {
        // Loki Helmet (2Small1853.png) mũ hoàng gia Asgard
        frameDx = 1;
        frameDy = -5;
      } else if (partId === 221) {
        // Loki Body (2Small1854.png) áo giáp hoàng gia Asgard
        frameDx = -5;
        frameDy = -6;
      } else if (partId === 222) {
        // Loki Legs (2Small1866.png) quần & ủng chiến Asgard
        frameDx = -4;
        frameDy = -2;
      }
      const dy = poseDy + frameDy;
      if (!facingLeft) {
        const dx = poseDx + frameDx;
        ctx.drawImage(smallImg, 0, 0, smallImg.width, smallImg.height, dx, dy, lw, lh);
      } else {
        const anchorRightX = -poseDx - frameDx;
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
    const bob = Math.sin(state.animTick * 0.06) * 3.2;
    const tilt = Math.sin(state.animTick * 0.04) * 0.055;

    ctx.save();
    ctx.translate(0, bob);
    ctx.rotate(tilt);

    // Chùm tia Tractor Beam & lõi năng lượng dưới đáy UFO
    const pulse = 0.75 + 0.25 * Math.sin(state.animTick * 0.15);
    const beamGrad = ctx.createRadialGradient(0, 6, 2, 0, 18, 36 * pulse);
    beamGrad.addColorStop(0, 'rgba(56, 189, 248, 0.85)');
    beamGrad.addColorStop(0.5, 'rgba(168, 85, 247, 0.42)');
    beamGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.ellipse(0, 10, 28 * pulse, 18 * pulse, 0, 0, Math.PI * 2);
    ctx.fill();

    // Chỉ dùng Frame 0 chuẩn cân đối (0..90px) trong UFO.png (vì frame 1 & 2 trong ảnh gốc là trạng thái nghiêng vỡ khi nổ)
    if (img) {
      const fh = Math.floor(img.height / 3);
      const w = img.width * 0.68;
      const h = fh * 0.68;
      ctx.drawImage(img, 0, 0, img.width, fh - 2, -w / 2, -h * 0.72, w, h);
    } else {
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.ellipse(0, -14, 34, 14, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Dải đèn led năng lượng chạy quanh vành đĩa bay mượt mà
    for (let i = 0; i < 6; i++) {
      const a = state.animTick * 0.1 + (i * Math.PI) / 3;
      const lx = Math.cos(a) * 26;
      const ly = -10 + Math.sin(a) * 4.5;
      ctx.fillStyle = i % 2 === 0 ? '#38bdf8' : '#f43f5e';
      ctx.beginPath();
      ctx.arc(lx, ly, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawSpiderBoss(ctx: CanvasRenderingContext2D, state: CharacterRenderState): void {
    const bob = Math.sin(state.animTick * 0.08) * 2.2;
    ctx.save();
    ctx.translate(0, bob);
    if (state.facingLeft) ctx.scale(-1, 1);

    // Bóng năng lượng độc dưới chân Nhện Máy
    const glow = ctx.createRadialGradient(0, 2, 3, 0, 2, 36);
    glow.addColorStop(0, 'rgba(34, 197, 94, 0.55)');
    glow.addColorStop(1, 'rgba(34, 197, 94, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(0, 2, 36, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    // 8 Chân Nhện Cơ Khí có khớp chuyển động
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const phase = state.animTick * 0.16 + i * 1.1 + (side === 1 ? 0.5 : 0);
        const lift = Math.max(0, Math.sin(phase)) * 5;
        const swing = Math.cos(phase) * 3.5;
        const bx = side * (8 + i * 4);
        const by = -16 + i * 1.5;
        const kx = side * (22 + i * 6) + swing * 0.5;
        const ky = -32 - (3 - i) * 2 - lift;
        const fx = side * (30 + i * 7) + swing;
        const fy = 2 - lift;

        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(kx, ky);
        ctx.lineTo(fx, fy);
        ctx.stroke();

        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(kx, ky);
        ctx.stroke();

        // Khớp nối phát sáng
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(kx, ky, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Bụng Nhện chứa Bể Độc Sinh Học (Abdomen)
    const abGrad = ctx.createRadialGradient(-14, -28, 3, -12, -24, 22);
    abGrad.addColorStop(0, '#4ade80');
    abGrad.addColorStop(0.45, '#15803d');
    abGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = abGrad;
    ctx.beginPath();
    ctx.ellipse(-13, -24, 20, 15, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#86efac';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Đầu & Giáp Ngực Nhện Máy (Cephalothorax)
    const headGrad = ctx.createRadialGradient(6, -20, 2, 6, -18, 16);
    headGrad.addColorStop(0, '#475569');
    headGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.ellipse(6, -18, 15, 12, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Cụm 6 Mắt Đỏ Tinh Thể & Nanh Độc
    ctx.fillStyle = '#ef4444';
    for (const [ex, ey, er] of [
      [14, -21, 2.6],
      [17, -18, 2.2],
      [11, -23, 1.8],
      [12, -16, 1.8],
    ]) {
      ctx.beginPath();
      ctx.arc(ex, ey, er, 0, Math.PI * 2);
      ctx.fill();
    }
    // Nanh độc nhỏ giọt axit
    ctx.strokeStyle = '#a3e635';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(16, -12);
    ctx.lineTo(23, -6);
    ctx.moveTo(13, -11);
    ctx.lineTo(19, -5);
    ctx.stroke();

    ctx.restore();
  }

  private drawDragonBoss(ctx: CanvasRenderingContext2D, state: CharacterRenderState): void {
    const bob = Math.sin(state.animTick * 0.07) * 4.0;
    const wingFlap = Math.sin(state.animTick * 0.15);

    ctx.save();
    ctx.translate(0, bob);
    if (state.facingLeft) ctx.scale(-1, 1);

    // Hào quang dung nham Hắc Long
    const aura = ctx.createRadialGradient(0, -24, 4, 0, -24, 46);
    aura.addColorStop(0, 'rgba(249, 115, 22, 0.6)');
    aura.addColorStop(0.6, 'rgba(220, 38, 38, 0.25)');
    aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, -24, 46, 0, Math.PI * 2);
    ctx.fill();

    // Đôi Cánh Rồng Lửa đập theo nhịp
    const wingY = -44 + wingFlap * 14;
    ctx.fillStyle = '#7f1d1d';
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-4, -28);
    ctx.quadraticCurveTo(-26, wingY - 14, -44, wingY);
    ctx.quadraticCurveTo(-30, wingY + 14, -18, -14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Đuôi Rồng có gai lửa
    ctx.strokeStyle = '#991b1b';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-12, -16);
    ctx.quadraticCurveTo(-32, -8, -42, -22 + Math.cos(state.animTick * 0.1) * 5);
    ctx.stroke();

    // Thân Rồng bọc giáp vảy Hắc Ám & Lõi Dung Nham
    const bodyGrad = ctx.createLinearGradient(-16, -38, 16, -6);
    bodyGrad.addColorStop(0, '#1e1b4b');
    bodyGrad.addColorStop(0.5, '#991b1b');
    bodyGrad.addColorStop(1, '#f97316');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, -22, 20, 15, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Đầu Rồng & Sừng Hoàng Kim
    ctx.fillStyle = '#7f1d1d';
    ctx.beginPath();
    ctx.moveTo(10, -32);
    ctx.lineTo(30, -30);
    ctx.lineTo(28, -18);
    ctx.lineTo(12, -18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Sừng Rồng
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(14, -32);
    ctx.lineTo(4, -45);
    ctx.moveTo(18, -32);
    ctx.lineTo(10, -43);
    ctx.stroke();

    // Mắt Rồng rực sáng + Lửa phun ở hàm
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(21, -26, 2.6, 0, Math.PI * 2);
    ctx.fill();

    const flameScale = 0.7 + 0.3 * Math.sin(state.animTick * 0.3);
    ctx.fillStyle = 'rgba(251, 146, 60, 0.85)';
    ctx.beginPath();
    ctx.arc(32, -22, 6 * flameScale, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawFortressBoss(ctx: CanvasRenderingContext2D, state: CharacterRenderState): void {
    const bodyImg = this.assets.getImage(this.assets.manifest.bosses.mechBody.url);
    const jetImg = this.assets.getImage(this.assets.manifest.bosses.jet.url);
    const q1 = this.assets.getImage('./assets/bosses/quat1.png');
    const q2 = this.assets.getImage('./assets/bosses/quat2.png');
    const bob = Math.sin(state.animTick * 0.05) * 2.5;

    ctx.save();
    ctx.translate(0, bob);
    if (state.facingLeft) ctx.scale(-1, 1);

    // Vòng khiên từ trường Pháo Đài Bay
    const pulse = 0.8 + 0.2 * Math.sin(state.animTick * 0.12);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, -34, 48 * pulse, 28 * pulse, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Thân chiến hạm bọc thép
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-42, -46, 84, 28, 10);
    ctx.fill();
    ctx.stroke();

    if (bodyImg) {
      const bw = bodyImg.width * 0.52;
      const bh = bodyImg.height * 0.52;
      ctx.drawImage(bodyImg, -bw / 2, -bh * 0.88, bw, bh);
    }
    if (jetImg) {
      const jw = jetImg.width * 0.55;
      const jh = jetImg.height * 0.55;
      ctx.drawImage(jetImg, -jw / 2, -58, jw, jh);
    }

    // Cánh quạt phản lực 2 bên mạn Pháo Đài
    const rotor = Math.floor(state.animTick / 3) % 2 === 0 ? q1 : q2;
    if (rotor) {
      ctx.drawImage(rotor, -44, -56, rotor.width * 1.15, rotor.height * 0.85);
      ctx.drawImage(rotor, 22, -56, rotor.width * 1.15, rotor.height * 0.85);
    }

    // Lõi Laze Hạt Nhân trung tâm
    const coreGrad = ctx.createRadialGradient(0, -32, 2, 0, -32, 13);
    coreGrad.addColorStop(0, '#ffffff');
    coreGrad.addColorStop(0.4, '#38bdf8');
    coreGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(0, -32, 13, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawFrozenOverlay(ctx: CanvasRenderingContext2D, tick: number): void {
    ctx.save();
    const shimmer = 0.82 + 0.1 * Math.sin(tick * 0.12);

    // Khối băng pha lê đa diện bao quanh toàn bộ nhân vật
    const iceGrad = ctx.createLinearGradient(-20, -44, 20, 6);
    iceGrad.addColorStop(0, `rgba(186, 230, 253, ${0.68 * shimmer})`);
    iceGrad.addColorStop(0.5, `rgba(56, 189, 248, ${0.52 * shimmer})`);
    iceGrad.addColorStop(1, `rgba(14, 165, 233, ${0.72 * shimmer})`);

    ctx.fillStyle = iceGrad;
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.95)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-16, 4);
    ctx.lineTo(-21, -18);
    ctx.lineTo(-14, -39);
    ctx.lineTo(0, -45);
    ctx.lineTo(15, -38);
    ctx.lineTo(21, -16);
    ctx.lineTo(16, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Đường vân phản quang mặt cắt tinh thể băng
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-12, -34);
    ctx.lineTo(8, -12);
    ctx.moveTo(-14, -16);
    ctx.lineTo(10, 0);
    ctx.moveTo(0, -42);
    ctx.lineTo(-6, -8);
    ctx.stroke();

    // Gai băng dưới chân
    ctx.fillStyle = 'rgba(125, 211, 252, 0.88)';
    for (const sx of [-15, -6, 5, 14]) {
      ctx.beginPath();
      ctx.moveTo(sx - 4, 4);
      ctx.lineTo(sx, -8);
      ctx.lineTo(sx + 4, 4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  private drawPoisonOverlay(ctx: CanvasRenderingContext2D, tick: number): void {
    ctx.save();
    // Quầng khói độc axit bao quanh mục tiêu
    const pulse = 0.8 + 0.2 * Math.sin(tick * 0.14);
    const grad = ctx.createRadialGradient(0, -18, 4, 0, -18, 26 * pulse);
    grad.addColorStop(0, 'rgba(74, 222, 128, 0.45)');
    grad.addColorStop(0.6, 'rgba(22, 163, 74, 0.32)');
    grad.addColorStop(1, 'rgba(22, 163, 74, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, -18, 26 * pulse, 0, Math.PI * 2);
    ctx.fill();

    // Các bong bóng độc axit bay lên quanh người
    for (let i = 0; i < 6; i++) {
      const a = tick * 0.08 + i * 1.05;
      const bx = Math.cos(a * 1.3) * 15;
      const by = -6 - ((tick * 0.6 + i * 7) % 34);
      const br = 2.2 + (i % 2) * 1.2;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(163, 230, 53, 0.88)' : 'rgba(34, 197, 94, 0.85)';
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawWebOverlay(ctx: CanvasRenderingContext2D, _tick: number): void {
    ctx.save();
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.9)';
    ctx.lineWidth = 1.6;
    for (const y of [-28, -20, -12, -5]) {
      ctx.beginPath();
      ctx.moveTo(-15, y);
      ctx.quadraticCurveTo(0, y + 3, 15, y - 1);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-12, -32);
    ctx.lineTo(12, -2);
    ctx.moveTo(12, -32);
    ctx.lineTo(-12, -2);
    ctx.stroke();
    ctx.restore();
  }

  private drawMechBoss(ctx: CanvasRenderingContext2D, state: CharacterRenderState): void {
    const bodyImg = this.assets.getImage(this.assets.manifest.bosses.mechBody.url);
    const hangerImg = this.assets.getImage(this.assets.manifest.bosses.mechHanger.url);
    const q1 = this.assets.getImage('./assets/bosses/quat1.png');
    const q2 = this.assets.getImage('./assets/bosses/quat2.png');
    const bob = Math.sin(state.animTick * 0.06) * 3.0;

    ctx.save();
    if (state.facingLeft) ctx.scale(-1, 1);

    // Giá treo + cánh quạt đôi phía trên thân cỗ máy
    if (hangerImg) {
      const hw = hangerImg.width * 0.55;
      const hh = hangerImg.height * 0.55;
      ctx.drawImage(hangerImg, -hw / 2, -82 + bob, hw, hh);
    }
    const rotor = Math.floor(state.animTick / 4) % 2 === 0 ? q1 : q2;
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
    const bob = Math.sin(state.animTick * 0.08) * 3;
    if (!img) return;

    const frames = entry.frames || 1;
    const fh = Math.floor(img.height / frames);
    const frame = frames > 1 ? Math.floor(state.animTick / 4) % frames : 0;
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
