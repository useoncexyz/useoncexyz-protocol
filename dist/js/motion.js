// Motion: damped-spring reveals, parallax depth, scroll progress, spotlight. All of it yields to reduced motion.
export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Damped harmonic oscillator, semi-implicit Euler at a fixed step.
export function spring(onFrame, { k = 170, c = 22, m = 1, delay = 0, done } = {}) {
  let x = 0, v = 0, last = 0, started = false;
  const step = 1 / 240;
  const begin = performance.now() + delay;
  function tick(now) {
    if (now < begin) return requestAnimationFrame(tick);
    if (!started) { started = true; last = now; }
    let dt = Math.min((now - last) / 1000, 0.05); last = now;
    while (dt > 0) {
      const h = Math.min(step, dt);
      const a = (-k * (x - 1) - c * v) / m;
      v += a * h; x += v * h; dt -= h;
    }
    onFrame(x);
    if (Math.abs(x - 1) < 0.001 && Math.abs(v) < 0.01) { onFrame(1); if (done) done(); return; }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

export function reveal() {
  const els = [...document.querySelectorAll('[data-reveal]')];
  if (reduced || !('IntersectionObserver' in window)) { els.forEach((e) => { e.style.opacity = 1; e.style.transform = 'none'; }); return; }
  els.forEach((e) => { e.style.opacity = 0; e.style.transform = 'translateY(28px)'; });
  const io = new IntersectionObserver((entries) => {
    entries.filter((e) => e.isIntersecting).forEach((en, i) => {
      const el = en.target; io.unobserve(el);
      const idx = Number(el.dataset.revealIndex ?? i);
      spring((p) => { el.style.opacity = Math.min(1, Math.max(0, p)); el.style.transform = `translateY(${(1 - p) * 28}px)`; },
        { delay: idx * 70, done: () => { el.style.transform = 'none'; el.style.opacity = 1; } });
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  els.forEach((e) => io.observe(e));
}

export function parallax(root) {
  const layers = [...root.querySelectorAll('[data-depth]')];
  if (reduced || !layers.length) return;
  let px = 0, py = 0, tx = 0, ty = 0, sy = 0, ts = 0;
  root.addEventListener('pointermove', (e) => {
    const r = root.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
  });
  root.addEventListener('pointerleave', () => { tx = 0; ty = 0; });
  addEventListener('scroll', () => { ts = Math.min(scrollY, 900); }, { passive: true });
  (function loop() {
    px += (tx - px) * 0.08; py += (ty - py) * 0.08; sy += (ts - sy) * 0.1;
    for (const l of layers) {
      const d = Number(l.dataset.depth);
      l.style.transform = `translate3d(${px * d * 18}px, ${py * d * 14 - sy * d * 0.12}px, 0)`;
    }
    requestAnimationFrame(loop);
  })();
}

export function progress(bar) {
  const set = () => {
    const h = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${h > 0 ? Math.min(1, scrollY / h) : 0})`;
  };
  addEventListener('scroll', set, { passive: true }); addEventListener('resize', set); set();
}

export function spotlight(root = document) {
  root.addEventListener('pointermove', (e) => {
    const t = e.target.closest && e.target.closest('[data-spot]');
    if (!t) return;
    const r = t.getBoundingClientRect();
    t.style.setProperty('--mx', e.clientX - r.left + 'px');
    t.style.setProperty('--my', e.clientY - r.top + 'px');
  });
}

// Count-up from the previous value to the next; the cell flashes when the value moved.
export function countTo(el, from, to, fmt, flash = true) {
  if (to === null || to === undefined) { el.textContent = '—'; return; }
  if (reduced || from === to) { el.textContent = fmt(to); return; }
  const start = from ?? 0;
  const t0 = performance.now(), dur = 700;
  if (flash && from !== null && from !== undefined) {
    el.classList.remove('flash-up', 'flash-down'); void el.offsetWidth;
    el.classList.add(to > from ? 'flash-up' : 'flash-down');
    el.classList.remove('rolled'); el.classList.add('rolled');
  }
  (function f(now) {
    const p = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(start + (to - start) * e);
    if (p < 1) requestAnimationFrame(f); else el.textContent = fmt(to);
  })(t0);
}
