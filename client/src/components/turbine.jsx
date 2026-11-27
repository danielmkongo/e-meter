import { material } from '../lib/materials.js';

// Geometry at scale 1, origin at the tower base, y up = negative.
export const TOWER_H = 250;
export const BLADE_L = 112;

const L = BLADE_L;
// An airfoil-ish blade pointing up from the hub: broad root, curved leading edge, fine tip.
export const BLADE_PATH_H =
  `M -3 -6 C -7.5 -22, -6 -${L * 0.55}, -2.2 -${L} Q 0 -${L + 3} 2.2 -${L} C 5 -${L * 0.62}, 10 -${L * 0.28}, 4.5 -6 Z`;

// Vertical-axis rotor: three straight upright blades (H-Darrieus) on struts around a
// central shaft, seen from slightly above. Each blade is projected in 3D every
// frame; the parts behind the shaft are drawn behind it and dimmed.
const VR = 50;                      // rotor radius
const VK = 0.16;                    // camera tilt: how round the orbit looks
const VTW = 0;                      // blade twist over its height (deg); 0 = straight
const VT = -(TOWER_H + 70);         // blade top
const VB = -(TOWER_H - 50);         // blade bottom
const VSTRUT = [0.1, 0.9];          // strut positions along the blade
const VN = 28;                      // slices per blade
const vY = (t) => VB + (VT - VB) * t;
const vPt = (deg, t) => {
  const a = deg * Math.PI / 180, z = Math.cos(a);
  return { x: VR * Math.sin(a), y: vY(t) + VR * VK * z, z, t };
};
// Half chord as seen: full face at front/back, thin edge-on at the sides,
// rounded off at the tips.
const vHw = (p) => 5.2 * (0.28 + 0.72 * Math.abs(p.z)) * (0.5 + 0.5 * Math.min(1, Math.min(p.t, 1 - p.t) / 0.06));
const f1 = (n) => n.toFixed(1);
const ribbon = (pts) => {
  const l = pts.map(p => `${f1(p.x - vHw(p))} ${f1(p.y)}`);
  const r = pts.map(p => `${f1(p.x + vHw(p))} ${f1(p.y)}`).reverse();
  return `M${l.join('L')}L${r.join('L')}Z`;
};
// Blade outline split into the part in front of the shaft and the part behind.
function bladeSides(base) {
  const out = { f: '', b: '' };
  let run = [], side = null;
  for (let i = 0; i <= VN; i++) {
    const t = i / VN, p = vPt(base + VTW * t, t), s = p.z >= 0 ? 'f' : 'b';
    if (side && s !== side) {
      const q = run[run.length - 1], tc = q.t + (t - q.t) * (q.z / (q.z - p.z));
      const c = vPt(base + VTW * tc, tc);
      run.push(c); out[side] += ribbon(run); run = [c];
    }
    side = s; run.push(p);
  }
  out[side] += ribbon(run);
  return out;
}
// Everything that moves, as path data keyed like the data-k attributes below.
function vGeom(angle) {
  const g = { sf: '', sb: '' };
  [0, 120, 240].forEach((ph, i) => {
    const { f, b } = bladeSides(angle + ph);
    g[`b${i}f`] = f; g[`b${i}b`] = b;
    for (const t of VSTRUT) {
      const p = vPt(angle + ph + VTW * t, t);
      g[p.z >= 0 ? 'sf' : 'sb'] += `M0 ${f1(vY(t))}L${f1(p.x)} ${f1(p.y)}`;
    }
  });
  return g;
}

// Put a rotor at `angle` degrees. One animation loop calls this for every
// turbine, so it works on the DOM directly instead of re-rendering React.
export function poseRotor(el, angle) {
  if (!el) return;
  if (el.dataset.vawt == null) { el.setAttribute('transform', `rotate(${angle.toFixed(2)})`); return; }
  const g = vGeom(angle);
  el._parts ??= [...el.querySelectorAll('[data-k]')].map(n => [n.dataset.k, n.tagName === 'path' ? [n] : [...n.querySelectorAll('path')]]);
  for (const [k, paths] of el._parts) for (const p of paths) p.setAttribute('d', g[k] || '');
}

const shade = (hex, amt) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + (amt > 0 ? (255 - c) * amt : c * amt))));
  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(f).map(c => c.toString(16).padStart(2, '0')).join('');
};

