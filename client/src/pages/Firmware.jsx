import { useRef, useState } from 'react';
import { useTheme } from '../ThemeContext.jsx';
import { api } from '../api.js';
import { useApi } from '../lib/useApi.js';
import { materialColor } from '../lib/materials.js';
import { fmtEAT, ago } from '../lib/format.js';
import { PageHeader, CardTitle, Icon, Spinner, Empty, StatusDot } from '../components/ui.jsx';

function fmtSize(b) {
  if (!b) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(2)} MB`;
}

function upload(version, file, onProgress) {
  const fd = new FormData();
  fd.append('version', version);
  fd.append('file', file);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.withCredentials = true;
    xhr.open('POST', '/api/ota');
    xhr.upload.onprogress = e => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let msg = 'Upload failed';
      try { msg = JSON.parse(xhr.responseText).error || msg; } catch {}
      reject(new Error(msg));
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(fd);
  });
}

export default function Firmware() {
  const { isDark } = useTheme();
  const { data: releases, reload } = useApi('/api/ota');
  const { data: fleet } = useApi('/api/dashboard/fleet', { interval: 60_000 });
  const [version, setVersion] = useState('');
  const [file, setFile] = useState(null);
  const [pct, setPct] = useState(null);
  const [err, setErr] = useState('');
  const [drag, setDrag] = useState(false);
  const fileRef = useRef();

  const pick = (f) => {
    if (!f) return;
    if (!f.name.endsWith('.bin')) { setErr('Only .bin firmware files are accepted.'); return; }
    setErr(''); setFile(f);
  };

  async function submit(e) {
    e.preventDefault();
    if (!version.trim()) return setErr('Version is required.');
    if (!file) return setErr('Choose a .bin file.');
    setErr(''); setPct(0);
    try {
      await upload(version.trim(), file, setPct);
      setVersion(''); setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      reload();
    } catch (e2) { setErr(e2.message); } finally { setPct(null); }
  }

  const act = async (fn) => { try { await fn(); reload(); } catch (e) { setErr(e.message); } };
  const active = releases?.find(r => r.active);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Over-the-air" title="Firmware"
                  sub="Upload a build and activate it. Every turbine picks up the active release on its next report." />
      {err && <div className="rounded-xl border border-bad/30 bg-bad/10 px-4 py-2 text-sm text-bad">{err}</div>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Fleet versions */}
          <section className="card card-pad">
            <CardTitle title="Running on the fleet" sub={active ? `Active release: v${active.version}` : 'No release is active — devices keep their current build.'} />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {(fleet?.turbines || []).map(t => {
                const fw = t.latest?.firmware;
                const current = active && fw === active.version;
                return (
                  <div key={t.id} className="flex items-center gap-3 rounded-2xl border border-line/70 bg-raised/40 p-3.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: materialColor(t.blade, isDark) }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-ink">{t.name}</span>
                        <StatusDot online={t.online} label={false} />
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs">
                        <span className="font-mono text-ink/85">{fw ? `v${fw}` : '—'}</span>
                        {active && fw && (current
                          ? <span className="text-good">up to date</span>
                          : <span className="text-warn">update pending</span>)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Releases */}
          <section className="card overflow-hidden">
            <div className="card-pad !pb-0"><CardTitle title="Releases" /></div>
            {!releases ? <div className="grid h-32 place-items-center"><Spinner /></div>
              : !releases.length ? <Empty title="No releases yet" icon="firmware" /> : (
              <ul className="divide-y divide-line/60">
                {releases.map(r => (
                  <li key={r.id} className="flex flex-wrap items-center gap-4 px-6 py-4">
                    <div className={`grid h-10 w-10 place-items-center rounded-xl ${r.active ? 'bg-accent/15 text-accent' : 'bg-raised text-faint'}`}>
                      <Icon name="firmware" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium text-ink">v{r.version}</span>
                        {r.active ? <span className="rounded-sm bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">Active</span> : null}
                      </div>
                      <div className="mt-0.5 text-xs text-muted">{fmtSize(r.size_bytes)} · uploaded {ago(r.created_at.replace(' ', 'T') + 'Z')} · {fmtEAT(r.created_at.replace(' ', 'T') + 'Z')}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.active
                        ? <button className="btn-ghost !py-1.5 !text-xs" onClick={() => act(() => api.put(`/api/ota/${r.id}/deactivate`))}>Deactivate</button>
                        : <button className="btn-primary !py-1.5 !text-xs" onClick={() => act(() => api.put(`/api/ota/${r.id}/activate`))}>Activate</button>}
                      <button className="btn-danger !px-2.5 !py-1.5" aria-label={`Delete v${r.version}`}
                              onClick={() => window.confirm(`Delete release v${r.version}?`) && act(() => api.delete(`/api/ota/${r.id}`))}>
                        <Icon name="trash" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Upload */}
        <form onSubmit={submit} className="card card-pad h-fit space-y-4">
          <CardTitle title="Upload a release" sub="Compiled ESP32 .bin, up to 10 MB" />
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">Version</span>
            <input className="input font-mono" value={version} onChange={e => setVersion(e.target.value)} placeholder="2.5.0" />
          </label>
          <label
            onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${
              drag || file ? 'border-accent/60 bg-accent/5' : 'border-line hover:border-faint'}`}>
            <Icon name="upload" className={`h-6 w-6 ${file ? 'text-accent' : 'text-faint'}`} />
            {file ? (
              <><span className="max-w-full truncate font-mono text-sm text-ink">{file.name}</span><span className="text-xs text-muted">{fmtSize(file.size)}</span></>
            ) : (
              <><span className="text-sm text-ink">Drop a .bin here</span><span className="text-xs text-muted">or click to browse</span></>
            )}
            <input ref={fileRef} type="file" accept=".bin" className="sr-only" onChange={e => pick(e.target.files[0])} />
          </label>
          {pct != null && (
            <div className="h-1.5 overflow-hidden rounded-full bg-raised">
              <div className="h-full rounded-sm bg-accent transition-all" style={{ width: `${pct}%` }} />
            </div>
          )}
          <button className="btn-primary w-full" disabled={pct != null}>{pct != null ? `Uploading ${pct}%` : 'Upload release'}</button>
        </form>
      </div>
    </div>
  );
}
