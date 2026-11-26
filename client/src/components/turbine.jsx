import { material } from '../lib/materials.js';

// Geometry at scale 1, origin at the tower base, y up = negative.
export const TOWER_H = 250;
export const BLADE_L = 112;

const L = BLADE_L;
// An airfoil-ish blade pointing up from the hub: broad root, curved leading edge, fine tip.
export const BLADE_PATH_H =
  `M -3 -6 C -7.5 -22, -6 -${L * 0.55}, -2.2 -${L} Q 0 -${L + 3} 2.2 -${L} C 5 -${L * 0.62}, 10 -${L * 0.28}, 4.5 -6 Z`;

// Vertical-axis (H-Darrieus) rotor: three upright blades on struts circling the
// mast. Seen from the side, each blade slides left/right as it goes round.
const VR = 46;                      // rotor radius
const VT = -(TOWER_H + 62);         // blade top
const VB = -(TOWER_H - 46);         // blade bottom
const VS = [VT + 30, VB - 30];      // strut heights
// Slim airfoil seen from the front: fine rounded ends, widest in the middle.
const VBLADE = `M 0 ${VT} C 3.6 ${VT + 8}, 4 ${VT + 30}, 4 ${(VT + VB) / 2} C 4 ${VB - 30}, 3.6 ${VB - 8}, 0 ${VB} C -3.6 ${VB - 8}, -4 ${VB - 30}, -4 ${(VT + VB) / 2} C -4 ${VT + 30}, -3.6 ${VT + 8}, 0 ${VT} Z`;
// Blade position for rotor angle: x across the view, narrower when edge-on,
// dimmer when on the far side of the mast.
const vPose = (angle, ph) => {
  const a = (angle + ph) * Math.PI / 180, c = Math.cos(a);
  return { x: VR * Math.sin(a), sx: 0.45 + 0.55 * Math.abs(c), op: 0.35 + 0.65 * (c + 1) / 2 };
};

// Put a rotor at `angle` degrees. One animation loop calls this for every
// turbine, so it works on the DOM directly instead of re-rendering React.
export function poseRotor(el, angle) {
  if (!el) return;
  if (el.dataset.vawt == null) { el.setAttribute('transform', `rotate(${angle.toFixed(2)})`); return; }
  for (const c of el.children) {
    if (c.dataset.ph == null) continue;
    const { x, sx, op } = vPose(angle, Number(c.dataset.ph));
    c.setAttribute('opacity', op.toFixed(2));
    for (const l of c.querySelectorAll('line')) l.setAttribute('x2', x.toFixed(2));
    c.lastElementChild.setAttribute('transform', `translate(${x.toFixed(2)} 0) scale(${sx.toFixed(3)} 1)`);
  }
}

const shade = (hex, amt) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + (amt > 0 ? (255 - c) * amt : c * amt))));
  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(f).map(c => c.toString(16).padStart(2, '0')).join('');
};

// One <defs> block per scene: blade surface treatments for every material.
export function BladeDefs({ uid, isDark }) {
  const al = isDark ? material('aluminum').dark : material('aluminum').light;
  const pl = isDark ? material('pla').dark : material('pla').light;
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
      {/* PLA: matte polymer with printed layer lines */}
      <linearGradient id={`${uid}-pla`} x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor={shade(pl, 0.45)} />
        <stop offset=".45" stopColor={pl} />
        <stop offset="1" stopColor={shade(pl, -0.35)} />
      </linearGradient>
      <pattern id={`${uid}-layers`} width="6" height="2.4" patternUnits="userSpaceOnUse">
        <line x1="0" y1="0.6" x2="6" y2="0.6" stroke="#000" strokeOpacity=".22" strokeWidth=".7" />
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
  if (blade === 'pla') return (
    <g>
      <path d={BLADE_PATH} fill={`url(#${uid}-pla)`} />
      <path d={BLADE_PATH} fill={`url(#${uid}-layers)`} />
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
  return (
    <g>
      {active && showGlow && (
        <g style={{ color }}>
          <ellipse cx="0" cy="2" rx="70" ry="10" fill={`url(#${uid}-ground)`} />
          <ellipse cx="0" cy="2" rx="34" ry="5" fill="none" stroke={color} strokeWidth="1.2"
                   className="animate-pulse-ring" style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
        </g>
      )}
      {/* slim mast, running up through the rotor */}
      <path d={`M -5.5 0 L 5.5 0 L 2.6 ${VT - 4} L -2.6 ${VT - 4} Z`} fill={active ? `url(#${uid}-tower)` : 'var(--ghost)'} />
      {/* generator under the rotor */}
      <rect x="-8" y={VB + 8} width="16" height="20" rx="8" fill={active ? `url(#${uid}-tower)` : 'var(--ghost)'} />
      {active && <rect x="-8" y={VB + 16.5} width="16" height="2.4" fill={color} />}
      {/* hub collars where the struts meet the mast */}
      {VS.map(y => <rect key={y} x="-4.5" y={y - 3} width="9" height="6" rx="2" fill={metal} />)}
      <circle cy={VT - 4} r="2.6" fill={metal} />
      <g ref={rotorRef} data-vawt="" style={active && showGlow ? { filter: `drop-shadow(0 0 4px ${color}55)` } : undefined}>
        {[0, 120, 240].map(ph => {
          const { x, sx, op } = vPose(angle, ph);
          return (
            <g key={ph} data-ph={ph} opacity={op.toFixed(2)}>
              {VS.map(y => <line key={y} x1="0" y1={y} x2={x.toFixed(2)} y2={y} stroke={metal} strokeWidth="1.6" strokeLinecap="round" />)}
              <g transform={`translate(${x.toFixed(2)} 0) scale(${sx.toFixed(3)} 1)`}>
                <Blade uid={uid} blade={blade} active={active} color={color} d={VBLADE} />
              </g>
            </g>
          );
        })}
      </g>
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
