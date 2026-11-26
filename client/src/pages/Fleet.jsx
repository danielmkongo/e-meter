import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTheme } from '../ThemeContext.jsx';
import { useApi, usePref } from '../lib/useApi.js';
import { material, materialColor, consumptionColor, MATERIAL_KEYS } from '../lib/materials.js';
import { fmtPower, fmtEnergy, fmtNum, fmtClock, ago, joinVU } from '../lib/format.js';
import { startOfTodayEAT, qs } from '../lib/range.js';
import WindFarm from '../components/WindFarm.jsx';
import Sparkline from '../components/Sparkline.jsx';
import { TurbineIcon } from '../components/turbine.jsx';
import { axisProps, gridProps, ChartTooltip } from '../components/charts.jsx';
import { Icon, PageHeader, CardTitle, StatusDot, MaterialChip, Stat, Spinner, Empty, Legend } from '../components/ui.jsx';

// ── Floating parameter panel ──────────────────────────────────────────────────
function TurbinePanel({ t, site, isDark }) {
  const l = t.latest;
  const color = materialColor(t.blade, isDark);
  const p = fmtPower(t.online ? l?.power : null);
  const e = fmtEnergy(t.today?.kwh);
  // Wind comes from the single site anemometer, whichever turbine carries it.
  const wind = site?.wind ?? null;
  const tsr = l && t.rotor_diameter && wind > 0.5 ? (l.rpm * Math.PI / 60 * t.rotor_diameter) / wind : null;
  const has = t.sensors || {};

  const params = [
    { k: 'wind', label: 'Site wind', value: fmtNum(wind, 1), unit: 'm/s' },
    { k: 'rpm', label: 'Rotor',     value: fmtNum(l?.rpm, 0),        unit: 'rpm' },
    { k: 'rpm', label: 'Tip-speed', value: tsr ? fmtNum(tsr, 1) : '—', unit: tsr ? 'λ' : '' },
    { k: 'voltage', label: 'Voltage',   value: fmtNum(l?.voltage, 1),    unit: 'V' },
    { k: 'current', label: 'Current',   value: fmtNum(l?.current, 2),    unit: 'A' },
    { k: 'frequency', label: 'Frequency', value: fmtNum(l?.frequency, 1),  unit: 'Hz' },
    has.temperature && { k: 'temperature', label: 'Temp',      value: fmtNum(l?.temperature, 1), unit: '°C' },
    has.humidity && { k: 'humidity', label: 'Humidity',  value: fmtNum(l?.humidity, 0),   unit: '%' },
    { k: 'power', label: 'Today',     value: e.value, unit: e.unit },
  ].filter(Boolean);

  return (
    <div className="overflow-hidden rounded-3xl border border-line/80 bg-surface shadow-2xl">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-base font-semibold text-ink">{t.name}</h3>
              <span className="rounded-md bg-raised px-1.5 py-0.5 font-mono text-[10px] text-muted">{t.id}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <MaterialChip blade={t.blade} />
              <StatusDot online={t.online} />
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-end justify-between gap-3">
          <div>
            <div className="eyebrow !text-[10px]">Output now</div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="num text-[40px] leading-none font-semibold text-ink">{p.value}</span>
              <span className="text-sm text-muted">{p.unit}</span>
            </div>
          </div>
          <div className="text-right text-[11px] text-muted leading-relaxed">
            <div>Peak today <span className="num text-ink">{joinVU(fmtPower(t.today?.peak))}</span></div>
            <div>Avg rotor <span className="num text-ink">{fmtNum(t.today?.avgRpm, 0)} rpm</span></div>
          </div>
        </div>

        <div className="mt-3">
          <Sparkline data={t.spark} color={color} height={46} format={v => fmtNum(v)} unit=" W" />
          <div className="mt-1 flex justify-between text-[10px] text-faint num">
            <span>6 h ago</span><span>now</span>
          </div>
        </div>

        {!t.online && l && <div className="mt-4 -mb-2 text-[10px] font-medium uppercase tracking-wider text-faint">Last known values</div>}
        <div className={`mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-line/70 bg-line/70 transition ${t.online ? '' : 'opacity-55'}`}>
          {params.map(x => (
            <Link key={x.label} to={`/inspect/${t.id}?p=${x.k}`} title={`Open ${x.label.toLowerCase()} history`}
                  className="group/p bg-surface px-3 py-2.5 transition hover:bg-raised">
              <div className="text-[10px] font-medium uppercase tracking-wider text-faint">{x.label}</div>
              <div className="mt-0.5 flex items-baseline gap-1">
                <span className="num text-[15px] font-medium text-ink">{x.value}</span>
                <span className="text-[10px] text-muted">{x.unit}</span>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between text-[11px] text-muted">
          <span>Seen {ago(t.lastSeen)} · fw <span className="font-mono">{l?.firmware ?? '—'}</span></span>
          <Link to={`/inspect/${t.id}`} className="inline-flex items-center gap-1 font-medium text-ink hover:text-accent transition">
            Inspect <Icon name="arrow" className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Turbine strip ─────────────────────────────────────────────────────────────
function TurbineStrip({ turbines, selectedId, onSelect, isDark }) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:px-0"
         style={{ gridTemplateColumns: `repeat(${Math.min(turbines.length, 5)}, minmax(0, 1fr))` }}>
      {turbines.map(t => {
        const on = t.id === selectedId;
        const color = materialColor(t.blade, isDark);
        const p = fmtPower(t.online ? t.latest?.power : null);
        return (
          <button key={t.id} onClick={() => onSelect(t.id)}
                  className={`group relative min-w-[210px] overflow-hidden rounded-2xl border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                    on ? 'picked' : 'border-line/70 bg-surface/50 hover:border-line hover:bg-surface'}`}>
            {on && <span className="absolute inset-x-0 bottom-0 h-0.5" style={{ background: color }} />}
            <div className="flex items-start gap-3">
              <div className={`transition ${on ? '' : 'opacity-60 grayscale group-hover:opacity-90'}`}>
                <TurbineIcon blade={t.blade} axis={t.axis} color={color} size={30} uid={`strip-${t.id}`} isDark={isDark} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-ink">{t.name}</span>
                  <StatusDot online={t.online} label={false} />
                </div>
                <div className="mt-0.5 text-[11px] text-muted">{material(t.blade).label}</div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="num text-xl font-medium text-ink">{p.value}</span>
                  <span className="text-xs text-muted">{p.unit}</span>
                  <span className="ml-auto num text-[11px] text-faint">{t.online ? fmtNum(t.latest?.rpm, 0) : '—'} rpm</span>
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Blade showdown (today) ────────────────────────────────────────────────────
function Showdown({ rows, isDark }) {
  const present = MATERIAL_KEYS.filter(k => rows.some(r => r.group === k));
  if (!present.length) return <Empty title="No blade materials reporting today" sub="Assign blade materials on the Turbines page." />;

  const metrics = [
    { key: 'kwh', label: 'Energy', fmt: v => joinVU(fmtEnergy(v)), better: 'high' },
    { key: 'avgPower', label: 'Avg power', fmt: v => `${fmtNum(v)} W`, better: 'high' },
    { key: 'efficiency', label: 'Capture index', fmt: v => v == null ? '—' : `${fmtNum(v, 0)}`, better: 'high', rel: true },
    { key: 'avgRpm', label: 'Avg rotor speed', fmt: v => v == null ? '—' : `${fmtNum(v, 0)} rpm`, better: 'high' },
  ];

  return (
    <div className="space-y-5">
      {metrics.map(m => {
        const vals = present.map(k => ({ k, v: rows.find(r => r.group === k)?.[m.key] }));
        const valid = vals.filter(x => x.v != null);
        const max = Math.max(...valid.map(x => x.v), 1e-9);
        const best = valid.length > 1 ? (m.better === 'low' ? valid.reduce((a, b) => (b.v < a.v ? b : a)) : valid.reduce((a, b) => (b.v > a.v ? b : a))).k : null;
        return (
          <div key={m.key}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-muted">{m.label}</span>
              {m.better === 'low' && <span className="text-[10px] text-faint">lower is better</span>}
            </div>
            <div className="space-y-1.5">
              {vals.map(({ k, v }) => {
                const shown = m.rel && v != null ? (v / max) * 100 : v;
                return (
                  <div key={k} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 truncate text-xs text-ink/85">{material(k).label}</span>
                    <div className="relative h-2 flex-1 overflow-hidden rounded-sm bg-raised">
                      <div className="absolute inset-y-0 left-0 rounded-sm transition-all duration-700"
                           style={{ width: `${v == null ? 0 : Math.max(3, (v / max) * 100)}%`, background: materialColor(k, isDark) }} />
                    </div>
                    <span className="w-20 shrink-0 text-right num text-xs text-ink">{m.fmt(shown)}</span>
                    <span className={`w-4 shrink-0 ${best === k ? 'text-warn' : 'text-transparent'}`} title={best === k ? 'Leader' : undefined}>
                      <Icon name="crown" className="h-3.5 w-3.5" />
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <p className="flex gap-2 text-[11px] leading-relaxed text-faint">
        <Icon name="info" className="mt-px h-3.5 w-3.5 shrink-0" />
        Capture index = power ÷ (site wind)³ above 1.5 m/s, scaled so the leader is 100. Every turbine is measured against the same wind sensor, so it's the fairest single number for comparing blades.
      </p>
    </div>
  );
}

// ── Site balance ──────────────────────────────────────────────────────────────
function SiteBalance({ fleet, isDark }) {
  const genNow = fleet.turbines.reduce((s, t) => s + (t.online ? t.latest?.power || 0 : 0), 0);
  const conNow = fleet.consumption.latest?.power ?? null;
  const genToday = fleet.turbines.reduce((s, t) => s + (t.today?.kwh || 0), 0);
  const conToday = fleet.consumption.todayKwh;

  const series = useMemo(() => {
    const m = new Map();
    for (const t of fleet.turbines) for (const p of t.spark) {
      const o = m.get(p.t) || { t: p.t, generation: 0 };
      o.generation += p.p || 0;
      m.set(p.t, o);
    }
    for (const p of fleet.consumption.spark) {
      const o = m.get(p.t) || { t: p.t };
      o.consumption = p.p;
      m.set(p.t, o);
    }
    return [...m.values()].sort((a, b) => a.t - b.t);
  }, [fleet]);

  const [hidden, setHidden] = useState([]);
  const toggle = (k) => setHidden(h => h.includes(k) ? h.filter(x => x !== k) : [...h, k]);
  const genColor = isDark ? '#2dd4bf' : '#0d9488';
  const conColor = consumptionColor(isDark);
  const net = conNow == null ? null : genNow - conNow;
  const cover = conToday ? Math.min(999, (genToday / conToday) * 100) : null;

  const seriesMeta = {
    generation: { color: genColor, label: 'Generation' },
    consumption: { color: conColor, label: 'Consumption', dash: '4 4' },
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-4">
        <Stat label="Generating" value={fmtPower(genNow).value} unit={fmtPower(genNow).unit} />
        <Stat label="Load" value={fmtPower(conNow).value} unit={fmtPower(conNow).unit} />
        <Stat label="Net" value={net == null ? '—' : (net >= 0 ? '+' : '−') + fmtPower(Math.abs(net)).value} unit={fmtPower(net).unit}
              hint={net == null ? null : net >= 0 ? 'Exporting surplus' : 'Drawing from storage/grid'} />
      </div>
      <div className="mt-5 h-[260px]">
        {series.length > 1 ? (
          <ResponsiveContainer>
            <AreaChart data={series} margin={{ top: 6, right: 4, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="sb-gen" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor={genColor} stopOpacity=".3" />
                  <stop offset="1" stopColor={genColor} stopOpacity="0" />
                </linearGradient>
              </defs>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} tickFormatter={fmtClock} {...axisProps} minTickGap={40} />
              <YAxis {...axisProps} width={48} tickFormatter={v => fmtNum(v, 0)} />
              <Tooltip content={<ChartTooltip labelFormat={fmtClock} valueFormat={v => fmtNum(v)} unit="W" series={seriesMeta} />} />
              <Area hide={hidden.includes('generation')} type="monotone" dataKey="generation" stroke={genColor} strokeWidth={2} fill="url(#sb-gen)" connectNulls dot={false} />
              <Area hide={hidden.includes('consumption')} type="monotone" dataKey="consumption" stroke={conColor} strokeWidth={2} strokeDasharray="4 4" fill="none" connectNulls dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        ) : <Empty title="Waiting for readings" />}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <Legend items={[{ key: 'generation', ...seriesMeta.generation }, { key: 'consumption', ...seriesMeta.consumption }]} hidden={hidden} onToggle={toggle} />
        <span className="text-xs text-muted">
          Today <span className="num text-ink">{joinVU(fmtEnergy(genToday))}</span> made ·{' '}
          <span className="num text-ink">{joinVU(fmtEnergy(conToday))}</span> used
          {cover != null && <> · <span className="num text-ink">{fmtNum(cover, 0)}%</span> covered</>}
        </span>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Fleet() {
  const { isDark } = useTheme();
  const { data: fleet, error } = useApi('/api/dashboard/fleet', { interval: 30_000 });
  const todayFrom = startOfTodayEAT();
  const { data: summary } = useApi('/api/dashboard/summary' + qs({ group: 'blade', from: todayFrom }), { interval: 60_000 });
  const [selected, setSelected] = usePref('fleet.selected', null);

  if (error && !fleet) return <Empty title="Couldn't reach the server" sub={error.message} icon="info" />;
  if (!fleet) return <div className="grid h-[60vh] place-items-center"><Spinner /></div>;

  const turbines = fleet.turbines;
  const selectedId = turbines.some(t => t.id === selected) ? selected : turbines[0]?.id;
  const online = turbines.filter(t => t.online).length;
  const totalPower = turbines.reduce((s, t) => s + (t.online ? t.latest?.power || 0 : 0), 0);
  const site = fleet.site || {};
  const tp = fmtPower(totalPower);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={`Live · ${online} of ${turbines.length} turbines reporting`} title="Fleet">
        <div className="flex items-center gap-5 rounded-2xl border border-line/70 bg-surface/60 px-4 py-2.5">
          <div>
            <div className="eyebrow !text-[10px]">Fleet output</div>
            <div className="num text-lg font-medium text-ink">{tp.value} <span className="text-xs text-muted">{tp.unit}</span></div>
          </div>
          <div className="h-8 w-px bg-line" />
          <div>
            <div className="eyebrow !text-[10px]">Site wind</div>
            <div className="num text-lg font-medium text-ink">{fmtNum(site.wind, 1)} <span className="text-xs text-muted">m/s</span></div>
          </div>
        </div>
      </PageHeader>

      {turbines.length ? (
        <>
          <div className="animate-rise" style={{ animationDelay: '60ms' }}>
            <WindFarm turbines={turbines} selectedId={selectedId} onSelect={setSelected} isDark={isDark} siteWind={site.wind}
                      renderPanel={(t) => <TurbinePanel t={t} site={site} isDark={isDark} />} />
          </div>
          <div className="animate-rise" style={{ animationDelay: '120ms' }}>
            <TurbineStrip turbines={turbines} selectedId={selectedId} onSelect={setSelected} isDark={isDark} />
          </div>
        </>
      ) : (
        <div className="card"><Empty title="No turbines yet" sub="Add one on the Turbines page, or just power one on — devices register themselves on their first reading.">
          <Link to="/turbines" className="btn-primary mt-4"><Icon name="plus" /> Add turbine</Link>
        </Empty></div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="card card-pad lg:col-span-2 animate-rise" style={{ animationDelay: '180ms' }}>
          <CardTitle title="Blade showdown" sub="Today so far, by blade material"
                     right={<Link to="/compare" className="text-xs font-medium text-muted hover:text-ink inline-flex items-center gap-1">Deep compare <Icon name="arrow" className="h-3.5 w-3.5" /></Link>} />
          {summary ? <Showdown rows={summary.rows} isDark={isDark} /> : <div className="grid h-40 place-items-center"><Spinner /></div>}
        </section>
        <section className="card card-pad lg:col-span-3 animate-rise" style={{ animationDelay: '220ms' }}>
          <CardTitle title="Site balance" sub="All turbines vs. household load · last 6 hours" />
          <SiteBalance fleet={fleet} isDark={isDark} />
        </section>
      </div>
    </div>
  );
}
