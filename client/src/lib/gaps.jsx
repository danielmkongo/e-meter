import { ReferenceArea, ReferenceLine } from 'recharts';

// Periods with no readings. A gap is any jump between consecutive time slots
// longer than `factor` slots. Charts break the line there and mark it, rather
// than drawing a straight line through time nobody measured.
export function findGaps(points, bucketSec, factor = 3) {
  const out = [], limit = bucketSec * 1000 * factor;
  for (let i = 1; i < points.length; i++) {
    if (points[i].t - points[i - 1].t > limit) out.push({ a: points[i - 1].t, b: points[i].t });
  }
  return out;
}

// Insert an empty slot inside each gap so lines break there.
export function withGaps(points, gaps) {
  if (!gaps.length) return points;
  const starts = new Set(gaps.map(g => g.a));
  const out = [];
  for (const p of points) {
    out.push(p);
    if (starts.has(p.t)) out.push({ t: p.t + 1 });
  }
  return out;
}

export function fmtDuration(ms) {
  const m = Math.round(ms / 60e3);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  if (h < 24) return r ? `${h} h ${r} min` : `${h} h`;
  const d = Math.floor(h / 24), rh = h % 24;
  return rh ? `${d} d ${rh} h` : `${d} d`;
}

// Recharts only renders reference elements that are direct children of the
// chart, so this returns an array to spread inline: a faint band over each gap,
// a "No signal" label when the band is wide enough to hold it, and a dotted
// bridge for each series from the last reading before to the first after.
//   series: [{ key, color }]   valueAt(t, key) → y at that timestamp
export function gapMarks(gaps, { span, series = [], valueAt, label = true, idPrefix = 'gap' }) {
  const els = [];
  gaps.forEach((g, i) => {
    const wide = span > 0 && (g.b - g.a) / span > 0.07;
    els.push(
      <ReferenceArea key={`${idPrefix}-a${i}`} x1={g.a} x2={g.b} ifOverflow="hidden"
                     fill="rgb(var(--raised))" fillOpacity={0.55} stroke="none"
                     label={label && wide ? {
                       value: `No signal · ${fmtDuration(g.b - g.a)}`, position: 'insideTop', offset: 8,
                       fill: 'var(--chart-tick)', fontSize: 10, opacity: 0.85,
                     } : undefined} />,
    );
    for (const s of series) {
      const y1 = valueAt(g.a, s.key), y2 = valueAt(g.b, s.key);
      if (y1 == null || y2 == null) continue;
      els.push(
        <ReferenceLine key={`${idPrefix}-l${i}-${s.key}`} segment={[{ x: g.a, y: y1 }, { x: g.b, y: y2 }]}
                       stroke={s.color} strokeOpacity={0.55} strokeWidth={1.25} strokeDasharray="2 4" ifOverflow="hidden" />,
      );
    }
  });
  return els;
}
