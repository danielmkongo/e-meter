import { useState } from 'react';
import { useTheme } from '../ThemeContext.jsx';
import { api } from '../api.js';
import { useApi } from '../lib/useApi.js';
import { MATERIALS, MATERIAL_KEYS, material, materialColor } from '../lib/materials.js';
import { fmtEAT, fmtNum } from '../lib/format.js';
import { TurbineIcon } from '../components/turbine.jsx';
import { PageHeader, CardTitle, Icon, Spinner, MaterialChip, Segmented } from '../components/ui.jsx';

function MaterialPicker({ value, onChange, isDark }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {MATERIAL_KEYS.map(k => {
        const on = value === k;
        const c = materialColor(k, isDark);
        return (
          <button key={k} type="button" onClick={() => onChange(k)} aria-pressed={on}
                  className={`relative flex flex-col items-center gap-1.5 rounded-2xl border px-2 pb-2.5 pt-3 transition ${
                    on ? 'picked' : 'border-line/70 hover:bg-raised/60'}`}>
            <div className={on ? '' : 'opacity-60 grayscale'}>
              <TurbineIcon blade={k} color={c} size={26} uid={`pick-${k}`} isDark={isDark} />
            </div>
            <span className="text-xs font-medium text-ink">{MATERIALS[k].label}</span>
            {on && <span className="absolute right-2 top-2 grid h-4 w-4 place-items-center rounded-full text-white" style={{ background: c }}><Icon name="check" className="h-3 w-3" strokeWidth={2.4} /></span>}
          </button>
        );
      })}
    </div>
  );
}

const AXES = [{ value: 'horizontal', label: 'Horizontal axis' }, { value: 'vertical', label: 'Vertical axis' }];

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-faint">{hint}</span>}
    </label>
  );
}

