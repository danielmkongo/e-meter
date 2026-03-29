import * as XLSX from 'xlsx';
import { api } from './api.js';

const EAT_OFFSET = 3 * 60;

function toEAT(isoStr) {
  if (!isoStr) return '';
  const eat = new Date(new Date(isoStr).getTime() + EAT_OFFSET * 60 * 1000);
  return eat.toISOString().replace('T', ' ').slice(0, 19) + ' EAT';
}

function genRows(rows) {
  return rows.map(r => ({
    'Timestamp (EAT)': toEAT(r.timestamp),
    'Firmware':        r.firmware,
    'Voltage (V)':     r.voltage,
    'Current (A)':     r.current,
    'RPM':             r.rpm,
    'Wind Speed (m/s)':r.wind_speed,
    'Frequency (Hz)':  r.frequency,
    'Power (kW)':      r.power,
    'Energy (kWh)':    r.energy,
    'Temperature (°C)':r.temperature,
    'Humidity (%)':    r.humidity,
  }));
}

function conRows(rows) {
  return rows.map(r => ({
    'Timestamp (EAT)': toEAT(r.timestamp),
    'Voltage (V)':     r.voltage,
    'Current (A)':     r.current,
    'Power (kW)':      r.power,
    'Energy (kWh)':    r.energy,
  }));
}

function buildWorkbook(generation, consumption) {
  const wb = XLSX.utils.book_new();

  const genSheet = XLSX.utils.json_to_sheet(genRows(generation));
  const conSheet = XLSX.utils.json_to_sheet(conRows(consumption));

  // Column widths
  genSheet['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 11 }, { wch: 11 }, { wch: 8 }, { wch: 15 }, { wch: 13 }, { wch: 10 }, { wch: 11 }, { wch: 15 }, { wch: 12 }];
  conSheet['!cols'] = [{ wch: 22 }, { wch: 11 }, { wch: 11 }, { wch: 10 }, { wch: 11 }];

  XLSX.utils.book_append_sheet(wb, genSheet,  'Generation');
  XLSX.utils.book_append_sheet(wb, conSheet,  'Consumption');

  return wb;
}

function fileName(from, to) {
  const fmt = iso => iso ? iso.slice(0, 10) : 'all';
  return `wind-meter-${fmt(from)}-to-${fmt(to)}.xlsx`;
}

export async function exportExcel({ from, to } = {}) {
  const qs = new URLSearchParams();
  if (from) qs.set('from', from);
  if (to)   qs.set('to',   to);
  const url = '/api/dashboard/export' + (qs.toString() ? '?' + qs : '');

  const data = await api.get(url);
  const wb   = buildWorkbook(data.generation, data.consumption);
  XLSX.writeFile(wb, fileName(from, to));
}
