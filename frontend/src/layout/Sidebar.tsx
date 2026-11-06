import { NavLink } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { NAV } from './nav';
import { useStore } from '../data/store';
import { cn } from '../lib/format';

/** Product mark used in the suite header and on the sign-in page. */
export function Logo({ onDark, collapsed }: { onDark?: boolean; collapsed?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <svg viewBox="0 0 32 32" className="h-6 w-6 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="6" fill="#0F6CBD" />
        <path d="M9 8h7a8 8 0 0 1 0 16H9z" fill="none" stroke="#fff" strokeWidth="2.6" />
        <circle cx="16" cy="16" r="2.6" fill="#fff" />
      </svg>
      {!collapsed && <span className={cn('text-base font-semibold', onDark ? 'text-header-fg' : 'text-fg')}>DG Catalyst</span>}
    </span>
  );
}

export function Sidebar({ collapsed, onToggle, onNavigate }: { collapsed: boolean; onToggle?: () => void; onNavigate?: () => void }) {
  const state = useStore((s) => s);
  return (
    <div className="flex h-full flex-col bg-sidebar">
      {onToggle && (
        <div className={cn('flex h-11 shrink-0 items-center', collapsed ? 'justify-center' : 'px-2')}>
          <button onClick={onToggle} className="flex h-8 w-8 items-center justify-center rounded text-fg hover:bg-surface-3" aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'} aria-expanded={!collapsed}>
            <Menu className="h-[18px] w-[18px]" />
          </button>
        </div>
      )}
      <nav className="flex-1 overflow-y-auto px-2 pb-4" aria-label="Main">
        {NAV.map((section, si) => (
          <div key={si} className={cn(si > 0 && 'mt-3')}>
            {section.label && !collapsed && <p className="mb-0.5 px-2.5 py-1 text-xs font-semibold text-muted">{section.label}</p>}
            {section.label && collapsed && <div className="mx-auto my-2 h-px w-6 bg-border" />}
            <ul>
              {section.items.map((item) => {
                const b = item.badge?.(state);
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      onClick={onNavigate}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        cn(
                          'group relative flex h-9 items-center gap-3 rounded text-base transition-colors',
                          collapsed ? 'justify-center' : 'px-2.5',
                          isActive ? 'bg-surface-3 font-semibold text-fg' : 'text-fg hover:bg-surface-3/70',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && <span className="absolute left-0 top-2 h-5 w-[3px] rounded-full bg-primary" aria-hidden />}
                          <item.icon className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-primary' : 'text-muted')} strokeWidth={1.75} />
                          {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                          {b && b.n > 0 && (
                            <span
                              className={cn(
                                'tabular rounded-full text-[11px] font-semibold leading-[18px]',
                                collapsed ? 'absolute right-1.5 top-1.5 h-2 w-2 p-0 text-[0px]' : 'min-w-[18px] px-1.5 text-center',
                                b.alert ? 'bg-danger text-white dark:text-[rgb(40,6,12)]' : 'bg-surface-3 text-muted group-hover:bg-surface',
                              )}
                            >
                              {b.n}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );
}
