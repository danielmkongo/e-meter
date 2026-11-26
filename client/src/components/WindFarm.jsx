import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BladeDefs, TurbineFigure, TOWER_H, BLADE_L } from './turbine.jsx';
import { material, materialColor } from '../lib/materials.js';
import { fmtPower } from '../lib/format.js';

const VB_H = 520;

// Rolling hills as functions so turbines can stand exactly on them.
const hills = {
  far:  (x) => 308 + 26 * Math.sin(x / 210 + 1) + 14 * Math.sin(x / 97),
  mid:  (x) => 380 + 20 * Math.sin(x / 260 + 2.2) + 9 * Math.sin(x / 120 + 1),
  near: (x) => 444 + 16 * Math.sin(x / 300 + 0.4) + 7 * Math.sin(x / 140 + 2),
};
const hillPath = (f, w) => {
  let d = `M0,${VB_H} L0,${f(0).toFixed(1)}`;
  for (let x = 20; x <= w; x += 20) d += ` L${x},${f(x).toFixed(1)}`;
  return d + ` L${w},${VB_H} Z`;
};

// Deterministic pseudo-random for stars & streaks.
const prand = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// RPM → on-screen rotation. Real small rotors spin at hundreds of RPM; the scene
// keeps the ordering and proportion but slows everything to a watchable pace.
const visualDegPerSec = (t) => {
  if (!t.online) return 0;
  const rpm = t.latest?.rpm ?? 0;
  return Math.min(rpm, 700) * 6 * 0.16;
};

