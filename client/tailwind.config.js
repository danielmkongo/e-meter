/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg:      v('bg'),
        surface: v('surface'),
        raised:  v('raised'),
        line:    v('line'),
        ink:     v('ink'),
        muted:   v('muted'),
        faint:   v('faint'),
        accent:  v('accent'),
        good:    v('good'),
        bad:     v('bad'),
        warn:    v('warn'),
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      // Crisp, rectangular UI: small radii everywhere (round only for status dots).
      borderRadius: { sm: '2px', DEFAULT: '3px', md: '3px', lg: '4px', xl: '4px', '2xl': '6px', '3xl': '6px', '4xl': '8px' },
      keyframes: {
        rise:  { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
        pulseRing: { '0%': { transform: 'scale(.6)', opacity: .7 }, '100%': { transform: 'scale(1.8)', opacity: 0 } },
      },
      animation: {
        rise: 'rise .45s cubic-bezier(.2,.7,.2,1) both',
        'pulse-ring': 'pulseRing 2s cubic-bezier(.2,.7,.2,1) infinite',
      },
    },
  },
  plugins: [],
};
