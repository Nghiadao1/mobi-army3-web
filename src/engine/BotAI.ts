import { BotDifficulty, UnitKind } from '../types';
import { Terrain } from './Terrain';

export const PHYSICS = {
  GRAVITY: 0.215,
  WIND_FACTOR: 0.0029,
  MAX_POWER_SPEED: 14.8,
  MUZZLE_OFFSET_X: 14,
  MUZZLE_OFFSET_Y: -20,
};

export interface SolverFighterView {
  id: string;
  team: 0 | 1;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  minAngle: number;
  maxAngle: number;
  unitKind: UnitKind;
  windScale: number;
}

export interface BotDecision {
  moveTargetX: number;
  moveTargetY?: number;
  facingLeft: boolean;
  aimAngleDeg: number;
  power: number;
  usePow: boolean;
  useHeal: boolean;
  useDouble: boolean;
}

export function computeShotVelocity(
  facingLeft: boolean,
  aimAngleDeg: number,
  power: number
): { vx: number; vy: number } {
  const rad = (aimAngleDeg * Math.PI) / 180;
  const speed = (Math.max(5, Math.min(100, power)) / 100) * PHYSICS.MAX_POWER_SPEED;
  const dir = facingLeft ? -1 : 1;
  return {
    vx: Math.cos(rad) * speed * dir,
    vy: -Math.sin(rad) * speed,
  };
}