// One <defs> block per scene: blade surface treatments for every material.
export function BladeDefs({ uid, isDark }) {
  const al = isDark ? material('aluminum').dark : material('aluminum').light;
  const nf = isDark ? material('natural').dark : material('natural').light;
  return (
    <defs>
      {/* Aluminium: brushed metal, cool tint */}
      <linearGradient id={`${uid}-al`} x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#f7fafd" />
        <stop offset=".32" stopColor={shade(al, 0.55)} />
        <stop offset=".52" stopColor="#eef4fa" />
        <stop offset=".78" stopColor={shade(al, 0.15)} />
        <stop offset="1" stopColor="#6d7f95" />
      </linearGradient>
      {/* Natural fibre: warm plant-fibre composite with long streaky strands */}
      <linearGradient id={`${uid}-nf`} x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor={shade(nf, 0.4)} />
        <stop offset=".5" stopColor={shade(nf, 0.12)} />
        <stop offset="1" stopColor={shade(nf, -0.3)} />
      </linearGradient>
      <pattern id={`${uid}-fib`} width="7" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(4)">
        <line x1="1" y1="0" x2="1" y2="40" stroke="#3b2410" strokeOpacity=".22" strokeWidth=".6" />
        <line x1="3.6" y1="0" x2="3.6" y2="26" stroke="#3b2410" strokeOpacity=".14" strokeWidth=".5" />
        <line x1="5.4" y1="12" x2="5.4" y2="40" stroke="#fff" strokeOpacity=".16" strokeWidth=".5" />
      </pattern>
      {/* Carbon fibre: 2×2 twill weave + clear-coat sheen */}
      <pattern id={`${uid}-cf`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="4" height="4" fill="#15171c" />
        <rect width="2" height="2" fill="#30343d" />
        <rect x="2" y="2" width="2" height="2" fill="#30343d" />
      </pattern>
      <linearGradient id={`${uid}-sheen`} x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#fff" stopOpacity="0" />
        <stop offset=".42" stopColor="#fff" stopOpacity=".32" />
        <stop offset=".58" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={`${uid}-tower`} x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="var(--tower-lo)" />
        <stop offset=".45" stopColor="var(--tower-hi)" />
        <stop offset="1" stopColor="var(--tower-lo)" />
      </linearGradient>
      <radialGradient id={`${uid}-ground`}>
        <stop offset="0" stopColor="currentColor" stopOpacity=".55" />
        <stop offset="1" stopColor="currentColor" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

function Blade({ uid, blade, active, color, d: BLADE_PATH = BLADE_PATH_H }) {
  if (!active) return <path d={BLADE_PATH} fill="var(--ghost)" />;
  if (blade === 'aluminum') return <path d={BLADE_PATH} fill={`url(#${uid}-al)`} stroke={color} strokeWidth=".9" />;
  if (blade === 'natural') return (
    <g>
      <path d={BLADE_PATH} fill={`url(#${uid}-nf)`} stroke={color} strokeWidth=".6" strokeOpacity=".6" />
      <path d={BLADE_PATH} fill={`url(#${uid}-fib)`} />
    </g>
  );
  if (blade === 'carbon') return (
    <g>
      <path d={BLADE_PATH} fill={`url(#${uid}-cf)`} stroke={color} strokeWidth="1.1" />
      <path d={BLADE_PATH} fill={`url(#${uid}-sheen)`} />
    </g>
  );
  return <path d={BLADE_PATH} fill="var(--tower-hi)" stroke={color} strokeWidth=".8" />;
}

// The turbine's static body. The rotor <g> is handed back through rotorRef so a
// single animation loop can spin every rotor without re-rendering React.
export function TurbineFigure({ uid, blade, axis, active, color, rotorRef, angle = 0, showGlow = true }) {
  const H = TOWER_H;
  if (axis === 'vertical') return <VerticalFigure {...{ uid, blade, active, color, rotorRef, angle, showGlow }} />;
  return (
    <g>
      {active && showGlow && (
        <g style={{ color }}>
          <ellipse cx="0" cy="2" rx="70" ry="10" fill={`url(#${uid}-ground)`} />
          <ellipse cx="0" cy="2" rx="34" ry="5" fill="none" stroke={color} strokeWidth="1.2"
                   className="animate-pulse-ring" style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
        </g>
      )}
      {/* tower */}
      <path d={`M -7 0 L 7 0 L 3.2 -${H} L -3.2 -${H} Z`} fill={active ? `url(#${uid}-tower)` : 'var(--ghost)'} />
      {/* nacelle */}
      <rect x="-8" y={-H - 7} width="27" height="13" rx="6.5" fill={active ? 'var(--tower-hi)' : 'var(--ghost)'} />
      {active && <rect x="4" y={-H - 1.6} width="13" height="2.4" rx="1.2" fill={color} />}
      {/* rotor */}
      <g transform={`translate(0 ${-H})`}>
        <g ref={rotorRef} transform={`rotate(${angle})`}
           style={active && showGlow ? { filter: `drop-shadow(0 0 7px ${color}88)` } : undefined}>
          {[0, 120, 240].map(a => (
            <g key={a} transform={`rotate(${a})`}><Blade uid={uid} blade={blade} active={active} color={color} /></g>
          ))}
          <circle r="7.5" fill={active ? 'var(--tower-hi)' : 'var(--ghost)'} />
          <circle r="3" fill={active ? color : 'var(--ghost)'} />
        </g>
      </g>
    </g>
  );
}

function VerticalFigure({ uid, blade, active, color, rotorRef, angle, showGlow }) {
  const metal = active ? 'var(--tower-hi)' : 'var(--ghost)';
  const body = active ? `url(#${uid}-tower)` : 'var(--ghost)';
  const g = vGeom(angle);
  const side = (s) => (
    <>
      <path data-k={`s${s}`} d={g[`s${s}`]} fill="none" stroke={metal} strokeWidth="2.2" strokeLinecap="round" />
      {[0, 1, 2].map(i => (
        <g key={i} data-k={`b${i}${s}`}>
          <Blade uid={uid} blade={blade} active={active} color={color} d={g[`b${i}${s}`]} />
        </g>
      ))}
    </>
  );
  return (
    <g>
      {active && showGlow && (
        <g style={{ color }}>
          <ellipse cx="0" cy="2" rx="70" ry="10" fill={`url(#${uid}-ground)`} />
          <ellipse cx="0" cy="2" rx="34" ry="5" fill="none" stroke={color} strokeWidth="1.2"
                   className="animate-pulse-ring" style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
        </g>
      )}
      {/* tower up to the generator */}
      <path d={`M -6.5 0 L 6.5 0 L 3.4 ${VB + 20} L -3.4 ${VB + 20} Z`} fill={body} />
      {/* faint orbit the struts sweep, sells the depth */}
      {active && showGlow && VSTRUT.map(t => (
        <ellipse key={t} cx="0" cy={vY(t)} rx={VR} ry={VR * VK} fill="none" stroke={color} strokeOpacity=".22" strokeWidth="1" strokeDasharray="2 3" />
      ))}
      <g ref={rotorRef} data-vawt="" style={active && showGlow ? { filter: `drop-shadow(0 0 5px ${color}66)` } : undefined}>
        <g opacity=".5">{side('b')}</g>
        {/* shaft, hubs, cap */}
        <rect x="-2.2" y={VT - 6} width="4.4" height={VB - VT + 14} rx="2.2" fill={metal} />
        {VSTRUT.map(t => <ellipse key={t} cx="0" cy={vY(t)} rx="6.5" ry="2.6" fill={metal} />)}
        <ellipse cx="0" cy={VT - 6} rx="4" ry="2" fill={metal} />
        {side('f')}
      </g>
      {/* generator */}
      <rect x="-10" y={VB + 6} width="20" height="20" rx="5" fill={body} />
      <ellipse cx="0" cy={VB + 6} rx="10" ry="2.6" fill={metal} />
      {active && <rect x="-10" y={VB + 17} width="20" height="2.4" fill={color} />}
    </g>
  );
}

// Small static turbine for cards and lists.
export function TurbineIcon({ blade, axis, color, active = true, size = 44, uid = 'ti', isDark = true }) {
  const id = `${uid}-${blade}`;
  return (
    <svg viewBox="-125 -380 250 395" width={size} height={size * 395 / 250} aria-hidden="true">
      <BladeDefs uid={id} isDark={isDark} />
      <TurbineFigure uid={id} blade={blade} axis={axis} active={active} color={color} angle={axis === 'vertical' ? 40 : 18} showGlow={false} />
    </svg>
  );
}
