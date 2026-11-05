import { describe, expect, it } from 'vitest';
import { computeShotVelocity, PHYSICS, solveBotShot, type SolverFighterView } from './BotAI';
import type { Terrain } from './Terrain';

// Địa hình trống hoàn toàn (không pixel nào là đất) để test quỹ đạo bay thuần vật lý.
const emptyTerrain = {
  width: 1000,
  height: 800,
  waterY: 720,
  isSolid: () => false,
} as unknown as Terrain;

function makeFighter(
  partial: Partial<SolverFighterView> & Pick<SolverFighterView, 'id' | 'team' | 'x' | 'y'>
): SolverFighterView {
  return {
    hp: 100,
    maxHp: 100,
    alive: true,
    minAngle: -80,
    maxAngle: 90,
    unitKind: 'hero',
    windScale: 1,
    ...partial,
  };
}

// Mô phỏng quỹ đạo đạn đúng cách BattleEngine/BotAI tích phân từng bước:
// cộng vị trí trước, sau đó mới cộng gió vào vx và trọng lực vào vy.
function simulateMinDistanceToTarget(
  shooter: SolverFighterView,
  target: SolverFighterView,
  wind: number,
  decision: ReturnType<typeof solveBotShot>
): number {
  const startX =
    decision.moveTargetX + (decision.facingLeft ? -PHYSICS.MUZZLE_OFFSET_X : PHYSICS.MUZZLE_OFFSET_X);
  const startY = (decision.moveTargetY ?? shooter.y) + PHYSICS.MUZZLE_OFFSET_Y;
  let { vx, vy } = computeShotVelocity(decision.facingLeft, decision.aimAngleDeg, decision.power);
  let x = startX;
  let y = startY;
  let best = Infinity;
  for (let t = 0; t < 240; t++) {
    x += vx;
    y += vy;
    vx += wind * PHYSICS.WIND_FACTOR * shooter.windScale;
    vy += PHYSICS.GRAVITY;
    best = Math.min(best, Math.hypot(x - target.x, y - (target.y - 16)));
    if (y > emptyTerrain.waterY + 20) break;
  }
  return best;
}

describe('computeShotVelocity', () => {
  it('bắn ngang góc 0, lực tối đa, sang phải: vx = tốc độ tối đa, vy = 0', () => {
    const { vx, vy } = computeShotVelocity(false, 0, 100);
    expect(vx).toBeCloseTo(PHYSICS.MAX_POWER_SPEED, 6);
    expect(vy).toBeCloseTo(0, 6);
  });

  it('bắn thẳng đứng góc 90: vx ~ 0, vy hướng lên với tốc độ tối đa', () => {
    const { vx, vy } = computeShotVelocity(false, 90, 100);
    expect(vx).toBeCloseTo(0, 6);
    expect(vy).toBeCloseTo(-PHYSICS.MAX_POWER_SPEED, 6);
  });

  it('góc 45, lực 50: hai thành phần bằng nhau và tốc độ bằng nửa tối đa', () => {
    const { vx, vy } = computeShotVelocity(false, 45, 50);
    expect(vx).toBeCloseTo(-vy, 6);
    expect(Math.hypot(vx, vy)).toBeCloseTo(PHYSICS.MAX_POWER_SPEED * 0.5, 6);
  });

  it('quay sang trái chỉ đảo dấu vx, giữ nguyên vy', () => {
    const right = computeShotVelocity(false, 60, 70);
    const left = computeShotVelocity(true, 60, 70);
    expect(left.vx).toBeCloseTo(-right.vx, 6);
    expect(left.vy).toBeCloseTo(right.vy, 6);
  });

  it('lực bắn luôn được kẹp trong khoảng 5..100', () => {
    expect(computeShotVelocity(false, 30, 250)).toEqual(computeShotVelocity(false, 30, 100));
    expect(computeShotVelocity(false, 30, 0)).toEqual(computeShotVelocity(false, 30, 5));
  });

  it('hằng số vật lý phải dương và hợp lệ', () => {
    expect(PHYSICS.GRAVITY).toBeGreaterThan(0);
    expect(PHYSICS.WIND_FACTOR).toBeGreaterThan(0);
    expect(PHYSICS.MAX_POWER_SPEED).toBeGreaterThan(0);
  });
});

