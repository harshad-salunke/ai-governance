import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '../../lib/format';

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="flex items-center gap-1 text-sm font-medium text-fg">
        {label}
        {required && <span className="text-danger" aria-hidden>*</span>}
      </label>
      {children}
      {error ? <p className="text-xs text-danger">{error}</p> : hint ? <p className="text-xs text-subtle">{hint}</p> : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn('input-base', className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn('input-base h-auto min-h-[80px] py-2 leading-relaxed', className)} {...rest} />;
});

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cn('relative', className)}>
      <select className="input-base appearance-none pr-8" {...rest}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search', className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="input-base h-8 pl-8 pr-7" />
      {value && (
        <button onClick={() => onChange('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-subtle hover:text-fg" aria-label="Clear search">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function Checkbox({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; description?: ReactNode; disabled?: boolean }) {
  const id = useId();
  return (
    <label htmlFor={id} className={cn('flex cursor-pointer items-start gap-2.5', disabled && 'cursor-not-allowed opacity-60')}>
      <span className="relative mt-0.5 inline-flex">
        <input id={id} type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span
          className={cn(
            'flex h-4 w-4 items-center justify-center rounded border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40',
            checked ? 'border-primary bg-primary text-primary-fg' : 'border-border-strong bg-surface',
          )}
        >
          {checked && <Check className="h-3 w-3" strokeWidth={3} />}
        </span>
      </span>
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-sm text-fg">{label}</span>}
          {description && <span className="block text-xs text-muted">{description}</span>}
        </span>
      )}
    </label>
  );
}

export function Switch({ checked, onChange, label, disabled, size = 'md', title }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean; size?: 'sm' | 'md'; title?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={title}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-4 w-7' : 'h-5 w-9',
        checked ? 'bg-primary' : 'bg-surface-3 ring-1 ring-inset ring-border-strong',
      )}
    >
      <span
        className={cn(
          'inline-block rounded-full bg-white shadow transition-transform',
          size === 'sm' ? 'h-3 w-3' : 'h-4 w-4',
          checked ? (size === 'sm' ? 'translate-x-3.5' : 'translate-x-[18px]') : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

/** Segmented control: compact single choice among 2–5 options. */
export function Segmented<T extends string>({ value, onChange, options, size = 'sm', ariaLabel }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; size?: 'xs' | 'sm'; ariaLabel?: string }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex rounded-md border border-border bg-surface-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-[5px] font-medium transition-colors',
            size === 'xs' ? 'h-6 px-2 text-xs' : 'h-7 px-2.5 text-sm',
            value === o.value ? 'bg-surface text-fg shadow-sm ring-1 ring-border' : 'text-muted hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Multi-select rendered as toggleable chips. */
export function ChipSelect<T extends string>({ values, onChange, options }: { values: T[]; onChange: (v: T[]) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = values.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? values.filter((v) => v !== o.value) : [...values, o.value])}
            className={cn(
              'inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition-colors',
              on ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-surface text-muted hover:border-border-strong hover:text-fg',
            )}
          >
            {on && <Check className="h-3 w-3" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Compact labelled filter for table toolbars, e.g. "Platform: All". */
export function FilterSelect({ label, value, onChange, options, allLabel = 'All' }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; allLabel?: string }) {
  const active = value !== 'all';
  return (
    <label
      className={cn(
        'relative inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border pl-2.5 pr-7 text-sm transition-colors',
        active ? 'border-primary/40 bg-primary/5 text-fg' : 'border-border bg-surface text-muted hover:border-border-strong',
      )}
    >
      <span className="text-subtle">{label}:</span>
      <span className={cn('max-w-[11rem] truncate font-medium', active ? 'text-primary' : 'text-fg')}>{value === 'all' ? allLabel : (options.find((o) => o.value === value)?.label ?? value)}</span>
      <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-subtle" />
      <select value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label={label}>
        <option value="all">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
