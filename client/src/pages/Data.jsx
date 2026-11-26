import { useState } from 'react';
import { useTheme } from '../ThemeContext.jsx';
import { useApi, usePref } from '../lib/useApi.js';
import { materialColor, material } from '../lib/materials.js';
import { fmtEAT, fmtNum } from '../lib/format.js';
import { stableRange, qs, useFitRange } from '../lib/range.js';
import { PageHeader, Segmented, RangePicker, Empty, Spinner, LoadingVeil, Icon } from '../components/ui.jsx';

const GEN_COLS = [
  { key: 'timestamp',   label: 'Time (EAT)', fmt: v => fmtEAT(v, { seconds: true }), cls: 'text-muted' },
  { key: 'turbine_id',  label: 'Turbine' },
  { key: 'power',       label: 'Power',  unit: 'W',   fmt: v => fmtNum(v) },
  { key: 'wind_speed',  label: 'Wind',   unit: 'm/s', fmt: v => fmtNum(v, 1) },
  { key: 'rpm',         label: 'RPM',                 fmt: v => fmtNum(v, 0) },
  { key: 'voltage',     label: 'Voltage', unit: 'V',  fmt: v => fmtNum(v, 1) },
  { key: 'current',     label: 'Current', unit: 'A',  fmt: v => fmtNum(v, 2) },
  { key: 'frequency',   label: 'Freq',   unit: 'Hz',  fmt: v => fmtNum(v, 1) },
  { key: 'energy',      label: 'Energy', unit: 'kWh', fmt: v => fmtNum(v, 3) },
  { key: 'temperature', label: 'Temp',   unit: '°C',  fmt: v => fmtNum(v, 1) },
  { key: 'humidity',    label: 'RH',     unit: '%',   fmt: v => fmtNum(v, 0) },
  { key: 'firmware',    label: 'FW', cls: 'text-muted' },
];
const CON_COLS = [
  { key: 'timestamp', label: 'Time (EAT)', fmt: v => fmtEAT(v, { seconds: true }), cls: 'text-muted' },
  { key: 'power',     label: 'Power',   unit: 'W',   fmt: v => fmtNum(v) },
  { key: 'voltage',   label: 'Voltage', unit: 'V',   fmt: v => fmtNum(v, 1) },
  { key: 'current',   label: 'Current', unit: 'A',   fmt: v => fmtNum(v, 3) },
  { key: 'energy',    label: 'Energy',  unit: 'kWh', fmt: v => fmtNum(v, 3) },
];

