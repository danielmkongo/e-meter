import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { api } from '../api.js';
import { exportExcel } from '../exportExcel.js';

// ── Time helpers ──────────────────────────────────────────────────────────────

const EAT_OFFSET = 3 * 60;

function toEAT(isoStr) {
  if (!isoStr) return '—';
  const eat = new Date(new Date(isoStr).getTime() + EAT_OFFSET * 60 * 1000);
  return eat.toISOString().replace('T', ' ').slice(0, 16);
}

// Format timestamp for chart x-axis label
function fmtLabel(isoStr, multiDay) {
  if (!isoStr) return '';
  const eat = new Date(new Date(isoStr).getTime() + EAT_OFFSET * 60 * 1000);
  return multiDay
    ? eat.toISOString().slice(5, 16).replace('T', ' ') // MM-DD HH:MM
    : eat.toISOString().slice(11, 16);                  // HH:MM
}

// ── Date range helpers ────────────────────────────────────────────────────────

const PRESETS = [
  { id: 'today', label: 'Today'   },
  { id: '7d',    label: '7 Days'  },
  { id: '30d',   label: '30 Days' },
  { id: 'custom', label: 'Custom' },
];

function computeRange(preset, customFrom, customTo) {
  const now = new Date();
  switch (preset) {
    case 'today': {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return { from: start.toISOString(), to: now.toISOString() };
    }
    case '7d':
      return { from: new Date(now - 7 * 86400_000).toISOString(), to: now.toISOString() };
    case '30d':
      return { from: new Date(now - 30 * 86400_000).toISOString(), to: now.toISOString() };
    case 'custom':
      return {
        from: customFrom ? new Date(customFrom + 'T00:00:00').toISOString() : new Date(now - 7 * 86400_000).toISOString(),
        to:   customTo   ? new Date(customTo   + 'T23:59:59').toISOString() : now.toISOString(),
      };
    default:
      return { from: null, to: null };
  }
}

function rangeQs(range) {
  const p = new URLSearchParams();
  if (range.from) p.set('from', range.from);
  if (range.to)   p.set('to',   range.to);
  const s = p.toString();
  return s ? '?' + s : '';
}

function isMultiDay(range) {
  if (!range.from || !range.to) return false;
  return new Date(range.to) - new Date(range.from) > 86400_000;
}

// ── Date range bar ────────────────────────────────────────────────────────────

function DateRangeBar({ preset, customFrom, customTo, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Preset pills */}
      <div className="flex items-center gap-1 rounded-xl bg-slate-200/70 p-1">
        {PRESETS.map(p => (
          <button
            key={p.id}
            onClick={() => onChange({ preset: p.id })}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              preset === p.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom date inputs */}
      {preset === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customFrom}
            onChange={e => onChange({ customFrom: e.target.value })}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          <span className="text-xs text-slate-400">to</span>
          <input
            type="date"
            value={customTo}
            onChange={e => onChange({ customTo: e.target.value })}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
      )}
    </div>
  );
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex h-52 items-center justify-center">
      <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-slate-200 border-t-emerald-500" />
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-2 text-slate-400">
      <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
      </svg>
      <span className="text-sm">No data for this period</span>
    </div>
  );
}

function ChartTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-white border border-slate-200 shadow-lg p-3 text-xs">
      <div className="font-semibold text-slate-500 mb-1.5">{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1 last:mb-0">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-bold text-slate-900">{p.value != null ? p.value : '—'} {unit || ''}</span>
        </div>
      ))}
    </div>
  );
}

const TABS = [
  {
    id: 'combined',
    label: 'Combined Graph',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>,
  },
  {
    id: 'individual',
    label: 'Individual Graphs',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" /></svg>,
  },
  {
    id: 'data',
    label: 'Data Table',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c-.621 0-1.125.504-1.125 1.125v1.5m2.25-2.625h7.5m-7.5 0c.621 0 1.125.504 1.125 1.125v1.5m7.5-2.625c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-18.375 0c-.621 0-1.125-.504-1.125-1.125" /></svg>,
  },
];

