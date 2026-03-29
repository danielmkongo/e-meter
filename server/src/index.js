import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { initDb } from './db.js';
import { authRouter } from './routes/auth.js';
import { dashboardRouter } from './routes/dashboard.js';
import { otaRouter, FIRMWARE_DIR } from './routes/ota.js';

const PORT = process.env.PORT || 3001;
const db = initDb(process.env.DB_PATH || './data/emeter.db');

const app = express();

// CORS — allow the frontend origin (set CLIENT_ORIGIN in production)
const allowedOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json());
app.use(cookieParser());

// Serve uploaded firmware binaries
app.use('/firmware', express.static(FIRMWARE_DIR));

app.use('/api/auth',      authRouter(db));
app.use('/api/dashboard', dashboardRouter(db));
app.use('/api/ota',       otaRouter(db));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
