// Generates a realistic demo dataset for UI development.
//   node scripts/seed-demo.js            → writes ./data/demo.db
//   DB_PATH=./data/demo.db npm run dev   → serve it
// Never point this at the production database.
import { initDb } from '../src/db.js';

const DB = process.argv[2] || './data/demo.db';
if (/emeter\.db$/.test(DB)) { console.error('Refusing to seed the production database.'); process.exit(1); }

const db = initDb(DB);
db.exec('DELETE FROM generation; DELETE FROM consumption; DELETE FROM turbines;');

const turbines = [
  // Like the real site: one anemometer (on T1); environmental sensors vary.
  { id: 'T1', name: 'North Mast', blade: 'aluminum', d: 1.6, cp: 0.30, cutIn: 2.2, tsr: 5.2, pos: 1, wind: true,  temp: true,  hum: true },
  { id: 'T2', name: 'Ridge Mast', blade: 'pla',      d: 1.6, cp: 0.25, cutIn: 2.6, tsr: 4.6, pos: 2, wind: false, temp: true,  hum: false },
  { id: 'T3', name: 'East Mast',  blade: 'carbon',   d: 1.6, cp: 0.36, cutIn: 1.9, tsr: 6.1, pos: 3, wind: false, temp: false, hum: false },
];
const insT = db.prepare('INSERT INTO turbines (id, name, blade, rotor_diameter, position) VALUES (?, ?, ?, ?, ?)');
for (const t of turbines) insT.run(t.id, t.name, t.blade, t.d, t.pos);

const insG = db.prepare(`INSERT OR IGNORE INTO generation
  (timestamp, turbine_id, blade, firmware, voltage, current, rpm, wind_speed, frequency, power, energy, temperature, humidity)
  VALUES (?, ?, ?, '2.4.1', ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const insC = db.prepare('INSERT INTO consumption (timestamp, voltage, current, power, energy) VALUES (?, ?, ?, ?, ?)');

let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const noise = (a) => (rnd() - 0.5) * 2 * a;

const now = Date.now();
const start = now - 8 * 86400e3;
const step = 2 * 60e3;
const energy = Object.fromEntries(turbines.map(t => [t.id, 0]));
let conE = 0, gust = 0;

db.transaction(() => {
  for (let ts = start; ts <= now; ts += step) {
    const hourEAT = ((ts / 3600e3) + 3) % 24;
    const day = Math.floor(ts / 86400e3);
    // Afternoon sea-breeze profile + day-to-day variation + gusts
    const base = 3.2 + 3.4 * Math.max(0, Math.sin(((hourEAT - 8) / 14) * Math.PI)) * (0.7 + 0.5 * Math.sin(day * 1.7));
    gust = gust * 0.9 + noise(0.6);
    const iso = new Date(ts).toISOString();
    const temp = 18 + 8 * Math.max(0, Math.sin(((hourEAT - 7) / 13) * Math.PI)) + noise(0.4);
    const hum = 78 - (temp - 18) * 3 + noise(2);

    for (const t of turbines) {
      if (t.id === 'T2' && ts > now - 50 * 60e3) continue; // T2 went quiet recently → offline
      const v = Math.max(0, base + gust + noise(0.5) + (t.id === 'T3' ? -0.15 : 0));
      const A = Math.PI * (t.d / 2) ** 2;
      const on = v > t.cutIn;
      const pW = on ? Math.min(420, 0.5 * 1.15 * A * t.cp * v ** 3 * (1 + noise(0.06))) : 0;
      const rpm = v > t.cutIn * 0.7 ? (t.tsr * v * 60) / (Math.PI * t.d) * (1 + noise(0.04)) : 0;
      const volt = on ? 12 + rpm / 22 : rpm / 30;
      const cur = volt > 0 ? pW / volt / 1.732 : 0;
      energy[t.id] += (pW * step) / 3600e3 / 1000;
      insG.run(iso, t.id, t.blade, volt, cur, rpm, t.wind ? v : null, rpm / 20, pW / 1000, energy[t.id],
               t.temp ? temp + noise(0.3) : null, t.hum ? hum : null);
    }
    const load = 60 + 40 * (hourEAT > 18 || hourEAT < 6 ? 1 : 0.3) + noise(10);
    conE += (load * step) / 3600e3 / 1000;
    insC.run(iso, 229 + noise(2), load / 230, load / 1000, conE);
  }
})();

console.log('Demo data written to', DB, db.prepare('SELECT COUNT(*) c FROM generation').get());
