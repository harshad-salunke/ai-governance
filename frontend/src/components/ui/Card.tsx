import type { ComponentType, HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/format';

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('min-w-0 rounded-lg bg-surface shadow-card', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  actions,
  icon: Icon,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-3', className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0 text-subtle" />}
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-5">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('p-4', className)}>{children}</div>;
}

/** Definition list used on detail pages: label on the left, value on the right. */
export function DescList({ items, cols = 1, className }: { items: [ReactNode, ReactNode][]; cols?: 1 | 2 | 3; className?: string }) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-3', cols === 2 && 'sm:grid-cols-2', cols === 3 && 'sm:grid-cols-2 lg:grid-cols-3', className)}>
      {items.map(([k, v], i) => (
        <div key={i} className="min-w-0">
          <dt className="text-xs text-subtle">{k}</dt>
          <dd className="mt-0.5 break-words text-sm text-fg">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Section({ title, description, actions, children, className }: { title: string; description?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
