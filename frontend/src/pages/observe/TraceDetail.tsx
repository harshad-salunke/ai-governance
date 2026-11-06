import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Bot, Cpu, Database, ShieldCheck, Wrench, type LucideIcon } from 'lucide-react';
import { useStore } from '../../data/store';
import { useLookup } from '../../lib/lookup';
import { compact, dateTime } from '../../lib/format';
import { Badge, Card, CardHeader, DescList, PageHeader } from '../../components/ui';
import { DecisionBadge, ObjectLink } from '../../components/domain';
import { cn } from '../../lib/format';
import type { TraceSpan } from '../../data/types';
import { NotFound } from '../NotFound';

const kindMeta: Record<TraceSpan['kind'], { icon: LucideIcon; bar: string; label: string }> = {
  agent: { icon: Bot, bar: 'bg-border-strong', label: 'Run' },
  llm: { icon: Cpu, bar: 'bg-info', label: 'LLM' },
  tool: { icon: Wrench, bar: 'bg-primary', label: 'Tool' },
  policy: { icon: ShieldCheck, bar: 'bg-violet', label: 'Policy check' },
  retrieval: { icon: Database, bar: 'bg-warning', label: 'Retrieval' },
};

export default function TraceDetail() {
  const { id } = useParams();
  const t = useStore((s) => s.traces.find((x) => x.id === id));
  const L = useLookup();
  const [sel, setSel] = useState<string>('root');
  if (!t) return <NotFound />;
  const span = t.spans.find((x) => x.id === sel) ?? t.spans[0];
  const total = t.durationMs;

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumbs={[{ label: 'Traces', to: '/observe/traces' }, { label: t.id }]}
        title={<span className="font-mono">{t.id}</span>}
        meta={
          <>
            <Badge tone={t.status === 'ok' ? 'success' : t.status === 'blocked' ? 'warning' : 'danger'} dot>{t.status}</Badge>
            <span className="text-xs text-subtle">{dateTime(t.startedAt)} · {(t.durationMs / 1000).toFixed(2)} s · {compact(t.tokensIn)} in / {compact(t.tokensOut)} out · ₹{t.cost.toFixed(2)}</span>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <p className="text-xs text-subtle">User message · {t.user}</p>
          <p className="mt-1 text-sm">{t.userMessage}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-subtle">Final answer · <ObjectLink kind="agent" id={t.agentId} name={L.agentName(t.agentId)} className="text-xs" /></p>
          <p className="mt-1 text-sm">{t.finalAnswer}</p>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader title="Timeline" description="Click a span for details" />
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <div className="grid grid-cols-[240px_1fr_72px] border-b border-border px-4 py-1.5 text-[11px] text-subtle">
                <span>Span</span>
                <span className="flex justify-between"><span>0 ms</span><span>{Math.round(total / 2)} ms</span><span>{total} ms</span></span>
                <span className="text-right">Duration</span>
              </div>
              <ul>
                {t.spans.map((sp) => {
                  const m = kindMeta[sp.kind];
                  const left = (sp.start / total) * 100;
                  const width = Math.max(0.6, (sp.duration / total) * 100);
                  return (
                    <li key={sp.id}>
                      <button onClick={() => setSel(sp.id)} className={cn('grid w-full grid-cols-[240px_1fr_72px] items-center px-4 py-2 text-left transition-colors', sel === sp.id ? 'bg-primary/5' : 'hover:bg-surface-2/60')}>
                        <span className="flex min-w-0 items-center gap-2" style={{ paddingLeft: sp.depth * 14 }}>
                          <m.icon className="h-3.5 w-3.5 shrink-0 text-subtle" />
                          <span className={cn('truncate text-sm', sp.kind === 'tool' && 'font-mono text-[12.5px]')}>{sp.name}</span>
                          {sp.decision && <DecisionBadge decision={sp.decision} />}
                        </span>
                        <span className="relative h-5">
                          <span className={cn('absolute top-1 h-3 rounded-sm', m.bar, sp.status === 'error' && 'bg-danger', sp.status === 'blocked' && 'bg-danger')} style={{ left: `${left}%`, width: `${width}%` }} />
                        </span>
                        <span className="tabular text-right text-xs text-muted">{sp.duration} ms</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 border-t border-border px-4 py-2.5 text-xs text-muted">
            {Object.entries(kindMeta).map(([k, m]) => <span key={k} className="flex items-center gap-1.5"><span className={cn('h-2.5 w-2.5 rounded-sm', m.bar)} />{m.label}</span>)}
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-danger" />Blocked or error</span>
          </div>
        </Card>

        <Card className="self-start">
          <CardHeader title={span.name} description={kindMeta[span.kind].label} />
          <div className="p-4">
            <DescList
              items={[
                ['Status', <Badge tone={span.status === 'ok' ? 'success' : 'danger'} dot>{span.status}</Badge>],
                ['Start', `${span.start} ms`],
                ['Duration', `${span.duration} ms`],
                ...(span.tokensIn ? ([['Tokens', `${span.tokensIn} in · ${span.tokensOut} out`]] as [string, string][]) : []),
                ...(span.decision ? ([['Decision', <DecisionBadge decision={span.decision} />]] as [string, React.ReactNode][]) : []),
                ...(span.detail ? ([['Detail', <span className="font-mono text-[12.5px]">{span.detail}</span>]] as [string, React.ReactNode][]) : []),
              ]}
            />
            {span.kind === 'llm' && <p className="mt-4 rounded-md bg-surface-2 p-3 text-xs text-muted">Prompt captured with PII redaction: “Customer [NAME] (ID [REDACTED]) asks about order ORD-123…”</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
