import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react';
import { cn, num } from '../../lib/format';
import { Checkbox } from './Form';
import { EmptyState } from './Misc';

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Return a primitive to enable sorting on this column. */
  sort?: (row: T) => string | number;
  align?: 'left' | 'right' | 'center';
  width?: string;
  className?: string;
  /** Hide below this breakpoint to keep tables readable on small screens. */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl';
}

const hide = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell', xl: 'hidden xl:table-cell' };

export function DataTable<T extends { id: string }>({
  rows,
  columns,
  onRowClick,
  pageSize = 25,
  initialSort,
  selectable,
  selected,
  onSelectedChange,
  empty,
  dense,
  rowClassName,
  footer,
  caption,
}: {
  rows: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
  pageSize?: number;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  selectable?: boolean;
  selected?: Set<string>;
  onSelectedChange?: (s: Set<string>) => void;
  empty?: ReactNode;
  dense?: boolean;
  rowClassName?: (row: T) => string | undefined;
  footer?: ReactNode;
  caption?: string;
}) {
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sort) return rows;
    const f = col.sort;
    return [...rows].sort((a, b) => {
      const x = f(a);
      const y = f(b);
      const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
      return sort.dir === 'asc' ? r : -r;
    });
  }, [rows, sort, columns]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = sorted.slice(current * pageSize, current * pageSize + pageSize);
  const allSelected = selectable && visible.length > 0 && visible.every((r) => selected?.has(r.id));

  const toggleSort = (key: string) =>
    setSort((s) => (s?.key === key ? (s.dir === 'asc' ? { key, dir: 'desc' } : undefined) : { key, dir: 'asc' }));

  const cellPad = dense ? 'px-3 py-1.5' : 'px-3 py-2';

  return (
    <div className="min-w-0">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b border-border">
              {selectable && (
                <th className="w-9 px-3 py-2">
                  <Checkbox
                    checked={!!allSelected}
                    onChange={(v) => {
                      const next = new Set(selected);
                      visible.forEach((r) => (v ? next.add(r.id) : next.delete(r.id)));
                      onSelectedChange?.(next);
                    }}
                  />
                </th>
              )}
              {columns.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    style={{ width: c.width }}
                    aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={cn(
                      'whitespace-nowrap px-3 py-2 text-left text-sm font-semibold text-fg',
                      c.align === 'right' && 'text-right',
                      c.align === 'center' && 'text-center',
                      c.hideBelow && hide[c.hideBelow],
                    )}
                  >
                    {c.sort ? (
                      <button onClick={() => toggleSort(c.key)} className={cn('inline-flex items-center gap-1 hover:text-fg', active && 'text-fg', c.align === 'right' && 'flex-row-reverse')}>
                        {c.header}
                        {active ? sort!.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" /> : <ChevronsUpDown className="h-3 w-3 opacity-40" />}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? (e) => e.key === 'Enter' && onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                className={cn(
                  'border-b border-border last:border-b-0 transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none',
                  selected?.has(row.id) && 'bg-primary/5',
                  rowClassName?.(row),
                )}
              >
                {selectable && (
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={!!selected?.has(row.id)}
                      onChange={(v) => {
                        const next = new Set(selected);
                        v ? next.add(row.id) : next.delete(row.id);
                        onSelectedChange?.(next);
                      }}
                    />
                  </td>
                )}
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(cellPad, 'align-middle', c.align === 'right' && 'text-right tabular', c.align === 'center' && 'text-center', c.hideBelow && hide[c.hideBelow], c.className)}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="py-6">{empty ?? <EmptyState title="Nothing matches these filters" description="Clear a filter or search for something else." />}</div>}
      </div>
      {(pages > 1 || footer) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs text-muted">
          <span className="tabular">
            {footer ?? `${num(current * pageSize + 1)}–${num(Math.min(sorted.length, (current + 1) * pageSize))} of ${num(sorted.length)}`}
          </span>
          {pages > 1 && (
            <div className="flex items-center gap-1">
              <button className="rounded p-1 hover:bg-surface-2 disabled:opacity-40" disabled={current === 0} onClick={() => setPage(current - 1)} aria-label="Previous page">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="tabular px-1">
                Page {current + 1} of {pages}
              </span>
              <button className="rounded p-1 hover:bg-surface-2 disabled:opacity-40" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} aria-label="Next page">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
