// Simulates live devices for the demo: posts a reading for each demo turbine
// (and the consumption meter) every 20 s, exactly like real firmware would.
//   node scripts/demo-feed.js [http://localhost:3001]
import Database from 'better-sqlite3';

const BASE = process.argv[2] || 'http://localhost:3001';
const db = new Database('./data/demo.db', { readonly: true });

const T = [
  { id: 'T1', cp: 0.30, cutIn: 2.2, tsr: 5.2, wind: true, temp: true, hum: true },   // carries the anemometer
  { id: 'T2', cp: 0.25, cutIn: 2.6, tsr: 4.6, temp: true },
  { id: 'T3', cp: 0.36, cutIn: 1.9, tsr: 6.1 },
];
const D = 1.6, A = Math.PI * (D / 2) ** 2;
const energy = Object.fromEntries(T.map(t => [t.id,
  db.prepare('SELECT energy FROM generation WHERE turbine_id = ? ORDER BY timestamp DESC LIMIT 1').get(t.id)?.energy ?? 0]));
let conE = db.prepare('SELECT energy FROM consumption ORDER BY timestamp DESC LIMIT 1').get()?.energy ?? 0;
db.close();

let gust = 0, last = Date.now();
const noise = (a) => (Math.random() - 0.5) * 2 * a;
const post = (path, body) => fetch(BASE + '/api/dashboard/' + path, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}).catch(e => console.error(path, e.message));

async function tick() {
  const now = Date.now(), dt = now - last; last = now;
  const hourEAT = ((now / 3600e3) + 3) % 24;
  const base = 3.4 + 3 * Math.max(0, Math.sin(((hourEAT - 8) / 14) * Math.PI));
  gust = gust * 0.8 + noise(0.9);
  const timestamp = new Date(now).toISOString();
  for (const t of T) {
    const v = Math.max(0, base + gust + noise(0.4));
    const on = v > t.cutIn;
    const pW = on ? 0.5 * 1.15 * A * t.cp * v ** 3 * (1 + noise(0.05)) : 0;
    const rpm = v > t.cutIn * 0.7 ? (t.tsr * v * 60) / (Math.PI * D) * (1 + noise(0.03)) : 0;
    const voltage = on ? 12 + rpm / 22 : rpm / 30;
    energy[t.id] += (pW * dt) / 3600e3 / 1000;
    await post('generation', {
      turbine: t.id, firmware: '2.4.1', timestamp, voltage, current: voltage ? pW / voltage / 1.732 : 0,
      rpm, frequency: rpm / 20, power: pW / 1000, energy: energy[t.id],
      ...(t.wind && { windSpeed: v }), ...(t.temp && { temperature: 22 + noise(0.5) }), ...(t.hum && { humidity: 64 + noise(2) }),
    });
  }
  const load = 70 + noise(15);
  conE += (load * dt) / 3600e3 / 1000;
  await post('consumption', { timestamp, voltage: 229 + noise(2), current: load / 230, power: load / 1000, energy: conE });
  console.log(timestamp, 'posted');
}

tick();
setInterval(tick, 20_000);