export default function Data() {
  const { isDark } = useTheme();
  const [source, setSource] = usePref('data.source', 'generation');
  const [range, setRange]   = usePref('data.range', { preset: '24h' });
  const [picked, setPicked] = useState([]);
  const [page, setPage]     = useState(1);
  const [busy, setBusy]     = useState(false);
  const [err, setErr]       = useState('');

  const { data: turbines } = useApi('/api/turbines');
  const { data: fleet } = useApi('/api/dashboard/fleet');

  // If the chosen source has gone quiet, open on the latest range with data.
  const lastAt = source === 'generation'
    ? (fleet?.turbines || []).filter(t => !picked.length || picked.includes(t.id)).map(t => t.latest?.timestamp).filter(Boolean).sort().pop()
    : fleet?.consumption?.latest?.timestamp;
  useFitRange(range, (x) => { setRange(x); setPage(1); }, lastAt, source + ':' + picked.join(','));

  const r = stableRange(range);
  const { data, loading } = useApi(`/api/dashboard/history/${source}` + qs({ page, limit: 25, from: r.from, to: r.to, turbines: source === 'generation' ? picked : [] }));

  const byId = Object.fromEntries((turbines || []).map(t => [t.id, t]));
  const cols = source === 'generation' ? GEN_COLS : CON_COLS;
  const setAnd = (fn) => (v) => { fn(v); setPage(1); };
  const togglePick = (id) => { setPicked(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]); setPage(1); };

  async function doExport() {
    setBusy(true); setErr('');
    try {
      const { exportExcel } = await import('../exportExcel.js');
      await exportExcel({ from: r.from, to: r.to, turbines: picked, names: Object.fromEntries((turbines || []).map(t => [t.id, t.name])) });
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Raw readings" title="Data" sub="Every reading as it arrived. Filter, page through, or export to Excel.">
        <button onClick={doExport} disabled={busy} className="btn-primary">
          {busy ? <Spinner className="!h-4 !w-4 !border-bg/30 !border-t-bg" /> : <Icon name="download" />}
          Export .xlsx
        </button>
      </PageHeader>
      {err && <div className="rounded-xl border border-bad/30 bg-bad/10 px-4 py-2 text-sm text-bad">{err}</div>}

      <div className="card flex flex-wrap items-center gap-3 px-4 py-3">
        <Segmented value={source} onChange={setAnd(setSource)} options={[{ value: 'generation', label: 'Generation' }, { value: 'consumption', label: 'Consumption' }]} />
        <div className="hidden h-6 w-px bg-line sm:block" />
        <RangePicker range={range} onChange={setAnd(setRange)} />
        {source === 'generation' && turbines?.length > 1 && (
          <>
            <div className="hidden h-6 w-px bg-line lg:block" />
            <div className="flex flex-wrap gap-1.5">
              {turbines.map(t => {
                const on = picked.includes(t.id);
                return (
                  <button key={t.id} onClick={() => togglePick(t.id)}
                          className={`chip ${on ? '!text-ink picked' : 'hover:text-ink'}`}
                          >
                    <span className="h-2 w-2 rounded-full" style={{ background: materialColor(t.blade, isDark) }} />
                    {t.name}
                  </button>
                );
              })}
              {picked.length > 0 && <button onClick={() => setPicked([])} className="chip hover:text-ink">Clear</button>}
            </div>
          </>
        )}
      </div>

      <section className="card relative overflow-hidden">
        <LoadingVeil show={loading} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-line/70">
                {cols.map(c => (
                  <th key={c.key} className="whitespace-nowrap px-4 py-3.5 text-left first:pl-6 last:pr-6">
                    <span className="eyebrow !text-[10px]">{c.label}</span>
                    {c.unit && <span className="ml-1 text-[10px] text-faint">{c.unit}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.rows || []).map(row => (
                <tr key={row.id} className="border-b border-line/40 transition hover:bg-raised/50">
                  {cols.map(c => {
                    if (c.key === 'turbine_id') {
                      const t = byId[row.turbine_id];
                      return (
                        <td key={c.key} className="whitespace-nowrap px-4 py-2.5">
                          <span className="inline-flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ background: materialColor(row.blade || 'unassigned', isDark) }} title={material(row.blade).label} />
                            <span className="text-ink">{t?.name || row.turbine_id}</span>
                          </span>
                        </td>
                      );
                    }
                    const v = row[c.key];
                    return <td key={c.key} className={`whitespace-nowrap px-4 py-2.5 num first:pl-6 last:pr-6 ${c.cls || 'text-ink'}`}>{c.fmt ? c.fmt(v) : v ?? '—'}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {data && !data.rows.length && <Empty />}
          {!data && <div className="grid h-60 place-items-center"><Spinner /></div>}
        </div>
        {data && data.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/70 px-6 py-3.5 text-xs text-muted">
            <span className="num">{fmtNum(data.total, 0)} readings · page {data.page} of {data.pages}</span>
            <div className="flex items-center gap-1.5">
              <button className="btn-ghost !px-3 !py-1.5 !text-xs" disabled={page <= 1} onClick={() => setPage(1)}>First</button>
              <button className="btn-ghost !px-3 !py-1.5 !text-xs" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
              <button className="btn-ghost !px-3 !py-1.5 !text-xs" disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}>Next</button>
              <button className="btn-ghost !px-3 !py-1.5 !text-xs" disabled={page >= data.pages} onClick={() => setPage(data.pages)}>Last</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
