import { useEffect, useState, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { api } from '../api.js';

const EAT_OFFSET = 3 * 60;

function toEAT(isoStr) {
  if (!isoStr) return '—';
  const eat = new Date(new Date(isoStr).getTime() + EAT_OFFSET * 60 * 1000);
  return eat.toISOString().replace('T', ' ').slice(0, 16) + ' EAT';
}
function fmtTime(isoStr) {
  if (!isoStr) return '';
  const eat = new Date(new Date(isoStr).getTime() + EAT_OFFSET * 60 * 1000);
  return eat.toISOString().slice(11, 16);
}
function mergeChartData(gen, con) {
  const map = {};
  for (const r of gen) map[r.timestamp] = { time: fmtTime(r.timestamp), generation: r.power };
  for (const r of con) {
    if (map[r.timestamp]) map[r.timestamp].consumption = r.power;
    else map[r.timestamp] = { time: fmtTime(r.timestamp), consumption: r.power };
  }
  return Object.values(map).sort((a, b) => a.time.localeCompare(b.time));
}

function KPICard({ label, value, unit, subtext, valueClass, iconBg, icon }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm dark:shadow-none hover:shadow-md dark:hover:border-slate-700 hover:border-slate-300 transition-all duration-200">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">{label}</span>
        <div className={`flex items-center justify-center w-8 h-8 rounded-xl ${iconBg}`}>{icon}</div>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-3xl font-bold tabular-nums tracking-tight ${valueClass}`}>{value ?? '—'}</span>
        {unit && <span className="text-sm font-medium text-slate-400 dark:text-slate-500">{unit}</span>}
      </div>
      {subtext && <div className="mt-1.5 text-xs text-slate-500 truncate">{subtext}</div>}
    </div>
  );
}

function GaugeBar({ value, max, color }) {
  const pct = Math.min(100, Math.max(0, ((value || 0) / max) * 100));
  return (
    <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function PowerTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg p-3 text-xs">
      <div className="font-semibold text-slate-500 dark:text-slate-400 mb-2">{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1 last:mb-0">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-slate-500 dark:text-slate-400">{p.name}:</span>
          <span className="font-bold text-slate-900 dark:text-slate-100">{p.value?.toFixed(3)} kW</span>
        </div>
      ))}
    </div>
  );
}

export default function Overview() {
  const [latest,    setLatest]    = useState(null);
  const [chart,     setChart]     = useState([]);
  const [lastFetch, setLastFetch] = useState(null);
  const [peakGen,   setPeakGen]   = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [latestData, chartData] = await Promise.all([
        api.get('/api/dashboard/latest'),
        api.get('/api/dashboard/power-chart'),
      ]);
      setLatest(latestData);
      setChart(mergeChartData(chartData.generation, chartData.consumption));
      setPeakGen(Math.max(...chartData.generation.map(r => r.power ?? 0), 0));
      setLastFetch(new Date());
    } catch (err) {
      console.error('Overview fetch error:', err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 60_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const g   = latest?.generation;
  const c   = latest?.consumption;
  const net = g && c ? g.power - c.power : null;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Overview</h1>
          <p className="text-sm text-slate-500 mt-0.5">Live turbine snapshot — auto-refreshes every minute</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {g?.firmware && (
            <div className="flex items-center gap-2 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-1.5">
              <svg className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
              </svg>
              <span className="text-xs font-mono font-medium text-slate-600 dark:text-slate-300">FW v{g.firmware}</span>
            </div>
          )}
          {lastFetch && (
            <div className="flex items-center gap-2 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900/60 px-3.5 py-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Live · {lastFetch.toLocaleTimeString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard
          label="Generation" value={g?.power?.toFixed(3)} unit="kW"
          subtext={g ? toEAT(g.timestamp) : 'No data'}
          valueClass="text-emerald-700 dark:text-emerald-400"
          iconBg="bg-emerald-100 dark:bg-emerald-500/10"
          icon={<svg className="w-4 h-4 text-emerald-700 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>}
        />
        <KPICard
          label="Consumption" value={c?.power?.toFixed(3)} unit="kW"
          subtext={c ? toEAT(c.timestamp) : 'No data'}
          valueClass="text-amber-600 dark:text-amber-400"
          iconBg="bg-amber-100 dark:bg-amber-500/10"
          icon={<svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 10.5h.375c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125H21M3.75 18h15A2.25 2.25 0 0021 15.75v-6a2.25 2.25 0 00-2.25-2.25h-15A2.25 2.25 0 001.5 9.75v6A2.25 2.25 0 003.75 18z" /></svg>}
        />
        <KPICard
          label="Net Balance"
          value={net != null ? (net >= 0 ? '+' : '') + net.toFixed(3) : null} unit="kW"
          subtext={net != null ? (net >= 0 ? 'Exporting to grid' : 'Importing from grid') : 'No data'}
          valueClass={net == null || net >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600 dark:text-rose-400'}
          iconBg={net == null || net >= 0 ? 'bg-indigo-100 dark:bg-indigo-500/10' : 'bg-rose-100 dark:bg-rose-500/10'}
          icon={<svg className={`w-4 h-4 ${net == null || net >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600 dark:text-rose-400'}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>}
        />
        <KPICard
          label="Wind Speed" value={g?.wind_speed?.toFixed(1)} unit="m/s"
          subtext={g ? `RPM: ${g.rpm?.toFixed(0) ?? '—'}` : 'No data'}
          valueClass="text-sky-600 dark:text-sky-400"
          iconBg="bg-sky-100 dark:bg-sky-500/10"
          icon={<svg className="w-4 h-4 text-sky-600 dark:text-sky-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12.75 3.03v.568c0 .334.148.65.405.864l1.068.89c.442.369.535 1.01.216 1.49l-.51.766a2.25 2.25 0 01-1.161.886l-.143.048a1.107 1.107 0 00-.57 1.664c.369.555.169 1.307-.427 1.605L9 13.125l.423 1.059a.956.956 0 01-1.652.928l-.679-.906a1.125 1.125 0 00-1.906.172L4.5 15.75l-.612.153M12.75 3.031a9 9 0 00-8.862 12.872M12.75 3.031A9 9 0 0121.75 12c0 4.556-3.382 8.326-7.815 8.898" /></svg>}
        />
      </div>

      {/* Chart + side panel */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">

        <div className="page-card xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Power — Last 24 Hours</h2>
              <p className="text-xs text-slate-500 mt-0.5">Generation vs. Consumption (kW)</p>
            </div>
            <div className="flex items-center gap-4">
              {peakGen != null && (
                <div className="text-right">
                  <div className="text-xs text-slate-400 dark:text-slate-500">24h peak</div>
                  <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{peakGen.toFixed(3)} kW</div>
                </div>
              )}
              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-1.5 text-xs text-slate-500"><span className="w-3 h-0.5 rounded bg-emerald-500 inline-block" />Generation</span>
                <span className="flex items-center gap-1.5 text-xs text-slate-500"><span className="w-3 h-0.5 rounded bg-amber-400 inline-block" />Consumption</span>
              </div>
            </div>
          </div>
          {chart.length === 0 ? (
            <div className="flex h-56 flex-col items-center justify-center gap-2 text-slate-300 dark:text-slate-700">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" /></svg>
              <span className="text-sm">No data available</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="time" tick={{ fill: 'var(--chart-tick)', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: 'var(--chart-tick)', fontSize: 11 }} unit=" kW" width={68} axisLine={false} tickLine={false} />
                <Tooltip content={<PowerTooltip />} />
                <Line type="monotone" dataKey="generation"  name="Generation"  stroke="#10b981" strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                <Line type="monotone" dataKey="consumption" name="Consumption" stroke="#f59e0b" strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {/* Mechanical */}
          <div className="page-card flex-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-5 rounded-full bg-orange-400" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Mechanical</h3>
            </div>
            <div className="space-y-3">
              {[
                { label: 'RPM',       value: g?.rpm?.toFixed(0),       max: 1500, bar: 'bg-orange-400', txt: 'text-orange-600 dark:text-orange-400', unit: '' },
                { label: 'Frequency', value: g?.frequency?.toFixed(1), max: 60,   bar: 'bg-indigo-400', txt: 'text-indigo-600 dark:text-indigo-400', unit: 'Hz' },
                { label: 'Voltage',   value: g?.voltage?.toFixed(1),   max: 260,  bar: 'bg-sky-400',    txt: 'text-sky-600 dark:text-sky-400',    unit: 'V' },
                { label: 'Current',   value: g?.current?.toFixed(2),   max: 30,   bar: 'bg-violet-400', txt: 'text-violet-600 dark:text-violet-400', unit: 'A' },
              ].map(({ label, value, max, bar, txt, unit }) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-500">{label}</span>
                    <span className={`text-sm font-bold tabular-nums ${txt}`}>{value ?? '—'}{unit && <span className="text-xs font-normal text-slate-400 ml-0.5">{unit}</span>}</span>
                  </div>
                  <GaugeBar value={parseFloat(value)} max={max} color={bar} />
                </div>
              ))}
            </div>
          </div>

          {/* Environmental */}
          <div className="page-card flex-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-5 rounded-full bg-blue-400" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Environmental</h3>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Temperature', value: g?.temperature?.toFixed(1), max: 50,  bar: 'bg-rose-400', txt: 'text-rose-600 dark:text-rose-400',  unit: '°C' },
                { label: 'Humidity',    value: g?.humidity?.toFixed(1),    max: 100, bar: 'bg-blue-400', txt: 'text-blue-600 dark:text-blue-400',  unit: '%' },
                { label: 'Wind Speed',  value: g?.wind_speed?.toFixed(1),  max: 30,  bar: 'bg-cyan-400', txt: 'text-cyan-600 dark:text-cyan-400',  unit: 'm/s' },
              ].map(({ label, value, max, bar, txt, unit }) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-500">{label}</span>
                    <span className={`text-sm font-bold tabular-nums ${txt}`}>{value ?? '—'}{unit && <span className="text-xs font-normal text-slate-400 ml-0.5">{unit}</span>}</span>
                  </div>
                  <GaugeBar value={parseFloat(value)} max={max} color={bar} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Gen + Con panels */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Generation */}
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-white dark:bg-slate-900 overflow-hidden shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-950/60 dark:to-slate-900 border-b border-emerald-100 dark:border-emerald-900/40">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-700 dark:bg-emerald-500/20 dark:border dark:border-emerald-500/20">
                <svg className="w-4 h-4 text-white dark:text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">Generation</div>
                <div className="text-xs text-emerald-600 dark:text-emerald-500/80">{g ? toEAT(g.timestamp) : 'No data'}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{g?.power?.toFixed(3) ?? '—'}</div>
              <div className="text-xs text-slate-400 dark:text-slate-500">kW output</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-px bg-slate-100 dark:bg-slate-800 p-px">
            {[
              { label: 'Voltage',     value: g?.voltage?.toFixed(1),    unit: 'V'   },
              { label: 'Current',     value: g?.current?.toFixed(2),    unit: 'A'   },
              { label: 'Frequency',   value: g?.frequency?.toFixed(1),  unit: 'Hz'  },
              { label: 'Wind Speed',  value: g?.wind_speed?.toFixed(1), unit: 'm/s' },
              { label: 'RPM',         value: g?.rpm?.toFixed(0),        unit: 'rpm' },
              { label: 'Energy',      value: g?.energy?.toFixed(3),     unit: 'kWh' },
              { label: 'Temperature', value: g?.temperature?.toFixed(1),unit: '°C'  },
              { label: 'Humidity',    value: g?.humidity?.toFixed(1),   unit: '%'   },
            ].map(({ label, value, unit }) => (
              <div key={label} className="bg-white dark:bg-slate-900 px-4 py-3">
                <div className="text-xs text-slate-400 dark:text-slate-500">{label}</div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                  {value ?? '—'} <span className="text-xs font-normal text-slate-400 dark:text-slate-500">{unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Consumption */}
        <div className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-white dark:bg-slate-900 overflow-hidden shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-amber-50 to-white dark:from-amber-950/60 dark:to-slate-900 border-b border-amber-100 dark:border-amber-900/40">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500 dark:bg-amber-500/20 dark:border dark:border-amber-500/20">
                <svg className="w-4 h-4 text-white dark:text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 10.5h.375c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125H21M3.75 18h15A2.25 2.25 0 0021 15.75v-6a2.25 2.25 0 00-2.25-2.25h-15A2.25 2.25 0 001.5 9.75v6A2.25 2.25 0 003.75 18z" /></svg>
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">Consumption</div>
                <div className="text-xs text-amber-600 dark:text-amber-500/80">{c ? toEAT(c.timestamp) : 'No data'}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">{c?.power?.toFixed(3) ?? '—'}</div>
              <div className="text-xs text-slate-400 dark:text-slate-500">kW load</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-px bg-slate-100 dark:bg-slate-800 p-px">
            {[
              { label: 'Voltage', value: c?.voltage?.toFixed(1), unit: 'V'   },
              { label: 'Current', value: c?.current?.toFixed(2), unit: 'A'   },
              { label: 'Power',   value: c?.power?.toFixed(3),   unit: 'kW'  },
              { label: 'Energy',  value: c?.energy?.toFixed(3),  unit: 'kWh' },
            ].map(({ label, value, unit }) => (
              <div key={label} className="bg-white dark:bg-slate-900 px-4 py-3">
                <div className="text-xs text-slate-400 dark:text-slate-500">{label}</div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                  {value ?? '—'} <span className="text-xs font-normal text-slate-400 dark:text-slate-500">{unit}</span>
                </div>
              </div>
            ))}
          </div>
          {net != null && (
            <div className={`mx-4 mb-4 mt-3 rounded-xl px-4 py-3 flex items-center justify-between border ${
              net >= 0
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/50'
            }`}>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Net Balance</div>
                <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{net >= 0 ? 'Exporting energy' : 'Importing energy'}</div>
              </div>
              <div className="text-right">
                <span className={`text-xl font-bold tabular-nums ${net >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {net >= 0 ? '+' : ''}{net.toFixed(3)}
                </span>
                <span className="text-xs text-slate-400 ml-1">kW</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
