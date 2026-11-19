// Juice: particles (sparks, smoke, muzzle flashes, explosions), skid marks
// left by hard driving, floating score text, and the screen shake that sells
// a crash. All of it is drawn in world space except the shake, which offsets
// the camera.

export function createEffects() {
  return {
    particles: [],
    skids: [],
    floats: [],
    shake: 0,
  };
}

export function addShake(fx, amount) {
  fx.shake = Math.min(18, fx.shake + amount);
}

export function burst(fx, x, y, colour, count, speed, life, size) {
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.3 + Math.random() * 0.7);
    fx.particles.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: life * (0.6 + Math.random() * 0.6),
      maxLife: life,
      size: size * (0.6 + Math.random() * 0.8),
      colour,
      drag: 3,
    });
  }
}

export function sparks(fx, x, y, n) {
  burst(fx, x, y, '#ffd76a', n || 10, 260, 0.4, 3);
}

export function explosion(fx, x, y) {
  burst(fx, x, y, '#ff8c1a', 26, 340, 0.7, 6);
  burst(fx, x, y, '#ffd76a', 18, 220, 0.5, 4);
  burst(fx, x, y, '#555555', 14, 120, 1.4, 8);
  addShake(fx, 12);
}

export function muzzle(fx, x, y, angle) {
  const mx = x + Math.cos(angle) * 22;
  const my = y + Math.sin(angle) * 22;
  fx.particles.push({ x: mx, y: my, vx: Math.cos(angle) * 60, vy: Math.sin(angle) * 60, life: 0.06, maxLife: 0.06, size: 7, colour: '#ffe066', drag: 0 });
}

export function smokePuff(fx, x, y) {
  fx.particles.push({ x, y, vx: (Math.random() - 0.5) * 20, vy: -30 - Math.random() * 20, life: 0.9, maxLife: 0.9, size: 7 + Math.random() * 5, colour: '#777777', drag: 0.5 });
}

export function addSkid(fx, x, y, angle) {
  fx.skids.push({ x, y, angle, life: 6 });
  if (fx.skids.length > 400) fx.skids.splice(0, fx.skids.length - 400);
}

export function floatText(fx, x, y, text, colour) {
  fx.floats.push({ x, y, text, colour: colour || '#ffffff', life: 1.4 });
}

export function stepEffects(fx, dt) {
  for (let i = fx.particles.length - 1; i >= 0; i -= 1) {
    const p = fx.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      fx.particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx -= p.vx * p.drag * dt;
    p.vy -= p.vy * p.drag * dt;
  }
  for (let i = fx.skids.length - 1; i >= 0; i -= 1) {
    fx.skids[i].life -= dt;
    if (fx.skids[i].life <= 0) fx.skids.splice(i, 1);
  }
  for (let i = fx.floats.length - 1; i >= 0; i -= 1) {
    const f = fx.floats[i];
    f.life -= dt;
    f.y -= 26 * dt;
    if (f.life <= 0) fx.floats.splice(i, 1);
  }
  fx.shake = Math.max(0, fx.shake - 30 * dt);
}

/** The camera offset from shake this frame (call once per frame). */
export function shakeOffset(fx) {
  if (fx.shake <= 0.2) return { x: 0, y: 0 };
  return {
    x: (Math.random() * 2 - 1) * fx.shake,
    y: (Math.random() * 2 - 1) * fx.shake,
  };
}

export function drawSkids(ctx, fx) {
  ctx.save();
  for (const s of fx.skids) {
    ctx.globalAlpha = Math.min(0.5, s.life / 6 * 0.5);
    ctx.fillStyle = '#111111';
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    ctx.fillRect(-7, -2, 14, 4);
    ctx.restore();
  }
  ctx.restore();
}

export function drawParticles(ctx, fx) {
  ctx.save();
  for (const p of fx.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.colour;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawFloats(ctx, fx) {
  ctx.save();
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const f of fx.floats) {
    ctx.globalAlpha = Math.min(1, f.life);
    ctx.fillStyle = f.colour;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 3;
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.restore();
}
