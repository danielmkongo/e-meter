// ── Power units ───────────────────────────────────────────────────────────────
//
// The firmware computes power as kilowatts — (√3 · V · I · PF) / 1000 — and
// sends that value verbatim; the consumption node's LoRa `P=` field is kW too.
// The `energy` field is genuinely kWh and is left alone.
//
// The UI displays watts, so every power reading is scaled on the way in, at the
// point each response is fetched. If the firmware is ever changed to send watts,
// set this to 1 — that is the only edit required.
export const POWER_TO_W = 1000;

// Scale the `power` field of a row, or of an array of rows. Everything else on
// the row is passed through untouched.
export function powerToWatts(data) {
  if (Array.isArray(data)) return data.map(powerToWatts);
  if (!data || typeof data.power !== 'number') return data;
  return { ...data, power: data.power * POWER_TO_W };
}

// Format a watt value for display. Watts don't need the milliwatt precision the
// old kW labels implied, so readings get one decimal — except sub-watt trickle,
// which would otherwise all render as "0.0".
export function fmtWatts(w) {
  if (w == null || Number.isNaN(w)) return '—';
  return Math.abs(w) < 10 ? w.toFixed(2) : w.toFixed(1);
}