// ── Parameter definitions ─────────────────────────────────────────────────────

const GEN_PARAMS = [
  { key: 'power',       label: 'Power',       unit: 'kW',   color: '#10b981', desc: 'Active power output'        },
  { key: 'wind_speed',  label: 'Wind Speed',  unit: 'm/s',  color: '#06b6d4', desc: 'Wind speed at turbine'      },
  { key: 'rpm',         label: 'RPM',         unit: 'rpm',  color: '#f97316', desc: 'Rotor revolutions/min'      },
  { key: 'voltage',     label: 'Voltage',     unit: 'V',    color: '#0ea5e9', desc: 'Generator output voltage'   },
  { key: 'current',     label: 'Current',     unit: 'A',    color: '#8b5cf6', desc: 'Generator output current'   },
  { key: 'frequency',   label: 'Frequency',   unit: 'Hz',   color: '#6366f1', desc: 'AC output frequency'        },
  { key: 'temperature', label: 'Temperature', unit: '°C',   color: '#f43f5e', desc: 'Ambient temperature'        },
  { key: 'humidity',    label: 'Humidity',    unit: '%',    color: '#3b82f6', desc: 'Relative humidity'          },
];

const CON_PARAMS = [
  { key: 'power',   label: 'Power',   unit: 'kW', color: '#f59e0b', desc: 'Active power consumed' },
  { key: 'voltage', label: 'Voltage', unit: 'V',  color: '#0ea5e9', desc: 'Supply voltage'        },
  { key: 'current', label: 'Current', unit: 'A',  color: '#8b5cf6', desc: 'Load current'          },
];

// ── Combined tab ──────────────────────────────────────────────────────────────

