import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function initDb(dbPath) {
  const resolved = path.resolve(__dirname, '..', dbPath);
  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = new Database(resolved);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS generation (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      received_at TEXT    NOT NULL DEFAULT (datetime('now')),
      timestamp   TEXT    NOT NULL,
      firmware    TEXT    NOT NULL,
      voltage     REAL    NOT NULL,
      current     REAL    NOT NULL,
      rpm         REAL    NOT NULL,
      wind_speed  REAL    NOT NULL,
      frequency   REAL    NOT NULL,
      power       REAL    NOT NULL,
      energy      REAL    NOT NULL,
      temperature REAL    NOT NULL,
      humidity    REAL    NOT NULL,
      UNIQUE(timestamp, firmware)
    );

    CREATE TABLE IF NOT EXISTS consumption (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      received_at TEXT    NOT NULL DEFAULT (datetime('now')),
      timestamp   TEXT    NOT NULL,
      voltage     REAL    NOT NULL,
      current     REAL    NOT NULL,
      power       REAL    NOT NULL,
      energy      REAL    NOT NULL
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

  // Seed default admin if users table is empty
  const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get();
  if (userCount.cnt === 0) {
    const hash = bcrypt.hashSync('wind@2026', 10);
    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run('Kirumbi', hash);
    console.log('Seeded default admin: Kirumbi / wind@2026');
  }

  return db;
}
