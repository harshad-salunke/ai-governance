import type { ComponentType, ReactNode } from 'react';
import { cn } from '../../lib/format';

export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'violet' | 'outline';

const tones: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-fg ring-border',
  primary: 'bg-primary/[0.08] text-primary ring-primary/20',
  success: 'bg-success/[0.08] text-success ring-success/20',
  warning: 'bg-warning/[0.08] text-warning ring-warning/25',
  danger: 'bg-danger/[0.08] text-danger ring-danger/20',
  info: 'bg-info/[0.08] text-info ring-info/20',
  violet: 'bg-violet/[0.08] text-violet ring-violet/20',
  outline: 'bg-surface text-muted ring-border-strong',
};

export const dotTone: Record<Tone, string> = {
  neutral: 'bg-subtle',
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  violet: 'bg-violet',
  outline: 'bg-border-strong',
};

export function Badge({
  tone = 'neutral',
  dot,
  icon: Icon,
  children,
  className,
  title,
}: {
  tone?: Tone;
  dot?: boolean;
  icon?: ComponentType<{ className?: string }>;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex h-5 max-w-full items-center gap-1 whitespace-nowrap rounded px-1.5 text-xs font-semibold ring-1 ring-inset',
        tones[tone],
        className,
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dotTone[tone])} aria-hidden />}
      {Icon && <Icon className="h-3 w-3 shrink-0" />}
      <span className="truncate">{children}</span>
    </span>
  );
}

export function StatusDot({ tone, pulse, className }: { tone: Tone; pulse?: boolean; className?: string }) {
  return <span className={cn('inline-block h-2 w-2 shrink-0 rounded-full', dotTone[tone], pulse && 'animate-pulse-ring', className)} aria-hidden />;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-surface-2 px-1 font-mono text-[10px] text-muted">{children}</kbd>;
}
