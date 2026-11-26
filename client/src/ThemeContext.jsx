import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

// Light is the default. Only an explicit toggle is remembered (key 'ui-theme'),
// so the default isn't frozen into storage on first visit.
export const THEME_KEY = 'ui-theme';

function initial() {
  try { return localStorage.getItem(THEME_KEY) === 'dark'; } catch { return false; }
}

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(initial);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark ? '#000000' : '#f3f5f9');
  }, [isDark]);

  const toggleTheme = () => setIsDark(d => {
    try { localStorage.setItem(THEME_KEY, d ? 'light' : 'dark'); } catch {}
    return !d;
  });

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
