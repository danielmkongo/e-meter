import { NavLink } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { useTheme } from '../ThemeContext.jsx';

function IconOverview() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  );
}
function IconAnalytics() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
    </svg>
  );
}
function IconEnergy() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}
function IconHistory() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c-.621 0-1.125.504-1.125 1.125v1.5m2.25-2.625h7.5m-7.5 0c.621 0 1.125.504 1.125 1.125v1.5m7.5-2.625c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-18.375 0c-.621 0-1.125-.504-1.125-1.125" />
    </svg>
  );
}
function IconFirmware() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
    </svg>
  );
}
function IconSun() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
    </svg>
  );
}
function IconMoon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
    </svg>
  );
}

const navItems = [
  { to: '/',          label: 'Overview',  Icon: IconOverview  },
  { to: '/analytics', label: 'Analytics', Icon: IconAnalytics },
  { to: '/energy',    label: 'Energy',    Icon: IconEnergy    },
  { to: '/history',   label: 'History',   Icon: IconHistory   },
  { to: '/ota',       label: 'Firmware',  Icon: IconFirmware  },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  return (
    <div
      className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950"
      style={{ backgroundImage: 'var(--page-glow)' }}
    >
      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      {/*  Light: deep forest green  |  Dark: near-black slate               */}
      <aside className="flex w-60 shrink-0 flex-col bg-emerald-900 dark:bg-slate-900 border-r border-emerald-950/40 dark:border-slate-800">

        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10 dark:border-slate-800">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/10 dark:bg-emerald-500/10 border border-white/20 dark:border-emerald-500/20">
            <svg className="w-5 h-5 text-emerald-200 dark:text-emerald-400" fill="none" viewBox="0 0 32 32" stroke="currentColor" strokeWidth={1.5}>
              <circle cx="16" cy="16" r="2.5" fill="currentColor" stroke="none" />
              <path d="M16 13.5 C16 13.5 15 8 12 4 C14 7 16 13.5 16 13.5Z" fill="currentColor" stroke="none" />
              <path d="M16 13.5 C16 13.5 11.5 16.5 7 17 C10.5 15.5 16 13.5 16 13.5Z" fill="currentColor" stroke="none" />
              <path d="M16 13.5 C16 13.5 20.5 10.5 25 11 C21.5 12.5 16 13.5 16 13.5Z" fill="currentColor" stroke="none" />
              <line x1="16" y1="18.5" x2="16" y2="28" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-bold text-white leading-tight tracking-tight">Wind Meter</div>
            <div className="text-xs text-emerald-300/70 dark:text-slate-500 mt-0.5">Turbine Monitor</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-white/15 dark:bg-emerald-500/10 text-white dark:text-emerald-400'
                    : 'text-emerald-200/80 dark:text-slate-400 hover:bg-white/10 dark:hover:bg-slate-800 hover:text-white dark:hover:text-slate-100'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-white dark:bg-emerald-400" />
                  )}
                  <span className={isActive ? 'text-white dark:text-emerald-400' : 'text-emerald-300/60 dark:text-slate-500'}>
                    <Icon />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="border-t border-white/10 dark:border-slate-800 px-3 py-4 space-y-3">

          {/* Theme toggle + user info row */}
          <div className="flex items-center gap-2 px-1">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 dark:bg-emerald-500/10 border border-white/20 dark:border-emerald-500/20 text-xs font-bold text-white dark:text-emerald-400">
              {user?.username?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-white dark:text-slate-300 truncate">{user?.username}</div>
              <div className="text-xs text-emerald-300/60 dark:text-slate-500">Administrator</div>
            </div>
            <button
              onClick={toggleTheme}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 dark:bg-slate-800 text-emerald-100 dark:text-slate-400 hover:bg-white/20 dark:hover:bg-slate-700 dark:hover:text-slate-100 transition-colors shrink-0"
            >
              {isDark ? <IconSun /> : <IconMoon />}
            </button>
          </div>

          <button
            onClick={logout}
            className="w-full rounded-xl border border-white/15 dark:border-slate-700 bg-white/8 dark:bg-slate-800 px-3 py-2 text-xs font-medium text-emerald-100 dark:text-slate-400 hover:bg-white/15 dark:hover:bg-slate-700 dark:hover:text-slate-100 transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
