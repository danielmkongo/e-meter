import { EAT_OFFSET_MIN } from './format.js';

export const PRESETS = [
  { key: '6h',    label: '6H',    hours: 6 },
  { key: '24h',   label: '24H',   hours: 24 },
  { key: 'today', label: 'Today' },
  { key: '7d',    label: '7D',    hours: 24 * 7 },
  { key: '30d',   label: '30D',   hours: 24 * 30 },
];

// Midnight EAT today, as a UTC ISO string.
export function startOfTodayEAT(now = Date.now()) {
  const local = new Date(now + EAT_OFFSET_MIN * 60e3);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - EAT_OFFSET_MIN * 60e3).toISOString();
}

// Datetime-local input values are interpreted as EAT.
const fromLocalInput = (s) => s ? new Date(new Date(s + ':00Z').getTime() - EAT_OFFSET_MIN * 60e3).toISOString() : null;

export function resolveRange({ preset, from, to }) {
  const now = Date.now();
  if (preset === 'custom') return { from: fromLocalInput(from), to: fromLocalInput(to) || new Date(now).toISOString() };
  if (preset === 'today')  return { from: startOfTodayEAT(now), to: new Date(now).toISOString() };
  const p = PRESETS.find(x => x.key === preset) || PRESETS[1];
  return { from: new Date(now - p.hours * 3600e3).toISOString(), to: new Date(now).toISOString() };
}

export function qs(obj) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) if (v != null && v !== '' && !(Array.isArray(v) && !v.length)) p.set(k, Array.isArray(v) ? v.join(',') : v);
  const s = p.toString();
  return s ? '?' + s : '';
}

// Round "now" so a URL built from a range stays stable between renders.
export function stableRange(range) {
  const r = resolveRange(range);
  const snap = (iso) => iso && new Date(Math.floor(new Date(iso).getTime() / 60e3) * 60e3).toISOString();
  return { from: snap(r.from), to: snap(r.to) };
}
