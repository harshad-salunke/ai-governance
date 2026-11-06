import { useEffect, useState } from 'react';
import { Check, Clock, Mail, MessageSquare, Monitor, X } from 'lucide-react';
import { actions, useStore } from '../../data/store';
import { useLookup } from '../../lib/lookup';
import { usePermission } from '../../lib/rbac';
import { useToast } from '../../lib/toast';
import { cn, relTime } from '../../lib/format';
import { NOW } from '../../data/seed';
import { Badge, Button, Card, CardHeader, DataTable, EmptyState, Mono, PageHeader, Person } from '../../components/ui';
import { ObjectLink } from '../../components/domain';

const channelIcon = { Teams: MessageSquare, Email: Mail, Portal: Monitor };

/** Counts down in real time from the fixed demo clock. */
function useCountdown(target: string) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return Math.round((Date.parse(target) - NOW) / 1000) - elapsed;
}

function Countdown({ target }: { target: string }) {
  const left = useCountdown(target);
  if (left <= 0) return <span className="text-xs font-medium text-danger">Timed out — default: block</span>;
  const m = Math.floor(left / 60);
  const sec = left % 60;
  return (
    <span className={cn('tabular inline-flex items-center gap-1 text-xs font-medium', left < 60 ? 'text-danger' : 'text-warning')}>
      <Clock className="h-3 w-3" />
      {m > 60 ? relTime(target) : `${m}:${String(sec).padStart(2, '0')} left`}
    </span>
  );
}

export default function HumanApprovals() {
  const s = useStore((x) => x);
  const L = useLookup();
  const { can, reason } = usePermission();
  const toast = useToast();
  const pending = s.approvalTasks.filter((t) => t.status === 'Pending');
  const done = s.approvalTasks.filter((t) => t.status !== 'Pending');
  const deny = can('runtime.tasks') ? undefined : reason('runtime.tasks');

  const decide = (id: string, st: 'Approved' | 'Denied') => {
    actions.decideTask(id, st);
    toast({ tone: st === 'Approved' ? 'success' : 'info', title: st === 'Approved' ? 'Approved — the agent continues' : 'Denied — the agent tells the user', body: 'The SDK receives the outcome on its next poll.' });
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Human approvals" description="“Ask human” decisions waiting on the agent's sponsor or a named group. Also actionable from Microsoft Teams and email." />

      {pending.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {pending.map((t) => {
            const Ch = channelIcon[t.channel];
            return (
              <Card key={t.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <ObjectLink kind="agent" id={t.agentId} name={L.agentName(t.agentId)} className="font-semibold" />
                    <p className="mt-0.5 text-xs text-muted">for <span className="text-fg">{t.user}</span> · {relTime(t.createdAt)}</p>
                  </div>
                  <Countdown target={t.timeoutAt} />
                </div>
                <div className="mx-4 rounded-md border border-border bg-surface-2/50 px-3 py-2.5">
                  <p className="font-mono text-[13px]">
                    <span className="text-primary">{L.toolName(t.toolId)}</span>(
                    {Object.entries(t.params).map(([k, v], i) => (
                      <span key={k}>{i > 0 && ', '}<span className="text-muted">{k}=</span>{typeof v === 'number' && k === 'amount' ? <b>₹{v.toLocaleString('en-IN')}</b> : JSON.stringify(v)}</span>
                    ))}
                    )
                  </p>
                </div>
                <p className="px-4 pt-3 text-sm text-muted">{t.reason}</p>
                <div className="mt-auto flex flex-wrap items-center gap-2 p-4">
                  <Button variant="primary" icon={Check} onClick={() => decide(t.id, 'Approved')} disabledReason={deny}>Approve</Button>
                  <Button variant="outline-danger" icon={X} onClick={() => decide(t.id, 'Denied')} disabledReason={deny}>Deny</Button>
                  <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-subtle"><Ch className="h-3.5 w-3.5" /> Also sent via {t.channel} to {L.userName(t.approver)}</span>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card><EmptyState icon={Check} title="Nothing waiting" description="New requests appear here the moment an agent's check returns “ask human”." /></Card>
      )}

      <Card>
        <CardHeader title="Recent outcomes" />
        <DataTable
          rows={done}
          columns={[
            { key: 'a', header: 'Agent', cell: (t) => L.agentName(t.agentId) },
            { key: 'c', header: 'Call', cell: (t) => <Mono className="text-fg">{L.toolName(t.toolId)}({Object.entries(t.params).map(([k, v]) => `${k}=${v}`).join(', ')})</Mono> },
            { key: 'u', header: 'User', hideBelow: 'md', cell: (t) => <span className="text-muted">{t.user}</span> },
            { key: 'p', header: 'Approver', hideBelow: 'lg', cell: (t) => <Person name={L.userName(t.approver)} /> },
            { key: 's', header: 'Outcome', cell: (t) => <Badge tone={t.status === 'Approved' ? 'success' : t.status === 'Denied' ? 'danger' : 'neutral'} dot>{t.status}</Badge> },
            { key: 't', header: 'When', hideBelow: 'sm', cell: (t) => <span className="text-muted">{relTime(t.createdAt)}</span> },
          ]}
        />
      </Card>
    </div>
  );
}
