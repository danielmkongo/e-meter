import { useEffect, useRef, useState } from 'react';

function fmtSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function Spinner() {
  return (
    <div className="flex h-24 items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-[3px] border-slate-200 border-t-emerald-500" />
    </div>
  );
}

async function apiFetch(method, path, body) {
  const opts = { method, credentials: 'include' };
  if (body instanceof FormData) {
    opts.body = body; // let browser set Content-Type with boundary
  } else if (body !== undefined) {
    opts.headers = { 'Content-Type': 'application/json' };
    opts.body = JSON.stringify(body);
  }
  const res  = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: res.status });
  return data;
}

export default function OTA() {
  const [releases, setReleases] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  const [version, setVersion]   = useState('');
  const [file, setFile]         = useState(null);
  const [adding, setAdding]     = useState(false);
  const [formErr, setFormErr]   = useState('');
  const [uploadPct, setUploadPct] = useState(null);
  const fileInputRef = useRef();

  async function load() {
    setLoading(true);
    try {
      const releases = await apiFetch('GET', '/api/ota');
      setReleases(releases);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function handleFileChange(e) {
    const f = e.target.files[0];
    if (!f) return setFile(null);
    if (!f.name.endsWith('.bin')) {
      setFormErr('Only .bin firmware files are accepted.');
      e.target.value = '';
      return;
    }
    setFormErr('');
    setFile(f);
  }

  async function handleAdd(e) {
    e.preventDefault();
    setFormErr('');
    if (!version.trim()) { setFormErr('Version is required.'); return; }
    if (!file)            { setFormErr('Please select a .bin firmware file.'); return; }

    const fd = new FormData();
    fd.append('version', version.trim());
    fd.append('file', file);

    setAdding(true);
    setUploadPct(0);

    // Use XMLHttpRequest for upload progress
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.withCredentials = true;
      xhr.open('POST', '/api/ota');

      xhr.upload.onprogress = e => {
        if (e.lengthComputable) setUploadPct(Math.round((e.loaded / e.total) * 100));
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          const data = JSON.parse(xhr.responseText || '{}');
          reject(new Error(data.error || 'Upload failed'));
        }
      };
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(fd);
    }).then(() => {
      setVersion('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      load();
    }).catch(err => {
      setFormErr(err.message);
    }).finally(() => {
      setAdding(false);
      setUploadPct(null);
    });
  }

  async function activate(id) {
    try { await apiFetch('PUT', `/api/ota/${id}/activate`);   await load(); }
    catch (err) { alert(err.message); }
  }

  async function deactivate(id) {
    try { await apiFetch('PUT', `/api/ota/${id}/deactivate`); await load(); }
    catch (err) { alert(err.message); }
  }

  async function remove(id, version) {
    if (!confirm(`Delete release v${version}?`)) return;
    try { await apiFetch('DELETE', `/api/ota/${id}`); await load(); }
    catch (err) { alert(err.message); }
  }

  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Firmware OTA</h1>
        <p className="text-sm text-slate-500 mt-0.5">Upload and manage over-the-air firmware releases for ESP32 devices</p>
      </div>

      {/* Upload form */}
      <div className="page-card">
        <div className="flex items-center gap-3 mb-6">
          <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-100">
            <svg className="w-[18px] h-[18px] text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Upload New Release</h2>
            <p className="text-xs text-slate-400">Select a compiled .bin file — size is auto-detected</p>
          </div>
        </div>

        <form onSubmit={handleAdd} className="space-y-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {/* Version */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Version</label>
              <input
                value={version}
                onChange={e => setVersion(e.target.value)}
                placeholder="1.0.1"
                className="form-input font-mono"
              />
            </div>

            {/* File */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Firmware binary</label>
              <label className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 cursor-pointer transition-all ${
                file
                  ? 'border-emerald-400 bg-emerald-50'
                  : 'border-dashed border-slate-300 bg-slate-50 hover:border-emerald-400 hover:bg-emerald-50/50'
              }`}>
                <svg className={`w-5 h-5 shrink-0 ${file ? 'text-emerald-600' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <div className="min-w-0 flex-1">
                  {file ? (
                    <>
                      <div className="text-sm font-medium text-emerald-700 truncate">{file.name}</div>
                      <div className="text-xs text-emerald-600">{fmtSize(file.size)}</div>
                    </>
                  ) : (
                    <div className="text-sm text-slate-400">Click to select .bin file</div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".bin"
                  onChange={handleFileChange}
                  className="sr-only"
                />
              </label>
            </div>
          </div>

          {formErr && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-3.5 py-3">
              <svg className="w-4 h-4 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              <p className="text-xs text-red-600 font-medium">{formErr}</p>
            </div>
          )}

          {/* Upload progress */}
          {uploadPct !== null && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Uploading…</span>
                <span className="font-semibold text-emerald-600">{uploadPct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-200"
                  style={{ width: `${uploadPct}%` }}
                />
              </div>
            </div>
          )}

          <button type="submit" disabled={adding} className="btn-primary">
            {adding ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Uploading…
              </span>
            ) : 'Upload Release'}
          </button>
        </form>
      </div>

      {/* Releases list */}
      <div className="page-card">
        <div className="flex items-center gap-3 mb-6">
          <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-slate-100">
            <svg className="w-[18px] h-[18px] text-slate-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Releases</h2>
            <p className="text-xs text-slate-400">{releases.length} release{releases.length !== 1 ? 's' : ''} registered</p>
          </div>
        </div>

        {loading && <Spinner />}
        {error && <p className="text-sm text-rose-500">{error}</p>}
        {!loading && releases.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <svg className="w-10 h-10 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
            <p className="text-sm font-medium text-slate-500">No firmware releases yet</p>
            <p className="text-xs text-slate-400 mt-1">Upload a .bin file above to get started</p>
          </div>
        )}
        {!loading && releases.length > 0 && (
          <div className="space-y-3">
            {releases.map(r => (
              <div
                key={r.id}
                className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between transition-colors ${
                  r.active ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-white hover:bg-slate-50/50'
                }`}
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-sm font-bold text-slate-900">v{r.version}</span>
                    {r.active === 1 && (
                      <span className="badge-active">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" /></svg>
                        Active
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    <span className="font-mono">{r.url.startsWith('/firmware/') ? r.url.split('/').pop() : r.url}</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    {fmtSize(r.size_bytes)}
                    <span className="mx-1.5 text-slate-300">·</span>
                    Added {r.created_at?.slice(0, 10)}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {r.active === 1 ? (
                    <button onClick={() => deactivate(r.id)} className="btn-secondary text-xs px-3 py-1.5">Deactivate</button>
                  ) : (
                    <button onClick={() => activate(r.id)}   className="btn-primary  text-xs px-3 py-1.5">Activate</button>
                  )}
                  <button
                    onClick={() => remove(r.id, r.version)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex items-start gap-3">
          <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-200 shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-slate-700 mb-1">How OTA works</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              When a generation reading arrives from the ESP32, the server checks for an active firmware release.
              If one exists, the device receives the download URL and file size. It then downloads and flashes the binary automatically.
              Only one release can be active at a time. Deleting a release also removes the file from the server.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
