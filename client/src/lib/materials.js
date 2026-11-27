// Blade materials are the experiment's independent variable, so they own the
// colour system: every chart, chip and turbine in the scene is coloured by
// material. Hues validated for colour-blind separation in both themes.
export const MATERIALS = {
  aluminum: {
    key: 'aluminum', label: 'Aluminium', short: 'AL',
    dark: '#2f92dd', light: '#1f6fd1',
    blurb: 'Stiff, light alloy. Holds its shape at high RPM.',
  },
  natural: {
    key: 'natural', label: 'Natural fibre', short: 'NF',
    dark: '#d98a2b', light: '#b8700f',
    blurb: 'Plant-fibre composite (flax, sisal, jute). Light and renewable.',
  },
  carbon: {
    key: 'carbon', label: 'Carbon fibre', short: 'CF',
    dark: '#cf4fa8', light: '#c03a9a',
    blurb: 'Composite weave. Highest stiffness-to-weight.',
  },
  unassigned: {
    key: 'unassigned', label: 'Unassigned', short: '—',
    dark: '#6b7a96', light: '#7b879c',
    blurb: 'No blade material set yet.',
  },
};

export const MATERIAL_KEYS = ['aluminum', 'natural', 'carbon'];

export const material = (k) => MATERIALS[k] || MATERIALS.unassigned;
export const materialColor = (k, isDark) => (isDark ? material(k).dark : material(k).light);

// Consumption is context, not a contestant: neutral ink, dashed.
export const consumptionColor = (isDark) => (isDark ? '#9aa6bd' : '#5b6578');

const DASHES = [undefined, '6 4', '2 3', '10 3 2 3'];

// Visual identity for one chart series.
// group=blade   → key is a material.
// group=turbine → key is a turbine id; colour comes from its material, and
//                 turbines sharing a material are separated by dash pattern.
export function seriesStyle(key, { group, turbines = [], isDark }) {
  if (key === 'consumption') {
    return { color: consumptionColor(isDark), dash: '4 4', label: 'Consumption' };
  }
  if (group === 'blade') {
    return { color: materialColor(key, isDark), dash: undefined, label: material(key).label };
  }
  const t = turbines.find(x => x.id === key);
  const m = t?.blade || 'unassigned';
  const siblings = turbines.filter(x => (x.blade || 'unassigned') === m);
  const idx = Math.max(0, siblings.findIndex(x => x.id === key));
  return {
    color: materialColor(m, isDark),
    dash: DASHES[idx % DASHES.length],
    label: t?.name || key,
    sub: material(m).label,
  };
}
