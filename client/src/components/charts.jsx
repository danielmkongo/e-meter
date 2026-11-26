import { fmtNum } from '../lib/format.js';
const fmtRaw = (v) => (v == null ? '—' : fmtNum(v));

// Shared chart anatomy: recessive grid & axes, crosshair tooltip.
export const axisProps = {
  tick: { fill: 'var(--chart-tick)', fontSize: 11 },
  tickLine: false,
  axisLine: false,
};
export const gridProps = {
  stroke: 'var(--chart-grid)',
  strokeDasharray: '2 4',
  vertical: false,
};

export function ChartTooltip({ active, payload, label, labelFormat = v => v, valueFormat = v => v, unit = '', rawUnit, series = {} }) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter(p => p.value != null).sort((a, b) => b.value - a.value);
  return (
    <div className="min-w-[180px] rounded-2xl border border-line bg-surface/95 p-3 text-xs shadow-xl backdrop-blur">
      <div className="mb-2 font-medium text-muted num">{labelFormat(label)}</div>
      <div className="space-y-1.5">
        {rows.map(p => {
          const s = series[p.dataKey] || {};
          return (
            <div key={p.dataKey} className="flex items-center gap-2">
              <svg width="14" height="6" aria-hidden="true">
                <line x1="1" y1="3" x2="13" y2="3" stroke={s.color || p.color} strokeWidth="2.5" strokeDasharray={s.dash} strokeLinecap="round" />
              </svg>
              <span className="text-muted truncate">{s.label || p.name}{s.sub && <span className="text-faint"> · {s.sub}</span>}</span>
              {p.payload?.__raw ? (
                // normalised chart: show the real reading, with its scaled position faint
                <span className="ml-auto pl-3 font-medium text-ink num">
                  {fmtRaw(p.payload.__raw[p.dataKey])}<span className="text-faint"> {rawUnit}</span>
                  <span className="ml-2 text-faint">{Math.round(p.value)}%</span>
                </span>
              ) : (
                <span className="ml-auto pl-3 font-medium text-ink num">{valueFormat(p.value)}{unit && <span className="text-faint"> {unit}</span>}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