function CombinedTab({ range }) {
  const [chart, setChart]     = useState([]);
  const [loading, setLoading] = useState(true);
  const multiDay = isMultiDay(range);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get('/api/dashboard/power-chart' + rangeQs(range));
      const map = {};
      for (const r of d.generation) {
        map[r.timestamp] = { ts: r.timestamp, label: fmtLabel(r.timestamp, multiDay), generation: +r.power.toFixed(4) };
      }
      for (const r of d.consumption) {
        if (map[r.timestamp]) map[r.timestamp].consumption = +r.power.toFixed(4);
        else map[r.timestamp] = { ts: r.timestamp, label: fmtLabel(r.timestamp, multiDay), consumption: +r.power.toFixed(4) };
      }
      setChart(Object.values(map).sort((a, b) => a.ts.localeCompare(b.ts)));
    } finally {
      setLoading(false);
    }
  }, [range, multiDay]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner />;

  const netData = chart
    .filter(d => d.generation != null && d.consumption != null)
    .map(d => ({ label: d.label, net: +(d.generation - d.consumption).toFixed(4) }));

  return (
    <div className="space-y-6">
      {/* Power chart */}
      <div className="page-card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Power Output vs. Load</h3>
            <p className="text-xs text-slate-400 mt-0.5">kW over selected period</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-xs text-slate-500"><span className="w-3 h-0.5 rounded bg-emerald-500 inline-block" />Generation</span>
            <span className="flex items-center gap-1.5 text-xs text-slate-500"><span className="w-3 h-0.5 rounded bg-amber-400 inline-block" />Consumption</span>
          </div>
        </div>
        {chart.length === 0 ? <EmptyChart /> : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} unit=" kW" width={70} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip unit="kW" />} />
              <Line type="monotone" dataKey="generation"  name="Generation"  stroke="#10b981" strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
              <Line type="monotone" dataKey="consumption" name="Consumption" stroke="#f59e0b" strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Net balance chart */}
      {netData.length > 0 && (
        <div className="page-card">
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-slate-900">Net Power Balance</h3>
            <p className="text-xs text-slate-400 mt-0.5">Generation − Consumption &mdash; positive = exporting, negative = importing (kW)</p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={netData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} unit=" kW" width={70} axisLine={false} tickLine={false} />
              <ReferenceLine y={0} stroke="#cbd5e1" strokeWidth={1.5} />
              <Tooltip content={<ChartTooltip unit="kW" />} />
              <Line type="monotone" dataKey="net" name="Net" stroke="#6366f1" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ── Individual tab ────────────────────────────────────────────────────────────

function IndividualTab({ range }) {
  const [source,   setSource]   = useState('generation');
  const [paramKey, setParamKey] = useState('power');
  const [genData,  setGenData]  = useState(null);
  const [conData,  setConData]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const multiDay = isMultiDay(range);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/api/dashboard/gen-timeseries' + rangeQs(range)),
      api.get('/api/dashboard/con-timeseries' + rangeQs(range)),
    ]).then(([gen, con]) => {
      setGenData(gen.map(r => ({ ...r, label: fmtLabel(r.timestamp, multiDay) })));
      setConData(con.map(r => ({ ...r, label: fmtLabel(r.timestamp, multiDay) })));
    }).finally(() => setLoading(false));
  }, [range, multiDay]);

  const params    = source === 'generation' ? GEN_PARAMS : CON_PARAMS;
  const rawData   = source === 'generation' ? genData  : conData;
  const paramMeta = params.find(p => p.key === paramKey) || params[0];

  function handleSource(s) {
    setSource(s);
    const newParams = s === 'generation' ? GEN_PARAMS : CON_PARAMS;
    if (!newParams.find(p => p.key === paramKey)) setParamKey(newParams[0].key);
  }

  const chartData = rawData
    ? rawData.map(r => ({
        label: r.label,
        value: r[paramMeta?.key] != null ? +Number(r[paramMeta.key]).toFixed(4) : null,
      }))
    : [];

  const validValues = chartData.map(d => d.value).filter(v => v != null);
  const minVal   = validValues.length ? Math.min(...validValues) : 0;
  const maxVal   = validValues.length ? Math.max(...validValues) : 1;
  const padding  = (maxVal - minVal) * 0.1 || 0.5;

  if (loading) return <Spinner />;

  return (
    <div className="space-y-5">
      {/* Source toggle */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 mr-1">Source</span>
        {[
          { id: 'generation',  label: 'Generation',  active: 'bg-emerald-600 text-white' },
          { id: 'consumption', label: 'Consumption', active: 'bg-amber-500 text-white'   },
        ].map(s => (
          <button key={s.id} onClick={() => handleSource(s.id)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all shadow-sm ${
              source === s.id ? s.active : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Parameter pills */}
      <div className="flex flex-wrap gap-2">
        {params.map(p => (
          <button key={p.key} onClick={() => setParamKey(p.key)}
            style={paramKey === p.key ? { backgroundColor: p.color + '15', borderColor: p.color, color: p.color } : {}}
            className={`rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition-all ${
              paramKey === p.key ? '' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}>
            {p.label} <span className="font-normal opacity-60 ml-0.5">{p.unit}</span>
          </button>
        ))}
      </div>

      {/* Main chart */}
      <div className="page-card">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: paramMeta.color }} />
              <h3 className="text-sm font-bold text-slate-900">{paramMeta.label}</h3>
              <span className="text-xs text-slate-400">{paramMeta.unit}</span>
            </div>
            <p className="text-xs text-slate-400 mt-1 ml-5">{paramMeta.desc}</p>
          </div>
          {validValues.length > 0 && (
            <div className="grid grid-cols-3 gap-4 text-center">
              {[
                { label: 'Min', val: minVal },
                { label: 'Avg', val: validValues.reduce((a, b) => a + b, 0) / validValues.length },
                { label: 'Max', val: maxVal },
              ].map(({ label, val }) => (
                <div key={label}>
                  <div className="text-xs text-slate-400">{label}</div>
                  <div className="text-sm font-bold text-slate-900 tabular-nums">{val.toFixed(2)}</div>
                  <div className="text-xs text-slate-400">{paramMeta.unit}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {chartData.length === 0 ? <EmptyChart /> : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} unit={` ${paramMeta.unit}`} width={72}
                domain={[Math.max(0, minVal - padding), maxVal + padding]} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip unit={paramMeta.unit} />} />
              <Line type="monotone" dataKey="value" name={paramMeta.label} stroke={paramMeta.color}
                strokeWidth={2.5} dot={false} connectNulls={false} activeDot={{ r: 4, fill: paramMeta.color, strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Mini sparkline grid */}
      <div>
        <h3 className="section-label">All {source === 'generation' ? 'Generation' : 'Consumption'} Parameters</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {params.map(p => {
            const vals   = rawData?.map(r => r[p.key]).filter(v => v != null) || [];
            const latest = vals[vals.length - 1];
            const mini   = rawData?.map((r, i) => ({ i, v: r[p.key] })) || [];
            const mn     = vals.length ? Math.min(...vals) : 0;
            const mx     = vals.length ? Math.max(...vals) : 1;
            const pd     = (mx - mn) * 0.15 || 0.5;
            return (
              <button key={p.key} onClick={() => setParamKey(p.key)}
                className="text-left rounded-2xl border p-4 transition-all hover:shadow-md bg-white"
                style={paramKey === p.key ? { borderColor: p.color, backgroundColor: p.color + '08' } : { borderColor: '#e2e8f0' }}>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-500">{p.label}</span>
                  <span className="text-xs text-slate-400">{p.unit}</span>
                </div>
                <div className="text-xl font-bold tabular-nums mb-2" style={{ color: p.color }}>
                  {latest != null ? Number(latest).toFixed(p.key === 'rpm' ? 0 : 2) : '—'}
                </div>
                <ResponsiveContainer width="100%" height={40}>
                  <LineChart data={mini} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                    <YAxis domain={[mn - pd, mx + pd]} hide />
                    <Line type="monotone" dataKey="v" stroke={p.color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Data tab ──────────────────────────────────────────────────────────────────

function Pagination({ page, pages, onPage }) {
  if (pages <= 1) return null;
  const nums = Array.from({ length: pages }, (_, i) => i + 1)
    .slice(Math.max(0, page - 3), Math.min(pages, page + 2));
  return (
    <div className="flex items-center justify-between mt-4 px-1">
      <span className="text-xs text-slate-400">Page {page} of {pages}</span>
      <div className="flex items-center gap-1">
        <button onClick={() => onPage(page - 1)} disabled={page <= 1}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>Prev
        </button>
        {nums.map(n => (
          <button key={n} onClick={() => onPage(n)}
            className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${n === page ? 'bg-emerald-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
            {n}
          </button>
        ))}
        <button onClick={() => onPage(page + 1)} disabled={page >= pages}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed">
          Next<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
        </button>
      </div>
    </div>
  );
}

function GenTable({ range, page, onPage }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams({ page });
    if (range.from) qs.set('from', range.from);
    if (range.to)   qs.set('to',   range.to);
    api.get(`/api/dashboard/history/generation?${qs}`).then(setData).finally(() => setLoading(false));
  }, [range, page]);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Generation Records</h3>
          {data && <p className="text-xs text-slate-400 mt-0.5">{data.total.toLocaleString()} records</p>}
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-700">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />Generation
        </span>
      </div>
      {loading ? <Spinner /> : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Timestamp (EAT)', 'Firmware', 'V (V)', 'I (A)', 'RPM', 'Wind m/s', 'Hz', 'kW', 'kWh', '°C', 'RH %'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {data?.rows.map((r, i) => (
                  <tr key={r.id} className={`hover:bg-slate-50 ${i % 2 ? 'bg-slate-50/30' : ''}`}>
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-700">{toEAT(r.timestamp)}</td>
                    <td className="px-4 py-3"><span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-slate-600">{r.firmware}</span></td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">{r.voltage.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">{r.current.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">{r.rpm.toFixed(0)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">{r.wind_speed.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">{r.frequency.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-600">{r.power.toFixed(3)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">{r.energy.toFixed(3)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">{r.temperature.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">{r.humidity.toFixed(1)}</td>
                  </tr>
                ))}
                {data?.rows.length === 0 && <tr><td colSpan={11} className="px-4 py-10 text-center text-slate-400">No records for this period</td></tr>}
              </tbody>
            </table>
          </div>
          <Pagination page={data?.page} pages={data?.pages} onPage={onPage} />
        </>
      )}
    </section>
  );
}

function ConTable({ range, page, onPage }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams({ page });
    if (range.from) qs.set('from', range.from);
    if (range.to)   qs.set('to',   range.to);
    api.get(`/api/dashboard/history/consumption?${qs}`).then(setData).finally(() => setLoading(false));
  }, [range, page]);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Consumption Records</h3>
          {data && <p className="text-xs text-slate-400 mt-0.5">{data.total.toLocaleString()} records</p>}
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-medium text-amber-700">
          <span className="w-2 h-2 rounded-full bg-amber-500" />Consumption
        </span>
      </div>
      {loading ? <Spinner /> : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Timestamp (EAT)', 'V (V)', 'I (A)', 'kW', 'kWh'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {data?.rows.map((r, i) => (
                  <tr key={r.id} className={`hover:bg-slate-50 ${i % 2 ? 'bg-slate-50/30' : ''}`}>
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-700">{toEAT(r.timestamp)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">{r.voltage.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">{r.current.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-amber-600">{r.power.toFixed(3)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">{r.energy.toFixed(3)}</td>
                  </tr>
                ))}
                {data?.rows.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">No records for this period</td></tr>}
              </tbody>
            </table>
          </div>
          <Pagination page={data?.page} pages={data?.pages} onPage={onPage} />
        </>
      )}
    </section>
  );
}

function ExportButton({ range }) {
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    setBusy(true);
    try {
      await exportExcel(range);
    } catch (err) {
      alert('Export failed: ' + err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
    >
      {busy ? (
        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
      )}
      {busy ? 'Exporting…' : 'Export to Excel'}
    </button>
  );
}

function DataTab({ range }) {
  const [genPage, setGenPage] = useState(1);
  const [conPage, setConPage] = useState(1);

  // Reset pages when range changes
  useEffect(() => { setGenPage(1); setConPage(1); }, [range]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">Showing paginated records for the selected period. Export downloads all records.</p>
        <ExportButton range={range} />
      </div>
      <div className="space-y-10">
        <GenTable range={range} page={genPage} onPage={setGenPage} />
        <ConTable range={range} page={conPage} onPage={setConPage} />
      </div>
    </div>
  );
}

// ── Main Analytics page ───────────────────────────────────────────────────────

export default function Analytics() {
  const [tab,         setTab]         = useState('combined');
  const [preset,      setPreset]      = useState('today');
  const [customFrom,  setCustomFrom]  = useState('');
  const [customTo,    setCustomTo]    = useState('');

  const range = useMemo(
    () => computeRange(preset, customFrom, customTo),
    [preset, customFrom, customTo]
  );

  function handleRangeChange({ preset: p, customFrom: cf, customTo: ct }) {
    if (p  != null) setPreset(p);
    if (cf != null) setCustomFrom(cf);
    if (ct != null) setCustomTo(ct);
  }

  // When tab changes reset to tab's default — keep range
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Analytics</h1>
        <p className="text-sm text-slate-500 mt-0.5">Deep-dive into generation and consumption data</p>
      </div>

      {/* Controls row: tabs + date range */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Tab bar */}
        <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-200/70 p-1">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Date range bar */}
        <DateRangeBar
          preset={preset}
          customFrom={customFrom}
          customTo={customTo}
          onChange={handleRangeChange}
        />
      </div>

      {/* Tab content */}
      {tab === 'combined'   && <CombinedTab   range={range} />}
      {tab === 'individual' && <IndividualTab range={range} />}
      {tab === 'data'       && <DataTab       range={range} />}
    </div>
  );
}
