import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { requireAuth } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const FIRMWARE_DIR = path.resolve(__dirname, '../../firmware');

// Ensure firmware directory exists
if (!fs.existsSync(FIRMWARE_DIR)) fs.mkdirSync(FIRMWARE_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, FIRMWARE_DIR),
  filename: (req, _file, cb) => {
    const version = (req.body.version || 'unknown').replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `v${version}.bin`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (_req, file, cb) => {
    if (file.originalname.endsWith('.bin') || file.mimetype === 'application/octet-stream') {
      cb(null, true);
    } else {
      cb(new Error('Only .bin files are allowed'));
    }
  },
});

export function otaRouter(db) {
  const router = Router();
  router.use(requireAuth);

  router.get('/', (req, res) => {
    try {
      const releases = db.prepare('SELECT * FROM firmware_release ORDER BY created_at DESC').all();
      res.json(releases);
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Upload a new firmware binary — multipart/form-data with fields: version, file
  router.post('/', upload.single('file'), (req, res) => {
    try {
      const { version } = req.body;
      if (!version)    return res.status(400).json({ error: 'version is required' });
      if (!req.file)   return res.status(400).json({ error: 'firmware .bin file is required' });

      const url        = `/firmware/${req.file.filename}`;
      const size_bytes = req.file.size;

      const result = db.prepare(
        'INSERT INTO firmware_release (version, url, size_bytes) VALUES (?, ?, ?)'
      ).run(version, url, size_bytes);

      res.status(201).json({ id: result.lastInsertRowid });
    } catch (err) {
      // Clean up uploaded file if DB insert failed
      if (req.file) fs.unlink(req.file.path, () => {});
      if (err.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Version already exists' });
      res.status(500).json({ error: err.message || 'Server error' });
    }
  });

  router.put('/:id/activate', (req, res) => {
    try {
      const { id } = req.params;
      if (!db.prepare('SELECT id FROM firmware_release WHERE id = ?').get(id)) {
        return res.status(404).json({ error: 'Not found' });
      }
      db.transaction(() => {
        db.prepare('UPDATE firmware_release SET active = 0').run();
        db.prepare('UPDATE firmware_release SET active = 1 WHERE id = ?').run(id);
      })();
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  router.put('/:id/deactivate', (req, res) => {
    try {
      db.prepare('UPDATE firmware_release SET active = 0 WHERE id = ?').run(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  router.delete('/:id', (req, res) => {
    try {
      const release = db.prepare('SELECT url FROM firmware_release WHERE id = ?').get(req.params.id);
      if (!release) return res.status(404).json({ error: 'Not found' });

      db.prepare('DELETE FROM firmware_release WHERE id = ?').run(req.params.id);

      // Remove the physical file if it's a locally hosted binary
      if (release.url.startsWith('/firmware/')) {
        const filePath = path.join(FIRMWARE_DIR, path.basename(release.url));
        fs.unlink(filePath, () => {}); // best-effort
      }

      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  return router;
}
