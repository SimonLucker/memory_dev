import { useRef, useEffect } from 'react';

// Pure-decoration layer behind the graph: ~70 slow paper-colored dust motes + a few huge
// blurred nebula blobs. Own rAF, never interacts (pointer-events:none). See "Alive & depth"
// in graph-view/SKILL.md — nothing here cycles faster than ~8s.
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);

export default function DustField({ w, h }) {
  const ref = useRef(null);

  useEffect(() => {
    const ctx = ref.current.getContext('2d');
    // positions normalized 0..1 so resize is free; speeds are slow (full traversal ~1-4 min)
    const dust = Array.from({ length: 70 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: rand(0.5, 2),
      a: rand(0.05, 0.18),
      sp: rand(0.004, 0.012),   // upward-left drift, norm units/sec
      wob: rand(0, TAU),
      wsp: rand(0.1, 0.35),     // wobble ~18-63s period
      wamp: rand(0.004, 0.012),
    }));
    const blobs = [
      { x: 0.22, y: 0.78, r: 0.55, c: '245,214,188' }, // peach
      { x: 0.82, y: 0.24, r: 0.6, c: '199,155,203' },  // lavender
      { x: 0.6, y: 0.95, r: 0.45, c: '157,180,222' },  // dawn blue
    ];

    let raf;
    let last = performance.now();
    const draw = (now) => {
      const c = ref.current;
      const W = c.width;
      const H = c.height;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, W, H);

      for (const b of blobs) {
        const bx = b.x * W;
        const by = b.y * H;
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, b.r * Math.max(W, H));
        g.addColorStop(0, `rgba(${b.c},0.05)`);
        g.addColorStop(1, `rgba(${b.c},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }

      for (const d of dust) {
        d.y -= d.sp * dt;
        d.x -= d.sp * 0.6 * dt;
        d.wob += d.wsp * dt;
        if (d.y < -0.02) { d.y = 1.02; d.x = Math.random(); }
        if (d.x < -0.02) d.x = 1.02;
        ctx.beginPath();
        ctx.arc((d.x + Math.sin(d.wob) * d.wamp) * W, d.y * H, d.r, 0, TAU);
        ctx.fillStyle = `rgba(242,240,236,${d.a})`;
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={ref}
      width={w}
      height={h}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
}
