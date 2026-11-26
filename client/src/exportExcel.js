import * as XLSX from 'xlsx';
import { api } from './api.js';
import { fmtEAT } from './lib/format.js';
import { qs } from './lib/range.js';
import { material } from './lib/materials.js';

// Power arrives from the API already in watts.
const genRows = (rows, names) => rows.map(r => ({
  'Timestamp (EAT)':  fmtEAT(r.timestamp, { seconds: true }),
  'Turbine':          names[r.turbine_id] || r.turbine_id,
  'Device key':       r.turbine_id,
  'Blade material':   material(r.blade || 'unassigned').label,
  'Firmware':         r.firmware,
  'Voltage (V)':      r.voltage,
  'Current (A)':      r.current,
  'RPM':              r.rpm,
  'Wind Speed (m/s)': r.wind_speed,
  'Frequency (Hz)':   r.frequency,
  'Power (W)':        r.power,
  'Energy (kWh)':     r.energy,
  'Temperature (°C)': r.temperature,
  'Humidity (%)':     r.humidity,
}));

const conRows = (rows) => rows.map(r => ({
  'Timestamp (EAT)': fmtEAT(r.timestamp, { seconds: true }),
  'Voltage (V)':     r.voltage,
  'Current (A)':     r.current,
  'Power (W)':       r.power,
  'Energy (kWh)':    r.energy,
}));

export async function exportExcel({ from, to, turbines = [], names = {} } = {}) {
  const data = await api.get('/api/dashboard/export' + qs({ from, to, turbines }));
  const wb = XLSX.utils.book_new();
  const gen = XLSX.utils.json_to_sheet(genRows(data.generation, names));
  gen['!cols'] = [22, 16, 10, 14, 10, 11, 11, 8, 15, 13, 10, 12, 15, 12].map(wch => ({ wch }));
  const con = XLSX.utils.json_to_sheet(conRows(data.consumption));
  con['!cols'] = [22, 11, 11, 10, 12].map(wch => ({ wch }));
  XLSX.utils.book_append_sheet(wb, gen, 'Generation');
  XLSX.utils.book_append_sheet(wb, con, 'Consumption');
  const d = (iso) => iso ? iso.slice(0, 10) : 'all';
  XLSX.writeFile(wb, `wind-meter-${d(from)}-to-${d(to)}.xlsx`);
}
