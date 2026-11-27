import { useState } from 'react';
import { useAuth } from '../AuthContext.jsx';
import { useTheme } from '../ThemeContext.jsx';
import WindFarm from '../components/WindFarm.jsx';
import LogoMark from '../components/Logo.jsx';
import { MATERIAL_KEYS, material, materialColor } from '../lib/materials.js';

// Decorative trio for the hero: one turbine per blade material.
const HERO = [
  { id: 'a', name: 'Aluminium', blade: 'aluminum', online: true, latest: { rpm: 260, wind_speed: 6, power: 38 } },
  { id: 'b', name: 'Natural',   blade: 'natural',      online: true, latest: { rpm: 190, wind_speed: 6, power: 29 } },
  { id: 'c', name: 'Carbon',    blade: 'carbon',   online: true, latest: { rpm: 330, wind_speed: 6, power: 45 } },
];

export default function Login() {
  const { login } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try { await login(username, password); }
    catch (err) { setError(err.status === 401 ? 'Wrong username or password.' : err.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="grid min-h-screen bg-bg lg:grid-cols-[1.25fr_1fr]">
      <div className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-end">
        <div className="absolute inset-0">
          <WindFarm turbines={HERO} selectedId={null} isDark={isDark} allActive framed={false} labels={false} />
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-0 p-12">
          <div className="eyebrow !text-accent">Blade Lab</div>
          <div className="mt-4 flex flex-wrap gap-4">
            {MATERIAL_KEYS.map(k => (
              <span key={k} className="inline-flex items-center gap-2 text-sm text-ink/80">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: materialColor(k, isDark) }} />
                {material(k).label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="relative flex items-center justify-center px-6 py-12">
        <button onClick={toggleTheme} className="absolute right-6 top-6 text-xs text-muted hover:text-ink">
          {isDark ? 'Light' : 'Dark'} mode
        </button>
        <div className="w-full max-w-sm animate-rise">
          <div className="mb-10 flex items-center gap-2.5">
            <LogoMark size={44} />
            <div>
              <div className="text-lg font-semibold tracking-tight text-ink">Wind Meter</div>
              <div className="text-xs text-muted">Turbine monitoring</div>
            </div>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-ink">Sign in</h2>
          <p className="mt-1 text-sm text-muted">Welcome back. The turbines kept spinning.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted">Username</span>
              <input className="input" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" autoFocus required />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted">Password</span>
              <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
            </label>
            {error && <div className="rounded-xl border border-bad/30 bg-bad/10 px-3.5 py-2.5 text-sm text-bad">{error}</div>}
            <button className="btn-primary w-full !py-3" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          </form>
        </div>
      </div>
    </div>
  );
}
