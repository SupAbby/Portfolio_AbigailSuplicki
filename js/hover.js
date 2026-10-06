document.addEventListener('DOMContentLoaded', () => {
  const wrapper = document.getElementById('videoBox');
  if (!wrapper) return;

  /* ---------- Spotlight lens + particles ---------- */
  const MAX_RADIUS = 145;  // main lens radius (px)
  const FOLLOW = 0.22;     // how tightly the main lens trails the cursor
  const GROW = 0.18;       // how fast the main lens opens/closes

  // Each particle is a smaller circle on its own spring, so they trail, overshoot
  // and drift around the lens. angle = resting angle (deg), dist = resting distance
  // (x lens radius), size = radius (px), k = spring stiffness (lower = lazier),
  // damp = friction (closer to 1 = bouncier), spin = orbit speed (rad/s).
  const PARTICLES = [
    { angle: 160, dist: 1.65, size: 55, k: 0.018, damp: 0.88, spin:  0.12, grow: 0.06 },
    { angle:  68, dist: 1.03, size: 33, k: 0.030, damp: 0.86, spin: -0.22, grow: 0.10 },
    { angle: -46, dist: 1.10, size: 25, k: 0.040, damp: 0.84, spin:  0.30, grow: 0.12 },
    { angle:  85, dist: 1.33, size: 17, k: 0.024, damp: 0.87, spin: -0.35, grow: 0.09 },
    { angle: -28, dist: 1.31, size: 18, k: 0.034, damp: 0.85, spin:  0.26, grow: 0.11 },
    { angle: 200, dist: 1.20, size: 12, k: 0.050, damp: 0.83, spin: -0.45, grow: 0.14 },
    { angle:  20, dist: 1.48, size: 10, k: 0.022, damp: 0.88, spin:  0.40, grow: 0.08 },
  ];

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const particles = reduceMotion ? [] : PARTICLES.map((d, i) => ({
    ...d, angle: d.angle * Math.PI / 180, phase: i * 1.7,
    x: 0, y: 0, vx: 0, vy: 0, s: 0,
  }));

  let pointerX = 0, pointerY = 0, hasPointer = false;
  let x = 0, y = 0, r = 0;   // main lens (viewport x/y, radius)
  let lastTime = performance.now();
  let lastHole = '';

  window.addEventListener('pointermove', (e) => {
    pointerX = e.clientX;
    pointerY = e.clientY;
    hasPointer = true;
  }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => { hasPointer = false; });
  window.addEventListener('blur', () => { hasPointer = false; });

  function frame(now) {
    const dt = Math.min((now - lastTime) / 16.667, 3); // 1 = one 60fps frame
    lastTime = now;
    const t = now / 1000;

    const rect = wrapper.getBoundingClientRect();
    const visible = wrapper.style.opacity === '' || parseFloat(wrapper.style.opacity) > 0.05;
    const inside = visible && hasPointer &&
      pointerX >= rect.left && pointerX <= rect.right &&
      pointerY >= rect.top && pointerY <= rect.bottom;

    // Main lens: bursts open from the cursor, then trails it
    const opening = inside && r < 1;
    if (opening) {
      x = pointerX; y = pointerY;
      particles.forEach(p => { p.x = x; p.y = y; p.vx = p.vy = 0; });
    } else {
      const f = 1 - Math.pow(1 - FOLLOW, dt);
      x += (pointerX - x) * f;
      y += (pointerY - y) * f;
    }
    const target = inside ? MAX_RADIUS : 0;
    r += (target - r) * (1 - Math.pow(1 - GROW, dt));
    if (Math.abs(target - r) < 0.2) r = target;

    const circles = [];
    if (r > 0.5) circles.push([x - rect.left, y - rect.top, r]);

    // Particles: spring toward a slowly orbiting spot around the lens
    for (const p of particles) {
      const a = p.angle + t * p.spin;
      const d = (p.dist + 0.08 * Math.sin(t * 0.9 + p.phase)) * r;
      const tx = x + Math.cos(a) * d;
      const ty = y + Math.sin(a) * d;

      p.vx = (p.vx + (tx - p.x) * p.k * dt) * Math.pow(p.damp, dt);
      p.vy = (p.vy + (ty - p.y) * p.k * dt) * Math.pow(p.damp, dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      p.s += ((inside ? 1 : 0) - p.s) * (1 - Math.pow(1 - p.grow, dt));
      if (p.s < 0.01) p.s = 0;

      const pr = p.size * p.s * (1 + 0.1 * Math.sin(t * 2 + p.phase));
      if (pr > 0.5) circles.push([p.x - rect.left, p.y - rect.top, pr]);
    }

    // Every circle cuts a hole in the grey layer and the stripes
    let hole = 'linear-gradient(#000, #000)';
    if (circles.length) {
      const at = (c) => `circle at ${c[0].toFixed(1)}px ${c[1].toFixed(1)}px`;
      hole = circles.map(c =>
        `radial-gradient(${at(c)}, transparent ${(c[2] - 1).toFixed(1)}px, #000 ${c[2].toFixed(1)}px)`).join(',');
    }
    if (hole !== lastHole) { lastHole = hole; wrapper.style.setProperty('--lens-hole', hole); }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
});