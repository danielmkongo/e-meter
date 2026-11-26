// Site time is East Africa Time (UTC+3, no DST).
export const EAT_OFFSET_MIN = 180;

const shift = (d) => new Date(new Date(d).getTime() + EAT_OFFSET_MIN * 60e3);

export function fmtEAT(iso, { seconds = false } = {}) {
  if (!iso) return '—';
  return shift(iso).toISOString().replace('T', ' ').slice(0, seconds ? 19 : 16);
}
export function fmtClock(t) {
  if (t == null) return '';
  return shift(t).toISOString().slice(11, 16);
}
export function fmtDay(t) {
  if (t == null) return '';
  const d = shift(t);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}
export function fmtDayTime(t) {
  return `${fmtDay(t)} ${fmtClock(t)}`;
}
export function fmtWeekday(dayStr) {
  const d = new Date(dayStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function ago(iso, now = Date.now()) {
  if (!iso) return 'never';
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

// Numbers: enough precision to compare small turbines, never noisy.
export function fmtNum(v, digits) {
  if (v == null || Number.isNaN(v)) return '—';
  const a = Math.abs(v);
  const d = digits ?? (a >= 1000 ? 0 : a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : a === 0 ? 0 : 2);
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function fmtPower(w) {
  if (w == null || Number.isNaN(w)) return { value: '—', unit: 'W' };
  if (Math.abs(w) >= 1000) return { value: fmtNum(w / 1000, 2), unit: 'kW' };
  return { value: fmtNum(w), unit: 'W' };
}
export function fmtEnergy(kwh) {
  if (kwh == null || Number.isNaN(kwh)) return { value: '—', unit: 'kWh' };
  if (Math.abs(kwh) < 1) return { value: fmtNum(kwh * 1000, kwh * 1000 >= 100 ? 0 : 1), unit: 'Wh' };
  return { value: fmtNum(kwh, 2), unit: 'kWh' };
}
export const joinVU = ({ value, unit }) => `${value} ${unit}`;
