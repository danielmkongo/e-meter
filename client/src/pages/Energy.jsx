import { useMemo, useState } from 'react';
import { ComposedChart, Bar, Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTheme } from '../ThemeContext.jsx';
import { useApi, usePref } from '../lib/useApi.js';
import { seriesStyle } from '../lib/materials.js';
import { fmtNum, fmtEnergy, fmtWeekday, joinVU } from '../lib/format.js';
import { qs } from '../lib/range.js';
import { axisProps, gridProps, ChartTooltip } from '../components/charts.jsx';
import { PageHeader, CardTitle, Segmented, Legend, Empty, Spinner, LoadingVeil, Icon } from '../components/ui.jsx';

export default function Energy() {
  const { isDark } = useTheme();
  const [days, setDays]   = usePref('energy.days', 7);
  const [group, setGroup] = usePref('energy.group', 'blade');
  const [hidden, setHidden] = useState([]);

  const { data: turbines } = useApi('/api/turbines');
  const { data, loading } = useApi('/api/dashboard/energy-daily' + qs({ days, group }));

  const style = (k) => seriesStyle(k, { group, turbines: turbines || [], isDark });
  const groups = data?.groups || [];
  const visible = groups.filter(g => !hidden.includes(g));
  const toggle = (k) => setHidden(h => h.includes(k) ? h.filter(x => x !== k) : [...h, k]);
  const unitWh = useMemo(() => {
    const max = Math.max(0, ...(data?.rows || []).flatMap(r => groups.map(g => r[g] || 0)));
    return max < 1;
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const scale = unitWh ? 1000 : 1;
  const unit = unitWh ? 'Wh' : 'kWh';

  const rows = useMemo(() => (data?.rows || []).map(r => {
    const o = { day: r.day };
    for (const g of groups) o[g] = r[g] != null ? r[g] * scale : null;
    if (r.consumption != null) o.consumption = r.consumption * scale;
    return o;
  }), [data, scale]); // eslint-disable-line react-hooks/exhaustive-deps

  const race = useMemo(() => {
    const acc = {};
    return rows.map(r => {
      const o = { day: r.day };
      for (const g of groups) { acc[g] = (acc[g] || 0) + (r[g] || 0); o[g] = acc[g]; }
      return o;
    });
  }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const totals = groups.map(g => ({ g, kwh: (data?.rows || []).reduce((s, r) => s + (r[g] || 0), 0) })).sort((a, b) => b.kwh - a.kwh);
  const totalGen = data ? totals.reduce((s, x) => s + x.kwh, 0) : null;
  const totalCon = data ? data.rows.reduce((s, r) => s + (r.consumption || 0), 0) : null;
  const leader = totals[0];

  const meta = { ...Object.fromEntries(groups.map(g => [g, style(g)])), consumption: style('consumption') };
  const legend = [...groups.map(g => ({ key: g, ...style(g) })), { key: 'consumption', ...style('consumption') }];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Production" title="Energy" sub="Daily energy on local (EAT) days, from each turbine's energy counter.">
        <Segmented value={group} onChange={(g) => { setGroup(g); setHidden([]); }}
                   options={[{ value: 'blade', label: 'By material' }, { value: 'turbine', label: 'By turbine' }]} />
        <Segmented value={days} onChange={setDays} options={[7, 14, 30].map(d => ({ value: d, label: `${d} days` }))} />
      </PageHeader>

      {/* Totals */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-rise">
        <div className="card card-pad">
          <div className="eyebrow">Generated</div>
          <div className="mt-2 num text-3xl font-medium text-ink">{fmtEnergy(totalGen).value} <span className="text-sm text-muted">{fmtEnergy(totalGen).unit}</span></div>
          <div className="mt-1 text-xs text-muted">All turbines · {days} days</div>
        </div>
        <div className="card card-pad">
          <div className="eyebrow">Consumed</div>
          <div className="mt-2 num text-3xl font-medium text-ink">{fmtEnergy(totalCon).value} <span className="text-sm text-muted">{fmtEnergy(totalCon).unit}</span></div>
          <div className="mt-1 text-xs text-muted">{totalCon ? `${fmtNum((totalGen / totalCon) * 100, 0)}% covered by wind` : data ? 'No load data' : ' '}</div>
        </div>
        <div className="card card-pad sm:col-span-2">
          <div className="flex items-center justify-between">
            <div className="eyebrow">Share of generation</div>
            {leader && totals.length > 1 && (
              <span className="inline-flex items-center gap-1 text-xs text-muted"><Icon name="crown" className="h-3.5 w-3.5 text-warn" /> {style(leader.g).label} leads</span>
            )}
          </div>
          <div className="mt-4 flex h-3 gap-[2px] overflow-hidden rounded-sm bg-raised">
            {totals.map(t => (
              <div key={t.g} className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-700"
                   style={{ width: `${totalGen ? (t.kwh / totalGen) * 100 : 0}%`, background: style(t.g).color }} />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
            {totals.map(t => (
              <div key={t.g} className="flex items-center gap-2 text-xs">
                <span className="h-2 w-2 rounded-full" style={{ background: style(t.g).color }} />
                <span className="text-ink/85">{style(t.g).label}</span>
                <span className="num text-muted">{joinVU(fmtEnergy(t.kwh))} · {totalGen ? fmtNum((t.kwh / totalGen) * 100, 0) : 0}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 min-[1800px]:grid-cols-2 [&>*]:min-w-0">
      <section className="card card-pad relative animate-rise" style={{ animationDelay: '80ms' }}>
        <LoadingVeil show={loading} />
        <CardTitle title="Daily energy" sub={`Bars per ${group === 'blade' ? 'material' : 'turbine'} · dashed line is household consumption`} />
        <div className="h-[340px]">
          {rows.length ? (
            <ResponsiveContainer>
              <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="22%" barGap={2}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="day" tickFormatter={fmtWeekday} {...axisProps} minTickGap={8} />
                <YAxis {...axisProps} width={52} tickFormatter={v => fmtNum(v, unitWh ? 0 : 1)}
                       label={{ value: unit, angle: -90, position: 'insideLeft', fill: 'var(--chart-tick)', fontSize: 11, dx: 4 }} />
                <Tooltip cursor={{ fill: 'rgb(var(--raised))', opacity: 0.6 }}
                         content={<ChartTooltip labelFormat={fmtWeekday} valueFormat={v => fmtNum(v, unitWh ? 0 : 2)} unit={unit} series={meta} />} />
                {visible.map(g => <Bar key={g} dataKey={g} fill={style(g).color} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />)}
                {!hidden.includes('consumption') && (
                  <Line dataKey="consumption" stroke={meta.consumption.color} strokeWidth={2} strokeDasharray="4 4" dot={false} isAnimationActive={false} connectNulls />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          ) : loading ? <div className="grid h-full place-items-center"><Spinner /></div> : <Empty />}
        </div>
        <div className="mt-4"><Legend items={legend} hidden={hidden} onToggle={toggle} /></div>
      </section>

      <section className="card card-pad animate-rise" style={{ animationDelay: '140ms' }}>
        <CardTitle title="Energy race" sub="Running total over the period. Steeper slope = more production per day." />
        <div className="h-[280px]">
          {race.length ? (
            <ResponsiveContainer>
              <LineChart data={race} margin={{ top: 8, right: 28, left: 0, bottom: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="day" tickFormatter={fmtWeekday} {...axisProps} minTickGap={8} />
                <YAxis {...axisProps} width={52} tickFormatter={v => fmtNum(v, unitWh ? 0 : 1)} />
                <Tooltip content={<ChartTooltip labelFormat={fmtWeekday} valueFormat={v => fmtNum(v, unitWh ? 0 : 2)} unit={unit} series={meta} />} />
                {visible.map(g => {
                  const s = style(g);
                  return <Line key={g} type="monotone" dataKey={g} stroke={s.color} strokeWidth={2.5} strokeDasharray={s.dash}
                               dot={{ r: 3, fill: s.color, strokeWidth: 0 }} isAnimationActive={false} />;
                })}
              </LineChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </div>
      </section>
      </div>
    </div>
  );
}
