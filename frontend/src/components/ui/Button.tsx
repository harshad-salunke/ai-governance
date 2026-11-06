import { forwardRef, type ButtonHTMLAttributes, type ComponentType, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { Loader2, Lock } from 'lucide-react';
import { cn } from '../../lib/format';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline-danger' | 'subtle';
type Size = 'xs' | 'sm' | 'md';

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-primary-fg hover:bg-primary-hover',
  secondary: 'bg-surface text-fg border border-border-strong hover:bg-surface-2',
  ghost: 'text-fg hover:bg-surface-2',
  subtle: 'bg-surface-2 text-fg hover:bg-surface-3',
  danger: 'bg-danger text-white hover:bg-danger/90 dark:text-[rgb(40,6,12)]',
  'outline-danger': 'border border-border-strong bg-surface text-danger hover:bg-danger/5',
};

const sizes: Record<Size, string> = {
  xs: 'h-6 px-2 text-xs gap-1',
  sm: 'h-7 px-2.5 text-sm gap-1.5',
  md: 'h-8 px-3 text-sm gap-1.5',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ComponentType<{ className?: string }>;
  iconRight?: ComponentType<{ className?: string }>;
  loading?: boolean;
  /** When set, the button is disabled and explains why (used for RBAC). */
  disabledReason?: string;
}

export const buttonClass = (variant: Variant = 'secondary', size: Size = 'md', className?: string) =>
  cn(
    'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded font-semibold transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 focus-visible:ring-offset-surface',
    'disabled:pointer-events-auto disabled:cursor-not-allowed disabled:opacity-50',
    variants[variant],
    sizes[size],
    className,
  );

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon: Icon, iconRight: IconRight, loading, disabledReason, className, children, disabled, title, ...rest },
  ref,
) {
  const iconCls = size === 'xs' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const locked = Boolean(disabledReason);
  return (
    <button
      ref={ref}
      type="button"
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading || locked}
      title={disabledReason ?? title}
      aria-disabled={disabled || locked || undefined}
      {...rest}
    >
      {loading ? <Loader2 className={cn(iconCls, 'animate-spin')} /> : locked ? <Lock className={iconCls} /> : Icon ? <Icon className={iconCls} /> : null}
      {children}
      {IconRight && <IconRight className={iconCls} />}
    </button>
  );
});

export function ButtonLink({ variant = 'secondary', size = 'md', icon: Icon, className, children, ...rest }: LinkProps & { variant?: Variant; size?: Size; icon?: ComponentType<{ className?: string }>; children?: ReactNode }) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </Link>
  );
}

export function IconButton({ label, icon: Icon, className, size = 'md', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; icon: ComponentType<{ className?: string }>; size?: 'sm' | 'md' }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center rounded text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-40',
        size === 'sm' ? 'h-7 w-7' : 'h-8 w-8',
        className,
      )}
      {...rest}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
