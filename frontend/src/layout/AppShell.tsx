import { useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { CommandPalette } from './CommandPalette';
import { PolicyPilot } from './PolicyPilot';
import { ShellContext, type ShellApi } from './shellContext';
import { useStore } from '../data/store';
import { ROLES } from '../lib/rbac';
import { cn } from '../lib/format';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Eye, X } from 'lucide-react';

export function AppShell() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('dgc.sidebar') === 'collapsed';
    } catch {
      return false;
    }
  });
  const [mobileNav, setMobileNav] = useState(false);
  const [search, setSearch] = useState(false);
  const [pilot, setPilot] = useState<{ open: boolean; target: { kind: 'agent' | 'tool'; id: string } | null }>({ open: false, target: null });
  const location = useLocation();
  const role = useStore((s) => s.session.activeRole);

  useEffect(() => {
    setMobileNav(false);
  }, [location.pathname]);
  // Braces matter: newer browsers return a Promise from scrollTo, and an effect
  // must return nothing or a cleanup function.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearch((v) => !v);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '.') {
        e.preventDefault();
        setPilot((p) => ({ ...p, open: !p.open }));
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem('dgc.sidebar', c ? 'expanded' : 'collapsed');
      } catch {
        /* ignore */
      }
      return !c;
    });

  const openPilot = useCallback<ShellApi['openPilot']>((target) => setPilot({ open: true, target: target ?? null }), []);
  const api = useMemo<ShellApi>(() => ({ openPilot, openSearch: () => setSearch(true) }), [openPilot]);
  const closeSearch = useCallback(() => setSearch(false), []);
  const pilotFromSearch = useCallback(() => setPilot({ open: true, target: null }), []);

  return (
    <ShellContext.Provider value={api}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[90] focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:shadow-pop">
        Skip to content
      </a>
      <Topbar onMenu={() => setMobileNav(true)} />
      <div className="flex min-h-screen pt-12">
        <aside className={cn('fixed bottom-0 left-0 top-12 z-30 hidden border-r border-border transition-[width] duration-200 lg:block', collapsed ? 'w-[52px]' : 'w-[260px]')}>
          <Sidebar collapsed={collapsed} onToggle={toggle} />
        </aside>

        {mobileNav && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 animate-fade-in bg-[rgb(var(--shadow)/0.45)]" onClick={() => setMobileNav(false)} aria-hidden />
            <div className="absolute inset-y-0 left-0 w-72 animate-slide-in-right border-r border-border pt-2 shadow-overlay">
              <button onClick={() => setMobileNav(false)} className="absolute right-3 top-3 z-10 rounded p-1 text-subtle hover:bg-surface-2" aria-label="Close navigation">
                <X className="h-4 w-4" />
              </button>
              <Sidebar collapsed={false} onNavigate={() => setMobileNav(false)} />
            </div>
          </div>
        )}

        <div className={cn('flex min-w-0 flex-1 flex-col transition-[padding] duration-200', collapsed ? 'lg:pl-[52px]' : 'lg:pl-[260px]')}>
          {role === 'auditor' && (
            <div className="flex items-center justify-center gap-2 border-b border-info/20 bg-info/5 px-4 py-1.5 text-xs text-info">
              <Eye className="h-3.5 w-3.5" /> Read-only view as {ROLES[role].label}. You can browse and export, but not change anything.
            </div>
          )}
          <main id="main" className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-5 sm:px-6 lg:px-8">
            <ErrorBoundary resetKey={location.pathname}>
              <Outlet />
            </ErrorBoundary>
          </main>
        </div>
      </div>
      <CommandPalette open={search} onClose={closeSearch} onPilot={pilotFromSearch} />
      <PolicyPilot open={pilot.open} initialTarget={pilot.target} onClose={() => setPilot((p) => ({ ...p, open: false }))} />
    </ShellContext.Provider>
  );
}
