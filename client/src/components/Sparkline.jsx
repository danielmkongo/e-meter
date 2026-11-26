import { useId, useMemo, useState } from 'react';
import { fmtClock } from '../lib/format.js';

// Lightweight inline area sparkline with a hover readout. Pure SVG.
export default function Sparkline({ data = [], valueKey = 'p', color, height = 44, format = v => v, unit = '' }) {
  const id = useId().replace(/:/g, '');
  const [hover, setHover] = useState(null);
  const W = 300;

  const geo = useMemo(() => {
    const pts = data.filter(d => d[valueKey] != null);
    if (pts.length < 2) return null;
    const t0 = pts[0].t, t1 = pts[pts.length - 1].t;
    const max = Math.max(...pts.map(d => d[valueKey]), 1e-9);
    const x = t => ((t - t0) / Math.max(1, t1 - t0)) * W;
    const y = v => height - 3 - (v / max) * (height - 8);
    const line = pts.map((d, i) => `${i ? 'L' : 'M'}${x(d.t).toFixed(1)},${y(d[valueKey]).toFixed(1)}`).join('');
    return { pts, x, y, line, area: `${line}L${W},${height}L0,${height}Z` };
  }, [data, valueKey, height]);

  if (!geo) return <div style={{ height }} className="grid place-items-center text-[11px] text-faint">Not enough data yet</div>;

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const fx = ((e.clientX - r.left) / r.width) * W;
    let best = geo.pts[0];
    for (const p of geo.pts) if (Math.abs(geo.x(p.t) - fx) < Math.abs(geo.x(best.t) - fx)) best = p;
    setHover(best);
  };

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="block w-full" style={{ height }}
           onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity=".32" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={geo.area} fill={`url(#${id})`} />
        <path d={geo.line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        {hover && <line x1={geo.x(hover.t)} x2={geo.x(hover.t)} y1="0" y2={height} stroke="currentColor" className="text-faint" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
      </svg>
      {hover && (
        <div className="pointer-events-none absolute -top-7 rounded-md bg-ink px-1.5 py-0.5 text-[10px] font-medium text-bg num whitespace-nowrap"
             style={{ left: `${(geo.x(hover.t) / W) * 100}%`, transform: 'translateX(-50%)' }}>
          {fmtClock(hover.t)} · {format(hover[valueKey])}{unit}
        </div>
      )}
    </div>
  );
}
