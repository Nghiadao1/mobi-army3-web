export const GRAVITY = 190;

export interface Vec2 { x: number; y: number; }

export function launchVelocity(angleDeg: number, power: number, facing: 1 | -1): Vec2 {
  const angle = Math.max(5, Math.min(175, angleDeg)) * Math.PI / 180;
  const speed = 155 + Math.max(0, Math.min(100, power)) * 4.7;
  return { x: Math.cos(angle) * speed * facing, y: -Math.sin(angle) * speed };
}

export function stepProjectile(position: Vec2, velocity: Vec2, wind: number, dt: number): { position: Vec2; velocity: Vec2 } {
  const nextVelocity = { x: velocity.x + wind * 10 * dt, y: velocity.y + GRAVITY * dt };
  return {
    position: { x: position.x + nextVelocity.x * dt, y: position.y + nextVelocity.y * dt },
    velocity: nextVelocity,
  };
}

export function blastDamage(base: number, distance: number, radius: number, armor = 0): number {
  if (distance >= radius) return 0;
  const falloff = 1 - distance / radius;
  return Math.max(1, Math.round(base * (0.28 + falloff * 0.72) * (100 / (100 + Math.max(0, armor)))));
}

export function solveShot(dx: number, dy: number, wind: number): { angle: number; power: number } {
  const distance = Math.abs(dx);
  const angle = Math.max(28, Math.min(78, 62 - dy * 0.035 + distance * 0.012));
  const power = Math.max(24, Math.min(96, distance / 8.3 - Math.sign(dx) * wind * 1.4));
  return { angle, power };
}
