import { useRef, useEffect } from 'react';

// Pure-decoration layer behind the graph: two dust layers (far/near) + a few huge blurred
// nebula blobs. Own rAF, never interacts (pointer-events:none). See "Alive & depth" and
// "Parallax (Phase 2)" in graph-view/SKILL.md — nothing here cycles faster than ~8s.
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);

// mote factory — layers differ only in size/alpha/speed ranges (near = bigger/faster/brighter)
const makeDust = (n, rR, aR, spR, wampR) =>
  Array.from({ length: n }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: rand(...rR),
    a: rand(...aR),
    sp: rand(...spR),      // upward-left drift, norm units/sec
    wob: rand(0, TAU),
    wsp: rand(0.1, 0.35),  // wobble ~18-63s period
    wamp: rand(...wampR),
  }));

export default function DustField({ w, h, mouse }) {
  const ref = useRef(null);

  useEffect(() => {
    const ctx = ref.current.getContext('2d');
    // far layer: smaller, slower, fainter — reads as depth behind the near layer.
    const far = makeDust(35, [0.4, 1.1], [0.03, 0.09], [0.002, 0.006], [0.003, 0.008]);
    const near = makeDust(35, [1, 2.2], [0.08, 0.18], [0.006, 0.014], [0.006, 0.014]);
    const blobs = [
      { x: 0.22, y: 0.78, r: 0.55, c: '245,214,188' }, // peach
      { x: 0.82, y: 0.24, r: 0.6, c: '199,155,203' },  // lavender
      { x: 0.6, y: 0.95, r: 0.45, c: '157,180,222' },  // dawn blue
    ];

    let raf;
    let last = performance.now();

    const drawLayer = (layer, W, H, dt, dx, dy) => {
      for (const d of layer) {
        d.y -= d.sp * dt;
        d.x -= d.sp * 0.6 * dt;
        d.wob += d.wsp * dt;
        if (d.y < -0.02) { d.y = 1.02; d.x = Math.random(); }
        if (d.x < -0.02) d.x = 1.02;
        ctx.beginPath();
        ctx.arc((d.x + Math.sin(d.wob) * d.wamp) * W + dx, d.y * H + dy, d.r, 0, TAU);
        ctx.fillStyle = `rgba(242,240,236,${d.a})`;
        ctx.fill();
      }
    };

    const draw = (now) => {
      const c = ref.current;
      const W = c.width;
      const H = c.height;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, W, H);

      // Same smoothed mouse vector (normalized [-0.5,0.5]) the graph parallax uses; per-layer
      // screen amplitude: nebula 4px < far 9px < near 18px (near reacts most → depth).
      const m = (mouse && mouse.current) || { x: 0, y: 0 };

      const nbx = m.x * 4;
      const nby = m.y * 4;
      for (const b of blobs) {
        const bx = b.x * W + nbx;
        const by = b.y * H + nby;
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, b.r * Math.max(W, H));
        g.addColorStop(0, `rgba(${b.c},0.05)`);
        g.addColorStop(1, `rgba(${b.c},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }

      drawLayer(far, W, H, dt, m.x * 9, m.y * 9);
      drawLayer(near, W, H, dt, m.x * 18, m.y * 18);

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [mouse]);

  return (
    <canvas
      ref={ref}
      width={w}
      height={h}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
}
