import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/format';

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
}

/** Keeps Tab focus inside the dialog and restores focus on close. */
function useFocusTrap(open: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const sel = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';
    const first = el?.querySelector<HTMLElement>('[data-autofocus]') ?? el?.querySelector<HTMLElement>(sel);
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !el) return;
      const items = Array.from(el.querySelectorAll<HTMLElement>(sel)).filter((x) => x.offsetParent !== null);
      if (!items.length) return;
      const a = items[0];
      const b = items[items.length - 1];
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        b.focus();
      } else if (!e.shiftKey && document.activeElement === b) {
        e.preventDefault();
        a.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [open]);
  return ref;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  useEscape(open, onClose);
  const ref = useFocusTrap(open);
  if (!open) return null;
  const w = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size];
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 animate-fade-in bg-[rgb(var(--shadow)/0.45)] backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div ref={ref} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} className={cn('relative flex max-h-[92vh] w-full animate-pop-in flex-col rounded-t-xl border border-border bg-surface shadow-overlay sm:rounded-xl', w)}>
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          <button onClick={onClose} className="-mr-1 rounded-md p-1 text-subtle hover:bg-surface-2 hover:text-fg" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-surface-2/40 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 'max-w-xl',
  headerExtra,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
  headerExtra?: ReactNode;
}) {
  useEscape(open, onClose);
  const ref = useFocusTrap(open);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[55]">
      <div className="absolute inset-0 animate-fade-in bg-[rgb(var(--shadow)/0.35)]" onClick={onClose} aria-hidden />
      <div ref={ref} role="dialog" aria-modal="true" className={cn('absolute inset-y-0 right-0 flex w-full animate-slide-in-right flex-col border-l border-border bg-surface shadow-overlay', width)}>
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">{title}</h2>
            {subtitle && <div className="mt-0.5 text-sm text-muted">{subtitle}</div>}
          </div>
          <div className="flex items-center gap-1">
            {headerExtra}
            <button onClick={onClose} className="rounded-md p-1 text-subtle hover:bg-surface-2 hover:text-fg" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-surface-2/40 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Click-to-open popover anchored to a trigger. Closes on outside click / Escape. */
export function Popover({
  trigger,
  children,
  align = 'end',
  className,
  open: controlled,
  onOpenChange,
}: {
  trigger: (p: { open: boolean; toggle: () => void }) => ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: 'start' | 'end';
  className?: string;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}) {
  const [inner, setInner] = useState(false);
  const open = controlled ?? inner;
  const setOpen = (o: boolean) => (onOpenChange ? onOpenChange(o) : setInner(o));
  const ref = useRef<HTMLDivElement>(null);
  useEscape(open, () => setOpen(false));
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  });
  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen(!open) })}
      {open && (
        <div className={cn('absolute top-full z-50 mt-1.5 animate-pop-in rounded-lg border border-border bg-surface shadow-pop', align === 'end' ? 'right-0' : 'left-0', className)}>
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ children, onClick, icon: Icon, danger, active, disabled }: { children: ReactNode; onClick?: () => void; icon?: React.ComponentType<{ className?: string }>; danger?: boolean; active?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors disabled:opacity-50',
        danger ? 'text-danger hover:bg-danger/10' : 'text-fg hover:bg-surface-2',
        active && 'bg-surface-2',
      )}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0 text-subtle" />}
      {children}
    </button>
  );
}
