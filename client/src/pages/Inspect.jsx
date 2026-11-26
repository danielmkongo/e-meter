import { useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ComposedChart, LineChart, ScatterChart, Line, Area, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useTheme } from '../ThemeContext.jsx';
import { useApi, usePref } from '../lib/useApi.js';
import { material, materialColor } from '../lib/materials.js';
import { fmtNum, fmtClock, fmtDayTime, ago, fmtPower, EAT_OFFSET_MIN } from '../lib/format.js';
import { stableRange, qs } from '../lib/range.js';
import { normalize } from '../lib/normalize.js';
import { findGaps, withGaps, gapMarks } from '../lib/gaps.jsx';
import { axisProps, gridProps } from '../components/charts.jsx';
import {
  Icon, PageHeader, CardTitle, Segmented, RangePicker, Toggle, Legend, Empty, Spinner, LoadingVeil, MaterialSwatch,
} from '../components/ui.jsx';

// Parameters own their colour on this page (colour follows the parameter, never
// its position). Validated categorical order — see the dataviz palette check.
const PARAMS = [
  { key: 'power',       label: 'Power',       unit: 'W',   d: 1, light: '#2a78d6', dark: '#3987e5' },
  { key: 'rpm',         label: 'Rotor speed', unit: 'rpm', d: 0, light: '#eb6834', dark: '#d95926' },
  { key: 'wind',        label: 'Wind (site)', unit: 'm/s', d: 1, light: '#1baf7a', dark: '#199e70' },
  { key: 'voltage',     label: 'Voltage',     unit: 'V',   d: 1, light: '#eda100', dark: '#c98500' },
  { key: 'current',     label: 'Current',     unit: 'A',   d: 2, light: '#e87ba4', dark: '#d55181' },
  { key: 'frequency',   label: 'Frequency',   unit: 'Hz',  d: 1, light: '#008300', dark: '#0ca30c' },
  { key: 'temperature', label: 'Temperature', unit: '°C',  d: 1, light: '#6250d6', dark: '#9085e9' },
  { key: 'humidity',    label: 'Humidity',    unit: '%',   d: 0, light: '#e34948', dark: '#e66767' },
];
const P = Object.fromEntries(PARAMS.map(p => [p.key, p]));
const color = (k, isDark) => (isDark ? P[k].dark : P[k].light);


// Axis ticks: drop decimals once numbers are big enough not to need them.
const tick = (d) => (v) => fmtNum(v, Math.abs(v) >= 100 ? 0 : d);

