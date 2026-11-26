import { NavLink } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { useTheme } from '../ThemeContext.jsx';
import { Icon } from './ui.jsx';
import LogoMark from './Logo.jsx';

const NAV = [
  { to: '/',         label: 'Fleet',    icon: 'fleet' },
  { to: '/inspect',  label: 'Inspect',  icon: 'inspect' },
  { to: '/compare',  label: 'Compare',  icon: 'compare' },
  { to: '/energy',   label: 'Energy',   icon: 'energy' },
  { to: '/data',     label: 'Data',     icon: 'data' },
  { to: '/turbines', label: 'Turbines', icon: 'turbines' },
  { to: '/firmware', label: 'Firmware', icon: 'firmware' },
];

function Logo() {
  return (
    <div className="group/logo flex items-center gap-2.5">
      <LogoMark size={36} />
      <div className="leading-none">
        <div className="text-[15px] font-semibold tracking-tight text-ink">Wind Meter</div>
        <div className="mt-0.5 text-[10px] font-medium uppercase tracking-[.16em] text-muted">Blade Lab</div>
      </div>
    </div>
  );
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-bg">
      {/* ambient glow */}
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[480px] opacity-70 dark:opacity-30"
           style={{ background: 'radial-gradient(60% 60% at 50% 0%, rgb(var(--accent) / .07), transparent 70%)' }} />

      <header className="sticky top-0 z-30 border-b border-line/60 bg-bg/75 backdrop-blur-xl">
        <div className="flex h-16 w-full items-center gap-6 px-4 sm:px-6 lg:px-8 2xl:px-10">
          <Logo />
          <nav className="hidden md:flex items-center gap-1 rounded-2xl border border-line/70 bg-surface/60 p-1">
            {NAV.map(n => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-[13px] font-medium transition ${
                    isActive ? 'bg-ink text-bg shadow-sm' : 'text-muted hover:text-ink'}`}>
                <Icon name={n.icon} className="h-[15px] w-[15px]" />
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={toggleTheme} className="grid h-9 w-9 place-items-center rounded-xl border border-line/70 text-muted transition hover:text-ink hover:bg-raised"
                    aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}>
              <Icon name={isDark ? 'sun' : 'moon'} />
            </button>
            <div className="hidden sm:flex items-center gap-2 rounded-xl border border-line/70 py-1 pl-1 pr-1">
              <div className="grid h-7 w-7 place-items-center rounded-lg bg-raised text-xs font-semibold text-ink">
                {user?.username?.[0]?.toUpperCase()}
              </div>
              <span className="text-[13px] font-medium text-ink pr-1">{user?.username}</span>
              <button onClick={logout} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:text-bad hover:bg-bad/10 transition" aria-label="Sign out">
                <Icon name="logout" className="h-[15px] w-[15px]" />
              </button>
            </div>
            <button onClick={logout} className="sm:hidden grid h-9 w-9 place-items-center rounded-xl border border-line/70 text-muted" aria-label="Sign out">
              <Icon name="logout" />
            </button>
          </div>
        </div>
      </header>

      <main className="relative w-full px-4 pb-28 pt-6 sm:px-6 sm:pt-8 md:pb-16 lg:px-8 2xl:px-10">
        {children}
      </main>

      {/* mobile tab bar */}
      <nav className="md:hidden fixed inset-x-3 bottom-3 z-30 flex justify-between rounded-2xl border border-line/70 bg-surface/90 p-1.5 backdrop-blur-xl shadow-lg">
        {NAV.map(n => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-medium transition ${
                isActive ? 'bg-ink text-bg' : 'text-muted'}`}>
            <Icon name={n.icon} className="h-[18px] w-[18px]" />
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
