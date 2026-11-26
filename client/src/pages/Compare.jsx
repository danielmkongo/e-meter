import { useMemo, useState } from 'react';
import {
  LineChart, Line, ComposedChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useTheme } from '../ThemeContext.jsx';
import { useApi, usePref } from '../lib/useApi.js';
import { seriesStyle, material, materialColor } from '../lib/materials.js';
import { fmtNum, fmtClock, fmtDayTime, fmtEnergy, joinVU } from '../lib/format.js';
import { stableRange, qs } from '../lib/range.js';
import { normalize } from '../lib/normalize.js';
import { findGaps, withGaps, gapMarks } from '../lib/gaps.jsx';
import { axisProps, gridProps, ChartTooltip } from '../components/charts.jsx';
import {
  Icon, PageHeader, CardTitle, Segmented, RangePicker, Toggle, Legend, Empty, Spinner, LoadingVeil, MaterialSwatch,
} from '../components/ui.jsx';

const METRICS = [
  { key: 'power',       label: 'Power',     unit: 'W' },
  { key: 'rpm',         label: 'RPM',       unit: 'rpm' },
  { key: 'voltage',     label: 'Voltage',   unit: 'V' },
  { key: 'current',     label: 'Current',   unit: 'A' },
  { key: 'frequency',   label: 'Frequency', unit: 'Hz' },
  { key: 'temperature', label: 'Temp',      unit: '°C' },
  { key: 'humidity',    label: 'Humidity',  unit: '%' },
];


// ── Scoreboard ────────────────────────────────────────────────────────────────
const SCORE_ROWS = [
  { key: 'kwh',        label: 'Energy produced', fmt: v => joinVU(fmtEnergy(v)), better: 'high' },
  { key: 'avgPower',   label: 'Average power',   fmt: v => `${fmtNum(v)} W`, better: 'high' },
  { key: 'peakPower',  label: 'Peak power',      fmt: v => `${fmtNum(v)} W`, better: 'high' },
  { key: 'efficiency', label: 'Capture index',   fmt: (v, max) => v == null ? '—' : fmtNum((v / max) * 100, 0), better: 'high', rel: true,
    hint: 'Power ÷ wind³ above 1.5 m/s, leader = 100. The fair, wind-independent comparison.' },
  { key: 'cutIn',      label: 'Cut-in wind',     fmt: v => v == null ? '—' : `${fmtNum(v, 1)} m/s`, better: 'low', hint: 'Lowest wind at which it produced power.' },
  { key: 'tsr',        label: 'Tip-speed ratio', fmt: v => v == null ? '—' : `${fmtNum(v, 2)} λ`, hint: 'Needs rotor diameter set on the Turbines page.' },
  { key: 'avgRpm',     label: 'Average RPM',     fmt: v => fmtNum(v, 0), better: 'high', hint: 'How fast the rotor turns on average. Same site wind for every turbine.' },
  { key: 'peakRpm',    label: 'Peak RPM',        fmt: v => fmtNum(v, 0), better: 'high' },
  { key: 'startWind',  label: 'Starts turning at', fmt: v => v == null ? '—' : `${fmtNum(v, 1)} m/s`, better: 'low', hint: 'Lowest site wind at which the rotor was spinning.' },
  { key: 'spinShare',  label: 'Time spinning',   fmt: v => v == null ? '—' : `${fmtNum(v * 100, 0)}%`, better: 'high', hint: 'Share of readings with the rotor turning.' },
  { key: 'coverage',   label: 'Data coverage',   fmt: v => v == null ? '—' : `${fmtNum(v * 100, 0)}%`, hint: 'Share of 10-minute slots with at least one reading.' },
];

