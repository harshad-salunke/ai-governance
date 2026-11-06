import { useRef, type ReactNode } from 'react';
import { cn, num } from '../../lib/format';

export interface TabItem<T extends string> {
  value: T;
  label: ReactNode;
  count?: number;
  alert?: boolean;
}

/** Underline tabs with roving keyboard focus (←/→). */
export function Tabs<T extends string>({ value, onChange, items, className, ariaLabel }: { value: T; onChange: (v: T) => void; items: TabItem<T>[]; className?: string; ariaLabel?: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const n = (i + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length;
    refs.current[n]?.focus();
    onChange(items[n].value);
  };
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn('-mb-px flex gap-1 overflow-x-auto border-b border-border', className)}>
      {items.map((t, i) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            ref={(el) => (refs.current[i] = el)}
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onKeyDown={(e) => onKey(e, i)}
            onClick={() => onChange(t.value)}
            className={cn(
              'relative inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap px-3 text-base transition-colors',
              active ? 'font-semibold text-fg' : 'text-muted hover:text-fg',
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className={cn(
                  'tabular rounded px-1 text-xs font-normal leading-4',
                  t.alert ? 'bg-danger/10 text-danger' : 'bg-surface-3 text-muted',
                )}
              >
                {num(t.count)}
              </span>
            )}
            {active && <span className="absolute inset-x-3 bottom-0 h-[3px] rounded-full bg-primary" />}
          </button>
        );
      })}
    </div>
  );
}
