import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { exportExcel } from '../exportExcel.js';

const EAT_OFFSET = 3 * 60;
function toEAT(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  const eat = new Date(d.getTime() + EAT_OFFSET * 60 * 1000);
  return eat.toISOString().replace('T', ' ').slice(0, 16);
}

// SQLite datetime('now') returns 'YYYY-MM-DD HH:MM:SS' (UTC, no Z) — normalise before converting
function toEATReceived(sqliteStr) {
  if (!sqliteStr) return '—';
  return toEAT(sqliteStr.replace(' ', 'T') + 'Z');
}

function Spinner() {
  return (
    <div className="flex h-24 items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-[3px] border-slate-700 border-t-emerald-500" />
    </div>
  );
}

function Pagination({ page, pages, onPage }) {
  if (pages <= 1) return null;
  const pageNums = Array.from({ length: pages }, (_, i) => i + 1);
  return (
    <div className="flex items-center justify-between mt-4 px-1">
      <span className="text-xs text-slate-400">Page {page} of {pages}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Prev
        </button>
        {pageNums.slice(Math.max(0, page - 3), Math.min(pages, page + 2)).map(n => (
          <button
            key={n}
            onClick={() => onPage(n)}
            className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
              n === page
                ? 'bg-emerald-600 text-white'
                : 'border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {n}
          </button>
        ))}
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= pages}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Next
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function GenTable({ page, onPage }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/api/dashboard/history/generation?page=${page}`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [page]);

  const headers = [
    { label: 'Timestamp (EAT)', cls: 'w-40' },
    { label: 'Received (EAT)',  cls: 'w-40' },
    { label: 'Firmware',        cls: 'w-24' },
    { label: 'V (V)',           cls: 'text-right' },
    { label: 'I (A)',           cls: 'text-right' },
    { label: 'RPM',             cls: 'text-right' },
    { label: 'Wind m/s',        cls: 'text-right' },
    { label: 'Hz',              cls: 'text-right' },
    { label: 'kW',              cls: 'text-right' },
    { label: 'kWh',             cls: 'text-right' },
    { label: '°C',              cls: 'text-right' },
    { label: 'RH %',            cls: 'text-right' },
  ];

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Generation Records</h2>
          {data && <p className="text-xs text-slate-400 mt-0.5">{data.total.toLocaleString()} records total</p>}
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-xs font-medium text-emerald-700">Generation</span>
        </div>
      </div>

      {loading ? <Spinner /> : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                  {headers.map(h => (
                    <th key={h.label} className={`px-4 py-3 text-left text-xs font-semibold text-slate-500 whitespace-nowrap ${h.cls || ''}`}>
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
                {data?.rows.map((r, i) => (
                  <tr key={r.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-50/30 dark:bg-slate-800/20'}`}>
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-700 dark:text-slate-300">{toEAT(r.timestamp)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500 dark:text-slate-400">{toEATReceived(r.received_at)}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-slate-600 dark:text-slate-300 font-mono text-xs">{r.firmware}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400 tabular-nums">{r.voltage.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400 tabular-nums">{r.current.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400 tabular-nums">{r.rpm.toFixed(0)}</td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400 tabular-nums">{r.wind_speed.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400 tabular-nums">{r.frequency.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{r.power.toFixed(3)}</td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400 tabular-nums">{r.energy.toFixed(3)}</td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400 tabular-nums">{r.temperature.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400 tabular-nums">{r.humidity.toFixed(1)}</td>
                  </tr>
                ))}
                {data?.rows.length === 0 && (
                  <tr>
                    <td colSpan={12} className="px-4 py-10 text-center text-slate-400">No records found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={data?.page} pages={data?.pages} onPage={onPage} />
        </>
      )}
    </section>
  );
}

function ConTable({ page, onPage }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/api/dashboard/history/consumption?page=${page}`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [page]);

  const headers = [
    { label: 'Timestamp (EAT)', cls: 'w-40' },
    { label: 'Received (EAT)',  cls: 'w-40' },
    { label: 'V (V)',  cls: 'text-right' },
    { label: 'I (A)',  cls: 'text-right' },
    { label: 'kW',     cls: 'text-right' },
    { label: 'kWh',    cls: 'text-right' },
  ];

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Consumption Records</h2>
          {data && <p className="text-xs text-slate-400 mt-0.5">{data.total.toLocaleString()} records total</p>}
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-xs font-medium text-amber-700">Consumption</span>
        </div>
      </div>

      {loading ? <Spinner /> : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                  {headers.map(h => (
                    <th key={h.label} className={`px-4 py-3 text-left text-xs font-semibold text-slate-500 whitespace-nowrap ${h.cls || ''}`}>
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
                {data?.rows.map((r, i) => (
                  <tr key={r.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-50/30 dark:bg-slate-800/20'}`}>
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-700 dark:text-slate-300">{toEAT(r.timestamp)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500 dark:text-slate-400">{toEATReceived(r.received_at)}</td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400 tabular-nums">{r.voltage.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400 tabular-nums">{r.current.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-amber-600 dark:text-amber-400 tabular-nums">{r.power.toFixed(3)}</td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400 tabular-nums">{r.energy.toFixed(3)}</td>
                  </tr>
                ))}
                {data?.rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400">No records found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={data?.page} pages={data?.pages} onPage={onPage} />
        </>
      )}
    </section>
  );
}

function ExportAllButton() {
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    setBusy(true);
    try {
      await exportExcel({}); // no range = all data
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
      {busy ? 'Exporting…' : 'Export all to Excel'}
    </button>
  );
}

export default function History() {
  const [genPage, setGenPage] = useState(1);
  const [conPage, setConPage] = useState(1);

  return (
    <div className="space-y-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">History</h1>
          <p className="text-sm text-slate-500 mt-0.5">Paginated records for all sensor readings</p>
        </div>
        <ExportAllButton />
      </div>
      <GenTable page={genPage} onPage={setGenPage} />
      <ConTable page={conPage} onPage={setConPage} />
    </div>
  );
}
