import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

export const BLADE_MATERIALS = ['aluminum', 'pla', 'carbon', 'unassigned'];

function clean(body) {
  const out = {};
  if (body.name !== undefined)  out.name  = String(body.name).trim().slice(0, 60);
  if (body.blade !== undefined) out.blade = BLADE_MATERIALS.includes(body.blade) ? body.blade : 'unassigned';
  if (body.axis !== undefined)  out.axis  = body.axis === 'vertical' ? 'vertical' : 'horizontal';
  if (body.notes !== undefined) out.notes = body.notes ? String(body.notes).slice(0, 500) : null;
  if (body.rotor_diameter !== undefined) {
    const d = Number(body.rotor_diameter);
    out.rotor_diameter = Number.isFinite(d) && d > 0 ? d : null;
  }
  if (body.position !== undefined) out.position = parseInt(body.position) || 0;
  return out;
}

export function turbinesRouter(db) {
  const router = Router();
  router.use(requireAuth);

  router.get('/', (_req, res) => {
    const rows = db.prepare(`
      SELECT t.*, COUNT(g.id) AS readings, MIN(g.timestamp) AS first_reading, MAX(g.timestamp) AS last_reading
      FROM turbines t LEFT JOIN generation g ON g.turbine_id = t.id
      GROUP BY t.id ORDER BY t.position, t.id
    `).all();
    res.json(rows);
  });

  router.post('/', (req, res) => {
    const id = String(req.body.id || '').trim();
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(id)) return res.status(400).json({ error: 'Device key must be 1–32 letters, digits, - or _' });
    const c = clean(req.body);
    if (!c.name) c.name = `Turbine ${id.replace(/^T/i, '')}`;
    try {
      db.prepare(`
        INSERT INTO turbines (id, name, blade, axis, rotor_diameter, notes, position)
        VALUES (?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM turbines))
      `).run(id, c.name, c.blade || 'unassigned', c.axis || 'horizontal', c.rotor_diameter ?? null, c.notes ?? null);
      res.status(201).json(db.prepare('SELECT * FROM turbines WHERE id = ?').get(id));
    } catch (err) {
      if (String(err.message).includes('UNIQUE') || String(err.message).includes('PRIMARY')) {
        return res.status(409).json({ error: 'A turbine with that device key already exists' });
      }
      res.status(500).json({ error: 'Server error' });
    }
  });

  router.put('/:id', (req, res) => {
    const existing = db.prepare('SELECT * FROM turbines WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const c = clean(req.body);
    const keys = Object.keys(c);
    if (keys.length) {
      db.transaction(() => {
        db.prepare(`UPDATE turbines SET ${keys.map(k => `${k} = @${k}`).join(', ')} WHERE id = @id`).run({ ...c, id: req.params.id });
        // Readings that were never attributed to a material (e.g. legacy data from
        // before blades were tracked) take on the first material assigned.
        // Readings already stamped with a material keep it, so swapping blades
        // later never rewrites history.
        if (c.blade && c.blade !== 'unassigned' && req.body.backfill !== false) {
          db.prepare('UPDATE generation SET blade = ? WHERE turbine_id = ? AND blade IS NULL').run(c.blade, req.params.id);
        }
      })();
    }
    res.json(db.prepare('SELECT * FROM turbines WHERE id = ?').get(req.params.id));
  });

  // Removes the turbine from the fleet. Its readings are kept; if the device
  // reports again it re-registers automatically.
  router.delete('/:id', (req, res) => {
    const r = db.prepare('DELETE FROM turbines WHERE id = ?').run(req.params.id);
    if (!r.changes) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  });

  return router;
}