export function solveBotShot(
  shooter: SolverFighterView,
  allUnits: SolverFighterView[],
  terrain: Terrain,
  wind: number,
  difficulty: BotDifficulty,
  powReady: boolean,
  canHeal: boolean,
  canDouble: boolean
): BotDecision {
  const enemies = allUnits.filter((u) => u.alive && u.team !== shooter.team);
  const allies = allUnits.filter((u) => u.alive && u.team === shooter.team && u.id !== shooter.id);

  if (enemies.length === 0) {
    return {
      moveTargetX: shooter.x,
      facingLeft: true,
      aimAngleDeg: 45,
      power: 50,
      usePow: false,
      useHeal: false,
      useDouble: false,
    };
  }

  // Chọn mục tiêu ưu tiên (gần + thấp máu)
  enemies.sort((a, b) => {
    const scoreA = Math.hypot(a.x - shooter.x, a.y - shooter.y) * 0.65 + (a.hp / a.maxHp) * 220;
    const scoreB = Math.hypot(b.x - shooter.x, b.y - shooter.y) * 0.65 + (b.hp / b.maxHp) * 220;
    return scoreA - scoreB;
  });
  const target = enemies[0];

  // Quyết định di chuyển nhẹ trước khi bắn
  let moveTargetX = shooter.x;
  let moveTargetY: number | undefined = undefined;
  const isFlying = shooter.unitKind !== 'hero';
  if (isFlying) {
    const shiftX = (Math.random() - 0.5) * 90;
    moveTargetX = Math.max(70, Math.min(terrain.width - 70, shooter.x + shiftX));
    moveTargetY = Math.max(85, Math.min(terrain.waterY - 140, shooter.y + (Math.random() - 0.5) * 40));
  } else {
    const step = (Math.random() - 0.45) * 34;
    const candidateX = Math.max(36, Math.min(terrain.width - 36, shooter.x + step));
    moveTargetX = candidateX;
  }

  const facingLeft = target.x < moveTargetX;
  const startX = moveTargetX + (facingLeft ? -PHYSICS.MUZZLE_OFFSET_X : PHYSICS.MUZZLE_OFFSET_X);
  const startY = (moveTargetY ?? shooter.y) + PHYSICS.MUZZLE_OFFSET_Y;
  const targetCenterY = target.y - 16;

  let bestAngle = 45;
  let bestPower = 60;
  let bestScore = Infinity;

  const minA = isFlying ? -65 : Math.max(-40, shooter.minAngle);
  const maxA = isFlying ? 65 : Math.min(84, shooter.maxAngle);
  const angleStep = difficulty === 'hard' ? 3 : 5;
  const powerStep = difficulty === 'hard' ? 3 : 5;

  for (let angle = minA; angle <= maxA; angle += angleStep) {
    for (let power = 18; power <= 98; power += powerStep) {
      const { vx: ivx, vy: ivy } = computeShotVelocity(facingLeft, angle, power);
      let x = startX;
      let y = startY;
      let vx = ivx;
      let vy = ivy;

      let impactX = x;
      let impactY = y;
      let hitSelfOrAlly = false;

      for (let t = 0; t < 240; t++) {
        x += vx;
        y += vy;
        vx += wind * PHYSICS.WIND_FACTOR * shooter.windScale;
        vy += PHYSICS.GRAVITY;

        if (x < -40 || x > terrain.width + 40 || y > terrain.waterY + 20) {
          impactX = x;
          impactY = y;
          break;
        }

        // Kiểm tra chạm mục tiêu trực tiếp
        if (Math.hypot(x - target.x, y - targetCenterY) <= 18) {
          impactX = x;
          impactY = y;
          break;
        }

        // Tránh bắn trúng đồng đội hoặc ngay dưới chân mình
        if (t > 5) {
          if (Math.hypot(x - moveTargetX, y - (shooter.y - 15)) < 26) {
            hitSelfOrAlly = true;
            break;
          }
          for (const al of allies) {
            if (Math.hypot(x - al.x, y - (al.y - 16)) < 28) {
              hitSelfOrAlly = true;
              break;
            }
          }
          if (hitSelfOrAlly) break;
        }

        if (terrain.isSolid(x, y)) {
          impactX = x;
          impactY = y;
          break;
        }
      }

      if (hitSelfOrAlly) continue;

      const dist = Math.hypot(impactX - target.x, impactY - targetCenterY);
      // Ưu tiên nhẹ góc bắn cầu vồng đẹp mắt (35..70 độ)
      const arcBonus = angle >= 30 && angle <= 72 ? 0 : 4;
      const score = dist + arcBonus;

      if (score < bestScore) {
        bestScore = score;
        bestAngle = angle;
        bestPower = power;
      }
    }
  }

  // Tinh chỉnh cục bộ quanh nghiệm tốt nhất cho Bot Khó / Thường
  if (difficulty !== 'easy') {
    const baseA = bestAngle;
    const baseP = bestPower;
    for (let da = -3; da <= 3; da += 1) {
      for (let dp = -3; dp <= 3; dp += 1) {
        const a = Math.max(minA, Math.min(maxA, baseA + da));
        const p = Math.max(12, Math.min(100, baseP + dp));
        const { vx: ivx, vy: ivy } = computeShotVelocity(facingLeft, a, p);
        let x = startX;
        let y = startY;
        let vx = ivx;
        let vy = ivy;
        for (let t = 0; t < 240; t++) {
          x += vx;
          y += vy;
          vx += wind * PHYSICS.WIND_FACTOR * shooter.windScale;
          vy += PHYSICS.GRAVITY;
          if (
            Math.hypot(x - target.x, y - targetCenterY) <= 14 ||
            terrain.isSolid(x, y) ||
            x < -40 ||
            x > terrain.width + 40 ||
            y > terrain.waterY + 20
          ) {
            break;
          }
        }
        const dist = Math.hypot(x - target.x, y - targetCenterY);
        if (dist < bestScore) {
          bestScore = dist;
          bestAngle = a;
          bestPower = p;
        }
      }
    }
  }

  // Độ lệch nhân văn theo cấp độ khó
  const errCfg =
    difficulty === 'easy'
      ? { angleErr: 4.5, powerErr: 8.5 }
      : difficulty === 'normal'
      ? { angleErr: 2.0, powerErr: 4.0 }
      : { angleErr: 0.65, powerErr: 1.4 };

  const finalAngle = Math.round(
    Math.max(minA, Math.min(maxA, bestAngle + (Math.random() * 2 - 1) * errCfg.angleErr))
  );
  const finalPower = Math.max(
    12,
    Math.min(100, bestPower + (Math.random() * 2 - 1) * errCfg.powerErr)
  );

  const goodShot = bestScore < 42;
  const useHeal = canHeal && shooter.hp < shooter.maxHp * 0.42;
  const usePow = powReady && (goodShot || shooter.unitKind !== 'hero');
  const useDouble = !usePow && !useHeal && canDouble && goodShot && difficulty !== 'easy' && Math.random() < 0.45;

  return {
    moveTargetX,
    moveTargetY,
    facingLeft,
    aimAngleDeg: finalAngle,
    power: finalPower,
    usePow,
    useHeal,
    useDouble,
  };
}

