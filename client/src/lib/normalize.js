// One normalisation, off by default: each series is scaled to 0–100 % of its
// own range over the visible period, so lines with different units or sizes
// can be compared by shape. Tooltips keep showing the real values.
export function normalize(points, keys, on) {
  if (!on) return points;
  const st = {};
  for (const k of keys) {
    let min = Infinity, max = -Infinity;
    for (const p of points) { const v = p[k]; if (v != null) { if (v < min) min = v; if (v > max) max = v; } }
    if (min !== Infinity) st[k] = { min, max };
  }
  return points.map(p => {
    const o = { t: p.t };
    for (const k of keys) {
      const v = p[k], s = st[k];
      o[k] = v == null || !s ? null : s.max === s.min ? 50 : ((v - s.min) / (s.max - s.min)) * 100;
    }
    return o;
  });
}
