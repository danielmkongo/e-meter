import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

// Build a WHERE time-range fragment.
// If from/to are provided they override the default window.
function timeRange(from, to, defaultHours = 24) {
  const parts  = [];
  const params = [];
  if (from) {
    parts.push('timestamp >= ?');
    params.push(from);
  } else if (defaultHours != null) {
    parts.push(`timestamp >= datetime('now', '-${defaultHours} hours')`);
  }
  if (to) {
    parts.push('timestamp <= ?');
    params.push(to);
  }
  return {
    clause: parts.length ? 'WHERE ' + parts.join(' AND ') : '',
    params,
  };
}

export function dashboardRouter(db) {
  const router = Router();

  // ── Device POST endpoints (unauthenticated) ──────────────────────────────

  router.post('/generation', (req, res) => {
    try {
      const { firmware, timestamp, voltage, current, rpm, windSpeed, frequency, power, energy, temperature, humidity } = req.body;

      if (!firmware || !timestamp) return res.status(400).json({ error: 'Missing required fields' });

      db.prepare(`
        INSERT OR IGNORE INTO generation (timestamp, firmware, voltage, current, rpm, wind_speed, frequency, power, energy, temperature, humidity)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(timestamp, firmware, voltage, current, rpm, windSpeed, frequency, power, energy, temperature, humidity);

      const active = db.prepare('SELECT url, size_bytes FROM firmware_release WHERE active = 1 LIMIT 1').get();
      if (active) {
        const fwUrl = active.url.startsWith('http')
          ? active.url
          : `${req.protocol}://${req.get('host')}${active.url}`;
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
        VALUES (?, ?, ?, ?, ?)
      `).run(timestamp, voltage, current, power, energy);
      res.json({});
    } catch (err) {
      console.error('POST /consumption error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ── Dashboard GET endpoints (authenticated) ───────────────────────────────

  router.get('/latest', requireAuth, (req, res) => {
    try {
      const gen = db.prepare('SELECT * FROM generation ORDER BY timestamp DESC LIMIT 1').get();
      const con = db.prepare('SELECT * FROM consumption ORDER BY timestamp DESC LIMIT 1').get();
      res.json({ generation: gen || null, consumption: con || null });
    } catch (err) {
      console.error('GET /latest error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ?from=ISO&to=ISO  (default: last 24 h)
  router.get('/power-chart', requireAuth, (req, res) => {
    try {
      const { from, to } = req.query;
      const r = timeRange(from, to, 24);

      const gen = db.prepare(`
        SELECT timestamp, power FROM generation ${r.clause} ORDER BY timestamp ASC
      `).all(...r.params);

      const con = db.prepare(`
        SELECT timestamp, power FROM consumption ${r.clause} ORDER BY timestamp ASC
      `).all(...r.params);

      res.json({ generation: gen, consumption: con });
    } catch (err) {
      console.error('GET /power-chart error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  router.get('/energy-chart', requireAuth, (req, res) => {
    try {
      const gen = db.prepare(`
        SELECT date(timestamp) as day, MAX(energy) - MIN(energy) as kwh
        FROM generation
        WHERE timestamp >= datetime('now', '-7 days')
        GROUP BY date(timestamp)
        ORDER BY day ASC
      `).all();

      const con = db.prepare(`
        SELECT date(timestamp) as day, MAX(energy) - MIN(energy) as kwh
        FROM consumption
        WHERE timestamp >= datetime('now', '-7 days')
        GROUP BY date(timestamp)
        ORDER BY day ASC
      `).all();

      res.json({ generation: gen, consumption: con });
    } catch (err) {
      console.error('GET /energy-chart error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ?from=ISO&to=ISO  (default: last 24 h)
  router.get('/gen-timeseries', requireAuth, (req, res) => {
    try {
      const { from, to } = req.query;
      const r = timeRange(from, to, 24);
      const rows = db.prepare(`
        SELECT timestamp, voltage, current, rpm, wind_speed, frequency, power, temperature, humidity
        FROM generation ${r.clause} ORDER BY timestamp ASC
      `).all(...r.params);
      res.json(rows);
    } catch (err) {
      console.error('GET /gen-timeseries error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ?from=ISO&to=ISO  (default: last 24 h)
  router.get('/con-timeseries', requireAuth, (req, res) => {
    try {
      const { from, to } = req.query;
      const r = timeRange(from, to, 24);
      const rows = db.prepare(`
        SELECT timestamp, voltage, current, power
        FROM consumption ${r.clause} ORDER BY timestamp ASC
      `).all(...r.params);
      res.json(rows);
    } catch (err) {
      console.error('GET /con-timeseries error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ?from=ISO&to=ISO  — returns full unpagenated dataset for export
  router.get('/export', requireAuth, (req, res) => {
    try {
      const { from, to } = req.query;
      const r = timeRange(from, to, null);

      const generation  = db.prepare(`SELECT * FROM generation  ${r.clause} ORDER BY timestamp ASC`).all(...r.params);
      const consumption = db.prepare(`SELECT * FROM consumption ${r.clause} ORDER BY timestamp ASC`).all(...r.params);

      res.json({ generation, consumption });
    } catch (err) {
      console.error('GET /export error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ?page=N&from=ISO&to=ISO
  router.get('/history/generation', requireAuth, (req, res) => {
    try {
      const { from, to } = req.query;
      const page   = Math.max(1, parseInt(req.query.page) || 1);
      const limit  = 20;
      const offset = (page - 1) * limit;
      const r      = timeRange(from, to, null); // no default window for history

      const rows  = db.prepare(`SELECT * FROM generation ${r.clause} ORDER BY timestamp DESC LIMIT ? OFFSET ?`).all(...r.params, limit, offset);
      const total = db.prepare(`SELECT COUNT(*) as cnt FROM generation ${r.clause}`).get(...r.params).cnt;

      res.json({ rows, total, page, pages: Math.ceil(total / limit) });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ?page=N&from=ISO&to=ISO
  router.get('/history/consumption', requireAuth, (req, res) => {
    try {
      const { from, to } = req.query;
      const page   = Math.max(1, parseInt(req.query.page) || 1);
      const limit  = 20;
      const offset = (page - 1) * limit;
      const r      = timeRange(from, to, null); // no default window for history

      const rows  = db.prepare(`SELECT * FROM consumption ${r.clause} ORDER BY timestamp DESC LIMIT ? OFFSET ?`).all(...r.params, limit, offset);
      const total = db.prepare(`SELECT COUNT(*) as cnt FROM consumption ${r.clause}`).get(...r.params).cnt;

      res.json({ rows, total, page, pages: Math.ceil(total / limit) });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  return router;
}
