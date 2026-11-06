import type { ReactNode } from 'react';
import type { TooltipProps } from 'recharts';
import { cn } from '../lib/format';

/** Shared tooltip: text in ink tokens, colour carried only by the swatch. */
export function ChartTooltip({
  active,
  payload,
  label,
  format = (v) => String(v),
  labelFormat,
  total,
}: TooltipProps<number, string> & { format?: (v: number) => string; labelFormat?: (l: string) => string; total?: boolean }) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => p.value !== undefined && p.value !== null);
  const sum = rows.reduce((s, p) => s + Number(p.value), 0);
  return (
    <div className="min-w-[160px] rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-pop">
      {label !== undefined && <p className="mb-1.5 font-medium text-fg">{labelFormat ? labelFormat(String(label)) : label}</p>}
      <ul className="space-y-1">
        {rows
          .slice()
          .reverse()
          .map((p) => (
            <li key={String(p.dataKey)} className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: p.color }} />
              <span className="flex-1 text-muted">{p.name}</span>
              <span className="tabular font-medium text-fg">{format(Number(p.value))}</span>
            </li>
          ))}
      </ul>
      {total && rows.length > 1 && (
        <div className="mt-1.5 flex justify-between border-t border-border pt-1.5">
          <span className="text-muted">Total</span>
          <span className="tabular font-medium text-fg">{format(sum)}</span>
        </div>
      )}
    </div>
  );
}

export function Legend({ items, className }: { items: { label: string; color: string; value?: ReactNode }[]; className?: string }) {
  return (
    <ul className={cn('flex flex-wrap gap-x-4 gap-y-1.5', className)}>
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5 text-xs text-muted">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} aria-hidden />
          {i.label}
          {i.value !== undefined && <span className="tabular font-medium text-fg">{i.value}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Horizontal proportion bar (e.g. tier mix) with 2px surface gaps between segments. */
export function SegmentBar({ segments, height = 10, label }: { segments: { label: string; value: number; color: string }[]; height?: number; label: string }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div className="flex w-full gap-[2px] overflow-hidden rounded-full" style={{ height }} role="img" aria-label={`${label}: ${segments.map((s) => `${s.label} ${s.value}`).join(', ')}`}>
      {segments
        .filter((s) => s.value > 0)
        .map((s) => (
          <div key={s.label} title={`${s.label}: ${s.value}`} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />
        ))}
    </div>
  );
}

export const axisProps = (color: string) => ({
  tick: { fill: color, fontSize: 11 },
  axisLine: false,
  tickLine: false,
});
