import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { ISO, SITE_BIN } from '../db.js';

// ── Units ─────────────────────────────────────────────────────────────────────
// The firmware reports power in kW; every API response converts to watts here,
// once, so the client never has to. If the firmware is changed to send watts,
// set this to 1.
const POWER_TO_W = 1000;

// The site runs on East Africa Time. Daily totals are bucketed on local days.
const TZ_OFFSET_MIN = Number(process.env.SITE_TZ_OFFSET_MIN ?? 180);
const TZ_MOD = `'${TZ_OFFSET_MIN >= 0 ? '+' : '-'}${Math.abs(TZ_OFFSET_MIN)} minutes'`;

// A turbine is "online" if it has reported within this window.
const ONLINE_WINDOW_MS = 15 * 60 * 1000;

const METRICS = {
  power:       { col: 'power',       scale: POWER_TO_W },
  rpm:         { col: 'rpm' },
  wind:        { col: 'site_wind' },   // the site anemometer, matched by time (see genWithSite)
  voltage:     { col: 'voltage' },
  current:     { col: 'current' },
  frequency:   { col: 'frequency' },
  temperature: { col: 'temperature' },
  humidity:    { col: 'humidity' },
};

const GROUP_COL = {
  turbine: 'g.turbine_id',
  blade:   "COALESCE(g.blade, 'unassigned')",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function toIso(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// Resolve ?from&to into canonical ISO strings. Defaults to the last `defHours`.
function resolveRange(q, defHours = 24) {
  const to   = toIso(q.to)   || new Date().toISOString();
  const from = toIso(q.from) || (defHours == null ? null : new Date(Date.now() - defHours * 3600e3).toISOString());
  return { from, to };
}

function rangeWhere({ from, to }, alias = 'g') {
  const parts = [], params = [];
  if (from) { parts.push(`${alias}.timestamp >= ?`); params.push(from); }
  if (to)   { parts.push(`${alias}.timestamp <= ?`); params.push(to); }
  return { sql: parts.join(' AND ') || '1=1', params };
}

// Optional ?turbines=T1,T2 filter
function turbineFilter(q, alias = 'g') {
  const ids = String(q.turbines || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!ids.length) return { sql: '1=1', params: [] };
  return { sql: `${alias}.turbine_id IN (${ids.map(() => '?').join(',')})`, params: ids };
}

const NICE_BUCKETS = [60, 120, 300, 600, 900, 1800, 3600, 7200, 10800, 21600, 43200, 86400];
function pickBucket(fromIso, toIso, points = 300) {
  const span = (new Date(toIso) - new Date(fromIso)) / 1000;
  const raw  = Math.max(60, span / points);
  return NICE_BUCKETS.find(b => b >= raw) || 86400;
}

// ── Site wind ───────────────────────────────────────────────────────────────
// The site has a single anemometer (carried by whichever turbine has one), so
// wind is a site-level reading. Every turbine's reading is matched to the site
// wind of its 5-minute slot: all blades are judged against the same wind.
const slotOf = (col) => `(CAST(strftime('%s', ${col}) AS INTEGER) / ${SITE_BIN})`;
// generation rows + site_wind column (primary-key lookup in the site_wind
// table), usable anywhere "generation" is.
const genWithSite = () =>
  `(SELECT g0.*, sw.w_sum / sw.w_n AS site_wind FROM generation g0 LEFT JOIN site_wind sw ON sw.slot = ${slotOf('g0.timestamp')})`;

const parseUtc = (s) => s ? new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z') : null;
const round = (v, d = 3) => v == null ? null : Math.round(v * 10 ** d) / 10 ** d;

function scaleRow(r) {
  if (!r) return r;
  return { ...r, power: r.power == null ? null : r.power * POWER_TO_W };
}

export function dashboardRouter(db) {
  const router = Router();

  const upsertTurbine = db.prepare(`
    INSERT OR IGNORE INTO turbines (id, name, position)
    VALUES (?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM turbines))
  `);
  const turbineBlade = db.prepare('SELECT blade FROM turbines WHERE id = ?');
  const addSiteWind = db.prepare(`
    INSERT INTO site_wind (slot, w_sum, w_n) VALUES (CAST(strftime('%s', ?) AS INTEGER) / ${SITE_BIN}, ?, 1)
    ON CONFLICT(slot) DO UPDATE SET w_sum = w_sum + excluded.w_sum, w_n = w_n + 1
  `);

  // ── Device POST endpoints (unauthenticated) ──────────────────────────────

  router.post('/generation', (req, res) => {
    try {
      const b = req.body;
      const { firmware, timestamp, voltage, current, rpm, frequency, power, energy } = b;
      // Every turbine reports its electrical/rotor parameters. Environmental
      // sensors (wind, temperature, humidity) are optional: absent → NULL, never 0.
      const required = { firmware, timestamp, voltage, current, rpm, frequency, power, energy };
      const missing = Object.entries(required).filter(([, v]) => v === undefined || v === null || v === '').map(([k]) => k);
      if (missing.length) return res.status(400).json({ error: 'Missing required fields', missing });
      const opt = (v) => (v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
      const windSpeed = opt(b.windSpeed ?? b.wind_speed), temperature = opt(b.temperature), humidity = opt(b.humidity);

      // Devices identify themselves with `turbine` (also accepts turbineId / deviceId).
      // Older firmware that sends nothing is the original turbine, T1.
      const turbineId = String(b.turbine ?? b.turbineId ?? b.deviceId ?? 'T1').trim().slice(0, 32) || 'T1';
      upsertTurbine.run(turbineId, `Turbine ${turbineId.replace(/^T/i, '')}`);
      const blade = turbineBlade.get(turbineId)?.blade;

      const inserted = db.prepare(`
        INSERT OR IGNORE INTO generation (timestamp, turbine_id, blade, firmware, voltage, current, rpm, wind_speed, frequency, power, energy, temperature, humidity)
        VALUES (${ISO('?')}, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(timestamp, timestamp, turbineId, blade === 'unassigned' ? null : blade, firmware, voltage, current, rpm, windSpeed, frequency, power, energy, temperature, humidity);
      if (inserted.changes && windSpeed != null) addSiteWind.run(timestamp, windSpeed);

      const active = db.prepare('SELECT url, size_bytes FROM firmware_release WHERE active = 1 LIMIT 1').get();
      if (active) {
        const fwUrl = active.url.startsWith('http')
          ? active.url
          : (() => {
              const host  = req.get('x-forwarded-host') || req.get('host');
              const proto = req.get('x-forwarded-proto') || req.protocol;
              return `${proto}://${host}${active.url}`;
            })();
        return res.json({ fw_url: fwUrl, fw_size: active.size_bytes });
      }
      res.json({});
    } catch (err) {
      console.error('POST /generation error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  router.post('/consumption', (req, res) => {
    try {
      const { timestamp, voltage, current, power, energy } = req.body;
      if (!timestamp) return res.status(400).json({ error: 'Missing timestamp' });
      db.prepare(`
        INSERT INTO consumption (timestamp, voltage, current, power, energy)
        VALUES (${ISO('?')}, ?, ?, ?, ?)
      `).run(timestamp, timestamp, voltage, current, power, energy);
      res.json({});
    } catch (err) {
      console.error('POST /consumption error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ── Dashboard GET endpoints (authenticated) ───────────────────────────────

  router.use(requireAuth);

  // Most recent reading of any turbine — kept for backwards compatibility.
  router.get('/latest', (req, res) => {
    try {
      const gen = db.prepare('SELECT * FROM generation ORDER BY timestamp DESC LIMIT 1').get();
      const con = db.prepare('SELECT * FROM consumption ORDER BY timestamp DESC LIMIT 1').get();
      res.json({ generation: scaleRow(gen) || null, consumption: scaleRow(con) || null });
    } catch (err) {
      console.error('GET /latest error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Everything the live fleet view needs, in one round-trip.
  router.get('/fleet', (req, res) => {
    try {
      const now        = Date.now();
      const sparkFrom  = new Date(now - 6 * 3600e3).toISOString();
      const dayStart   = db.prepare(`SELECT strftime('%Y-%m-%dT%H:%M:%fZ', datetime('now', ${TZ_MOD}, 'start of day', '-${TZ_OFFSET_MIN} minutes')) AS d`).get().d;

      const turbines = db.prepare('SELECT * FROM turbines ORDER BY position, id').all();

      const latest = db.prepare(`
        SELECT g.* FROM generation g
        JOIN (SELECT turbine_id, MAX(timestamp) AS m FROM generation GROUP BY turbine_id) x
          ON x.turbine_id = g.turbine_id AND x.m = g.timestamp
      `).all();
      const latestById = Object.fromEntries(latest.map(r => [r.turbine_id, r]));

      const today = db.prepare(`
        WITH d AS (
          SELECT turbine_id, power, wind_speed, rpm,
                 energy - LAG(energy) OVER (PARTITION BY turbine_id ORDER BY timestamp) AS de
          FROM generation WHERE timestamp >= ?
        )
        SELECT turbine_id,
               SUM(CASE WHEN de > 0 THEN de ELSE 0 END) AS kwh,
               MAX(power) AS peak, AVG(power) AS avg_power,
               AVG(rpm) AS avg_rpm, COUNT(*) AS n
        FROM d GROUP BY turbine_id
      `).all(dayStart);
      const todayById = Object.fromEntries(today.map(r => [r.turbine_id, r]));

      const bucket = 600;
      const spark = db.prepare(`
        SELECT turbine_id, (CAST(strftime('%s', timestamp) AS INTEGER) / ${bucket}) * ${bucket} AS t,
               AVG(power) AS p, AVG(wind_speed) AS w
        FROM generation WHERE timestamp >= ?
        GROUP BY turbine_id, t ORDER BY t
      `).all(sparkFrom);
      const sparkById = {};
      for (const r of spark) (sparkById[r.turbine_id] ||= []).push({ t: r.t * 1000, p: round(r.p * POWER_TO_W, 2), w: round(r.w, 2) });

      // Site wind: the latest anemometer reading, today's average and a 6 h trend.
      const windLast = db.prepare('SELECT turbine_id, wind_speed, timestamp, received_at FROM generation WHERE wind_speed IS NOT NULL ORDER BY timestamp DESC LIMIT 1').get();
      const windToday = db.prepare('SELECT AVG(wind_speed) AS avg, MAX(wind_speed) AS peak FROM generation WHERE wind_speed IS NOT NULL AND timestamp >= ?').get(dayStart);
      const windSpark = db.prepare(`
        SELECT (CAST(strftime('%s', timestamp) AS INTEGER) / ${bucket}) * ${bucket} AS t, AVG(wind_speed) AS w
        FROM generation WHERE wind_speed IS NOT NULL AND timestamp >= ? GROUP BY t ORDER BY t
      `).all(sparkFrom).map(r => ({ t: r.t * 1000, w: round(r.w, 2) }));
      const windSeen = parseUtc(windLast?.received_at);

      // Which optional sensors each turbine actually reports (last 7 days).
      const sensors = Object.fromEntries(db.prepare(`
        SELECT turbine_id, COUNT(wind_speed) AS wind, COUNT(temperature) AS temperature, COUNT(humidity) AS humidity
        FROM generation WHERE timestamp >= ? GROUP BY turbine_id
      `).all(new Date(now - 7 * 86400e3).toISOString()).map(r => [r.turbine_id, { wind: r.wind > 0, temperature: r.temperature > 0, humidity: r.humidity > 0 }]));

      const consumption = db.prepare('SELECT * FROM consumption ORDER BY timestamp DESC LIMIT 1').get();
      const conSpark = db.prepare(`
        SELECT (CAST(strftime('%s', timestamp) AS INTEGER) / ${bucket}) * ${bucket} AS t, AVG(power) AS p
        FROM consumption WHERE timestamp >= ? GROUP BY t ORDER BY t
      `).all(sparkFrom).map(r => ({ t: r.t * 1000, p: round(r.p * POWER_TO_W, 2) }));

      const conToday = db.prepare(`
        WITH d AS (SELECT energy - LAG(energy) OVER (ORDER BY timestamp) AS de FROM consumption WHERE timestamp >= ?)
        SELECT SUM(CASE WHEN de > 0 THEN de ELSE 0 END) AS kwh FROM d
      `).get(dayStart);

      res.json({
        serverTime: new Date(now).toISOString(),
        onlineWindowMs: ONLINE_WINDOW_MS,
        turbines: turbines.map(t => {
          const l = latestById[t.id];
          const seen = parseUtc(l?.received_at);
          const td = todayById[t.id];
          return {
            ...t,
            latest: scaleRow(l) || null,
            lastSeen: seen ? seen.toISOString() : null,
            online: !!seen && now - seen.getTime() < ONLINE_WINDOW_MS,
            today: td ? {
              kwh: round(td.kwh, 4), peak: round(td.peak * POWER_TO_W, 2),
              avgPower: round(td.avg_power * POWER_TO_W, 2), avgRpm: round(td.avg_rpm, 1), samples: td.n,
            } : null,
            spark: sparkById[t.id] || [],
            sensors: sensors[t.id] || { wind: false, temperature: false, humidity: false },
          };
        }),
        site: {
          wind: windLast && windSeen && now - windSeen.getTime() < ONLINE_WINDOW_MS ? round(windLast.wind_speed, 2) : null,
          windAt: windLast?.timestamp ?? null, windFrom: windLast?.turbine_id ?? null,
          windToday: windToday?.avg == null ? null : { avg: round(windToday.avg, 2), peak: round(windToday.peak, 2) },
          windSpark,
        },
        consumption: {
          latest: scaleRow(consumption) || null,
          todayKwh: round(conToday?.kwh, 4),
          spark: conSpark,
        },
      });
    } catch (err) {
      console.error('GET /fleet error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Bucketed time series of one metric, one column per turbine / blade material.
  // ?metric=power&group=turbine|blade&from&to&points=300&turbines=T1,T2&consumption=1
  router.get('/series', (req, res) => {
    try {
      const metric = METRICS[req.query.metric] || METRICS.power;
      const gcol   = GROUP_COL[req.query.group] || GROUP_COL.turbine;
      const range  = resolveRange(req.query, 24);
      const bucket = pickBucket(range.from, range.to, Math.min(1000, Number(req.query.points) || 300));
      const rw = rangeWhere(range), tf = turbineFilter(req.query);
      const scale = metric.scale || 1;

      const rows = db.prepare(`
        SELECT ${gcol} AS grp, (CAST(strftime('%s', g.timestamp) AS INTEGER) / ${bucket}) * ${bucket} AS t,
               AVG(g.${metric.col}) AS v
        FROM ${genWithSite(range)} g WHERE ${rw.sql} AND ${tf.sql}
        GROUP BY grp, t ORDER BY t
      `).all(...rw.params, ...tf.params);

      const byT = new Map();
      const groups = new Set();
      for (const r of rows) {
        if (r.v == null) continue;           // a turbine without this sensor adds no series
        groups.add(r.grp);
        if (!byT.has(r.t)) byT.set(r.t, { t: r.t * 1000 });
        byT.get(r.t)[r.grp] = round(r.v * scale, 3);
      }

      const withCon = req.query.consumption === '1' && ['power', 'voltage', 'current'].includes(req.query.metric || 'power');
      if (withCon) {
        const cw = rangeWhere(range, 'c');
        const crow = db.prepare(`
          SELECT (CAST(strftime('%s', c.timestamp) AS INTEGER) / ${bucket}) * ${bucket} AS t, AVG(c.${metric.col}) AS v
          FROM consumption c WHERE ${cw.sql} GROUP BY t
        `).all(...cw.params);
        for (const r of crow) {
          if (!byT.has(r.t)) byT.set(r.t, { t: r.t * 1000 });
          byT.get(r.t).consumption = round(r.v * scale, 3);
        }
      }

      res.json({
        bucket, from: range.from, to: range.to,
        groups: [...groups],
        points: [...byT.values()].sort((a, b) => a.t - b.t),
      });
    } catch (err) {
      console.error('GET /series error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Every parameter of ONE device over time: bucketed avg/min/max per parameter,
  // whole-range stats, and a sample of raw readings for correlation plots.
  // ?source=generation|consumption&turbine=T1&from&to&points=300
  router.get('/params', (req, res) => {
    try {
      const con = req.query.source === 'consumption';
      const keys = con ? ['power', 'voltage', 'current'] : Object.keys(METRICS);
      const range = resolveRange(req.query, 24);
      const bucket = pickBucket(range.from, range.to, Math.min(1000, Number(req.query.points) || 300));
      const rw = rangeWhere(range, 'x');
      const where = con ? rw.sql : `${rw.sql} AND x.turbine_id = ?`;
      const params = con ? rw.params : [...rw.params, String(req.query.turbine || 'T1')];
      const table = con ? 'consumption' : genWithSite(range);
      const sc = (k) => METRICS[k].scale || 1;

      const agg = keys.map(k => {
        const c = METRICS[k].col;
        return `AVG(x.${c}) AS "${k}", MIN(x.${c}) AS "${k}_min", MAX(x.${c}) AS "${k}_max"`;
      }).join(', ');

      const points = db.prepare(`
        SELECT (CAST(strftime('%s', x.timestamp) AS INTEGER) / ${bucket}) * ${bucket} AS t, ${agg}
        FROM ${table} x WHERE ${where} GROUP BY t ORDER BY t
      `).all(...params).map(r => {
        const o = { t: r.t * 1000 };
        for (const k of keys) {
          const s = sc(k);
          o[k] = round(r[k] == null ? null : r[k] * s, 3);
          o[k + '_band'] = r[k + '_min'] == null ? null : [round(r[k + '_min'] * s, 3), round(r[k + '_max'] * s, 3)];
        }
        return o;
      });

      const statSql = keys.map(k => {
        const c = METRICS[k].col;
        return `AVG(x.${c}) AS "${k}_avg", MIN(x.${c}) AS "${k}_min", MAX(x.${c}) AS "${k}_max", COUNT(x.${c}) AS "${k}_n",
                AVG(x.${c} * x.${c}) AS "${k}_sq"`;
      }).join(', ');
      const st = db.prepare(`SELECT COUNT(*) AS n, ${statSql} FROM ${table} x WHERE ${where}`).get(...params);
      const last = db.prepare(`SELECT * FROM ${table} x WHERE ${where} ORDER BY x.timestamp DESC LIMIT 1`).get(...params);
      const stats = {};
      for (const k of keys) {
        const s = sc(k), avg = st[k + '_avg'];
        const sd = avg == null ? null : Math.sqrt(Math.max(0, st[k + '_sq'] - avg * avg));
        stats[k] = {
          avg: round(avg == null ? null : avg * s, 3), min: round(st[k + '_min'] == null ? null : st[k + '_min'] * s, 3),
          max: round(st[k + '_max'] == null ? null : st[k + '_max'] * s, 3), sd: round(sd == null ? null : sd * s, 3),
          last: round(last?.[METRICS[k].col] == null ? null : last[METRICS[k].col] * s, 3),
        };
      }

      // Raw readings for scatter plots, evenly thinned to ≤ 1500.
      const step = Math.max(1, Math.ceil((st.n || 0) / 1500));
      const cols = keys.map(k => `x.${METRICS[k].col} AS "${k}"`).join(', ');
      const samples = db.prepare(`
        SELECT t, ${keys.map(k => `"${k}"`).join(', ')} FROM (
          SELECT CAST(strftime('%s', x.timestamp) AS INTEGER) * 1000 AS t, ${cols},
                 ROW_NUMBER() OVER (ORDER BY x.timestamp) AS rn
          FROM ${table} x WHERE ${where}
        ) WHERE rn % ${step} = 0
      `).all(...params).map(r => {
        for (const k of keys) if (r[k] != null) r[k] = round(r[k] * sc(k), 3);
        return r;
      });

      // Only report parameters this device actually measures (optional sensors).
      const present = keys.filter(k => st[k + '_n'] > 0);
      res.json({ source: con ? 'consumption' : 'generation', keys: present,
                 windSource: con ? null : 'site', bucket, from: range.from, to: range.to,
                 count: st.n, lastAt: last?.timestamp ?? null, points, stats, samples });
    } catch (err) {
      console.error('GET /params error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Power (and RPM) against wind speed, binned — the fair way to compare blades,
  // because it takes the wind each turbine actually saw out of the equation.
  // ?group=turbine|blade&from&to&bin=0.5&turbines=
  router.get('/power-curve', (req, res) => {
    try {
      const gcol  = GROUP_COL[req.query.group] || GROUP_COL.turbine;
      const bin   = Math.min(5, Math.max(0.1, Number(req.query.bin) || 0.5));
      const range = resolveRange(req.query, 24 * 7);
      const rw = rangeWhere(range), tf = turbineFilter(req.query);

      const bins = db.prepare(`
        SELECT ${gcol} AS grp, ROUND(g.site_wind / ${bin}) * ${bin} AS ws,
               AVG(g.power) AS p, AVG(g.rpm) AS rpm, COUNT(*) AS n
        FROM ${genWithSite(range)} g WHERE ${rw.sql} AND ${tf.sql} AND g.site_wind >= 0
        GROUP BY grp, ws HAVING n >= 2 ORDER BY ws
      `).all(...rw.params, ...tf.params);

      const total = db.prepare(`SELECT COUNT(*) AS n FROM generation g WHERE ${rw.sql} AND ${tf.sql}`).get(...rw.params, ...tf.params).n;
      const step  = Math.max(1, Math.ceil(total / 1500));
      const samples = db.prepare(`
        SELECT ${gcol} AS grp, g.site_wind AS ws, g.power AS p, g.rpm AS rpm
        FROM ${genWithSite(range)} g WHERE ${rw.sql} AND ${tf.sql} AND g.site_wind IS NOT NULL AND g.id % ${step} = 0
      `).all(...rw.params, ...tf.params);

      const groups = new Set();
      const byWs = new Map();
      for (const r of bins) {
        groups.add(r.grp);
        const k = round(r.ws, 2);
        if (!byWs.has(k)) byWs.set(k, { ws: k });
        const o = byWs.get(k);
        o[r.grp] = round(r.p * POWER_TO_W, 2);
        o[`${r.grp}__rpm`] = round(r.rpm, 1);
        o[`${r.grp}__n`] = r.n;
      }

      res.json({
        bin, from: range.from, to: range.to,
        groups: [...groups],
        curve: [...byWs.values()].sort((a, b) => a.ws - b.ws),
        samples: samples.map(s => ({ g: s.grp, ws: round(s.ws, 2), p: round(s.p * POWER_TO_W, 2), rpm: round(s.rpm, 1) })),
      });
    } catch (err) {
      console.error('GET /power-curve error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Head-to-head scoreboard. ?group=turbine|blade&from&to&turbines=
  router.get('/summary', (req, res) => {
    try {
      const group = GROUP_COL[req.query.group] ? req.query.group : 'turbine';
      const gcol  = GROUP_COL[group];
      const range = resolveRange(req.query, 24);
      const rw = rangeWhere(range), tf = turbineFilter(req.query);
      const spanBuckets = Math.max(1, (new Date(range.to) - new Date(range.from)) / 600e3);

      const rows = db.prepare(`
        WITH d AS (
          SELECT g.*, t.rotor_diameter AS dia,
                 g.energy - LAG(g.energy) OVER (PARTITION BY g.turbine_id ORDER BY g.timestamp) AS de
          FROM ${genWithSite(range)} g LEFT JOIN turbines t ON t.id = g.turbine_id
          WHERE ${rw.sql} AND ${tf.sql}
        )
        SELECT ${gcol.replace('g.', '')} AS grp,
               COUNT(*) AS n,
               COUNT(DISTINCT turbine_id) AS turbines,
               GROUP_CONCAT(DISTINCT turbine_id) AS members,
               SUM(CASE WHEN de > 0 THEN de ELSE 0 END) AS kwh,
               AVG(power) AS avg_power, MAX(power) AS peak_power,
               AVG(site_wind) AS avg_wind, MAX(site_wind) AS peak_wind,
               AVG(rpm) AS avg_rpm, MAX(rpm) AS peak_rpm,
               AVG(voltage) AS avg_voltage, AVG(current) AS avg_current,
               SUM(CASE WHEN site_wind > 1.5 THEN power ELSE 0 END) /
                 NULLIF(SUM(CASE WHEN site_wind > 1.5 THEN site_wind * site_wind * site_wind ELSE 0 END), 0) AS eff,
               AVG(CASE WHEN site_wind > 1.5 AND dia > 0 THEN (rpm * 3.14159265 / 60.0 * dia) / site_wind END) AS tsr,
               MIN(CASE WHEN power > 0.0005 THEN site_wind END) AS cut_in,
               MIN(CASE WHEN rpm > 0 THEN site_wind END) AS start_wind,
               SUM(CASE WHEN rpm > 0 THEN 1 ELSE 0 END) * 1.0 / COUNT(*) AS spin_share,
               COUNT(DISTINCT turbine_id || ':' || (CAST(strftime('%s', timestamp) AS INTEGER) / 600)) AS covered
        FROM d GROUP BY grp ORDER BY grp
      `).all(...rw.params, ...tf.params);

      res.json({
        from: range.from, to: range.to, group,
        rows: rows.map(r => ({
          group: r.grp, samples: r.n, turbines: r.turbines,
          members: r.members ? r.members.split(',').sort() : [],
          kwh: round(r.kwh, 4),
          avgPower: round(r.avg_power * POWER_TO_W, 2), peakPower: round(r.peak_power * POWER_TO_W, 2),
          avgWind: round(r.avg_wind, 2), peakWind: round(r.peak_wind, 2),
          avgRpm: round(r.avg_rpm, 1), peakRpm: round(r.peak_rpm, 1),
          avgVoltage: round(r.avg_voltage, 2), avgCurrent: round(r.avg_current, 3),
          // W per (m/s)³ above 1.5 m/s — a capture-efficiency index, proportional to Cp
          // for equal swept areas. Only meaningful relative to the other rows.
          efficiency: r.eff == null ? null : round(r.eff * POWER_TO_W, 5),
          tsr: round(r.tsr, 2),
          cutIn: round(r.cut_in, 2),
          // lowest site wind at which the rotor was turning, and share of readings spinning
          startWind: round(r.start_wind, 2), spinShare: round(r.spin_share, 3),
          coverage: round(Math.min(1, r.covered / (spanBuckets * r.turbines)), 3),
        })),
      });
    } catch (err) {
      console.error('GET /summary error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Daily kWh per group on local (EAT) days. ?days=7&group=turbine|blade
  router.get('/energy-daily', (req, res) => {
    try {
      const gcol = GROUP_COL[req.query.group] || GROUP_COL.turbine;
      const days = Math.min(90, Math.max(1, Number(req.query.days) || 7));
      const from = db.prepare(`SELECT strftime('%Y-%m-%dT%H:%M:%fZ', datetime('now', ${TZ_MOD}, 'start of day', '-${days - 1} days', '-${TZ_OFFSET_MIN} minutes')) AS d`).get().d;

      const gen = db.prepare(`
        WITH d AS (
          SELECT g.turbine_id, g.blade, g.timestamp,
                 g.energy - LAG(g.energy) OVER (PARTITION BY g.turbine_id ORDER BY g.timestamp) AS de
          FROM generation g WHERE g.timestamp >= ?
        )
        SELECT ${gcol.replace('g.', '')} AS grp, date(timestamp, ${TZ_MOD}) AS day,
               SUM(CASE WHEN de > 0 THEN de ELSE 0 END) AS kwh
        FROM d GROUP BY grp, day ORDER BY day
      `).all(from);

      const con = db.prepare(`
        WITH d AS (SELECT timestamp, energy - LAG(energy) OVER (ORDER BY timestamp) AS de FROM consumption WHERE timestamp >= ?)
        SELECT date(timestamp, ${TZ_MOD}) AS day, SUM(CASE WHEN de > 0 THEN de ELSE 0 END) AS kwh
        FROM d GROUP BY day
      `).all(from);

      const byDay = new Map();
      const start = new Date(new Date(from).getTime() + TZ_OFFSET_MIN * 60e3);
      for (let i = 0; i < days; i++) {
        const day = new Date(start.getTime() + i * 86400e3).toISOString().slice(0, 10);
        byDay.set(day, { day });
      }
      const groups = new Set();
      for (const r of gen) { groups.add(r.grp); if (byDay.has(r.day)) byDay.get(r.day)[r.grp] = round(r.kwh, 4); }
      for (const r of con) { if (byDay.has(r.day)) byDay.get(r.day).consumption = round(r.kwh, 4); }

      res.json({ days, groups: [...groups], rows: [...byDay.values()] });
    } catch (err) {
      console.error('GET /energy-daily error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ?from&to&turbines= — full unpaginated dataset for export
  router.get('/export', (req, res) => {
    try {
      const range = resolveRange(req.query, null);
      const rw = rangeWhere(range), tf = turbineFilter(req.query);
      const cw = rangeWhere(range, 'c');
      const generation  = db.prepare(`SELECT g.* FROM generation g WHERE ${rw.sql} AND ${tf.sql} ORDER BY g.timestamp ASC`).all(...rw.params, ...tf.params).map(scaleRow);
      const consumption = db.prepare(`SELECT c.* FROM consumption c WHERE ${cw.sql} ORDER BY c.timestamp ASC`).all(...cw.params).map(scaleRow);
      res.json({ generation, consumption });
    } catch (err) {
      console.error('GET /export error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ?page=N&from&to&turbines=&limit=25
  router.get('/history/:source', (req, res) => {
    try {
      const source = req.params.source === 'consumption' ? 'consumption' : 'generation';
      const page   = Math.max(1, parseInt(req.query.page) || 1);
      const limit  = Math.min(200, Math.max(5, parseInt(req.query.limit) || 25));
      const offset = (page - 1) * limit;
      const range  = resolveRange(req.query, null);
      const rw = rangeWhere(range, 'g');
      const tf = source === 'generation' ? turbineFilter(req.query) : { sql: '1=1', params: [] };

      const rows  = db.prepare(`SELECT g.* FROM ${source} g WHERE ${rw.sql} AND ${tf.sql} ORDER BY g.timestamp DESC LIMIT ? OFFSET ?`)
        .all(...rw.params, ...tf.params, limit, offset).map(scaleRow);
      const total = db.prepare(`SELECT COUNT(*) AS cnt FROM ${source} g WHERE ${rw.sql} AND ${tf.sql}`).get(...rw.params, ...tf.params).cnt;

      res.json({ rows, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
    } catch (err) {
      console.error('GET /history error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  return router;
}
