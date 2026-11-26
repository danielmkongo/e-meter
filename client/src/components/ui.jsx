import { useTheme } from '../ThemeContext.jsx';
import { material, materialColor } from '../lib/materials.js';
import { PRESETS } from '../lib/range.js';

// ── Icons (1.6px stroke, 24 grid) ─────────────────────────────────────────────
const paths = {
  fleet:    'M12 3v8m0 0 5.5 3.2M12 11l-5.5 3.2M12 11v10M9 21h6',
  compare:  'M4 19V9m5 10V5m6 14v-7m5 7V3',
  energy:   'M13 2 4.5 13.5H12l-1 8.5L19.5 10.5H12L13 2z',
  inspect:  'M3 17l5-6 4 3 5-7 4 4M3 21h18',
  data:     'M4 6h16M4 12h16M4 18h10',
  turbines: 'M12 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0-4V3m1.7 7L19 13m-8.7-3L5 13m7 0v8',
  firmware: 'M8 3v2m8-2v2M8 19v2m8-2v2M3 8h2m-2 8h2m14-8h2m-2 8h2M7 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm3 5h4v4h-4z',
  sun:      'M12 4V2m0 20v-2m8-8h2M2 12h2m13.7-5.7 1.4-1.4M4.9 19.1l1.4-1.4m0-11.4L4.9 4.9m14.2 14.2-1.4-1.4M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
  moon:     'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
  logout:   'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10',
  wind:     'M3 8h10a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7',
  download: 'M12 4v11m0 0-4-4m4 4 4-4M5 20h14',
  plus:     'M12 5v14M5 12h14',
  arrow:    'M5 12h14m-5-5 5 5-5 5',
  trash:    'M5 7h14M10 11v6m4-6v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3',
  check:    'M5 12.5 10 17 19 7',
  upload:   'M12 20V9m0 0-4 4m4-4 4 4M5 4h14',
  crown:    'M4 18h16M5 15 3.5 7l5 3.5L12 5l3.5 5.5 5-3.5L19 15H5z',
  info:     'M12 17v-6m0-3.5v.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  edit:     'M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4',
  x:        'M6 6l12 12M18 6 6 18',
};
export function Icon({ name, className = 'w-4 h-4', strokeWidth = 1.6 }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}

// ── Layout primitives ────────────────────────────────────────────────────────
export function PageHeader({ eyebrow, title, children, sub }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 animate-rise">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
        <h1 className="h-page">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted max-w-2xl">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function CardTitle({ title, sub, right }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Segmented({ value, onChange, options, size }) {
  return (
    <div className="seg" role="radiogroup">
      {options.map(o => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value}
                data-on={value === o.value} disabled={o.disabled} title={o.title}
                onClick={() => onChange(o.value)}
                className={`seg-btn ${size === 'sm' ? '!px-2.5 !py-1' : ''} disabled:opacity-30 disabled:cursor-not-allowed`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// A plain on/off switch with its label.
export function Toggle({ on, onChange, label, title }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} title={title}
            className="inline-flex items-center gap-2 text-xs font-medium text-muted transition hover:text-ink">
      <span className={`relative h-[18px] w-8 rounded-sm border transition ${on ? 'border-ink bg-ink' : 'border-line bg-raised'}`}>
        <span className={`absolute top-[2px] h-3 w-3 rounded-[2px] transition-all ${on ? 'left-[16px] bg-bg' : 'left-[2px] bg-muted'}`} />
      </span>
      <span className={on ? 'text-ink' : ''}>{label}</span>
    </button>
  );
}

export function RangePicker({ range, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented value={range.preset} onChange={p => onChange({ ...range, preset: p })}
                 options={[...PRESETS.map(p => ({ value: p.key, label: p.label })), { value: 'custom', label: 'Custom' }]} />
      {range.preset === 'custom' && (
        <div className="flex items-center gap-1.5">
          <input type="datetime-local" className="input !py-1.5 !text-xs w-auto" value={range.from || ''}
                 onChange={e => onChange({ ...range, from: e.target.value })} aria-label="From (EAT)" />
          <span className="text-faint text-xs">→</span>
          <input type="datetime-local" className="input !py-1.5 !text-xs w-auto" value={range.to || ''}
                 onChange={e => onChange({ ...range, to: e.target.value })} aria-label="To (EAT)" />
        </div>
      )}
    </div>
  );
}

// ── Data atoms ───────────────────────────────────────────────────────────────
export function MaterialSwatch({ blade, size = 10 }) {
  const { isDark } = useTheme();
  return <span className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, background: materialColor(blade, isDark) }} />;
}