// ── Device picker ─────────────────────────────────────────────────────────────
// A flat tab strip: one column per device, live output on each, an underline
// marks the one being inspected.
function DevicePicker({ turbines, fleet, value, onChange, isDark }) {
  const live = Object.fromEntries((fleet?.turbines || []).map(t => [t.id, t]));
  const items = [
    ...(turbines || []).map(t => ({
      id: t.id, label: t.name, sub: material(t.blade).label, accent: materialColor(t.blade, isDark), blade: t.blade,
      online: live[t.id]?.online, power: live[t.id]?.online ? live[t.id]?.latest?.power : null,
    })),
    { id: 'load', label: 'Household load', sub: 'Consumption meter', accent: 'rgb(var(--ink))',
      online: !!fleet?.consumption?.latest, power: fleet?.consumption?.latest?.power },
  ];
  return (
    <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="flex min-w-max border border-line/80 bg-surface sm:min-w-0 rounded-md overflow-hidden" role="tablist" aria-label="Device">
        {items.map((it, i) => {
          const on = it.id === value;
          const p = fmtPower(it.power);
          return (
            <button key={it.id} type="button" role="tab" aria-selected={on} onClick={() => onChange(it.id)}
                    className={`relative flex min-w-[190px] flex-1 items-center gap-3 px-4 py-3 text-left transition ${
                      i ? 'border-l border-line/80' : ''} ${on ? 'bg-ink' : 'bg-surface hover:bg-raised/60'}`}>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: it.id === 'load' ? (on ? 'rgb(var(--bg))' : 'rgb(var(--muted))') : it.accent }} />
                  <span className={`truncate text-[13px] font-semibold ${on ? 'text-bg' : 'text-ink'}`}>{it.label}</span>
                  {it.id !== 'load' && <span className={`font-mono text-[10px] ${on ? 'text-bg/60' : 'text-faint'}`}>{it.id}</span>}
                </span>
                <span className={`mt-0.5 block truncate pl-4 text-[11px] ${on ? 'text-bg/70' : 'text-muted'}`}>{it.sub}</span>
              </span>
              <span className="text-right leading-tight">
                <span className={`block num text-sm font-medium ${on ? 'text-bg' : 'text-ink'}`}>{p.value}<span className={`ml-0.5 text-[10px] ${on ? 'text-bg/60' : 'text-muted'}`}>{p.unit}</span></span>
                <span className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${on ? 'text-bg/60' : 'text-faint'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${it.online ? 'bg-good' : 'bg-faint'}`} />{it.online ? 'live' : 'offline'}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Parameter tile: live value + stats, and the toggle for the charts ────────
function ParamTile({ p, stat, on, onToggle, isDark }) {
  const c = color(p.key, isDark);
  return (
    <button type="button" aria-pressed={on} onClick={onToggle}
            className={`group relative overflow-hidden rounded-2xl border p-3.5 text-left transition active:scale-[.98] ${
              on ? 'border-ink bg-surface' : 'border-line/70 bg-surface/40 hover:border-line hover:bg-surface'}`}>
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full transition" style={{ background: c, opacity: on ? 1 : 0.35 }} />
        <span className="truncate text-[11px] font-medium uppercase tracking-wider text-muted">{p.label}</span>
        <span className={`ml-auto grid h-4 w-4 shrink-0 place-items-center rounded-md transition ${
          on ? 'text-white' : 'border border-line text-transparent group-hover:border-muted'}`} style={on ? { background: c } : undefined}>
          <Icon name="check" className="h-3 w-3" strokeWidth={2.4} />
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="num text-xl font-medium text-ink">{fmtNum(stat?.last, p.d)}</span>
        <span className="text-xs text-muted">{p.unit}</span>
      </div>
      <div className="mt-1 truncate num text-[11px] text-faint">
        avg {fmtNum(stat?.avg, p.d)} · {fmtNum(stat?.min, p.d)}–{fmtNum(stat?.max, p.d)}
      </div>
    </button>
  );
}

// ── Tooltips ──────────────────────────────────────────────────────────────────
function StackTip({ active, payload, k }) {
  if (!active || !payload?.length) return null;
  const pt = payload[0].payload, p = P[k], band = pt[k + '_band'];
  return (
    <div className="rounded-xl border border-line bg-surface/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <div className="num text-muted">{fmtDayTime(pt.t)}</div>
      <div className="mt-0.5 num font-medium text-ink">{fmtNum(pt[k], p.d)} <span className="text-faint">{p.unit}</span></div>
      {band && band[0] !== band[1] && <div className="num text-[11px] text-faint">range {fmtNum(band[0], p.d)}–{fmtNum(band[1], p.d)}</div>}
    </div>
  );
}

function OverlayTip({ active, payload, keys, isDark, norm, hour }) {
  if (!active || !payload?.length) return null;
  const pt = payload[0].payload;
  return (
    <div className="min-w-[200px] rounded-2xl border border-line bg-surface/95 p-3 text-xs shadow-xl backdrop-blur">
      <div className="mb-2 num font-medium text-muted">{hour ? `${String(pt.t).padStart(2, '0')}:00 – ${String(pt.t).padStart(2, '0')}:59 (avg)` : fmtDayTime(pt.t)}</div>
      <div className="space-y-1.5">
        {keys.map(k => (
          <div key={k} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: color(k, isDark) }} />
            <span className="text-muted">{P[k].label}</span>
            <span className="ml-auto pl-3 num font-medium text-ink">
              {fmtNum(pt.raw?.[k], P[k].d)} <span className="text-faint">{P[k].unit}</span>
            </span>
            {norm && <span className="w-10 text-right num text-faint">{fmtNum(pt[k], 0)}%</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Views ─────────────────────────────────────────────────────────────────────
function StackedView({ data, keys, isDark, multiDay }) {
  const gaps = useMemo(() => findGaps(data.points, data.bucket), [data]);
  const pts = useMemo(() => withGaps(data.points, gaps), [data, gaps]);
  const byT = useMemo(() => new Map(data.points.map(p => [p.t, p])), [data]);
  const span = data.points.length ? data.points.at(-1).t - data.points[0].t : 0;
  return (
    <div className="divide-y divide-line/60">
      {keys.map((k, i) => {
        const p = P[k], c = color(k, isDark), s = data.stats[k];
        const last = i === keys.length - 1;
        return (
          <div key={k} className="py-4 first:pt-0 last:pb-0">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
                <span className="text-[13px] font-semibold text-ink">{p.label}</span>
                <span className="text-xs text-faint">{p.unit}</span>
              </div>
              <div className="flex gap-4 num text-[11px] text-muted">
                <span>min <span className="text-ink">{fmtNum(s?.min, p.d)}</span></span>
                <span>avg <span className="text-ink">{fmtNum(s?.avg, p.d)}</span></span>
                <span>max <span className="text-ink">{fmtNum(s?.max, p.d)}</span></span>
                <span className="hidden sm:inline">σ <span className="text-ink">{fmtNum(s?.sd, p.d)}</span></span>
              </div>
            </div>
            <div className={last ? 'h-[168px]' : 'h-[140px]'}>
              <ResponsiveContainer>
                <ComposedChart data={pts} syncId="inspect" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} hide={!last}
                         tickFormatter={multiDay ? fmtDayTime : fmtClock} minTickGap={56} {...axisProps} />
                  <YAxis {...axisProps} width={48} domain={['auto', 'auto']} tickCount={4} tickFormatter={tick(p.d)} />
                  <Tooltip content={<StackTip k={k} />} cursor={{ stroke: 'var(--chart-tick)', strokeDasharray: '3 3' }} />
                  {gapMarks(gaps, { span, series: [{ key: k, color: c }], valueAt: (t, key) => byT.get(t)?.[key], label: i === 0, idPrefix: k })}
                  <Area dataKey={k + '_band'} stroke="none" fill={c} fillOpacity={isDark ? 0.16 : 0.12}
                        animationDuration={700} animationEasing="ease-out" tooltipType="none" activeDot={false} />
                  <Line dataKey={k} stroke={c} strokeWidth={2} dot={false} animationDuration={700} animationEasing="ease-out"
                        activeDot={{ r: 4, strokeWidth: 2, stroke: 'rgb(var(--surface))' }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}
      <p className="pt-4 text-[11px] text-faint">Line = average per time slot · shaded band = lowest to highest reading in that slot. Hover any chart to read all of them at the same moment. Shaded gaps with a dotted line are periods with no readings.</p>
    </div>
  );
}

function OverlayView({ data, keys, isDark, multiDay, norm, setNorm }) {
  const units = new Set(keys.map(k => P[k].unit));
  const mixed = units.size > 1;
  const gaps = useMemo(() => findGaps(data.points, data.bucket), [data]);
  const chartData = useMemo(() => {
    const src = withGaps(data.points, gaps);
    return normalize(src, keys, norm).map((p, i) => ({ ...p, raw: src[i] }));
  }, [data, gaps, keys.join(), norm]); // eslint-disable-line react-hooks/exhaustive-deps
  const byT = useMemo(() => new Map(chartData.map(p => [p.t, p])), [chartData]);
  const span = data.points.length ? data.points.at(-1).t - data.points[0].t : 0;
  const unit = norm ? '% of range' : mixed ? '' : [...units][0];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Toggle on={norm} onChange={setNorm} label="Normalise" title="Scale each line to 0–100 % of its own range to compare shapes" />
        <span className="text-[11px] text-faint">
          {norm ? 'Each line is scaled to its own range, so shapes line up. Hover for real values.'
            : mixed ? 'Different units share one scale here. Turn on Normalise to compare shapes.' : ''}
        </span>
      </div>
      <div className="h-[400px]">
        <ResponsiveContainer>
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']}
                   tickFormatter={multiDay ? fmtDayTime : fmtClock} minTickGap={56} {...axisProps} />
            <YAxis {...axisProps} width={52} tickFormatter={tick(1)}
                   label={unit ? { value: unit, angle: -90, position: 'insideLeft', fill: 'var(--chart-tick)', fontSize: 11, dx: 4 } : undefined} />
            <Tooltip content={<OverlayTip keys={keys} isDark={isDark} norm={norm} />} cursor={{ stroke: 'var(--chart-tick)', strokeDasharray: '3 3' }} />
            {gapMarks(gaps, { span, series: keys.map(k => ({ key: k, color: color(k, isDark) })), valueAt: (t, key) => byT.get(t)?.[key] })}
            {keys.map(k => (
              <Line key={k} dataKey={k} stroke={color(k, isDark)} strokeWidth={2} dot={false} animationDuration={700} animationEasing="ease-out"
                    activeDot={{ r: 4, strokeWidth: 2, stroke: 'rgb(var(--surface))' }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4">
        <Legend items={keys.map(k => ({ key: k, color: color(k, isDark), label: P[k].label, sub: P[k].unit }))} />
      </div>
    </div>
  );
}

// Average of each parameter by hour of the day (EAT): when does it peak?
function DailyView({ data, keys, isDark, norm, setNorm }) {
  const rows = useMemo(() => {
    const acc = Array.from({ length: 24 }, (_, h) => ({ h, sum: {}, n: {} }));
    for (const p of data.points) {
      const h = Math.floor(((p.t / 3600e3) + EAT_OFFSET_MIN / 60) % 24);
      for (const k of keys) if (p[k] != null) { acc[h].sum[k] = (acc[h].sum[k] || 0) + p[k]; acc[h].n[k] = (acc[h].n[k] || 0) + 1; }
    }
    const raw = acc.map(a => { const o = { t: a.h }; for (const k of keys) o[k] = a.n[k] ? a.sum[k] / a.n[k] : null; return o; });
    return normalize(raw, keys, norm).map((p, i) => ({ ...p, raw: raw[i] }));
  }, [data, keys.join(), norm]); // eslint-disable-line react-hooks/exhaustive-deps
  const units = new Set(keys.map(k => P[k].unit));
  const unit = norm ? '% of range' : units.size > 1 ? '' : [...units][0];
  const peaks = keys.map(k => {
    const best = rows.reduce((b, r) => (r.raw[k] != null && (b == null || r.raw[k] > b.raw[k]) ? r : b), null);
    return { k, h: best?.t };
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Toggle on={norm} onChange={setNorm} label="Normalise" title="Scale each line to 0–100 % of its own range" />
        <span className="text-[11px] text-faint">Average for each hour of the day (EAT) across the selected range.</span>
      </div>
      <div className="h-[340px]">
        <ResponsiveContainer>
          <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="t" type="number" domain={[0, 23]} ticks={[0, 3, 6, 9, 12, 15, 18, 21]} {...axisProps}
                   tickFormatter={h => `${String(h).padStart(2, '0')}:00`} />
            <YAxis {...axisProps} width={52} tickFormatter={tick(1)}
                   label={unit ? { value: unit, angle: -90, position: 'insideLeft', fill: 'var(--chart-tick)', fontSize: 11, dx: 4 } : undefined} />
            <Tooltip content={<OverlayTip keys={keys} isDark={isDark} norm={norm} hour />} cursor={{ stroke: 'var(--chart-tick)', strokeDasharray: '3 3' }} />
            {keys.map(k => (
              <Line key={k} dataKey={k} stroke={color(k, isDark)} strokeWidth={2} dot={{ r: 2.5, strokeWidth: 0, fill: color(k, isDark) }}
                    animationDuration={700} animationEasing="ease-out" connectNulls activeDot={{ r: 4, strokeWidth: 2, stroke: 'rgb(var(--surface))' }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted">
        {peaks.filter(p => p.h != null).map(p => (
          <span key={p.k} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: color(p.k, isDark) }} />
            {P[p.k].label} peaks around <span className="num text-ink">{String(p.h).padStart(2, '0')}:00</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function fit(pts) {
  const n = pts.length;
  if (n < 3) return null;
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (const { x, y } of pts) { sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; }
  const vx = n * sxx - sx * sx, vy = n * syy - sy * sy;
  if (vx <= 0 || vy <= 0) return null;
  const slope = (n * sxy - sx * sy) / vx;
  return { slope, icpt: (sy - slope * sx) / n, r: (n * sxy - sx * sy) / Math.sqrt(vx * vy), n };
}

function ParamSelect({ value, onChange, keys, isDark }) {
  return (
    <span className="relative inline-flex items-center">
      <span className="pointer-events-none absolute left-2.5 h-2 w-2 rounded-full" style={{ background: color(value, isDark) }} />
      <select className="input !w-auto !py-1.5 !pl-7 !text-sm font-medium" value={value} onChange={e => onChange(e.target.value)}>
        {keys.map(k => <option key={k} value={k}>{P[k].label}</option>)}
      </select>
    </span>
  );
}

// Scatter of one parameter against another. Each dot is a single reading, so it
// belongs to both parameters: dots stay neutral and each axis carries its
// parameter's colour. The verdict is written in plain words.
function CorrelateView({ data, isDark, xy, setXY }) {
  const keys = data.keys;
  const x = keys.includes(xy.x) ? xy.x : keys[0];
  const y = keys.includes(xy.y) && xy.y !== x ? xy.y : keys.find(k => k !== x);
  const pts = useMemo(() => data.samples.filter(s => s[x] != null && s[y] != null).map(s => ({ x: s[x], y: s[y], t: s.t })), [data, x, y]);
  const f = fit(pts);
  const xs = pts.map(p => p.x);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const a = f ? Math.abs(f.r) : 0;
  const level = !f ? 0 : a > 0.8 ? 4 : a > 0.6 ? 3 : a > 0.4 ? 2 : a > 0.2 ? 1 : 0;
  const word = ['No clear link', 'Weak link', 'Moderate link', 'Clear link', 'Strong link'][level];
  const lx = P[x].label.toLowerCase(), ly = P[y].label.toLowerCase();
  const sentence = !f || level === 0
    ? `${P[y].label} does not follow ${lx} in a simple way.`
    : `When ${lx} rises, ${ly} ${f.r > 0 ? 'rises' : 'falls'}${level >= 3 ? ' with it' : ', loosely'}.`;
  const suggestions = [['wind', 'power'], ['wind', 'rpm'], ['rpm', 'voltage'], ['rpm', 'power']]
    .filter(([a1, b1]) => keys.includes(a1) && keys.includes(b1) && !(a1 === x && b1 === y));
  const ink = isDark ? 'rgb(237 237 239)' : 'rgb(15 20 30)';

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2 text-sm text-muted">
        <span>How does</span>
        <ParamSelect value={y} keys={keys} isDark={isDark} onChange={v => setXY({ x: v === x ? y : x, y: v })} />
        <span>respond to</span>
        <ParamSelect value={x} keys={keys} isDark={isDark} onChange={v => setXY({ x: v, y: v === y ? x : y })} />
        <span>?</span>
        <button type="button" className="btn-ghost ml-1 !px-2.5 !py-1.5 !text-xs" onClick={() => setXY({ x: y, y: x })} title="Swap">⇄ Swap</button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <div className="h-[400px]">
          {pts.length ? (
            <ResponsiveContainer>
              <ScatterChart margin={{ top: 8, right: 12, left: 4, bottom: 16 }}>
                <CartesianGrid {...gridProps} vertical />
                <XAxis type="number" dataKey="x" domain={['auto', 'auto']} {...axisProps} tickFormatter={tick(P[x].d)}
                       label={{ value: `${P[x].label} (${P[x].unit}) →`, position: 'insideBottom', offset: -10, fill: color(x, isDark), fontSize: 12, fontWeight: 600 }} />
                <YAxis type="number" dataKey="y" domain={['auto', 'auto']} {...axisProps} width={56} tickFormatter={tick(P[y].d)}
                       label={{ value: `${P[y].label} (${P[y].unit}) →`, angle: -90, position: 'insideLeft', fill: color(y, isDark), fontSize: 12, fontWeight: 600, dx: 2, style: { textAnchor: 'middle' } }} />
                <Tooltip cursor={{ strokeDasharray: '3 3', stroke: 'var(--chart-tick)' }} content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload;
                  return (
                    <div className="rounded-md border border-line bg-surface/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
                      <div className="num text-muted">{fmtDayTime(p.t)}</div>
                      {[[x, p.x], [y, p.y]].map(([k, v]) => (
                        <div key={k} className="mt-0.5 flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ background: color(k, isDark) }} />
                          <span className="text-muted">{P[k].label}</span>
                          <span className="ml-auto pl-3 num text-ink">{fmtNum(v, P[k].d)} {P[k].unit}</span>
                        </div>
                      ))}
                    </div>
                  );
                }} />
                <Scatter data={pts} fill={ink} fillOpacity={isDark ? 0.3 : 0.22} shape="circle" isAnimationActive={false} />
                {f && <ReferenceLine segment={[{ x: x0, y: f.icpt + f.slope * x0 }, { x: x1, y: f.icpt + f.slope * x1 }]}
                                     stroke={color(y, isDark)} strokeWidth={2} strokeDasharray="6 4" ifOverflow="hidden" />}
              </ScatterChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </div>

        <div className="space-y-4 lg:border-l lg:border-line/60 lg:pl-6">
          <div>
            <div className="eyebrow !text-[10px]">Verdict</div>
            <div className="mt-1 text-xl font-semibold text-ink">{word}</div>
            <div className="mt-2 flex gap-1" aria-label={`${level} of 4`}>
              {[1, 2, 3, 4].map(i => <span key={i} className={`h-1.5 flex-1 rounded-sm ${i <= level ? 'bg-ink' : 'bg-raised'}`} />)}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink/80">{sentence}</p>
          </div>
          <p className="text-[11px] leading-relaxed text-faint">
            Each dot is one reading ({fmtNum(pts.length, 0)} shown); the dashed line is the overall trend.
            {f && ` Correlation r = ${fmtNum(f.r, 2)}.`}
            {x === 'wind' && ' Wind is the site sensor, matched to each reading by time.'}
            {x === 'wind' && y === 'power' && ' Power grows faster than wind, so the dots curve upward.'}
          </p>
          {suggestions.length > 0 && (
            <div>
              <div className="eyebrow !text-[10px] mb-1.5">Try</div>
              <div className="flex flex-col items-start gap-1">
                {suggestions.slice(0, 3).map(([sx, sy]) => (
                  <button key={sx + sy} type="button" onClick={() => setXY({ x: sx, y: sy })}
                          className="text-xs text-muted underline-offset-2 hover:text-ink hover:underline">
                    {P[sy].label} vs {P[sx].label.toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Inspect() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const { isDark } = useTheme();
  const { data: turbines } = useApi('/api/turbines');
  const { data: fleet } = useApi('/api/dashboard/fleet', { interval: 30_000 });
  const [lastDevice, setLastDevice] = usePref('inspect.device', null);
  const [range, setRange] = usePref('inspect.range', { preset: '24h' });
  const [sel, setSel] = usePref('inspect.params', ['power', 'wind', 'rpm']);
  const [view, setView] = usePref('inspect.view2', 'overlay');
  const [norm, setNorm] = usePref('inspect.normalise', false);
  const [xy, setXY] = usePref('inspect.xy', { x: 'wind', y: 'power' });

  const device = id || lastDevice || turbines?.[0]?.id || 'T1';
  const isLoad = device === 'load';
  useEffect(() => { if (id) setLastDevice(id); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Deep link from the Fleet panel: /inspect/T2?p=voltage adds that parameter.
  const deepParam = search.get('p');
  useEffect(() => {
    if (!deepParam || !P[deepParam]) return;
    setSel(s => (s.includes(deepParam) ? s : [...s, deepParam]));
    setView(v => (v === 'correlate' ? 'overlay' : v));
    setSearch({}, { replace: true });
  }, [deepParam]); // eslint-disable-line react-hooks/exhaustive-deps

  const r = stableRange(range);
  const url = '/api/dashboard/params' + qs(isLoad
    ? { source: 'consumption', from: r.from, to: r.to, points: 360 }
    : { turbine: device, from: r.from, to: r.to, points: 360 });
  const { data, loading, error } = useApi(url);

  const avail = data?.keys || (isLoad ? ['power', 'voltage', 'current'] : PARAMS.map(p => p.key));
  const active = PARAMS.map(p => p.key).filter(k => avail.includes(k) && sel.includes(k));
  const shown = active.length ? active : [avail[0]];
  const toggle = (k) => setSel(s => {
    const has = s.includes(k);
    if (has && shown.length === 1 && shown[0] === k) return s;   // keep one
    return has ? s.filter(x => x !== k) : [...s, k];
  });

  const t = turbines?.find(x => x.id === device);
  const title = isLoad ? 'Household load' : t?.name || device;
  const multiDay = r.from && (new Date(r.to) - new Date(r.from)) > 36 * 3600e3;
  const hasData = data && data.points.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Inspect · one device, every parameter" title={title}
                  sub={data ? `${fmtNum(data.count, 0)} readings in range${data.lastAt ? ` · last ${ago(data.lastAt)}` : ''}` : ' '}>
        <RangePicker range={range} onChange={setRange} />
      </PageHeader>

      <div className="animate-rise" style={{ animationDelay: '40ms' }}>
        <DevicePicker turbines={turbines} fleet={fleet} isDark={isDark} value={device} onChange={(d) => navigate(`/inspect/${d}`)} />
      </div>

      {error && !data ? (
        <div className="card"><Empty title="Couldn't load readings" sub={error.message} icon="info" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 2xl:grid-cols-8 animate-rise" style={{ animationDelay: '80ms' }}>
            {PARAMS.filter(p => avail.includes(p.key)).map(p => (
              <ParamTile key={p.key} p={p} stat={data?.stats?.[p.key]} on={shown.includes(p.key)}
                         onToggle={() => toggle(p.key)} isDark={isDark} />
            ))}
          </div>

          <section className="card card-pad relative animate-rise" style={{ animationDelay: '120ms' }}>
            <LoadingVeil show={loading && !!data} />
            <CardTitle
              title={{ overlay: 'All in one chart', stack: 'One chart each', daily: 'Daily pattern', correlate: 'Correlation' }[view] || ''}
              sub={view === 'correlate' ? 'How one parameter moves with another'
                : `${shown.length} parameter${shown.length > 1 ? 's' : ''} · tap the tiles above to add or remove`
                  + (data ? ` · ${data.bucket >= 3600 ? data.bucket / 3600 + ' h' : data.bucket / 60 + ' min'} slots` : '')}
              right={<Segmented value={view} onChange={setView} size="sm" options={[
                { value: 'overlay', label: 'Overlay' }, { value: 'stack', label: 'Stacked' }, { value: 'daily', label: 'Daily pattern' }, { value: 'correlate', label: 'Correlate' },
              ]} />} />
            {!data ? <div className="grid h-72 place-items-center"><Spinner /></div>
              : !hasData ? <Empty sub="Try a longer range, or check the device is reporting." />
              : view === 'stack' ? <StackedView data={data} keys={shown} isDark={isDark} multiDay={multiDay} />
              : view === 'overlay' ? <OverlayView data={data} keys={shown} isDark={isDark} multiDay={multiDay} norm={norm} setNorm={setNorm} />
              : view === 'daily' ? <DailyView data={data} keys={shown} isDark={isDark} norm={norm} setNorm={setNorm} />
              : <CorrelateView data={data} isDark={isDark} xy={xy} setXY={setXY} />}
          </section>
        </>
      )}
    </div>
  );
}
