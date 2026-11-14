// Vector-drawn redesigns for Iron Man, Loki and Doctor Strange.
// Drawn procedurally (canvas paths) in the same feet-origin, right-facing
// convention as CharacterRenderer.drawCompositeHero: the caller has
// already translated the context so (0, 0) is the feet point and the
// figure stands about 38-40 px tall. Pose semantics follow the Marvel
// pose map used by MarvelRender: 0/1 idle, 2-6 walk, 9 falling,
// 11-17 aim by elevation, 23-29 the matching shoot poses, 18-22 hurt/die.

export const REDESIGN_IDS = ['ironman', 'loki', 'doctor_strange'];

const AIM_DEG = { 11: 0, 12: 20, 13: 40, 14: 60, 15: 80, 16: -18, 17: -38 };

function poseParams(pose) {
  const p = {
    bob: 0, lean: 0, aimDeg: null, recoil: 0,
    legA: 0, legB: 0, armsUp: false, hurt: 0, dead: false,
  };
  if (pose === 1) {
    p.bob = 1;
  } else if (pose >= 2 && pose <= 6) {
    const t = ((pose - 2) / 5) * Math.PI * 2;
    p.legA = Math.sin(t) * 5;
    p.legB = Math.sin(t + Math.PI) * 5;
    p.bob = Math.abs(Math.cos(t));
  } else if (pose === 9) {
    p.legA = 5;
    p.legB = -5;
    p.armsUp = true;
  } else if (pose >= 11 && pose <= 17) {
    p.aimDeg = AIM_DEG[pose];
  } else if (pose >= 23 && pose <= 29) {
    p.aimDeg = AIM_DEG[pose - 12] ?? 0;
    p.recoil = 2;
  } else if (pose >= 18 && pose <= 22) {
    p.hurt = pose - 17;
    p.lean = -p.hurt * 3;
    p.bob = p.hurt;
    p.dead = pose === 22;
  }
  return p;
}

