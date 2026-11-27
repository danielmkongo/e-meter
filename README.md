# Wind Meter · Blade Lab

Live monitoring for a small fleet of wind turbines, built to compare blade
materials (aluminium, natural fibre, carbon fibre) under the same wind.

- `server/` — Express + SQLite (better-sqlite3) API
- `client/` — React + Vite + Tailwind + Recharts dashboard

## Running

```bash
npm install && npm install --prefix server && npm install --prefix client
npm run dev            # API on :3001, UI on :5173
```

Demo data for UI work (never touches the real database):

```bash
cd server
node scripts/seed-demo.js                 # writes ./data/demo.db
DB_PATH=./data/demo.db PORT=3001 node src/index.js
```

## Multiple turbines

Each device adds a `turbine` key to the JSON it posts to
`/api/dashboard/generation`:

```json
{ "turbine": "T2", "firmware": "2.4.1", "timestamp": "2026-11-20T10:15:00Z", "...": "..." }
```

- A device that omits `turbine` is treated as **T1** (the original turbine), so
  existing firmware keeps working unchanged.
- An unknown key registers itself automatically on its first reading.
- **Required** on every reading: `firmware`, `timestamp`, `voltage`, `current`,
  `rpm`, `frequency`, `power`, `energy`. A reading missing one is rejected with
  a 400 that names the missing field.
- **Optional** environmental sensors: `windSpeed`, `temperature`, `humidity`.
  Leave them out if the turbine has no such sensor; they are stored as empty,
  never as 0.
- The site has **one wind sensor**. Whichever turbine carries it sends
  `windSpeed`, and every turbine is compared against that same site wind
  (matched in 5-minute slots) for the power curve, capture index, cut-in and
  tip-speed ratio.
- Name turbines, set blade material and rotor diameter on the **Turbines** page.
  Each reading is stamped with the blade material at the time it was recorded,
  so swapping blades later never rewrites history.

## Database

SQLite stays. At ~5 turbines reporting once a minute that is ~2.6 M rows a year,
well within what SQLite handles on one server. On first start, the server
migrates the old single-turbine table in place: existing readings become T1
and timestamps are normalised to UTC ISO.

---

## Author

Built by **Daniel Mkongo** (Daniel Godfrey Mkongo), mechatronics engineer, CEO and co-founder of [Vortan](https://vortan.io), Arusha, Tanzania. Daniel designs embedded hardware, firmware and the cloud platforms that run on top of them.

[GitHub](https://github.com/danielmkongo) · [LinkedIn](https://www.linkedin.com/in/daniel-mkongo-2a5906202)
