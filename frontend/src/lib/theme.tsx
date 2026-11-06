import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemePref = 'light' | 'dark' | 'system';
type Resolved = 'light' | 'dark';

interface ThemeCtx {
  pref: ThemePref;
  resolved: Resolved;
  setPref: (p: ThemePref) => void;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx | null>(null);
const KEY = 'dgc.theme';
const mq = () => window.matchMedia('(prefers-color-scheme: dark)');

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(readPref);
  const [systemDark, setSystemDark] = useState(() => mq().matches);

  useEffect(() => {
    const m = mq();
    const on = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);

  const resolved: Resolved = pref === 'system' ? (systemDark ? 'dark' : 'light') : pref;

  // Applied during render (idempotent) so chart colour reads below see the new theme immediately.
  document.documentElement.dataset.theme = resolved;

  const setPref = useCallback((p: ThemePref) => {
    setPrefState(p);
    try {
      localStorage.setItem(KEY, p);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<ThemeCtx>(
    () => ({ pref, resolved, setPref, toggle: () => setPref(resolved === 'dark' ? 'light' : 'dark') }),
    [pref, resolved, setPref],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTheme outside ThemeProvider');
  return v;
}

/**
 * Resolved colours for SVG charts. Recharts writes colours into SVG
 * attributes, where CSS variables are unreliable, so we read them here.
 */
export function useChartColors() {
  const { resolved } = useTheme();
  return useMemo(() => {
    const cs = getComputedStyle(document.documentElement);
    const v = (name: string) => `rgb(${cs.getPropertyValue(`--${name}`).trim().split(/\s+/).join(',')})`;
    const dark = resolved === 'dark';
    return {
      primary: v('primary'),
      success: v('success'),
      warning: v('warning'),
      danger: v('danger'),
      info: v('info'),
      violet: v('violet'),
      fg: v('fg'),
      muted: v('fg-muted'),
      subtle: v('fg-subtle'),
      grid: v('border'),
      surface: v('surface'),
      border: v('border'),
      // Categorical series palette in a fixed, CVD-validated slot order (dataviz
      // validator: adjacent CVD ΔE ≥ 8, normal-vision ≥ 15 in both modes).
      // Never cycle or reorder; a 7th series folds into "Other".
      series: dark
        ? ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300']
        : ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300'],
      tier: {
        Low: dark ? '#54B054' : '#107C10',
        Medium: dark ? '#F7A04B' : '#CA5010',
        High: dark ? '#EE6980' : '#C4314B',
        Prohibited: dark ? '#B191E6' : '#5C2E91',
        Unscored: dark ? '#8A8A8A' : '#A0A0A0',
      } as Record<string, string>,
    };
  }, [resolved]);
}