function limb(ctx, x1, y1, x2, y2, w, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function poly(ctx, points, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.fill();
}

function circle(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function outline(ctx, draw, color = 'rgba(15, 10, 5, 0.55)', w = 1) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  draw(true);
  ctx.restore();
}

// Shared skeleton: draws legs/torso/head base given a palette and a
// callback for hero-specific layers. Local coords: feet (0,0), up = -y.
function drawFigure(ctx, pose, pal, hooks) {
  const P = poseParams(pose);
  ctx.save();
  ctx.translate(0, -P.bob * 0.4);
  if (P.lean) {
    ctx.translate(0, -14);
    ctx.rotate((P.lean * Math.PI) / 180);
    ctx.translate(0, 14);
  }
  if (hooks.behind) hooks.behind(ctx, P);
  // Back arm (far side, darker).
  const backArmColor = pal.armDark;
  if (P.armsUp) limb(ctx, -2, -26, -8, -36, 3.4, backArmColor);
  else limb(ctx, -2, -26, -6, -16, 3.4, backArmColor);
  // Legs: hip at y=-15, feet at y=0 with walk offsets.
  limb(ctx, -1, -15, -2 + P.legB * 0.5, -7, 4.2, pal.legDark);
  limb(ctx, -2 + P.legB * 0.5, -7, -2 + P.legB, -1, 3.6, pal.legDark);
  poly(ctx, [[-5 + P.legB, 0], [3 + P.legB, 0], [2 + P.legB, -2.4], [-3 + P.legB, -2.4]], pal.bootDark);
  limb(ctx, 1, -15, 2 + P.legA * 0.5, -7, 4.2, pal.leg);
  limb(ctx, 2 + P.legA * 0.5, -7, 2 + P.legA, -1, 3.6, pal.leg);
  poly(ctx, [[-1 + P.legA, 0], [7 + P.legA, 0], [6 + P.legA, -2.4], [1 + P.legA, -2.4]], pal.boot);
  // Torso.
  if (hooks.torso) hooks.torso(ctx, P);
  // Head.
  if (hooks.head) hooks.head(ctx, P);
  // Weapon arm (near side) + weapon.
  const shoulder = [3, -26];
  if (hooks.weaponArm) hooks.weaponArm(ctx, P, shoulder);
  ctx.restore();
  return P;
}

function aimHand(P, shoulder, len = 10) {
  if (P.aimDeg === null) return null;
  const rad = (-P.aimDeg * Math.PI) / 180;
  return [
    shoulder[0] + Math.cos(rad) * len - P.recoil,
    shoulder[1] + Math.sin(rad) * len,
  ];
}

// ---------------------------------------------------------------- Iron Man
function drawIronman(ctx, pose) {
  const pal = {
    leg: '#b91c1c', legDark: '#7f1d1d', boot: '#f59e0b', bootDark: '#b45309',
    armDark: '#92400e',
  };
  drawFigure(ctx, pose, pal, {
    torso(ctx2) {
      poly(ctx2, [[-6, -14], [6, -14], [7, -29], [-7, -29]], '#b91c1c');
      poly(ctx2, [[-6, -14], [6, -14], [6.4, -21], [-6.4, -21]], '#991b1b');
      poly(ctx2, [[-3.4, -29], [3.4, -29], [2.2, -24], [-2.2, -24]], '#f59e0b');
      ctx2.save();
      ctx2.shadowColor = '#22d3ee';
      ctx2.shadowBlur = 7;
      circle(ctx2, 0, -20.5, 2.6, '#a5f3fc');
      ctx2.restore();
      circle(ctx2, 0, -20.5, 1.4, '#ecfeff');
    },
    head(ctx2, P) {
      circle(ctx2, 1, -34, 6.2, '#b91c1c');
      poly(ctx2, [[-3.4, -38.6], [5.4, -38.6], [6, -33], [4.4, -29.8], [-2, -29.8], [-3.8, -33]], '#fbbf24');
      ctx2.fillStyle = P.dead ? '#7f1d1d' : '#e0faff';
      if (P.dead) {
        ctx2.fillRect(-2.4, -35.4, 3, 1.4);
        ctx2.fillRect(2.4, -35.4, 3, 1.4);
      } else {
        ctx2.fillRect(-2.6, -35.2, 3.1, 1.5);
        ctx2.fillRect(2.2, -35.2, 3.1, 1.5);
      }
      ctx2.fillStyle = '#92400e';
      ctx2.fillRect(-0.6, -31.6, 3.4, 1.1);
    },
    weaponArm(ctx2, P, shoulder) {
      const hand = aimHand(P, shoulder);
      if (hand) {
        limb(ctx2, shoulder[0], shoulder[1], hand[0], hand[1], 3.8, '#f59e0b');
        ctx2.save();
        ctx2.shadowColor = '#22d3ee';
        ctx2.shadowBlur = P.recoil ? 12 : 6;
        circle(ctx2, hand[0] + 1.5, hand[1], P.recoil ? 3 : 2, '#a5f3fc');
        ctx2.restore();
      } else if (P.armsUp) {
        limb(ctx2, shoulder[0], shoulder[1], 9, -36, 3.8, '#f59e0b');
        circle(ctx2, 10, -37, 1.8, '#a5f3fc');
      } else {
        limb(ctx2, shoulder[0], shoulder[1], 7, -16, 3.8, '#f59e0b');
        circle(ctx2, 7.5, -15, 1.8, '#a5f3fc');
      }
    },
  });
}

// -------------------------------------------------------------------- Loki
function drawLoki(ctx, pose) {
  const pal = {
    leg: '#14532d', legDark: '#052e16', boot: '#eab308', bootDark: '#a16207',
    armDark: '#14532d',
  };
  drawFigure(ctx, pose, pal, {
    behind(ctx2) {
      // Long green cape flowing behind.
      poly(ctx2, [[-4, -28], [-11, -20], [-12, -2], [-6, 0], [-3, -12]], '#166534');
      poly(ctx2, [[-4, -28], [-9, -18], [-9, -4], [-6, 0], [-3, -12]], '#15803d');
    },
    torso(ctx2) {
      poly(ctx2, [[-6, -14], [6, -14], [7, -29], [-7, -29]], '#14532d');
      poly(ctx2, [[-7, -29], [7, -29], [6.6, -24], [-6.6, -24]], '#052e16');
      ctx2.strokeStyle = '#eab308';
      ctx2.lineWidth = 1.4;
      ctx2.beginPath();
      ctx2.moveTo(-6.4, -27.5);
      ctx2.lineTo(5, -19);
      ctx2.moveTo(6.4, -27.5);
      ctx2.lineTo(-5, -19);
      ctx2.stroke();
      poly(ctx2, [[-6, -16.4], [6, -16.4], [6, -14], [-6, -14]], '#eab308');
    },
    head(ctx2, P) {
      circle(ctx2, 1, -33.4, 5.6, '#f2c9a0');
      // Hair at the back.
      poly(ctx2, [[-4.4, -37], [-4.8, -28], [-1.5, -28.6], [-2.6, -36]], '#1f2937');
      // Horned helmet: gold band + two long curved horns.
      ctx2.strokeStyle = '#eab308';
      ctx2.lineCap = 'round';
      ctx2.lineWidth = 2.6;
      ctx2.beginPath();
      ctx2.moveTo(-3.4, -37.6);
      ctx2.quadraticCurveTo(-10, -44, -13.5, -40.5);
      ctx2.stroke();
      ctx2.beginPath();
      ctx2.moveTo(5, -37.8);
      ctx2.quadraticCurveTo(10.5, -45.5, 15.5, -43.5);
      ctx2.stroke();
      ctx2.lineWidth = 2.2;
      ctx2.beginPath();
      ctx2.moveTo(-4.2, -36.8);
      ctx2.quadraticCurveTo(1, -39.4, 6.2, -36.8);
      ctx2.stroke();
      circle(ctx2, 1, -37.6, 1.4, '#eab308');
      ctx2.fillStyle = '#111827';
      if (P.dead) {
        ctx2.fillRect(-1.8, -34.4, 2.6, 1.2);
        ctx2.fillRect(2.6, -34.4, 2.6, 1.2);
      } else {
        ctx2.fillRect(-1.9, -34.3, 2.2, 1.3);
        ctx2.fillRect(2.5, -34.3, 2.2, 1.3);
      }
    },
    weaponArm(ctx2, P, shoulder) {
      const hand = aimHand(P, shoulder, 9);
      const drawScepter = (hx, hy, ang) => {
        ctx2.save();
        ctx2.translate(hx, hy);
        ctx2.rotate(ang);
        ctx2.strokeStyle = '#eab308';
        ctx2.lineWidth = 1.8;
        ctx2.beginPath();
        ctx2.moveTo(-7, 0);
        ctx2.lineTo(8, 0);
        ctx2.stroke();
        ctx2.restore();
        ctx2.save();
        ctx2.shadowColor = '#38bdf8';
        ctx2.shadowBlur = 7;
        circle(ctx2, hx + Math.cos(ang) * 9, hy + Math.sin(ang) * 9, 2.1, '#7dd3fc');
        ctx2.restore();
      };
      if (hand) {
        limb(ctx2, shoulder[0], shoulder[1], hand[0], hand[1], 3.6, '#166534');
        drawScepter(hand[0], hand[1], (-(P.aimDeg ?? 0) * Math.PI) / 180);
      } else {
        limb(ctx2, shoulder[0], shoulder[1], 7, -17, 3.6, '#166534');
        drawScepter(7, -16, -0.5);
      }
    },
  });
}

// ----------------------------------------------------------- Doctor Strange
function drawStrange(ctx, pose) {
  const pal = {
    leg: '#1e3a8a', legDark: '#172554', boot: '#7f1d1d', bootDark: '#450a0a',
    armDark: '#1e3a8a',
  };
  drawFigure(ctx, pose, pal, {
    behind(ctx2) {
      // Red cloak flowing behind + high collar peaks.
      poly(ctx2, [[-4, -28], [-11, -18], [-12, -1], [-5, 0.6], [-2.5, -13]], '#991b1b');
      poly(ctx2, [[-4, -28], [-9, -16], [-9, -3], [-5, 0.6], [-2.5, -13]], '#dc2626');
      poly(ctx2, [[-5.5, -29], [-7.5, -38], [-3.4, -33.5]], '#dc2626');
      poly(ctx2, [[6.5, -29.5], [9.5, -37], [4.6, -33.8]], '#dc2626');
    },
    torso(ctx2) {
      poly(ctx2, [[-6, -14], [6, -14], [7, -29], [-7, -29]], '#1e40af');
      poly(ctx2, [[-6.8, -23], [6.8, -23], [6.4, -19.5], [-6.4, -19.5]], '#f59e0b');
      poly(ctx2, [[-6, -16.2], [6, -16.2], [6, -14], [-6, -14]], '#92400e');
      // Eye of Agamotto.
      ctx2.save();
      ctx2.shadowColor = '#4ade80';
      ctx2.shadowBlur = 5;
      circle(ctx2, 0.5, -26.4, 2.3, '#f59e0b');
      ctx2.restore();
      circle(ctx2, 0.5, -26.4, 1.1, '#22c55e');
    },
    head(ctx2, P) {
      circle(ctx2, 1, -33.6, 5.7, '#f2c9a0');
      // Hair with grey temple streaks + goatee.
      poly(ctx2, [[-4.2, -35.5], [-3.4, -39.2], [2, -39.8], [6, -37.6], [6.4, -34.6], [3.4, -37.4], [-1, -37.8]], '#374151');
      ctx2.fillStyle = '#d1d5db';
      ctx2.fillRect(-3.9, -36.4, 1.5, 2.6);
      ctx2.fillRect(5.2, -36.2, 1.4, 2.4);
      ctx2.fillStyle = '#374151';
      ctx2.fillRect(-0.4, -29.9, 2.8, 1.8);
      ctx2.fillStyle = '#111827';
      if (P.dead) {
        ctx2.fillRect(-1.8, -34.6, 2.6, 1.2);
        ctx2.fillRect(2.6, -34.6, 2.6, 1.2);
      } else {
        ctx2.fillRect(-1.9, -34.5, 2.2, 1.3);
        ctx2.fillRect(2.5, -34.5, 2.2, 1.3);
      }
    },
    weaponArm(ctx2, P, shoulder) {
      const hand = aimHand(P, shoulder, 9);
      const mandala = (hx, hy, r) => {
        ctx2.save();
        ctx2.translate(hx, hy);
        ctx2.shadowColor = '#fb923c';
        ctx2.shadowBlur = 8;
        ctx2.strokeStyle = '#f97316';
        ctx2.lineWidth = 1.6;
        ctx2.beginPath();
        ctx2.arc(0, 0, r, 0, Math.PI * 2);
        ctx2.stroke();
        ctx2.strokeStyle = '#fdba74';
        ctx2.lineWidth = 1;
        ctx2.beginPath();
        ctx2.arc(0, 0, r * 0.62, 0, Math.PI * 2);
        ctx2.stroke();
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3 + 0.4;
          ctx2.beginPath();
          ctx2.moveTo(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62);
          ctx2.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          ctx2.stroke();
        }
        ctx2.restore();
      };
      if (hand) {
        limb(ctx2, shoulder[0], shoulder[1], hand[0], hand[1], 3.6, '#1e40af');
        mandala(hand[0] + 3.5, hand[1], P.recoil ? 7 : 5.4);
      } else if (P.armsUp) {
        limb(ctx2, shoulder[0], shoulder[1], 9, -35, 3.6, '#1e40af');
        mandala(11, -36, 5);
      } else {
        limb(ctx2, shoulder[0], shoulder[1], 6.5, -17.5, 3.6, '#1e40af');
        mandala(8.5, -16.5, 4.4);
      }
    },
  });
}

const DRAWERS = {
  ironman: drawIronman,
  loki: drawLoki,
  doctor_strange: drawStrange,
};

export function drawVectorHero(ctx, heroId, pose) {
  const draw = DRAWERS[heroId];
  if (draw) draw(ctx, pose);
}