function TurbineCard({ t, onSaved, isDark }) {
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState(t);
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState('');
  const color = materialColor(t.blade, isDark);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e?.target ? e.target.value : e }));

  async function save() {
    setBusy(true); setErr('');
    try {
      await api.put(`/api/turbines/${encodeURIComponent(t.id)}`, {
        name: form.name, blade: form.blade, axis: form.axis || 'horizontal', rotor_diameter: form.rotor_diameter, notes: form.notes,
      });
      setEdit(false); onSaved();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  async function remove() {
    if (!window.confirm(`Remove ${t.name} from the fleet?\n\nIts ${t.readings} readings are kept, and it will re-appear automatically if the device reports again.`)) return;
    await api.delete(`/api/turbines/${encodeURIComponent(t.id)}`);
    onSaved();
  }

  return (
    <div className="card overflow-hidden">
      <div className="relative flex items-end gap-4 px-6 pt-6">
        <div className="pointer-events-none absolute inset-0 opacity-60"
             style={{ background: `radial-gradient(80% 90% at 15% 100%, ${color}22, transparent 70%)` }} />
        <div className="relative -mb-1"><TurbineIcon blade={t.blade} axis={t.axis} color={color} size={52} uid={`card-${t.id}`} isDark={isDark} /></div>
        <div className="relative min-w-0 flex-1 pb-3">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-lg font-semibold text-ink">{t.name}</h3>
            <span className="rounded-md bg-raised px-1.5 py-0.5 font-mono text-[11px] text-muted">{t.id}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2"><MaterialChip blade={t.blade} />{t.axis === 'vertical' && <span className="text-[11px] text-muted">Vertical axis</span>}</div>
        </div>
        {!edit && (
          <button onClick={() => { setForm(t); setEdit(true); }} className="relative mb-3 grid h-9 w-9 place-items-center rounded-xl border border-line/70 text-muted hover:bg-raised hover:text-ink" aria-label={`Edit ${t.name}`}>
            <Icon name="edit" />
          </button>
        )}
      </div>

      {!edit ? (
        <div className="grid grid-cols-3 gap-px border-t border-line/60 bg-line/60">
          {[
            ['Readings', fmtNum(t.readings, 0)],
            ['Rotor Ø', t.rotor_diameter ? `${fmtNum(t.rotor_diameter, 2)} m` : '—'],
            ['Last seen', t.last_reading ? fmtEAT(t.last_reading).slice(5) : 'never'],
          ].map(([k, v]) => (
            <div key={k} className="bg-surface px-5 py-3.5">
              <div className="text-[10px] font-medium uppercase tracking-wider text-faint">{k}</div>
              <div className="mt-0.5 truncate num text-sm text-ink">{v}</div>
            </div>
          ))}
          {t.notes && <div className="col-span-3 bg-surface px-5 py-3 text-xs text-muted">{t.notes}</div>}
        </div>
      ) : (
        <div className="space-y-4 border-t border-line/60 p-6">
          <Field label="Name"><input className="input" value={form.name || ''} onChange={set('name')} /></Field>
          <Field label="Blade material"
                 hint="New readings are tagged with this material. Past readings keep the material they were recorded with, so swapping blades never rewrites history.">
            <MaterialPicker value={form.blade} onChange={set('blade')} isDark={isDark} />
          </Field>
          <Field label="Rotor type"><Segmented value={form.axis || 'horizontal'} onChange={set('axis')} options={AXES} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Rotor diameter (m)" hint="Enables tip-speed ratio">
              <input className="input num" type="number" step="0.01" min="0" value={form.rotor_diameter ?? ''} onChange={set('rotor_diameter')} placeholder="1.60" />
            </Field>
            <Field label="Notes"><input className="input" value={form.notes || ''} onChange={set('notes')} placeholder="Blade profile, mount…" /></Field>
          </div>
          {err && <div className="text-xs text-bad">{err}</div>}
          <div className="flex items-center gap-2">
            <button onClick={save} disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Save changes'}</button>
            <button onClick={() => setEdit(false)} className="btn-ghost">Cancel</button>
            <button onClick={remove} className="btn-danger ml-auto !px-3" aria-label="Remove turbine"><Icon name="trash" /></button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddTurbine({ existing, onSaved, isDark }) {
  const nextKey = (() => { for (let i = 1; i < 100; i++) if (!existing.includes(`T${i}`)) return `T${i}`; return ''; })();
  const [form, setForm] = useState({ id: nextKey, name: '', blade: 'natural', axis: 'horizontal', rotor_diameter: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e?.target ? e.target.value : e }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      await api.post('/api/turbines', form);
      onSaved();
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="card card-pad space-y-4">
      <CardTitle title="Add a turbine" sub="Or skip this — a device that reports with a new key registers itself." />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Device key" hint='Sent by firmware as "turbine"'>
          <input className="input font-mono" value={form.id} onChange={set('id')} required pattern="[A-Za-z0-9_\-]{1,32}" />
        </Field>
        <Field label="Name"><input className="input" value={form.name} onChange={set('name')} placeholder={`Turbine ${form.id.replace(/^T/i, '')}`} /></Field>
      </div>
      <Field label="Blade material"><MaterialPicker value={form.blade} onChange={set('blade')} isDark={isDark} /></Field>
      <Field label="Rotor type"><Segmented value={form.axis} onChange={set('axis')} options={AXES} /></Field>
      <Field label="Rotor diameter (m)"><input className="input num" type="number" step="0.01" min="0" value={form.rotor_diameter} onChange={set('rotor_diameter')} placeholder="1.60" /></Field>
      {err && <div className="text-xs text-bad">{err}</div>}
      <button disabled={busy} className="btn-primary w-full"><Icon name="plus" /> {busy ? 'Adding…' : 'Add turbine'}</button>
    </form>
  );
}

export default function Turbines() {
  const { isDark } = useTheme();
  const { data, reload } = useApi('/api/turbines');
  const [copied, setCopied] = useState(false);
  const snippet = `{
  "turbine":   "T2",        // ← new: this turbine's device key
  "firmware":  "2.4.1",
  "timestamp": "2026-11-20T10:15:00Z",
  "voltage": 24.1, "current": 1.2, "rpm": 310,
  "windSpeed": 5.4, "frequency": 15.5,
  "power": 0.052, "energy": 3.84,
  "temperature": 23.4, "humidity": 61
}`;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Configuration" title="Turbines"
                  sub="Name each turbine, set its blade material and rotor size. Up to five is the plan; nothing stops you adding more." />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 grid gap-5 md:grid-cols-2 min-[1800px]:grid-cols-3 content-start">
          {!data && <div className="col-span-2 grid h-40 place-items-center"><Spinner /></div>}
          {data?.map(t => <TurbineCard key={t.id + t.blade + t.name} t={t} onSaved={reload} isDark={isDark} />)}
        </div>
        <div className="space-y-6">
          {data && <AddTurbine key={data.length} existing={data.map(t => t.id)} onSaved={reload} isDark={isDark} />}
          <div className="card card-pad">
            <CardTitle title="Firmware payload" sub='Add a "turbine" key to the JSON each device posts to /api/dashboard/generation. Devices that omit it are treated as T1.'
                       right={<button className="chip hover:text-ink" onClick={() => { navigator.clipboard?.writeText(snippet.replace(/ *\/\/.*$/gm, '')); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                         {copied ? 'Copied' : 'Copy'}
                       </button>} />
            <pre className="overflow-x-auto rounded-2xl bg-raised/70 p-4 font-mono text-[11.5px] leading-relaxed text-ink/85">{snippet}</pre>
          </div>
          <div className="card card-pad">
            <CardTitle title="Materials" />
            <div className="space-y-3">
              {MATERIAL_KEYS.map(k => (
                <div key={k} className="flex items-start gap-3">
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: materialColor(k, isDark) }} />
                  <div>
                    <div className="text-sm font-medium text-ink">{material(k).label}</div>
                    <div className="text-xs text-muted">{material(k).blurb}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