describe('solveBotShot', () => {
  it('không còn địch thì trả quyết định trung tính, không bắn POW/hồi máu/gấp đôi', () => {
    const shooter = makeFighter({ id: 'bot', team: 0, x: 300, y: 400 });
    const decision = solveBotShot(shooter, [shooter], emptyTerrain, 0, 'normal', false, false, false);
    expect(decision.aimAngleDeg).toBe(45);
    expect(decision.power).toBe(50);
    expect(decision.usePow).toBe(false);
    expect(decision.useHeal).toBe(false);
    expect(decision.useDouble).toBe(false);
  });

  it('tự quay mặt về phía địch', () => {
    const shooter = makeFighter({ id: 'bot', team: 0, x: 500, y: 400 });
    const leftEnemy = makeFighter({ id: 'e1', team: 1, x: 200, y: 400 });
    const rightEnemy = makeFighter({ id: 'e2', team: 1, x: 800, y: 400 });
    expect(solveBotShot(shooter, [shooter, leftEnemy], emptyTerrain, 0, 'normal', false, false, false).facingLeft).toBe(true);
    expect(solveBotShot(shooter, [shooter, rightEnemy], emptyTerrain, 0, 'normal', false, false, false).facingLeft).toBe(false);
  });

  it('góc và lực trả ra luôn nằm trong giới hạn cho phép ở mọi độ khó và gió', () => {
    const shooter = makeFighter({ id: 'bot', team: 0, x: 200, y: 400 });
    const enemy = makeFighter({ id: 'e1', team: 1, x: 550, y: 380 });
    for (const difficulty of ['easy', 'normal', 'hard'] as const) {
      for (const wind of [-35, 0, 35]) {
        const d = solveBotShot(shooter, [shooter, enemy], emptyTerrain, wind, difficulty, false, false, false);
        // minA = max(-40, minAngle) = -40, maxA = min(84, maxAngle) = 84 với fighter mẫu
        expect(d.aimAngleDeg).toBeGreaterThanOrEqual(-40);
        expect(d.aimAngleDeg).toBeLessThanOrEqual(84);
        expect(d.power).toBeGreaterThanOrEqual(12);
        expect(d.power).toBeLessThanOrEqual(100);
      }
    }
  });

  it('bot Khó bắn tới rất gần mục tiêu ở địa hình trống, không gió, cách 300px', () => {
    const shooter = makeFighter({ id: 'bot', team: 0, x: 200, y: 400 });
    const enemy = makeFighter({ id: 'e1', team: 1, x: 500, y: 400 });
    const decision = solveBotShot(shooter, [shooter, enemy], emptyTerrain, 0, 'hard', false, false, false);
    const minDist = simulateMinDistanceToTarget(shooter, enemy, 0, decision);
    expect(minDist).toBeLessThanOrEqual(25);
  });

  it('máu dưới 42% và còn lượt hồi máu thì bot chọn hồi máu; đầy máu thì không', () => {
    const enemy = makeFighter({ id: 'e1', team: 1, x: 600, y: 400 });
    const lowHp = makeFighter({ id: 'bot', team: 0, x: 200, y: 400, hp: 30, maxHp: 100 });
    const fullHp = makeFighter({ id: 'bot', team: 0, x: 200, y: 400, hp: 100, maxHp: 100 });
    expect(solveBotShot(lowHp, [lowHp, enemy], emptyTerrain, 0, 'normal', false, true, false).useHeal).toBe(true);
    expect(solveBotShot(fullHp, [fullHp, enemy], emptyTerrain, 0, 'normal', false, true, false).useHeal).toBe(false);
  });
});