export default function WindFarm({ turbines, selectedId, onSelect = () => {}, isDark, renderPanel, allActive = false, framed = true, labels = true, siteWind }) {
  const uid = 'wf' + useId().replace(/:/g, '');
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(1200);
  const [height, setHeight] = useState(520);
  const rotorRefs = useRef({});
  const motion = useRef({});

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => { setWidth(e.contentRect.width); setHeight(e.contentRect.height); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Wide screens: the parameter panel docks on the right of the scene and the
  // turbines spread across the remaining space, so it never covers one.
  // The viewBox width follows the container so nothing is cropped or stretched.
  const PANEL_W = width < 1250 ? 310 : 340, PANEL_GAP = 24;
  const docked = !!renderPanel && width >= 1000;
  const sceneH = docked ? Math.min(600, Math.max(548, width / 2.6)) : null;
  const VB_W = docked ? (width * VB_H) / sceneH : !framed ? 1000 : width < 640 ? 760 : 1200;
  // Unframed (full-bleed) scenes keep the ground at the bottom and add sky above.
  const vbTop = !framed && height > 0 ? Math.min(0, VB_H - (VB_W * height) / Math.max(1, width)) : 0;
  const k = docked ? sceneH / VB_H : width / VB_W;   // px per viewBox unit

  // ── Layout ─────────────────────────────────────────────────────────────────
  const placed = useMemo(() => {
    const n = turbines.length;
    // keep a full blade's reach (plus breathing room) clear of each edge
    const margin = BLADE_L + 28;
    const x0 = margin;
    const x1 = (docked ? (width - PANEL_W - PANEL_GAP * 2) / k : VB_W) - margin;
    const spacing = n <= 1 ? 0 : Math.min(440, (x1 - x0) / (n - 1));
    const mid = (x0 + x1) / 2;
    const scale = n <= 1 ? 1 : Math.max(0.5, Math.min(1, spacing / 250));
    return turbines.map((t, i) => {
      const back = n > 2 && i % 2 === 1;
      const x = mid + (i - (n - 1) / 2) * spacing;
      const s = scale * (back ? 0.8 : 1);
      const y = back ? hills.mid(x) + 4 : hills.near(x) + 6;
      // click target: the rotor disc and tower, never reaching into a neighbour's half
      const half = n <= 1 ? BLADE_L * s + 6 : Math.min(BLADE_L * s + 6, spacing / 2);
      return { t, x, y, s, back, half, hubY: y - TOWER_H * s };
    });
  }, [turbines, VB_W, docked, width, k]);

  // ── One animation loop for every rotor ─────────────────────────────────────
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    for (const t of turbines) {
      const m = (motion.current[t.id] ||= { angle: prand(t.id.length * 7 + t.id.charCodeAt(0)) * 120, speed: 0 });
      m.target = reduce ? 0 : visualDegPerSec(t);
    }
  }, [turbines]);

  // Animate only while the scene is on screen; scrolled away, it costs nothing.
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !window.IntersectionObserver) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let raf, last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      for (const [id, m] of Object.entries(motion.current)) {
        m.speed += ((m.target ?? 0) - m.speed) * Math.min(1, dt * 0.8);   // spin up / coast down
        m.angle = (m.angle + m.speed * dt) % 360;
        rotorRefs.current[id]?.setAttribute('transform', `rotate(${m.angle.toFixed(2)})`);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  // Wind streak speed follows the site anemometer.
  const sel = placed.find(p => p.t.id === selectedId);
  const wind = siteWind ?? Math.max(0, ...turbines.map(t => t.latest?.wind_speed ?? 0));
  const windDur = wind > 0.3 ? Math.max(1.6, 26 / wind) : 40;

  // ── Docked panel + leader line ─────────────────────────────────────────────
  let panel = null;
  if (docked && sel) {
    const left = width - PANEL_W - PANEL_GAP, top = PANEL_GAP;
    panel = { left, top, anchorX: left / k, anchorY: (top + 72) / k, hx: sel.x, hy: sel.hubY };
  }

  const ordered = [...placed].sort((a, b) => Number(b.back) - Number(a.back));
  const selColor = sel ? materialColor(sel.t.blade, isDark) : null;

  const handleKey = (e, id) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(id); }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const i = turbines.findIndex(t => t.id === id);
      const next = turbines[(i + (e.key === 'ArrowRight' ? 1 : -1) + turbines.length) % turbines.length];
      onSelect(next.id);
      requestAnimationFrame(() => wrapRef.current?.querySelector(`[data-tid="${next.id}"]`)?.focus());
    }
  };

  const renderTurbine = ({ t, x, y, s, half }) => {
    const active = allActive || t.id === selectedId;
    const color = materialColor(t.blade, isDark);
    const p = fmtPower(t.latest?.power);
    return (
      <g key={t.id} data-tid={t.id} className="turbine-hit" role="button" tabIndex={0}
         aria-label={`${t.name}, ${material(t.blade).label} blades${active ? ', selected' : ''}`}
         aria-pressed={active}
         onClick={() => onSelect(t.id)} onKeyDown={(e) => handleKey(e, t.id)}
         transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
        <rect x={-half} y={-(TOWER_H + BLADE_L) * s - 6} width={half * 2} height={(TOWER_H + BLADE_L) * s + 52} fill="transparent" />
        <g pointerEvents="none" className="turbine-body" data-dim={!active} style={{ opacity: active ? 1 : 0.5 }} transform={`scale(${s})`}>
          <TurbineFigure uid={uid} blade={t.blade} active={active} color={color}
                         rotorRef={(el) => { if (el) rotorRefs.current[t.id] = el; }}
                         angle={motion.current[t.id]?.angle ?? 0} />
        </g>
        {labels && <g transform="translate(0 26)" style={{ opacity: active ? 1 : 0.6 }}>
          <text textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--label)" style={{ letterSpacing: '-.01em' }}>{t.name}</text>
          <text y="17" textAnchor="middle" fontSize="11" fontFamily="Inter, system-ui, sans-serif" fill={active ? color : 'var(--label)'} fillOpacity={active ? 1 : 0.6}>
            {material(t.blade).short} · {t.online ? `${p.value} ${p.unit}` : 'offline'}
          </text>
        </g>}
      </g>
    );
  };

  return (
    <div ref={wrapRef} className={framed ? "relative" : "relative h-full"}>
      <div className={framed ? "relative overflow-hidden rounded-4xl border border-line/70" : "relative h-full overflow-hidden"} style={{ '--wind-dur': `${windDur}s`, height: sceneH ?? undefined }} data-paused={!visible}>
        <svg viewBox={`0 ${vbTop} ${VB_W} ${VB_H - vbTop}`} className={`block w-full select-none ${docked || !framed ? "h-full" : "h-auto"}`} preserveAspectRatio="xMidYMax slice" role="group" aria-label="Wind farm">
          <BladeDefs uid={uid} isDark={isDark} />
          <defs>
            <linearGradient id={`${uid}-sky`} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={vbTop} y2={VB_H}>
              <stop offset="0" stopColor="var(--sky-top)" />
              <stop offset=".6" stopColor="var(--sky-mid)" />
              <stop offset="1" stopColor="var(--sky-low)" />
            </linearGradient>
            <radialGradient id={`${uid}-sun`}>
              <stop offset="0" stopColor="var(--sun)" />
              <stop offset="1" stopColor="var(--sun)" stopOpacity="0" />
            </radialGradient>
            {selColor && (
              <radialGradient id={`${uid}-aura`}>
                <stop offset="0" stopColor={selColor} stopOpacity={isDark ? 0.16 : 0.12} />
                <stop offset="1" stopColor={selColor} stopOpacity="0" />
              </radialGradient>
            )}
          </defs>

          <rect y={vbTop} width={VB_W} height={VB_H - vbTop} fill={`url(#${uid}-sky)`} />
          <circle cx={VB_W * 0.86} cy="70" r="230" fill={`url(#${uid}-sun)`} />
          {Array.from({ length: 70 }, (_, i) => (
            <circle key={i} cx={prand(i) * VB_W} cy={vbTop + prand(i + 99) * (300 - vbTop)} r={prand(i + 7) * 0.9 + 0.3}
                    fill="var(--star)" opacity={0.25 + prand(i + 3) * 0.75} />
          ))}
          {sel && <circle cx={sel.x} cy={sel.hubY} r={260 * sel.s} fill={`url(#${uid}-aura)`} style={{ transition: 'cx .6s ease, cy .6s ease' }} />}

          <path d={hillPath(hills.far, VB_W)} fill="var(--hill-far)" />

          {/* wind */}
          <g fill="none" strokeWidth="1.4" strokeLinecap="round">
            {Array.from({ length: 16 }, (_, i) => {
              const y0 = 50 + prand(i + 40) * 300;
              const amp = 6 + prand(i + 50) * 10;
              return (
                <path key={i} className="wind-streak"
                      style={{ animationDelay: `${-prand(i + 60) * 12}s`, animationDuration: `calc(var(--wind-dur) * ${0.8 + prand(i + 70) * 0.6})` }}
                      d={`M-200,${y0} C${VB_W * 0.25},${y0 - amp} ${VB_W * 0.5},${y0 + amp} ${VB_W * 0.75},${y0 - amp / 2} S${VB_W + 100},${y0 + amp / 2} ${VB_W + 200},${y0}`} />
              );
            })}
          </g>

          <path d={hillPath(hills.mid, VB_W)} fill="var(--hill-mid)" />
          {ordered.filter(p => p.back).map(renderTurbine)}
          <path d={hillPath(hills.near, VB_W)} fill="var(--hill-near)" />
          {ordered.filter(p => !p.back).map(renderTurbine)}

          {panel && (
            <g pointerEvents="none">
              <path d={`M${panel.hx},${panel.hy} C${(panel.hx + panel.anchorX) / 2},${panel.hy} ${(panel.hx + panel.anchorX) / 2},${panel.anchorY} ${panel.anchorX},${panel.anchorY}`}
                    fill="none" stroke={selColor} strokeWidth={1.4 / Math.max(k, 0.5)} strokeDasharray="3 4" opacity=".85" />
              <circle cx={panel.anchorX} cy={panel.anchorY} r={3.5 / Math.max(k, 0.5)} fill={selColor} />
            </g>
          )}
        </svg>

        {panel && (
          <div key={selectedId} className="absolute animate-rise" style={{ left: panel.left, top: panel.top, width: PANEL_W }}>
            {renderPanel(sel.t)}
          </div>
        )}
      </div>

      {!docked && sel && renderPanel && <div className="mt-4 animate-rise" key={selectedId}>{renderPanel(sel.t)}</div>}
    </div>
  );
}