export function MaterialChip({ blade, className = '' }) {
  return (
    <span className={`chip !text-ink/80 ${className}`}>
      <MaterialSwatch blade={blade} size={8} />
      {material(blade).label}
    </span>
  );
}

export function StatusDot({ online, label = true }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span className="relative flex h-2 w-2">
        {online && <span className="absolute inset-0 rounded-full bg-good animate-pulse-ring" />}
        <span className={`relative h-2 w-2 rounded-full ${online ? 'bg-good' : 'bg-faint'}`} />
      </span>
      {label && <span className={online ? 'text-good' : 'text-muted'}>{online ? 'Live' : 'Offline'}</span>}
    </span>
  );
}

export function Stat({ label, value, unit, hint, big }) {
  return (
    <div className="min-w-0">
      <div className="eyebrow !text-[10px] !tracking-[.12em]">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={`num font-medium text-ink ${big ? 'text-3xl' : 'text-lg'}`}>{value ?? '—'}</span>
        {unit && <span className="text-xs text-muted">{unit}</span>}
      </div>
      {hint && <div className="mt-0.5 text-[11px] text-faint truncate">{hint}</div>}
    </div>
  );
}

// Legend: always present for ≥2 series; swatch carries identity, text stays ink.
export function Legend({ items, onToggle, hidden = [] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {items.map(it => {
        const off = hidden.includes(it.key);
        const body = (
          <>
            <svg width="22" height="8" aria-hidden="true">
              <line x1="1" y1="4" x2="21" y2="4" stroke={it.color} strokeWidth="2.5" strokeDasharray={it.dash} strokeLinecap="round" />
            </svg>
            <span className={`font-medium ${off ? 'text-muted line-through decoration-faint' : 'text-ink/85'}`}>{it.label}</span>
            {it.sub && <span className="text-faint">{it.sub}</span>}
          </>
        );
        // Only interactive legends are buttons; a static legend is just a label.
        return onToggle ? (
          <button key={it.key} type="button" aria-pressed={!off} onClick={() => onToggle(it.key)}
                  title={off ? 'Show' : 'Hide'}
                  className={`-mx-1.5 flex items-center gap-2 rounded-lg px-1.5 py-1 text-xs transition hover:bg-raised ${off ? 'opacity-50' : ''}`}>
            {body}
          </button>
        ) : (
          <span key={it.key} className="flex items-center gap-2 text-xs">{body}</span>
        );
      })}
    </div>
  );
}

export function Spinner({ className = '' }) {
  return <div className={`h-5 w-5 animate-spin rounded-full border-2 border-line border-t-accent ${className}`} />;
}

export function Empty({ title = 'No data in this range', sub, icon = 'wind', children }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-raised text-faint">
        <Icon name={icon} className="w-5 h-5" />
      </div>
      <div className="text-sm font-medium text-ink">{title}</div>
      {sub && <div className="mt-1 max-w-sm text-xs text-muted">{sub}</div>}
      {children}
    </div>
  );
}

export function LoadingVeil({ show }) {
  if (!show) return null;
  return (
    <div className={`pointer-events-none absolute right-4 top-4 transition-opacity ${show ? 'opacity-100' : 'opacity-0'}`}>
      <Spinner className="!h-4 !w-4" />
    </div>
  );
}
