import { Link, useNavigate } from 'react-router-dom';
import { Bell, Building2, Check, ChevronDown, LogOut, Menu, Monitor, Moon, Search, Settings, Sparkles, Sun, UserRound } from 'lucide-react';
import { actions, useStore } from '../data/store';
import { ROLES } from '../lib/rbac';
import { useTheme, type ThemePref } from '../lib/theme';
import { cn, relTime } from '../lib/format';
import { Avatar, MenuItem, Popover } from '../components/ui';
import { Logo } from './Sidebar';
import type { RoleKey } from '../data/types';
import { useShell } from './shellContext';

const headerBtn = 'flex h-12 w-11 items-center justify-center text-header-fg/90 hover:bg-white/10 hover:text-header-fg';

/** Suite header: product, global search, scope and account. Dark in both themes. */
export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { openPilot, openSearch } = useShell();
  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-12 items-center bg-header pr-1 text-header-fg">
      <button onClick={onMenu} className={cn(headerBtn, 'lg:hidden')} aria-label="Open navigation">
        <Menu className="h-[18px] w-[18px]" />
      </button>
      <Link to="/" className="flex h-12 items-center px-3 hover:bg-white/10 lg:pl-4" aria-label="DG Catalyst home">
        <Logo onDark />
      </Link>
      <span className="mx-1 hidden h-5 w-px bg-white/20 md:block" aria-hidden />
      <ScopeSelect />

      <div className="flex min-w-0 flex-1 justify-center px-3">
        <button
          onClick={openSearch}
          className="flex h-8 w-full max-w-xl items-center gap-2 rounded bg-white/10 px-3 text-sm text-header-fg/75 ring-1 ring-inset ring-white/15 transition-colors hover:bg-white/15"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="truncate">Search the AI catalog</span>
          <span className="ml-auto hidden text-xs text-header-fg/60 sm:block">Ctrl+K</span>
        </button>
      </div>

      <div className="flex items-center">
        <button onClick={() => openPilot()} className={cn(headerBtn, 'w-auto gap-1.5 px-3 text-sm font-semibold')} aria-label="Open PolicyPilot" title="PolicyPilot (Ctrl+.)">
          <Sparkles className="h-4 w-4" />
          <span className="hidden xl:inline">PolicyPilot</span>
        </button>
        <Notifications />
        <ThemeMenu />
        <Link to="/admin/settings" className={cn(headerBtn, 'hidden sm:flex')} aria-label="Settings" title="Settings">
          <Settings className="h-[18px] w-[18px]" />
        </Link>
        <UserMenu />
      </div>
    </header>
  );
}

function ScopeSelect() {
  const bus = useStore((s) => s.businessUnits);
  const scope = useStore((s) => s.session.buScope);
  const label = scope === 'all' ? 'All business units' : bus.find((b) => b.id === scope)?.name;
  return (
    <Popover
      align="start"
      className="w-64 p-1"
      trigger={({ toggle, open }) => (
        <button onClick={toggle} aria-expanded={open} className="hidden h-12 items-center gap-2 px-3 text-sm text-header-fg/90 hover:bg-white/10 md:inline-flex" title="Business-unit scope">
          <Building2 className="h-4 w-4 opacity-80" />
          <span className="max-w-[11rem] truncate">{label}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </button>
      )}
    >
      {(close) => (
        <div role="listbox" aria-label="Business-unit scope">
          <p className="px-2 pb-1 pt-1.5 text-xs text-subtle">Scope every page to</p>
          {[{ id: 'all', name: 'All business units' }, ...bus].map((b) => (
            <MenuItem
              key={b.id}
              active={scope === b.id}
              onClick={() => {
                actions.setBuScope(b.id);
                close();
              }}
            >
              <span className="flex-1">{b.name}</span>
              {scope === b.id && <Check className="h-4 w-4 text-primary" />}
            </MenuItem>
          ))}
        </div>
      )}
    </Popover>
  );
}

