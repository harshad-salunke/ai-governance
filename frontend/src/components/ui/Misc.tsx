import { useState, type ComponentType, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronRight, Copy, Inbox } from 'lucide-react';
import { cn, initials } from '../../lib/format';

// ---------------------------------------------------------------- page header
export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  meta,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: { label: string; to?: string }[];
  meta?: ReactNode;
}) {
  return (
    <header className="mb-5 space-y-2">
      {breadcrumbs && (
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-subtle">
          {breadcrumbs.map((b, i) => (
            <span key={i} className="inline-flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3" />}
              {b.to ? (
                <Link to={b.to} className="hover:text-fg">
                  {b.label}
                </Link>
              ) : (
                <span className="text-muted">{b.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 max-w-3xl">
          <h1 className="text-2xl font-semibold leading-tight">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          {meta && <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

// ---------------------------------------------------------------- stat tile
export function Stat({
  label,
  value,
  sub,
  tone,
  icon: Icon,
  to,
  children,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'danger' | 'warning' | 'success' | 'primary';
  icon?: ComponentType<{ className?: string }>;
  to?: string;
  children?: ReactNode;
}) {
  const toneCls = { danger: 'text-danger', warning: 'text-warning', success: 'text-success', primary: 'text-primary' };
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted">{label}</span>
        {Icon && <Icon className={cn('h-4 w-4', tone ? toneCls[tone] : 'text-subtle')} />}
      </div>
      <div className="tabular mt-1 text-2xl font-semibold text-fg">{value}</div>
      {sub && <div className={cn('mt-0.5 text-xs', tone ? toneCls[tone] : 'text-muted')}>{sub}</div>}
      {children}
    </>
  );
  const cls = 'block rounded-lg bg-surface p-4 shadow-card';
  return to ? (
    <Link to={to} className={cn(cls, 'transition-shadow hover:shadow-pop')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

// ---------------------------------------------------------------- empty state
export function EmptyState({ icon: Icon = Inbox, title, description, action }: { icon?: ComponentType<{ className?: string }>; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-2">
        <Icon className="h-5 w-5 text-subtle" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ---------------------------------------------------------------- avatar
const avatarHues = ['#0D766E', '#2563EB', '#7C3AED', '#B45F06', '#BE185D', '#475569', '#15803D'];

export function Avatar({ name, size = 'sm', muted }: { name: string; size?: 'xs' | 'sm' | 'md' | 'lg'; muted?: boolean }) {
  const hue = avatarHues[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % avatarHues.length];
  const dim = { xs: 'h-5 w-5 text-[9px]', sm: 'h-6 w-6 text-[10px]', md: 'h-8 w-8 text-xs', lg: 'h-11 w-11 text-sm' }[size];
  return (
    <span
      className={cn('inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white', dim, muted && 'opacity-50 grayscale')}
      style={{ backgroundColor: hue }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function Person({ name, sub, size = 'sm', muted, unassigned }: { name?: string; sub?: ReactNode; size?: 'xs' | 'sm' | 'md'; muted?: boolean; unassigned?: string }) {
  if (!name) return <span className="text-sm italic text-subtle">{unassigned ?? 'Unassigned'}</span>;
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <Avatar name={name} size={size} muted={muted} />
      <span className="min-w-0">
        <span className={cn('block truncate text-sm', muted ? 'text-subtle line-through' : 'text-fg')}>{name}</span>
        {sub && <span className="block truncate text-xs text-subtle">{sub}</span>}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------- meter
export function Meter({ value, max = 100, tone = 'primary', className, label }: { value: number; max?: number; tone?: 'primary' | 'success' | 'warning' | 'danger' | 'auto'; className?: string; label?: string }) {
  const p = Math.max(0, Math.min(100, (value / max) * 100));
  const t = tone === 'auto' ? (p >= 100 ? 'danger' : p >= 80 ? 'warning' : 'primary') : tone;
  const bg = { primary: 'bg-primary', success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger' }[t];
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-3', className)} role="meter" aria-valuenow={Math.round(p)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={cn('h-full rounded-full transition-[width] duration-500', bg)} style={{ width: `${p}%` }} />
    </div>
  );
}

// ---------------------------------------------------------------- code
export function CopyButton({ text, className }: { text: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(text).catch(() => {});
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      }}
      className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted hover:bg-surface-3 hover:text-fg', className)}
      aria-label="Copy to clipboard"
    >
      {done ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

/** Lightweight highlighter for JSON / Python snippets (no dependency). */
function highlight(code: string, lang: string) {
  const esc = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  if (lang === 'json') {
    return esc
      .replace(/("(?:\\.|[^"\\])*")(\s*:)/g, '<span class="text-info">$1</span>$2')
      .replace(/:\s*("(?:\\.|[^"\\])*")/g, ': <span class="text-success">$1</span>')
      .replace(/\b(true|false|null)\b/g, '<span class="text-violet">$1</span>')
      .replace(/(:\s*)(-?\d+(?:\.\d+)?)/g, '$1<span class="text-warning">$2</span>');
  }
  if (lang === 'python' || lang === 'bash') {
    return esc
      .replace(/(#.*)$/gm, '<span class="text-subtle">$1</span>')
      .replace(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g, '<span class="text-success">$1</span>')
      .replace(/\b(from|import|def|return|if|elif|else|await|async|with|as|for|in|pip|install|export)\b/g, '<span class="text-violet">$1</span>')
      .replace(/(@[\w.]+)/g, '<span class="text-warning">$1</span>');
  }
  return esc;
}

export function CodeBlock({ code, lang = 'json', title, className, maxHeight }: { code: string; lang?: 'json' | 'python' | 'bash' | 'text'; title?: string; className?: string; maxHeight?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-lg border border-border bg-surface-2/60', className)}>
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="text-xs text-muted">{title ?? lang.toUpperCase()}</span>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-auto p-3 font-mono text-[12.5px] leading-relaxed text-fg" style={{ maxHeight }}>
        <code dangerouslySetInnerHTML={{ __html: highlight(code, lang) }} />
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------- misc
export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('font-mono text-[12px] text-muted', className)}>{children}</span>;
}

export function Callout({ tone = 'info', title, children, icon: Icon, action }: { tone?: 'info' | 'warning' | 'danger' | 'success'; title: ReactNode; children?: ReactNode; icon?: ComponentType<{ className?: string }>; action?: ReactNode }) {
  const t = {
    info: 'border-info/30 bg-info/5 text-info',
    warning: 'border-warning/30 bg-warning/5 text-warning',
    danger: 'border-danger/30 bg-danger/5 text-danger',
    success: 'border-success/30 bg-success/5 text-success',
  }[tone];
  return (
    <div className={cn('flex flex-wrap items-start gap-3 rounded-lg border px-4 py-3', t)} role={tone === 'danger' ? 'alert' : undefined}>
      {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0" />}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        {children && <div className="mt-0.5 text-sm text-muted">{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-surface-3', className)} />;
}

export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5', className)}>{children}</div>;
}
