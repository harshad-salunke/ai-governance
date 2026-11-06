import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, Moon, Search, Sparkles } from 'lucide-react';
import { useStore } from '../data/store';
import { NAV } from './nav';
import { kindMeta } from '../components/domain';
import { objectHref } from '../lib/lookup';
import { useTheme } from '../lib/theme';
import { cn } from '../lib/format';
import { Kbd } from '../components/ui';
import type { LucideIcon } from 'lucide-react';

interface Item {
  id: string;
  group: string;
  label: string;
  sub?: string;
  icon: LucideIcon;
  run: () => void;
  keywords?: string;
}

export function CommandPalette({ open, onClose, onPilot }: { open: boolean; onClose: () => void; onPilot: () => void }) {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const navigate = useNavigate();
  const { toggle } = useTheme();
  const s = useStore((x) => x);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const all = useMemo<Item[]>(() => {
    const go = (to: string) => () => {
      navigate(to);
      onClose();
    };
    return [
      { id: 'act-pilot', group: 'Actions', label: 'Ask PolicyPilot to draft a policy', icon: Sparkles, run: () => { onClose(); onPilot(); }, keywords: 'ai chat rule' },
      { id: 'act-theme', group: 'Actions', label: 'Toggle light / dark theme', icon: Moon, run: () => { toggle(); onClose(); }, keywords: 'appearance mode' },
      { id: 'act-register', group: 'Actions', label: 'Register an agent', icon: kindMeta.agent.icon, run: go('/catalog/register'), keywords: 'new create add' },
      ...NAV.flatMap((sec) => sec.items.map((i) => ({ id: `nav-${i.to}`, group: 'Pages', label: i.label, sub: sec.label, icon: i.icon, run: go(i.to), keywords: i.keywords }))),
      ...s.agents.map((a) => ({ id: a.id, group: 'Agents', label: a.name, sub: `${a.platform} · ${a.tier}`, icon: kindMeta.agent.icon, run: go(objectHref('agent', a.id)), keywords: a.description })),
      ...s.applications.map((a) => ({ id: a.id, group: 'Applications', label: a.name, sub: a.channel, icon: kindMeta.application.icon, run: go(objectHref('application', a.id)) })),
      ...s.tools.map((t) => ({ id: t.id, group: 'Tools', label: t.name, sub: t.actionType, icon: kindMeta.tool.icon, run: go(objectHref('tool', t.id)), keywords: t.description })),
      ...s.models.map((m) => ({ id: m.id, group: 'Models', label: m.name, sub: `${m.deployment} · ${m.region}`, icon: kindMeta.model.icon, run: go(objectHref('model', m.id)) })),
      ...s.mcpServers.map((m) => ({ id: m.id, group: 'MCP servers', label: m.name, sub: m.url, icon: kindMeta.mcp.icon, run: go(objectHref('mcp', m.id)) })),
      ...s.dataSources.map((d) => ({ id: d.id, group: 'Data sources', label: d.name, sub: d.type, icon: kindMeta.data.icon, run: go(objectHref('data', d.id)) })),
      ...s.runtimePolicies.map((p) => ({ id: p.id, group: 'Runtime policies', label: p.name, sub: p.id, icon: NAV[2].items[0].icon, run: go(`/runtime/policies/${p.id}`) })),
    ];
  }, [s, navigate, onClose, onPilot, toggle]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return all.filter((i) => i.group === 'Actions' || i.group === 'Pages').slice(0, 14);
    return all
      .map((i) => {
        const hay = `${i.label} ${i.sub ?? ''} ${i.keywords ?? ''}`.toLowerCase();
        const score = i.label.toLowerCase().startsWith(term) ? 3 : i.label.toLowerCase().includes(term) ? 2 : hay.includes(term) ? 1 : 0;
        return { i, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 40)
      .map((x) => x.i);
  }, [q, all]);

  useEffect(() => {
    setIdx(0);
  }, [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${idx}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [idx]);

  if (!open) return null;

  const groups = results.reduce<Record<string, Item[]>>((m, i) => ((m[i.group] ??= []).push(i), m), {});
  let n = -1;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-3 pt-[12vh]">
      <div className="absolute inset-0 animate-fade-in bg-[rgb(var(--shadow)/0.45)] backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label="Search" className="relative w-full max-w-xl animate-pop-in overflow-hidden rounded-xl border border-border bg-surface shadow-overlay">
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="h-4 w-4 text-subtle" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(results.length - 1, i + 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
              if (e.key === 'Enter') results[idx]?.run();
              if (e.key === 'Escape') onClose();
            }}
            placeholder="Search agents, tools, models, policies or pages"
            className="h-12 flex-1 bg-transparent text-sm text-fg placeholder:text-subtle focus:outline-none"
            role="combobox"
            aria-expanded="true"
            aria-controls="cmd-list"
          />
          <Kbd>Esc</Kbd>
        </div>
        <ul id="cmd-list" ref={listRef} role="listbox" className="max-h-[52vh] overflow-y-auto p-1.5">
          {results.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted">No results for “{q}”. Try an agent name, tool or policy ID.</li>}
          {Object.entries(groups).map(([g, items]) => (
            <li key={g}>
              <p className="px-2.5 pb-1 pt-2 text-[11px] font-medium text-subtle">{g}</p>
              <ul>
                {items.map((i) => {
                  n += 1;
                  const k = n;
                  return (
                    <li key={i.id} role="option" aria-selected={idx === k} data-idx={k}>
                      <button
                        onMouseMove={() => setIdx(k)}
                        onClick={i.run}
                        className={cn('flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm', idx === k ? 'bg-primary/10 text-fg' : 'text-fg')}
                      >
                        <i.icon className={cn('h-4 w-4 shrink-0', idx === k ? 'text-primary' : 'text-subtle')} />
                        <span className="truncate">{i.label}</span>
                        {i.sub && <span className="ml-1 truncate text-xs text-subtle">{i.sub}</span>}
                        {idx === k && <CornerDownLeft className="ml-auto h-3.5 w-3.5 shrink-0 text-subtle" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