function Scoreboard({ rows, style }) {
  if (!rows.length) return <Empty />;
  return (
    <div className="-mx-5 overflow-x-auto sm:-mx-6">
      <table className="w-full min-w-[560px] border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 bg-surface px-5 pb-3 text-left sm:px-6"><span className="eyebrow">Metric</span></th>
            {rows.map(r => {
              const s = style(r.group);
              return (
                <th key={r.group} className="px-4 pb-3 text-right font-normal">
                  <div className="inline-flex items-center gap-2">
                    <svg width="18" height="6" aria-hidden="true"><line x1="1" y1="3" x2="17" y2="3" stroke={s.color} strokeWidth="3" strokeDasharray={s.dash} strokeLinecap="round" /></svg>
                    <span className="text-[13px] font-semibold text-ink">{s.label}</span>
                  </div>
                  {s.sub && <div className="text-[11px] text-muted">{s.sub}</div>}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {SCORE_ROWS.map(m => {
            const vals = rows.map(r => r[m.key]).filter(v => v != null);
            const max = Math.max(...vals, 1e-12);
            const bestVal = m.better && vals.length > 1 ? (m.better === 'low' ? Math.min(...vals) : Math.max(...vals)) : null;
            return (
              <tr key={m.key} className="group">
                <td className="sticky left-0 border-t border-line/60 bg-surface px-5 py-3 sm:px-6">
                  <div className="text-[13px] text-ink/90">{m.label}</div>
                  {m.hint && <div className="hidden text-[11px] text-faint md:block">{m.hint}</div>}
                </td>
                {rows.map(r => {
                  const v = r[m.key];
                  const lead = bestVal != null && v === bestVal;
                  return (
                    <td key={r.group} className="border-t border-line/60 px-4 py-3 text-right">
                      <span className={`num inline-flex items-center gap-1.5 ${lead ? 'font-semibold text-ink' : 'text-ink/75'}`}>
                        {lead && <Icon name="crown" className="h-3.5 w-3.5 text-warn" />}
                        {m.fmt(v, max)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Compare() {
  const { isDark } = useTheme();
  const [range, setRange]   = usePref('compare.range', { preset: '24h' });
  const [group, setGroup]   = usePref('compare.group', 'blade');
  const [metricPref, setMetric] = usePref('compare.metric', 'power');
  const metric = METRICS.some(x => x.key === metricPref) ? metricPref : 'power';
  const [norm, setNorm]     = usePref('compare.normalise', false);
  const [curveY, setCurveY] = usePref('compare.curveY', 'power');
  const [hidden, setHidden] = useState([]);
  const [only, setOnly]     = usePref('compare.turbines', []);   // [] = every turbine

  const r = stableRange(range);
  const { data: turbines } = useApi('/api/turbines');
  const picked = only.filter(id => turbines?.some(t => t.id === id));
  const base = { group, from: r.from, to: r.to, turbines: picked };

  const { data: summary, loading: lSum } = useApi('/api/dashboard/summary' + qs(base));
  const { data: series, loading: lSer } = useApi('/api/dashboard/series' + qs({ ...base, metric, points: 400 }));
  const { data: curve, loading: lCurve } = useApi('/api/dashboard/power-curve' + qs(base));

  // Every series says where its data came from: a blade group lists the
  // turbines whose readings were stamped with that material in this range.
  const nameOf = (id) => turbines?.find(t => t.id === id)?.name || id;
  const members = Object.fromEntries((summary?.rows || []).map(x => [x.group, x.members || []]));
  const style = (k) => {
    const s = seriesStyle(k, { group, turbines: turbines || [], isDark });
    if (group === 'blade') {
      const m = members[k];
      return { ...s, sub: m?.length ? m.map(nameOf).join(' + ') : undefined };
    }
    return { ...s, sub: `${k} · ${s.sub}` };
  };
  const togglePick = (id) => {
    const all = (turbines || []).map(t => t.id);
    const cur = picked.length ? picked : all;
    const next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id];
    setOnly(!next.length || next.length === all.length ? [] : next);
    setHidden([]);
  };
  const groups = series?.groups || [];
  const visible = groups.filter(g => !hidden.includes(g));
  const m = METRICS.find(x => x.key === metric) || METRICS[0];
  const unit = norm ? '% of range' : m.unit;
  const multiDay = r.from && (new Date(r.to) - new Date(r.from)) > 36 * 3600e3;

  const chartData = useMemo(
    () => {
      if (!series) return [];
      const n = normalize(series.points, groups, norm).map((p, i) => (norm ? { ...p, __raw: series.points[i] } : p));
      return withGaps(n, findGaps(series.points, series.bucket));
    },
    [series, norm], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const gaps = useMemo(() => series ? findGaps(series.points, series.bucket) : [], [series]);
  const gapAt = useMemo(() => new Map(chartData.map(p => [p.t, p])), [chartData]);
  const span = series?.points?.length ? series.points.at(-1).t - series.points[0].t : 0;
  const seriesMeta = Object.fromEntries(groups.map(g => [g, style(g)]));
  const legendItems = groups.map(g => ({ key: g, ...style(g) }));
  const toggle = (k) => setHidden(h => h.includes(k) ? h.filter(x => x !== k) : [...h, k]);

  const valueFmt = (v) => (norm ? fmtNum(v, 0) : fmtNum(v));

  const curveGroups = (curve?.groups || []).filter(g => !hidden.includes(g));

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Blade trials" title="Compare"
                  sub="Pit blade materials or individual turbines against each other. Every turbine is measured against the same site wind sensor.">
      </PageHeader>

      {/* Control bar — one row, above everything it controls */}
      <div className="card flex flex-wrap items-center gap-3 px-4 py-3 animate-rise">
        <Segmented value={group} onChange={(g) => { setGroup(g); setHidden([]); }}
                   options={[{ value: 'blade', label: 'By blade material' }, { value: 'turbine', label: 'By turbine' }]} />
        <div className="hidden h-6 w-px bg-line sm:block" />
        <RangePicker range={range} onChange={setRange} />
        {turbines?.length > 0 && (
          <div className="flex w-full flex-wrap items-center gap-1.5 border-t border-line/60 pt-3">
            <span className="eyebrow mr-1 !text-[10px]">Turbines included</span>
            {turbines.map(t => {
              const on = !picked.length || picked.includes(t.id);
              return (
                <button key={t.id} type="button" aria-pressed={on} onClick={() => togglePick(t.id)}
                        className={`chip transition ${on ? '!border-ink/40 !text-ink bg-surface' : 'opacity-60 hover:opacity-100'}`}>
                  <MaterialSwatch blade={t.blade} size={8} />
                  {t.name}
                  <span className="font-mono text-[10px] text-faint">{t.id}</span>
                  {on && <Icon name="check" className="h-3 w-3" strokeWidth={2.2} />}
                </button>
              );
            })}
            {picked.length > 0 && <button type="button" onClick={() => setOnly([])} className="chip hover:text-ink">Show all</button>}
          </div>
        )}
      </div>

      {/* Where each series' data comes from */}
      {summary?.rows?.length > 0 && (
        <div className="flex flex-wrap gap-2 animate-rise">
          {summary.rows.map(x => {
            const s = style(x.group);
            return (
              <div key={x.group} className="flex items-center gap-2.5 rounded-2xl border border-line/70 bg-surface/60 px-3.5 py-2">
                <svg width="18" height="6" aria-hidden="true"><line x1="1" y1="3" x2="17" y2="3" stroke={s.color} strokeWidth="3" strokeDasharray={s.dash} strokeLinecap="round" /></svg>
                <span className="text-[13px] font-medium text-ink">{s.label}</span>
                <span className="text-xs text-muted">
                  {group === 'blade' ? <>from {(x.members || []).map(id => <span key={id} className="text-ink/80">{nameOf(id)} <span className="font-mono text-[10px] text-faint">{id}</span> </span>)}</>
                                     : <>{s.sub}</>}
                  {' · '}<span className="num">{fmtNum(x.samples, 0)}</span> readings
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Scoreboard */}
      <section className="card card-pad relative animate-rise" style={{ animationDelay: '60ms' }}>
        <LoadingVeil show={lSum} />
        <CardTitle title="Head to head"
                   sub={`${group === 'blade' ? 'Blade materials' : 'Turbines'} · ${fmtDayTime(r.from)} → ${fmtDayTime(r.to)} EAT`} />
        {summary ? <Scoreboard rows={summary.rows} style={style} /> : <div className="grid h-40 place-items-center"><Spinner /></div>}
      </section>

      {/* Time series */}
      <div className="grid gap-6 min-[1800px]:grid-cols-2 [&>*]:min-w-0">
      <section className="card card-pad relative animate-rise" style={{ animationDelay: '120ms' }}>
        <LoadingVeil show={lSer} />
        <CardTitle title={`${m.label} over time`}
                   sub={series ? `Averaged into ${series.bucket >= 3600 ? series.bucket / 3600 + ' h' : series.bucket / 60 + ' min'} buckets` : ' '} />
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="no-scrollbar -mx-1 overflow-x-auto px-1">
            <Segmented value={metric} onChange={setMetric} size="sm" options={METRICS.map(x => ({ value: x.key, label: x.label }))} />
          </div>
          <Toggle on={norm} onChange={setNorm} label="Normalise" title="Scale each line to 0–100 % of its own range to compare shapes" />
        </div>
        <div className="h-[340px]">
          {chartData.length ? (
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']}
                       tickFormatter={multiDay ? fmtDayTime : fmtClock} minTickGap={56} {...axisProps} />
                <YAxis {...axisProps} width={56} tickFormatter={v => valueFmt(v)}
                       label={unit ? { value: unit, angle: -90, position: 'insideLeft', fill: 'var(--chart-tick)', fontSize: 11, dx: 4 } : undefined} />
                <Tooltip content={<ChartTooltip labelFormat={fmtDayTime} valueFormat={valueFmt} unit={norm ? '%' : unit} rawUnit={m.unit} series={seriesMeta} />} />
                {gapMarks(gaps, { span, series: visible.map(g => ({ key: g, color: style(g).color })), valueAt: (t, k) => gapAt.get(t)?.[k] })}
                {visible.map(g => {
                  const s = style(g);
                  return <Line key={g} type="monotone" dataKey={g} stroke={s.color} strokeWidth={2} strokeDasharray={s.dash}
                               dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: 'rgb(var(--surface))' }} animationDuration={700} animationEasing="ease-out" />;
                })}
              </LineChart>
            </ResponsiveContainer>
          ) : lSer ? <div className="grid h-full place-items-center"><Spinner /></div> : <Empty />}
        </div>
        <div className="mt-4"><Legend items={legendItems} hidden={hidden} onToggle={toggle} /></div>
      </section>

      {/* Power curve */}
      <section className="card card-pad relative animate-rise" style={{ animationDelay: '180ms' }}>
        <LoadingVeil show={lCurve} />
        <CardTitle title={curveY === 'power' ? 'Power curve' : 'Rotor response'}
                   sub={`${curveY === 'power' ? 'Power' : 'RPM'} against site wind, averaged in ${curve?.bin ?? 0.5} m/s bins. Dots are individual readings. Higher and further left wins.`}
                   right={<Segmented value={curveY} onChange={setCurveY} size="sm" options={[{ value: 'power', label: 'Power' }, { value: 'rpm', label: 'RPM' }]} />} />
        <div className="h-[360px]">
          {curve?.curve?.length ? (
            <ResponsiveContainer>
              <ComposedChart data={curve.curve} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="ws" type="number" domain={[0, 'dataMax']} {...axisProps} tickFormatter={v => fmtNum(v, 0)}
                       label={{ value: 'Site wind (m/s)', position: 'insideBottom', offset: -4, fill: 'var(--chart-tick)', fontSize: 11 }} />
                <YAxis {...axisProps} width={56} tickFormatter={v => fmtNum(v, 0)}
                       label={{ value: curveY === 'power' ? 'W' : 'rpm', angle: -90, position: 'insideLeft', fill: 'var(--chart-tick)', fontSize: 11, dx: 4 }} />
                <Tooltip content={<ChartTooltip labelFormat={v => `${fmtNum(v, 1)} m/s`} valueFormat={v => fmtNum(v)} unit={curveY === 'power' ? 'W' : 'rpm'}
                         series={Object.fromEntries(curveGroups.map(g => [curveY === 'power' ? g : `${g}__rpm`, style(g)]))} />} />
                {curveGroups.map(g => (
                  <Scatter key={'s' + g} data={curve.samples.filter(s => s.g === g)} dataKey={curveY === 'power' ? 'p' : 'rpm'}
                           fill={style(g).color} fillOpacity={0.16} shape="circle" isAnimationActive={false} legendType="none" tooltipType="none" />
                ))}
                {curveGroups.map(g => {
                  const s = style(g);
                  return <Line key={g} type="monotone" dataKey={curveY === 'power' ? g : `${g}__rpm`} stroke={s.color} strokeWidth={2.5}
                               strokeDasharray={s.dash} dot={{ r: 2.5, fill: s.color, strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 2, stroke: 'rgb(var(--surface))' }}
                               connectNulls animationDuration={700} animationEasing="ease-out" />;
                })}
              </ComposedChart>
            </ResponsiveContainer>
          ) : lCurve ? <div className="grid h-full place-items-center"><Spinner /></div> : <Empty />}
        </div>
        <div className="mt-4"><Legend items={(curve?.groups || []).map(g => ({ key: g, ...style(g) }))} hidden={hidden} onToggle={toggle} /></div>
      </section>
      </div>

      {group === 'turbine' && turbines && (
        <p className="flex items-center gap-2 text-xs text-faint">
          <Icon name="info" className="h-3.5 w-3.5" />
          Colour follows each turbine's blade material
          {['aluminum', 'pla', 'carbon'].map(k => (
            <span key={k} className="inline-flex items-center gap-1"><MaterialSwatch blade={k} size={8} />{material(k).label}</span>
          ))}
          — line style tells turbines with the same material apart.
        </p>
      )}
    </div>
  );
}
