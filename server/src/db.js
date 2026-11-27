import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Every timestamp is stored as a canonical UTC ISO string
// ("2026-11-20T10:15:00.000Z") so plain string comparison == time comparison and
// range queries can use the (turbine_id, timestamp) index.
// Site wind is kept per 5-minute slot (see site_wind below).
export const SITE_BIN = 300;

export const ISO = (expr) => `COALESCE(strftime('%Y-%m-%dT%H:%M:%fZ', ${expr}), ${expr})`;

const GENERATION_DDL = `
  CREATE TABLE IF NOT EXISTS generation (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    received_at TEXT    NOT NULL DEFAULT (datetime('now')),
    timestamp   TEXT    NOT NULL,
    turbine_id  TEXT    NOT NULL DEFAULT 'T1',
    blade       TEXT,                       -- blade material at the time of the reading
    firmware    TEXT    NOT NULL,
    voltage     REAL    NOT NULL,
    current     REAL    NOT NULL,
    rpm         REAL    NOT NULL,
    wind_speed  REAL,                       -- optional: only turbines with an anemometer
    frequency   REAL    NOT NULL,
    power       REAL    NOT NULL,
    energy      REAL    NOT NULL,
    temperature REAL,                       -- optional environmental sensors
    humidity    REAL,
    UNIQUE(turbine_id, timestamp)
  );
  CREATE INDEX IF NOT EXISTS idx_generation_ts ON generation(timestamp);
`;

export function initDb(dbPath) {
  const resolved = path.resolve(__dirname, '..', dbPath);
  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = new Database(resolved);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // ── Migration: single-turbine → multi-turbine ───────────────────────────────
  // The old table had UNIQUE(timestamp, firmware), which would silently drop a
  // second turbine's reading whenever two turbines on the same firmware report
  // at the same second. SQLite can't alter constraints, so the table is rebuilt.
  const genCols = db.prepare('PRAGMA table_info(generation)').all();
  if (genCols.length && !genCols.some(c => c.name === 'turbine_id')) {
    console.log('Migrating generation table to multi-turbine schema…');
    db.transaction(() => {
      db.exec('ALTER TABLE generation RENAME TO generation_legacy');
      db.exec(GENERATION_DDL);
      db.exec(`
        INSERT OR IGNORE INTO generation
          (received_at, timestamp, turbine_id, blade, firmware, voltage, current, rpm,
           wind_speed, frequency, power, energy, temperature, humidity)
        SELECT received_at, ${ISO('timestamp')}, 'T1', NULL, firmware, voltage, current, rpm,
               wind_speed, frequency, power, energy, temperature, humidity
        FROM generation_legacy
      `);
      db.exec('DROP TABLE generation_legacy');
      db.exec(`UPDATE consumption SET timestamp = ${ISO('timestamp')}`);
    })();
    console.log('Migration complete.');
  }

  // ── Migration: environmental sensors become optional ────────────────────────
  // Only one turbine carries the wind sensor and not every turbine has
  // temperature/humidity, so those columns must accept NULL (never a fake 0).
  const windCol = db.prepare('PRAGMA table_info(generation)').all().find(c => c.name === 'wind_speed');
  if (windCol?.notnull) {
    console.log('Migrating generation table: wind/temperature/humidity become optional…');
    const COLS = 'received_at, timestamp, turbine_id, blade, firmware, voltage, current, rpm, wind_speed, frequency, power, energy, temperature, humidity';
    db.transaction(() => {
      db.exec('ALTER TABLE generation RENAME TO generation_old');
      db.exec(GENERATION_DDL);
      db.exec(`INSERT OR IGNORE INTO generation (id, ${COLS}) SELECT id, ${COLS} FROM generation_old`);
      db.exec('DROP TABLE generation_old');
    })();
    console.log('Migration complete.');
  }

  db.exec(`
    ${GENERATION_DDL}

    CREATE TABLE IF NOT EXISTS consumption (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      received_at TEXT    NOT NULL DEFAULT (datetime('now')),
      timestamp   TEXT    NOT NULL,
      voltage     REAL    NOT NULL,
      current     REAL    NOT NULL,
      power       REAL    NOT NULL,
      energy      REAL    NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_consumption_ts ON consumption(timestamp);

    CREATE TABLE IF NOT EXISTS turbines (
      id             TEXT    PRIMARY KEY,           -- device key sent by the firmware
      name           TEXT    NOT NULL,
      blade          TEXT    NOT NULL DEFAULT 'unassigned',
      rotor_diameter REAL,                          -- metres, enables tip-speed ratio
      notes          TEXT,
      position       INTEGER NOT NULL DEFAULT 0,
      created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS firmware_release (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      version    TEXT    NOT NULL UNIQUE,
      url        TEXT    NOT NULL,
      size_bytes INTEGER NOT NULL,
      active     INTEGER NOT NULL DEFAULT 0,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT    NOT NULL UNIQUE,
      password_hash TEXT    NOT NULL
    );
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_generation_turbine_ts ON generation(turbine_id, timestamp)');

  // ── Site wind ────────────────────────────────────────────────────────────────
  // One anemometer serves the whole site. Its readings are summed per 5-minute
  // slot here so any turbine's reading can look up the site wind by primary key
  // (fast at any date range). Rebuilt from the raw readings on every start, and
  // kept current by the ingest route.
  db.exec('CREATE TABLE IF NOT EXISTS site_wind (slot INTEGER PRIMARY KEY, w_sum REAL NOT NULL, w_n INTEGER NOT NULL)');
  db.transaction(() => {
    db.exec('DELETE FROM site_wind');
    db.exec(`INSERT INTO site_wind (slot, w_sum, w_n)
             SELECT CAST(strftime('%s', timestamp) AS INTEGER) / ${SITE_BIN}, SUM(wind_speed), COUNT(*)
             FROM generation WHERE wind_speed IS NOT NULL GROUP BY 1`);
  })();

  // The original turbine always exists so legacy data has a home.
  // Rotor type, added later: horizontal-axis (classic) or vertical-axis (H-Darrieus).
  if (!db.prepare('PRAGMA table_info(turbines)').all().some(c => c.name === 'axis')) {
    db.exec("ALTER TABLE turbines ADD COLUMN axis TEXT NOT NULL DEFAULT 'horizontal'");
  }
  // PLA blades were replaced by natural fibre; carry old rows over.
  db.exec("UPDATE turbines SET blade = 'natural' WHERE blade = 'pla'");
  db.exec("UPDATE generation SET blade = 'natural' WHERE blade = 'pla'");

  const turbineCount = db.prepare('SELECT COUNT(*) AS cnt FROM turbines').get().cnt;
  if (turbineCount === 0) {
    db.prepare("INSERT INTO turbines (id, name, position) VALUES ('T1', 'Turbine 1', 1)").run();
  }

  // Seed default admin if users table is empty
  const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get();
  if (userCount.cnt === 0) {
    const hash = bcrypt.hashSync('wind@2026', 10);
    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run('Kirumbi', hash);
    console.log('Seeded default admin: Kirumbi / wind@2026');
  }

  return db;
}
