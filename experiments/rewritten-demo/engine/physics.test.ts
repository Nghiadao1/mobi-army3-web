import { describe, expect, it } from 'vitest';
import { blastDamage, launchVelocity, solveShot, stepProjectile } from './physics';

describe('vật lý MobiArmy2 Web', () => {
  it('góc 45 độ bắn lên và về đúng hướng', () => {
    const right = launchVelocity(45, 50, 1);
    const left = launchVelocity(45, 50, -1);
    expect(right.x).toBeGreaterThan(0);
    expect(left.x).toBeLessThan(0);
    expect(right.y).toBeLessThan(0);
  });
  it('gió làm lệch vận tốc ngang và trọng lực kéo đạn xuống', () => {
    const next = stepProjectile({ x: 0, y: 0 }, { x: 100, y: -100 }, 5, 0.5);
    expect(next.velocity.x).toBeGreaterThan(100);
    expect(next.velocity.y).toBeGreaterThan(-100);
  });
  it('sát thương giảm theo khoảng cách và giáp', () => {
    expect(blastDamage(200, 0, 50)).toBeGreaterThan(blastDamage(200, 30, 50));
    expect(blastDamage(200, 0, 50, 30)).toBeLessThan(blastDamage(200, 0, 50));
    expect(blastDamage(200, 60, 50)).toBe(0);
  });
  it('AI luôn trả góc và lực hợp lệ', () => {
    for (const dx of [-900, -200, 200, 900]) for (const wind of [-8, 0, 8]) {
      const shot = solveShot(dx, 40, wind);
      expect(shot.angle).toBeGreaterThanOrEqual(28);
      expect(shot.power).toBeGreaterThanOrEqual(24);
      expect(shot.power).toBeLessThanOrEqual(96);
    }
  });
});
