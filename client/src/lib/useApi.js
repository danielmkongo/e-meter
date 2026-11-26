import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

// Fetch JSON, optionally on an interval. Keeps the previous data while a new
// request is in flight so charts never flash empty on a filter change.
export function useApi(url, { interval } = {}) {
  const [data, setData]       = useState(null);
  const [error, setError]     = useState(null);
  const [loading, setLoading] = useState(!!url);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!url) return;
    const my = ++seq.current;
    setLoading(true);
    try {
      const d = await api.get(url);
      if (my === seq.current) { setData(d); setError(null); }
    } catch (e) {
      if (my === seq.current) setError(e);
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    load();
    if (!interval) return;
    const id = setInterval(() => { if (!document.hidden) load(); }, interval);
    return () => clearInterval(id);
  }, [load, interval]);

  return { data, error, loading, reload: load };
}

// Persist a small UI preference (tab, filter) per browser. Never critical.
export function usePref(key, initial) {
  const [v, setV] = useState(() => {
    try { const s = localStorage.getItem('pref:' + key); return s ? JSON.parse(s) : initial; } catch { return initial; }
  });
  useEffect(() => { try { localStorage.setItem('pref:' + key, JSON.stringify(v)); } catch {} }, [key, v]);
  return [v, setV];
}
