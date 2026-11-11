import { sound } from '../audio/SoundEngine';
import type { BattleEngine, Fighter } from './BattleEngine';

/**
 * Lịch bắn vũ khí theo tướng (toàn bộ switch theo `hero.weapon`:
 * tướng Mobi Army 3 gốc + các Siêu Anh Hùng Marvel).
 *
 * Tách ra từ BattleEngine.scheduleHeroWeapon (P1) để file engine gọn hơn.
 * Hàm này chỉ dùng 4 thành viên của engine: `queueProjectile`, `spawnBullet`,
 * `spawnFloatingText` và `chargePower2` — hành vi giữ nguyên 100%.
 */

export function scheduleHeroWeapon(
  engine: BattleEngine,
  u: Fighter,
  power: number,
  usePow: boolean,
  baseDelay: number
): void {
  switch (u.hero.weapon) {
    case 'cannon': {
      // Gunner chuẩn Mobi Army 3: 1 viên pháo cối uy lực lớn; POW = 3 viên pháo hạt nhân
      if (!usePow) {
        engine.queueProjectile(baseDelay, () => {
          sound.playShoot(true);
          engine.spawnBullet(u, u.aimAngleDeg, power, {
            spriteKey: 'cannon',
            effectKey: 'bigExplosion',
            holeMask: u.hero.holeMask,
            holeScale: 1.08,
            damage: u.attack * 1.02,
            blastRadius: 45,
          });
        });
      } else {
        [-3.2, 0, 3.2].forEach((da, i) => {
          engine.queueProjectile(baseDelay + i * 8, () => {
            sound.playShoot(true);
            engine.spawnBullet(u, u.aimAngleDeg + da, power, {
              spriteKey: 'special',
              effectKey: 'nuke',
              holeMask: 'h55x50.png',
              holeScale: 1.18,
              damage: u.attack * 0.68,
              blastRadius: 50,
            });
          });
        });
      }
      break;
    }

    case 'ak': {
      // Miss 6 (Aka): điểm xạ 3 viên liên thanh; POW = 6 viên liên thanh
      const count = usePow ? 6 : 3;
      const perShotDmg = usePow ? 0.35 : 0.41;
      for (let i = 0; i < count; i++) {
        engine.queueProjectile(baseDelay + i * 5, () => {
          sound.playShoot(false);
          const spread = (i - (count - 1) / 2) * 0.65;
          engine.spawnBullet(u, u.aimAngleDeg + spread, power, {
            spriteKey: 'ak',
            effectKey: 'explosion',
            holeMask: usePow ? u.hero.powHoleMask : u.hero.holeMask,
            holeScale: 0.95,
            damage: u.attack * perShotDmg,
            blastRadius: 32,
          });
        });
      }
      break;
    }

    case 'electric': {
      // Điện Quang chuẩn Mobi Army 3: chùm 3 cầu sét Plasma tách góc; POW = 5 tia sét giật sét trời
      const angles = usePow ? [-5, -2.5, 0, 2.5, 5] : [-2.4, 0, 2.4];
      const ratio = usePow ? 0.42 : 0.44;
      angles.forEach((da, i) => {
        engine.queueProjectile(baseDelay + i * 5, () => {
          sound.playShoot(true);
          engine.spawnBullet(u, u.aimAngleDeg + da, power, {
            spriteKey: 'lightning',
            effectKey: 'electric',
            holeMask: usePow ? u.hero.powHoleMask : u.hero.holeMask,
            holeScale: usePow ? 1.05 : 0.95,
            damage: u.attack * ratio,
            blastRadius: 40,
            windScale: 0.45,
            special: usePow ? 'sky_lightning' : 'electric',
          });
        });
      });
      break;
    }

    case 'banana_cluster': {
      // King Kong (Khỉ Đột): Bắn chùm 4 quả chuối xoáy (POW = 6 quả chuối đại)
      const angles = usePow ? [-6, -3.6, -1.2, 1.2, 3.6, 6] : [-4.5, -1.5, 1.5, 4.5];
      const ratio = usePow ? 0.36 : 0.34;
      angles.forEach((da, i) => {
        engine.queueProjectile(baseDelay + i * 5, () => {
          sound.playShoot(true);
          engine.spawnBullet(u, u.aimAngleDeg + da, power, {
            spriteKey: 'banana',
            effectKey: usePow ? 'bigExplosion' : 'explosion',
            holeMask: 'hrangcua.png',
            holeScale: usePow ? 1.05 : 0.92,
            damage: u.attack * ratio,
            blastRadius: 38,
            windScale: 0.85,
            scale: 1.2,
          });
        });
      });
      break;
    }

    case 'boomerang': {
      // Tazang: Ném 1 chiếc Bumerang xoáy và tự động ĐỔI HƯỚNG quay ngược lại khi đang bay!
      engine.queueProjectile(baseDelay, () => {
        sound.playShoot(true);
        engine.spawnBullet(u, u.aimAngleDeg, power, {
          spriteKey: 'boomerang',
          effectKey: usePow ? 'nuke' : 'bigExplosion',
          holeMask: 'hrangcua.png',
          holeScale: usePow ? 1.32 : 1.18,
          damage: u.attack * (usePow ? 1.52 : 1.12),
          blastRadius: usePow ? 52 : 46,
          windScale: 0.35,
          special: 'boomerang_curve',
          boomerangTurnDir: u.facingLeft ? 1 : -1,
          scale: usePow ? 1.35 : 1.12,
        });
      });
      break;
    }

    case 'rocket': {
      // Rocketer chuẩn Mobi Army 3: chùm 3 tên lửa 13Missile.png; POW = 5 tên lửa
      const angles = usePow ? [-6, -3, 0, 3, 6] : [-3.2, 0, 3.2];
      const ratio = usePow ? 0.42 : 0.44;
      angles.forEach((da, i) => {
        engine.queueProjectile(baseDelay + i * 4, () => {
          sound.playShoot(false);
          engine.spawnBullet(u, u.aimAngleDeg + da, power, {
            spriteKey: 'rocket',
            effectKey: usePow ? 'bigExplosion' : 'explosion',
            holeMask: usePow ? u.hero.powHoleMask : u.hero.holeMask,
            holeScale: 1.0,
            damage: u.attack * ratio,
            blastRadius: 36,
          });
        });
      });
      break;
    }

    case 'grenade': {
      // Granos: lựu đạn mẹ phát nổ văng ra 3 quả bom con (POW = 5 quả bom con)
      engine.queueProjectile(baseDelay, () => {
        sound.playShoot(true);
        engine.spawnBullet(u, u.aimAngleDeg, power, {
          spriteKey: 'bomb',
          effectKey: usePow ? 'nuke' : 'bigExplosion',
          holeMask: usePow ? 'h55x50.png' : u.hero.holeMask,
          holeScale: usePow ? 1.25 : 1.08,
          damage: u.attack * (usePow ? 0.95 : 0.72),
          blastRadius: 44,
          special: 'cluster',
          diggerCharges: usePow ? 5 : 3,
        });
      });
      break;
    }

    case 'chicky': {
      // Chicky: Đạn bắn ra là 1 con Gà (gatruilong.png), căn thời gian đẻ Trứng Vàng theo Thanh Lực 2!
      const shots = usePow ? [-2.5, 0, 2.5] : [0];
      const eggTick =
        u.isPlayerControlled && engine.chargePower2 > 0
          ? Math.round(6 + (engine.chargePower2 / 100) * 58)
          : 24;
      shots.forEach((da, i) => {
        engine.queueProjectile(baseDelay + i * 8, () => {
          sound.playShoot(false);
          engine.spawnBullet(u, u.aimAngleDeg + da, power, {
            spriteKey: 'gatruilong',
            effectKey: 'explosion',
            holeMask: u.hero.holeMask,
            holeScale: 0.95,
            damage: u.attack * (usePow ? 0.42 : 0.62),
            blastRadius: 36,
            special: 'chicky_egg',
            eggDropTick: eggTick + i * 4,
            scale: 1.15,
          });
        });
      });
      break;
    }

    case 'apache': {
      // Apache: Bắn 1 viên Kim Cương lên trời và phóng tia Laze tới đó, khúc xạ thành hình tam giác gây nổ ở điểm cuối!
      engine.queueProjectile(baseDelay, () => {
        sound.playShoot(true);
        engine.spawnBullet(u, Math.max(25, u.aimAngleDeg), power, {
          spriteKey: 'imgDiamond',
          effectKey: usePow ? 'nuke' : 'bigExplosion',
          holeMask: usePow ? 'h55x50.png' : 'h44x39.png',
          holeScale: usePow ? 1.32 : 1.15,
          damage: u.attack * (usePow ? 1.55 : 1.18),
          blastRadius: usePow ? 54 : 46,
          windScale: 0.35,
          special: 'apache_diamond',
          scale: 1.25,
        });
      });
      break;
    }

    case 'magenta_orb': {
      // Magenta (#10): Bắn chùm 4 quả cầu ma pháp tím lượn xoáy và hội tụ vào mục tiêu. POW: Đại Cầu Tinh Vân
      const angles = usePow ? [-4.5, -2, 0, 2, 4.5] : [-3, -1, 1, 3];
      const ratio = usePow ? 0.42 : 0.28;
      angles.forEach((da, i) => {
        engine.queueProjectile(baseDelay + i * 5, () => {
          sound.playShoot(usePow);
          engine.spawnBullet(u, u.aimAngleDeg + da, power, {
            spriteKey: 'special',
            effectKey: usePow ? 'nuke' : 'electric',
            holeMask: usePow ? 'h55x50.png' : 'h36x30.png',
            holeScale: usePow ? 1.25 : 1.0,
            damage: u.attack * ratio,
            blastRadius: usePow ? 46 : 36,
            windScale: 0.35,
            special: 'magenta_orb',
            scale: usePow ? 1.35 : 1.15,
          });
        });
      });
      break;
    }

    // ================= VŨ KHÍ ĐẶC TRƯNG BIỆT ĐỘI MARVEL =================
    case 'ironman_mark50': {
      u.shotCount = (u.shotCount ?? 0) + 1;
      const isEnergyBeamReady = (u.shotCount >= 3) || usePow;
      if (isEnergyBeamReady) {
        if (!usePow) u.shotCount = 0;
        engine.queueProjectile(baseDelay, () => {
          sound.playPow();
          engine.spawnFloatingText(u.x, u.y - 48, '⚡ PHÁO NĂNG LƯỢNG MARK 50 (150% ST XUYÊN THẤU)!', '#ea580c', 1.3);
          engine.spawnBullet(u, u.aimAngleDeg, power, {
            spriteKey: 'lightning',
            effectKey: 'nuke',
            holeMask: 'h55x50.png',
            holeScale: 1.3,
            damage: u.attack * 1.5,
            blastRadius: 52,
            windScale: 0.05,
            special: 'ironman_beam',
            scale: 1.6,
          });
        });
      } else {
        engine.spawnFloatingText(u.x, u.y - 44, `⚡ PHÁO PLASMA (${u.shotCount}/2 PHÁT SẠC)`, '#38bdf8', 1.1);
        for (let i = 0; i < 4; i++) {
          engine.queueProjectile(baseDelay + i * 4, () => {
            sound.playShoot(false);
            engine.spawnBullet(u, u.aimAngleDeg, power, {
              spriteKey: 'lightning',
              effectKey: 'electric',
              holeMask: 'h36x30.png',
              holeScale: 0.95,
              damage: u.attack * 0.28,
              blastRadius: 32,
              windScale: 0.1,
              special: 'ironman_plasma',
              scale: 1.15,
            });
          });
        }
      }
      break;
    }

    case 'red_hulk_shockwave': {
      u.shotCount = (u.shotCount ?? 0) + 1;
      const isShockwaveReady = (u.shotCount >= 3) || usePow;
      if (isShockwaveReady) {
        if (!usePow) u.shotCount = 0;
        engine.queueProjectile(baseDelay, () => {
          sound.playPow();
          engine.spawnFloatingText(u.x, u.y - 48, '🌪️ CUỒNG PHONG XÉ GIÓ (150% ST VÙNG GIÓ)!', '#dc2626', 1.35);
          engine.spawnBullet(u, u.aimAngleDeg, power, {
            spriteKey: 'meteor',
            effectKey: 'nuke',
            holeMask: 'h55x50.png',
            holeScale: 1.35,
            damage: u.attack * 1.5,
            blastRadius: 65,
            windScale: 0,
            special: 'red_hulk_shockwave',
            scale: 1.8,
          });
        });
      } else {
        engine.queueProjectile(baseDelay, () => {
          sound.playShoot(true);
          engine.spawnFloatingText(u.x, u.y - 46, `HULK ĐỎ BẬT NHẢY (${u.shotCount}/2 PHÁT SẠC)!`, '#ef4444', 1.2);
          engine.spawnBullet(u, u.aimAngleDeg, power, {
            spriteKey: 'meteor',
            effectKey: 'bigExplosion',
            holeMask: 'h55x50.png',
            holeScale: 1.18,
            damage: u.attack * 0.95,
            blastRadius: 56,
            windScale: 0,
            special: 'hulk_leap',
            leapStartY: u.y,
          });
        });
      }
      break;
    }

    case 'stormbreaker_axe': {
      u.shotCount = (u.shotCount ?? 0) + 1;
      const isStormReady = (u.shotCount >= 3) || usePow;
      if (isStormReady && !usePow) u.shotCount = 0;
      engine.queueProjectile(baseDelay, () => {
        sound.playShoot(true);
        if (isStormReady) {
          engine.spawnFloatingText(u.x, u.y - 48, '⚡ BÃO SÉT STORMBREAKER (150% ST VÙNG RƠI)!', '#38bdf8', 1.3);
        }
        engine.spawnBullet(u, u.aimAngleDeg, power, {
          spriteKey: 'stormbreaker',
          effectKey: 'electric',
          holeMask: isStormReady ? 'h55x50.png' : 'h44x39.png',
          holeScale: isStormReady ? 1.3 : 1.15,
          damage: u.attack * (isStormReady ? 1.5 : 1.12),
          blastRadius: isStormReady ? 56 : 48,
          windScale: 0.45,
          // Theo web: phát thường chỉ là ném rìu, sét chỉ gọi quanh chỗ rìu rơi ở phát đặc biệt.
          special: isStormReady ? 'stormbreaker_axe' : undefined,
          scale: 1.15,
        });
      });
      break;
    }

    case 'doctor_strange': {
      u.shotCount = (u.shotCount ?? 0) + 1;
      const discs: Array<'green' | 'yellow'> = ['green', 'yellow'];
      discs.forEach((color, i) => {
        engine.queueProjectile(baseDelay + i * 8, () => {
          sound.playShoot(true);
          const isGreen = color === 'green';
          engine.spawnFloatingText(
            u.x,
            u.y - 44,
            isGreen ? '🟢 ĐĨA PHÉP XANH (BỎ 20% THỦ)' : '🟡 ĐĨA PHÉP VÀNG (-10% CÔNG ĐỊCH)',
            isGreen ? '#4ade80' : '#facc15',
            1.15
          );
          engine.spawnBullet(u, u.aimAngleDeg + (i === 0 ? -1.5 : 1.5), power, {
            spriteKey: 'special',
            effectKey: 'electric',
            holeMask: usePow ? 'h55x50.png' : 'h44x39.png',
            holeScale: usePow ? 1.25 : 1.05,
            damage: u.attack * (usePow ? 0.85 : 0.6) * (isGreen ? 1.2 : 1.0),
            blastRadius: 44,
            windScale: 0.35,
            special: 'doctor_strange_disc',
            strangeDiscColor: color,
            scale: 1.2,
          });
        });
      });
      break;
    }

    case 'winter_sniper_mark': {
      const sniperCount = usePow ? 3 : 1;
      for (let i = 0; i < sniperCount; i++) {
        engine.queueProjectile(baseDelay + i * 5, () => {
          sound.playShoot(false);
          engine.spawnFloatingText(u.x, u.y - 46, '🎯 ĐẠN XUYÊN ĐỊA HÌNH ĐÁNH DẤU!', '#64748b', 1.15);
          engine.spawnBullet(u, u.aimAngleDeg + (i - (sniperCount - 1) / 2) * 0.8, power, {
            spriteKey: 'ak',
            effectKey: 'explosion',
            holeMask: 'h36x30.png',
            holeScale: 0.95,
            damage: u.attack * (usePow ? 0.45 : 0.65),
            blastRadius: 36,
            windScale: 0.25,
            special: 'piercing_terrain',
          });
        });
      }
      break;
    }

    case 'hawkeye_tech': {
      u.shotCount = (u.shotCount ?? 0) + 1;
      const isAirstrikeReady = (u.shotCount >= 3) || usePow;
      if (isAirstrikeReady) {
        if (!usePow) u.shotCount = 0;
        engine.queueProjectile(baseDelay, () => {
          sound.playPow();
          engine.spawnFloatingText(u.x, u.y - 48, '✈️ PHI CƠ HỖ TRỢ CHIẾN ĐẤU CƠ (200% ST)!', '#a855f7', 1.35);
          engine.spawnBullet(u, u.aimAngleDeg, power, {
            spriteKey: 'muiten_cn',
            effectKey: 'nuke',
            holeMask: 'h55x50.png',
            holeScale: 1.35,
            damage: u.attack * 2.0,
            blastRadius: 62,
            windScale: 0.2,
            special: 'hawkeye_tech_airstrike',
            scale: 1.5,
          });
        });
      } else {
        engine.queueProjectile(baseDelay, () => {
          sound.playShoot(false);
          engine.spawnFloatingText(u.x, u.y - 44, `🏹 TÊN CÔNG NGHỆ (${u.shotCount}/2 PHÁT SẠC)`, '#a855f7', 1.1);
          engine.spawnBullet(u, u.aimAngleDeg, power, {
            spriteKey: 'muiten_cn',
            effectKey: 'bigExplosion',
            holeMask: 'h40x35.png',
            holeScale: 1.05,
            damage: u.attack * 1.05,
            blastRadius: 40,
            windScale: 0.3,
          });
        });
      }
      break;
    }

    case 'ultron_prime': {
      const mainCount = usePow ? 4 : 3;
      for (let i = 0; i < mainCount; i++) {
        engine.queueProjectile(baseDelay + i * 5, () => {
          sound.playShoot(true);
          engine.spawnBullet(u, u.aimAngleDeg + (i - (mainCount - 1) / 2) * 1.8, power, {
            spriteKey: 'lightning',
            effectKey: 'electric',
            holeMask: usePow ? 'h55x50.png' : 'h40x35.png',
            holeScale: usePow ? 1.3 : 1.05,
            damage: u.attack * (usePow ? 0.58 : 0.48),
            blastRadius: usePow ? 48 : 40,
            windScale: 0.3,
            special: 'electric',
          });
        });
      }
      break;
    }

    case 'vibranium_shield': {
      if (usePow) {
        // Kỹ năng POW của Captain America: Ném Khiên Khổng Lồ, bật nảy 3 lần và gây sát thương lớn!
        engine.queueProjectile(baseDelay, () => {
          sound.playPow();
          engine.spawnFloatingText(
            u.x,
            u.y - 48,
            '🛡️ KHIÊN VIBRANIUM KHỔNG LỒ (BẬT NẢY 3 LẦN)!',
            '#38bdf8',
            1.28
          );
          const baseDmg = Math.round(u.attack * 1.48);
          engine.spawnBullet(u, u.aimAngleDeg, power, {
            spriteKey: 'shield',
            effectKey: 'nuke',
            holeMask: 'h55x50.png',
            holeScale: 1.32,
            damage: baseDmg,
            baseDamage: baseDmg,
            blastRadius: 58,
            windScale: 0.4,
            special: 'shield_bounce',
            bounceCount: 0,
            maxBounces: 3,
            scale: 1.85,
          });
        });
      } else {
        // Bắn thường của Captain America: Khiên bật nảy 2 lần (nảy lần 1 +10% ST, lần 2 +20% ST)!
        engine.queueProjectile(baseDelay, () => {
          sound.playShoot(true);
          const baseDmg = Math.round(u.attack * 0.85);
          engine.spawnBullet(u, u.aimAngleDeg, power, {
            spriteKey: 'shield',
            effectKey: 'electric',
            holeMask: 'hrangcua.png',
            holeScale: 1.12,
            damage: baseDmg,
            baseDamage: baseDmg,
            blastRadius: 44,
            windScale: 0.5,
            special: 'shield_bounce',
            bounceCount: 0,
            maxBounces: 2,
            scale: 1.08,
          });
        });
      }
      break;
    }

    case 'mjolnir': {
      // Thor (theo mobiarmy3.me/nhan-vat): Sấm sét — Gọi sét đánh xuống, mỗi cột sét gây 150% sát thương.
      // Dùng được sau 2 phát bắn thường: 2 phát đầu ném búa thường, phát thứ 3 mới gọi sét.
      u.shotCount = (u.shotCount ?? 0) + 1;
      const isLightningReady = (u.shotCount >= 3) || usePow;
      if (isLightningReady && !usePow) u.shotCount = 0;
      const shots = usePow ? [-4, 0, 4] : [0];
      shots.forEach((da, i) => {
        engine.queueProjectile(baseDelay + i * 9, () => {
          sound.playShoot(true);
          if (isLightningReady && !usePow) {
            engine.spawnFloatingText(u.x, u.y - 48, '⚡ SẤM SÉT ASGARD (150% ST)!', '#38bdf8', 1.3);
          } else if (!usePow) {
            engine.spawnFloatingText(u.x, u.y - 44, `🔨 BÚA MJOLNIR (${u.shotCount}/2 PHÁT SẠC)`, '#38bdf8', 1.1);
          }
          engine.spawnBullet(u, u.aimAngleDeg + da, power, {
            spriteKey: 'stormbreaker',
            effectKey: 'electric',
            holeMask: usePow ? 'h55x50.png' : 'h44x39.png',
            holeScale: usePow ? 1.22 : 1.14,
            damage: u.attack * (usePow ? 0.7 : isLightningReady ? 1.5 : 1.0),
            blastRadius: 48,
            windScale: 0.45,
            special: isLightningReady ? 'sky_lightning' : undefined,
            // Phát sấm sét: sát thương 150% nằm ở viên đạn, cột sét chỉ còn là hiệu ứng hình ảnh.
            lightningScale: isLightningReady && !usePow ? 0 : undefined,
            scale: 1.1,
          });
        });
      });
      break;
    }

    case 'repulsor': {
      if (usePow) {
        // Tuyệt kỹ POW của Iron Man: Phóng loạt 6 tên lửa nhỏ Jericho bay tới vị trí địch, bị cản bởi địa hình
        sound.playPow();
        engine.spawnFloatingText(u.x, u.y - 48, '🔥 BÃO TÊN LỬA JERICHO MICRO!', '#f97316', 1.25);
        const missileCount = 6;
        for (let m = 0; m < missileCount; m++) {
          const spreadAngle = (m - (missileCount - 1) / 2) * 5.2;
          engine.queueProjectile(baseDelay + m * 5, () => {
            sound.playShoot(true);
            engine.spawnBullet(u, u.aimAngleDeg + spreadAngle, Math.max(50, power * 0.88), {
              spriteKey: 'rocket',
              effectKey: 'bigExplosion',
              holeMask: 'h36x30.png',
              holeScale: 0.9,
              damage: u.attack * 0.42,
              blastRadius: 36,
              special: 'homing',
              scale: 0.78,
            });
          });
        }
      } else {
        // Bắn thường: Chùm 4 tia Plasma thẳng hàng công phá cực mạnh (bị cản bởi địa hình)
        sound.playShoot(true);
        engine.spawnFloatingText(u.x, u.y - 46, '⚡ LIÊN HOÀN 4 PHÁO PLASMA!', '#38bdf8', 1.25);
        const plasmaCount = 4;
        for (let i = 0; i < plasmaCount; i++) {
          engine.queueProjectile(baseDelay + i * 4, () => {
            sound.playShoot(false);
            engine.spawnBullet(u, u.aimAngleDeg, power, {
              spriteKey: 'lightning',
              effectKey: 'electric',
              holeMask: 'h36x30.png',
              holeScale: 0.95,
              damage: u.attack * 0.28,
              blastRadius: 32,
              windScale: 0.1,
              special: 'ironman_plasma',
              scale: 1.15,
            });
          });
        }
      }
      break;
    }

    case 'hulk_leap':
    case 'hulk_smash': {
      // Hulk: Thay vì bắn súng, Hulk BẬT NHẢY trực tiếp tới đích và gây sát thương khi nhảy trúng mục tiêu! Không bị ảnh hưởng bởi gió!
      engine.queueProjectile(baseDelay, () => {
        sound.playShoot(true);
        engine.spawnFloatingText(u.x, u.y - 46, 'HULK BẬT NHẢY!!', '#ef4444', 1.25);
        engine.spawnBullet(u, u.aimAngleDeg, power, {
          spriteKey: 'meteor',
          effectKey: 'nuke',
          holeMask: 'h55x50.png',
          holeScale: usePow ? 1.38 : 1.18,
          damage: u.attack * (usePow ? 1.25 : 0.92),
          blastRadius: 56,
          windScale: 0,
          special: 'hulk_leap',
          leapStartY: u.y,
        });
      });
      break;
    }

    case 'hawkeye_bow': {
      // Hawk Eyes (theo mobiarmy3.me/nhan-vat): Khóa mục tiêu — Chọn một mục tiêu, bắn 4 mũi tên,
      // mỗi mũi gây 50% sát thương. Dùng được sau 3 phát bắn thường (phát thứ 4 là phát khóa mục tiêu,
      // 4 mũi tên tự lái theo địch gần nhất như cơ chế homing sẵn có).
      u.shotCount = (u.shotCount ?? 0) + 1;
      const isLockOnReady = !usePow && u.shotCount >= 4;
      if (isLockOnReady) {
        u.shotCount = 0;
        engine.spawnFloatingText(u.x, u.y - 48, '🎯 KHÓA MỤC TIÊU: 4 MŨI TÊN (50% ST)!', '#c084fc', 1.3);
        for (let i = 0; i < 4; i++) {
          engine.queueProjectile(baseDelay + i * 6, () => {
            sound.playShoot(false);
            engine.spawnBullet(u, u.aimAngleDeg + (i - 1.5) * 2.2, Math.max(60, power), {
              spriteKey: 'muiten',
              effectKey: 'explosion',
              holeMask: 'h36x30.png',
              holeScale: 0.95,
              damage: u.attack * 0.5,
              blastRadius: 36,
              windScale: 0,
              special: 'hawkeye_giant_homing',
              scale: 1.1,
            });
          });
        }
      } else {
        engine.queueProjectile(baseDelay, () => {
          sound.playShoot(usePow);
          if (!usePow) {
            engine.spawnFloatingText(u.x, u.y - 44, `🏹 TÊN ƯNG NHÃN (${u.shotCount}/3 PHÁT SẠC)`, '#c084fc', 1.05);
          }
          engine.spawnBullet(u, u.aimAngleDeg, power, {
            spriteKey: 'muiten',
            effectKey: usePow ? 'bigExplosion' : 'explosion',
            holeMask: usePow ? 'h55x50.png' : 'h36x30.png',
            holeScale: usePow ? 1.25 : 0.95,
            damage: u.attack * (usePow ? 1.75 : 1.0),
            blastRadius: usePow ? 48 : 36,
            windScale: 0.35,
          });
        });
      }
      break;
    }

    case 'ultron_beam': {
      // Ultron: Phóng chùm cầu năng lượng Plasma hủy diệt
      const mainCount = usePow ? 3 : 2;
      for (let i = 0; i < mainCount; i++) {
        engine.queueProjectile(baseDelay + i * 5, () => {
          sound.playShoot(true);
          engine.spawnBullet(u, u.aimAngleDeg + (i - (mainCount - 1) / 2) * 1.8, power, {
            spriteKey: 'lightning',
            effectKey: 'electric',
            holeMask: usePow ? 'h55x50.png' : 'h40x35.png',
            holeScale: usePow ? 1.25 : 1.0,
            damage: u.attack * (usePow ? 0.62 : 0.52),
            blastRadius: usePow ? 46 : 38,
            windScale: 0.3,
            special: 'electric',
          });
        });
      }
      break;
    }

    case 'winter_sniper':
    default: {
      // Winter Soldier: Đạn bắn tỉa siêu tốc kháng gió + Lựu đạn phân mảnh Bionic
      const sniperCount = usePow ? 3 : 1;
      for (let i = 0; i < sniperCount; i++) {
        engine.queueProjectile(baseDelay + i * 5, () => {
          sound.playShoot(false);
          engine.spawnBullet(u, u.aimAngleDeg + (i - (sniperCount - 1) / 2) * 0.8, power, {
            spriteKey: 'ak',
            effectKey: 'explosion',
            holeMask: 'h36x30.png',
            holeScale: 0.95,
            damage: u.attack * (usePow ? 0.38 : 0.55),
            blastRadius: 34,
            windScale: 0.25,
          });
        });
      }
      engine.queueProjectile(baseDelay + 10, () => {
        sound.playShoot(true);
        engine.spawnBullet(u, u.aimAngleDeg, power, {
          spriteKey: 'bomb',
          effectKey: 'bigExplosion',
          holeMask: 'h44x39.png',
          holeScale: 1.05,
          damage: u.attack * (usePow ? 0.58 : 0.52),
          blastRadius: 42,
          special: 'cluster',
          diggerCharges: usePow ? 3 : 2,
        });
      });
      break;
    }
  }
}
