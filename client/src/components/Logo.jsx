// The mark: a three-blade rotor knocked out of a solid tile. One colour, follows
// the theme (ink tile, background-coloured blades). Spins once on hover.
export const BLADE = 'M0 -3.2 C 2.4 -6.5, 2.9 -14, 1.1 -22.6 C 0.8 -23.9, -0.7 -23.9, -0.9 -22.6 C -1.9 -15, -1.7 -7.5, 0 -3.2 Z';

export default function Logo({ size = 34, spin = true, className = '' }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={`shrink-0 ${className}`} aria-hidden="true">
      <rect width="64" height="64" rx="10" fill="rgb(var(--ink))" />
      <g transform="translate(32 32)">
        <g className={spin ? 'origin-center transition-transform duration-[1200ms] ease-[cubic-bezier(.2,.7,.2,1)] group-hover/logo:rotate-[360deg]' : ''}
           style={{ transformBox: 'fill-box' }}>
          {/* invisible disc centres the bounding box on the hub so the spin doesn't wobble */}
          <circle r="26" fill="none" />
          {[0, 120, 240].map(a => <path key={a} d={BLADE} transform={`rotate(${a + 10})`} fill="rgb(var(--bg))" />)}
          <circle r="3.6" fill="rgb(var(--bg))" />
          <circle r="1.4" fill="rgb(var(--ink))" />
        </g>
      </g>
    </svg>
  );
}