function Notifications() {
  const items = useStore((s) => s.notifications);
  const unread = items.filter((n) => !n.read).length;
  const navigate = useNavigate();
  return (
    <Popover
      className="w-[min(380px,calc(100vw-1.5rem))]"
      trigger={({ toggle, open }) => (
        <button onClick={toggle} aria-expanded={open} className={cn(headerBtn, 'relative')} aria-label={`Notifications, ${unread} unread`}>
          <Bell className="h-[18px] w-[18px]" />
          {unread > 0 && <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#C4314B] px-1 text-[10px] font-semibold text-white">{unread}</span>}
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
            <span className="text-sm font-semibold">Notifications</span>
            {unread > 0 && (
              <button onClick={() => actions.markAllRead()} className="text-xs text-primary hover:underline">
                Mark all as read
              </button>
            )}
          </div>
          <ul className="max-h-[420px] overflow-y-auto py-1">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => {
                    close();
                    navigate(n.href);
                  }}
                  className="flex w-full gap-3 px-3 py-2.5 text-left hover:bg-surface-2"
                >
                  <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : n.kind === 'incident' || n.kind === 'violation' ? 'bg-danger' : 'bg-primary')} />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-sm', n.read ? 'text-muted' : 'font-medium text-fg')}>{n.title}</span>
                    <span className="block truncate text-xs text-subtle">{n.body}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-subtle">{relTime(n.at)}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-border px-3 py-2 text-xs">
            <Link to="/admin/settings" onClick={close} className="text-muted hover:text-fg">
              Notification settings
            </Link>
          </div>
        </div>
      )}
    </Popover>
  );
}

function ThemeMenu() {
  const { pref, resolved, setPref } = useTheme();
  const opts: { v: ThemePref; label: string; icon: typeof Sun }[] = [
    { v: 'light', label: 'Light', icon: Sun },
    { v: 'dark', label: 'Dark', icon: Moon },
    { v: 'system', label: 'System', icon: Monitor },
  ];
  return (
    <Popover
      className="w-40 p-1"
      trigger={({ toggle, open }) => (
        <button onClick={toggle} aria-expanded={open} className={headerBtn} aria-label="Theme" title="Theme">
          {resolved === 'dark' ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
        </button>
      )}
    >
      {(close) =>
        opts.map((o) => (
          <MenuItem
            key={o.v}
            icon={o.icon}
            active={pref === o.v}
            onClick={() => {
              setPref(o.v);
              close();
            }}
          >
            <span className="flex-1">{o.label}</span>
            {pref === o.v && <Check className="h-4 w-4 text-primary" />}
          </MenuItem>
        ))
      }
    </Popover>
  );
}

function UserMenu() {
  const session = useStore((s) => s.session);
  const user = useStore((s) => s.users.find((u) => u.id === s.session.userId)!);
  const navigate = useNavigate();
  const allRoles = Object.keys(ROLES) as RoleKey[];
  return (
    <Popover
      className="w-72 p-1"
      trigger={({ toggle, open }) => (
        <button onClick={toggle} aria-expanded={open} className="flex h-12 items-center gap-2 px-2 text-header-fg hover:bg-white/10" aria-label="Account and role">
          <span className="hidden text-right leading-tight lg:block">
            <span className="block text-sm">{user.name}</span>
            <span className="block text-[11px] text-header-fg/70">{ROLES[session.activeRole].label}</span>
          </span>
          <Avatar name={user.name} size="md" />
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center gap-3 px-2 py-2.5">
            <Avatar name={user.name} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-subtle">{user.email}</p>
            </div>
          </div>
          <div className="border-t border-border px-2 pb-1 pt-2">
            <p className="text-xs font-medium text-fg">Acting as</p>
            <p className="text-[11px] text-subtle">Switch role to preview what each persona can do.</p>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {allRoles.map((r) => (
              <MenuItem
                key={r}
                active={session.activeRole === r}
                onClick={() => {
                  actions.setRole(r);
                  close();
                }}
              >
                <span className="min-w-0 flex-1">
                  <span className="block">{ROLES[r].label}</span>
                  <span className="block truncate text-[11px] text-subtle">{ROLES[r].description}</span>
                </span>
                {session.activeRole === r && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </MenuItem>
            ))}
          </div>
          <div className="mt-1 border-t border-border pt-1">
            <MenuItem icon={UserRound} onClick={() => { close(); navigate('/admin/users'); }}>
              Users & roles
            </MenuItem>
            <MenuItem icon={LogOut} onClick={() => { close(); actions.signOut(); }}>
              Sign out
            </MenuItem>
          </div>
        </div>
      )}
    </Popover>
  );
}
