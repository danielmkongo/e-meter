import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { api } from '../api.js';

function mergeEnergyData(gen, con) {
  const map = {};
  for (const r of gen) {
    map[r.day] = { day: r.day, generation: r.kwh >= 0 ? +r.kwh.toFixed(3) : 0 };
  }
  for (const r of con) {
    if (map[r.day]) {
      map[r.day].consumption = r.kwh >= 0 ? +r.kwh.toFixed(3) : 0;
    } else {
      map[r.day] = { day: r.day, consumption: r.kwh >= 0 ? +r.kwh.toFixed(3) : 0 };
    }
  }
  return Object.values(map).sort((a, b) => a.day.localeCompare(b.day));
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-white border border-slate-200 shadow-lg p-3 text-xs">
      <div className="font-semibold text-slate-600 mb-2">{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: p.fill }} />
          <span className="text-slate-600">{p.name}:</span>
          <span className="font-semibold text-slate-900">{p.value} kWh</span>
        </div>
      ))}
    </div>
  );
}

export default function Energy() {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    api.get('/api/dashboard/energy-chart')
      .then(d => setData(mergeEnergyData(d.generation, d.consumption)))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const totalGen = data.reduce((s, r) => s + (r.generation || 0), 0);
  const totalCon = data.reduce((s, r) => s + (r.consumption || 0), 0);
  const netExport = totalGen - totalCon;

  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Energy</h1>
        <p className="text-sm text-slate-500 mt-0.5">Daily totals for the last 7 days</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="stat-card">
          <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-100 mb-3">
            <svg className="w-[18px] h-[18px] text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900 tabular-nums">{totalGen.toFixed(2)}</span>
            <span className="text-xs font-medium text-slate-400">kWh</span>
          </div>
          <div className="mt-1 text-xs font-medium text-slate-500">Total Generation</div>
        </div>

        <div className="stat-card">
          <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-amber-100 mb-3">
            <svg className="w-[18px] h-[18px] text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 10.5h.375c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125H21M3.75 18h15A2.25 2.25 0 0021 15.75v-6a2.25 2.25 0 00-2.25-2.25h-15A2.25 2.25 0 001.5 9.75v6A2.25 2.25 0 003.75 18z" />
            </svg>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900 tabular-nums">{totalCon.toFixed(2)}</span>
            <span className="text-xs font-medium text-slate-400">kWh</span>
          </div>
          <div className="mt-1 text-xs font-medium text-slate-500">Total Consumption</div>
        </div>

        <div className={`stat-card ${netExport >= 0 ? 'border-emerald-200 bg-emerald-50/40' : 'border-rose-200 bg-rose-50/40'}`}>
          <div className={`inline-flex items-center justify-center w-9 h-9 rounded-xl mb-3 ${netExport >= 0 ? 'bg-emerald-100' : 'bg-rose-100'}`}>
            <svg className={`w-[18px] h-[18px] ${netExport >= 0 ? 'text-emerald-600' : 'text-rose-600'}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              {netExport >= 0
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6L9 12.75l4.286-4.286a11.948 11.948 0 014.306 6.43l.776 2.898m0 0l3.182-5.511m-3.182 5.51l-5.511-3.181" />
              }
            </svg>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-2xl font-bold tabular-nums ${netExport >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {netExport >= 0 ? '+' : ''}{netExport.toFixed(2)}
            </span>
            <span className="text-xs font-medium text-slate-400">kWh</span>
          </div>
          <div className="mt-1 text-xs font-medium text-slate-500">Net {netExport >= 0 ? 'Export' : 'Import'}</div>
        </div>
      </div>

      {/* Bar chart */}
      <div className="page-card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Daily Energy (kWh)</h2>
            <p className="text-xs text-slate-400 mt-0.5">Generation vs. Consumption by day</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />Generation
            </span>
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="w-3 h-3 rounded bg-amber-400 inline-block" />Consumption
            </span>
          </div>
        </div>

        {loading && (
          <div className="flex h-64 items-center justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-slate-200 border-t-emerald-500" />
          </div>
        )}
        {error && (
          <div className="flex h-64 items-center justify-center">
            <p className="text-sm text-rose-500">{error}</p>
          </div>
        )}
        {!loading && !error && data.length === 0 && (
          <div className="flex h-64 items-center justify-center">
            <div className="text-center">
              <svg className="w-8 h-8 text-slate-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
              </svg>
              <p className="text-sm text-slate-400">No data for last 7 days</p>
            </div>
          </div>
        )}
        {!loading && !error && data.length > 0 && (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                unit=" kWh"
                width={72}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
              <Bar dataKey="generation"  name="Generation"  fill="#10b981" radius={[5, 5, 0, 0]} maxBarSize={40} />
              <Bar dataKey="consumption" name="Consumption" fill="#fbbf24" radius={[5, 5, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
