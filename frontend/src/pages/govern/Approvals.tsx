import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowDown, Check, CircleDashed, Clock, MessageSquare, Plus, ShieldAlert, Trash2, X } from 'lucide-react';
import { actions, useStore } from '../../data/store';
import { useLookup } from '../../lib/lookup';
import { ROLES, usePermission } from '../../lib/rbac';
import { useToast } from '../../lib/toast';
import { cn, dateTime, relTime } from '../../lib/format';
import { NOW } from '../../data/seed';
import { Badge, Button, Callout, Card, CardHeader, EmptyState, Meter, PageHeader, Segmented, Select, Tabs, Textarea } from '../../components/ui';
import { ObjectLink, TierBadge } from '../../components/domain';
import type { ApprovalRequest, Workflow, WorkflowStep } from '../../data/types';

type Tab = 'queue' | 'workflows';

export default function Approvals() {
  const [tab, setTab] = useState<Tab>('queue');
  const pending = useStore((s) => s.approvals.filter((a) => a.status === 'Pending').length);
  return (
    <div className="space-y-5">
      <PageHeader title="Approvals" description="Agents, tool changes and policy drafts move through the workflow for their tier. Nobody approves what they own or sponsor." />
      <Tabs value={tab} onChange={setTab} items={[{ value: 'queue', label: 'Queue', count: pending }, { value: 'workflows', label: 'Workflows' }]} />
      {tab === 'queue' ? <Queue /> : <Workflows />}
    </div>
  );
}

function Queue() {
  const s = useStore((x) => x);
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<'Pending' | 'Decided' | 'All'>('Pending');
  const list = s.approvals
    .filter((a) => (filter === 'All' ? true : filter === 'Pending' ? a.status === 'Pending' : a.status !== 'Pending'))
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const selectedId = params.get('id') ?? list[0]?.id;
  const selected = s.approvals.find((a) => a.id === selectedId);

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="flex flex-col lg:max-h-[calc(100vh-14rem)]">
        <div className="border-b border-border p-2.5">
          <Segmented value={filter} onChange={setFilter} options={[{ value: 'Pending', label: 'Pending' }, { value: 'Decided', label: 'Decided' }, { value: 'All', label: 'All' }]} />
        </div>
        <ul className="flex-1 divide-y divide-border overflow-y-auto" role="listbox" aria-label="Approval requests">
          {list.map((a) => {
            const late = a.status === 'Pending' && Date.parse(a.dueAt) < NOW;
            return (
              <li key={a.id} role="option" aria-selected={a.id === selectedId}>
                <button onClick={() => setParams({ id: a.id }, { replace: true })} className={cn('w-full px-4 py-3 text-left transition-colors', a.id === selectedId ? 'bg-primary/5 shadow-[inset_3px_0_0_rgb(var(--primary))]' : 'hover:bg-surface-2/60')}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-snug">{a.title}</p>
                    <StatusBadge status={a.status} />
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-subtle">
                    <span>{s.workflows.find((w) => w.id === a.workflowId)?.tier} workflow</span>
                    <span aria-hidden>·</span>
                    {a.status === 'Pending' ? (
                      <span className={cn('inline-flex items-center gap-1', late && 'font-medium text-danger')}>
                        <Clock className="h-3 w-3" />
                        {late ? `SLA breached ${relTime(a.dueAt)}` : `Due ${relTime(a.dueAt)}`}
                      </span>
                    ) : (
                      <span>Requested {relTime(a.requestedAt)}</span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
          {list.length === 0 && <EmptyState title="Queue is clear" description="New requests appear here when an owner asks for approval." />}
        </ul>
      </Card>
      {selected ? <Detail req={selected} key={selected.id} /> : <Card><EmptyState title="Select a request" /></Card>}
    </div>
  );
}

function StatusBadge({ status }: { status: ApprovalRequest['status'] }) {
  return <Badge tone={status === 'Approved' ? 'success' : status === 'Rejected' ? 'danger' : status === 'Pending' ? 'info' : 'warning'} dot>{status}</Badge>;
}

function Detail({ req }: { req: ApprovalRequest }) {
  const s = useStore((x) => x);
  const L = useLookup();
  const { can, reason, role } = usePermission();
  const toast = useToast();
  const [comment, setComment] = useState('');
  const agent = L.agent(req.objectId);
  const me = s.session.userId;
  const step = req.steps[req.currentStep];

  // Separation of duties (PRD §2): nobody approves an agent they own or sponsor.
  const conflict = agent && (agent.owner === me || agent.sponsor === me) && step?.role !== 'Business sponsor';
  const controlsBlock = req.objectKind === 'agent' && req.controlsTotal > 0 && req.controlsReady < req.controlsTotal && req.currentStep === req.steps.length - 1;
  const denied = !can('approvals.decide') ? reason('approvals.decide') : conflict ? 'Separation of duties: you own or sponsor this agent, so you can’t approve it.' : undefined;
  const late = req.status === 'Pending' && Date.parse(req.dueAt) < NOW;

  const decide = (d: 'approved' | 'rejected' | 'changes') => {
    if (d !== 'approved' && comment.trim().length < 5) {
      toast({ tone: 'warning', title: 'Add a comment', body: 'Rejections and change requests need a reason the owner can act on.' });
      return;
    }
    actions.decideApproval(req.id, d, comment.trim());
    toast({ tone: d === 'approved' ? 'success' : 'info', title: d === 'approved' ? (req.currentStep === req.steps.length - 1 ? 'Approved' : `Step approved — sent to ${req.steps[req.currentStep + 1].name}`) : d === 'rejected' ? 'Rejected' : 'Changes requested', body: 'The owner has been notified.' });
    setComment('');
  };

  return (
    <Card>
      <CardHeader
        title={req.title}
        description={<>Requested by {L.userName(req.requestedBy)} {relTime(req.requestedAt)} · <span className="font-mono">{req.id}</span></>}
        actions={<StatusBadge status={req.status} />}
      />
      <div className="space-y-5 p-4">
        <p className="text-sm">{req.reason}</p>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-border p-3">
            <p className="text-xs text-subtle">Object</p>
            <div className="mt-1">{agent ? <ObjectLink kind="agent" id={agent.id} name={agent.name} /> : req.objectKind === 'tool' ? <ObjectLink kind="tool" id={req.objectId} name={L.toolName(req.objectId)} mono /> : <Link to={`/runtime/policies/${req.objectId}`} className="link text-sm">{req.objectId}</Link>}</div>
            {agent && <div className="mt-1.5"><TierBadge tier={agent.tier} score={agent.score} /></div>}
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-xs text-subtle">SLA</p>
            <p className={cn('mt-1 text-sm font-medium', late ? 'text-danger' : 'text-fg')}>{req.status !== 'Pending' ? 'Closed' : late ? `Breached ${relTime(req.dueAt)}` : `Due ${relTime(req.dueAt)}`}</p>
            <p className="text-xs text-subtle">{dateTime(req.dueAt)}</p>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-xs text-subtle">Required controls</p>
            {req.controlsTotal ? (
              <>
                <p className="tabular mt-1 text-sm font-medium">{req.controlsReady} of {req.controlsTotal} accepted</p>
                <Meter className="mt-1.5" value={req.controlsReady} max={req.controlsTotal} tone={req.controlsReady === req.controlsTotal ? 'success' : 'warning'} label="Controls ready" />
              </>
            ) : (
              <p className="mt-1 text-sm text-muted">Not applicable</p>
            )}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Workflow</p>
          <ol className="space-y-0">
            {req.steps.map((st, i) => {
              const icon = st.decision === 'approved' ? <Check className="h-3.5 w-3.5" /> : st.decision === 'rejected' ? <X className="h-3.5 w-3.5" /> : st.decision === 'changes' ? <MessageSquare className="h-3.5 w-3.5" /> : <CircleDashed className="h-3.5 w-3.5" />;
              const tone = st.decision === 'approved' ? 'bg-success text-white dark:text-[rgb(4,30,12)]' : st.decision === 'rejected' ? 'bg-danger text-white' : st.decision === 'changes' ? 'bg-warning text-white dark:text-black' : st.decision === 'pending' ? 'bg-primary/15 text-primary ring-1 ring-primary/40' : 'bg-surface-2 text-subtle';
              return (
                <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < req.steps.length - 1 && <span className="absolute left-3 top-7 h-[calc(100%-1.25rem)] w-px bg-border" aria-hidden />}
                  <span className={cn('relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full', tone)}>{icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2">
                      <p className="text-sm font-medium">{st.name}</p>
                      <span className="text-xs text-subtle">{st.approver ? L.userName(st.approver) : st.role}</span>
                      {st.at && <span className="text-xs text-subtle">· {relTime(st.at)}</span>}
                    </div>
                    {st.comment && <p className="mt-1 rounded-md bg-surface-2 px-2.5 py-1.5 text-sm text-muted">“{st.comment}”</p>}
                    {st.decision === 'pending' && <p className="mt-0.5 text-xs text-primary">Waiting for decision</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {req.status === 'Pending' && (
          <div className="space-y-3 border-t border-border pt-4">
            {conflict && <Callout tone="danger" icon={ShieldAlert} title="You can’t approve this request">You are the owner or sponsor of this agent. Ask another {step.role.toLowerCase()} to decide.</Callout>}
            {controlsBlock && <Callout tone="warning" title="Final approval is blocked">All required controls need accepted evidence before the agent can move to Approved.</Callout>}
            <div>
              <label htmlFor="comment" className="mb-1.5 block text-sm font-medium">Comment for the owner</label>
              <Textarea id="comment" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Required when rejecting or requesting changes" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" icon={Check} onClick={() => decide('approved')} disabledReason={denied ?? (controlsBlock ? 'Required controls are missing accepted evidence.' : undefined)}>
                Approve step
              </Button>
              <Button icon={MessageSquare} onClick={() => decide('changes')} disabledReason={denied}>Request changes</Button>
              <Button variant="outline-danger" icon={X} onClick={() => decide('rejected')} disabledReason={denied}>Reject</Button>
              <span className="ml-auto text-xs text-subtle">Acting as {ROLES[role].label}. Also actionable from Teams and email.</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function Workflows() {
  const s = useStore((x) => x);
  const { can, reason } = usePermission();
  const toast = useToast();
  const [drafts, setDrafts] = useState<Workflow[]>(s.workflows);
  const locked = !can('workflows.configure');
  const upd = (wid: string, steps: WorkflowStep[]) => setDrafts((ds) => ds.map((w) => (w.id === wid ? { ...w, steps } : w)));
  const roleOptions: WorkflowStep['approverRole'][] = ['owner', 'auto', 'business_sponsor', 'risk_reviewer', 'governance_lead', 'security_admin'];
  const roleLabel = (r: WorkflowStep['approverRole']) => (r === 'owner' ? 'Agent owner' : r === 'auto' ? 'Automatic' : ROLES[r].label);

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {drafts.map((w) => (
        <Card key={w.id} className="flex flex-col">
          <CardHeader title={w.name} actions={<TierBadge tier={w.tier} />} />
          <ol className="flex-1 space-y-2 p-4">
            {w.steps.map((st, i) => (
              <li key={i}>
                {i > 0 && <ArrowDown className="mx-auto mb-2 h-4 w-4 text-subtle" aria-hidden />}
                <div className="rounded-md border border-border p-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-2 text-[11px] font-semibold text-muted">{i + 1}</span>
                    <input value={st.name} disabled={locked} onChange={(e) => upd(w.id, w.steps.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className="min-w-0 flex-1 bg-transparent text-sm font-medium focus:outline-none" aria-label="Step name" />
                    {!locked && w.steps.length > 1 && (
                      <button onClick={() => upd(w.id, w.steps.filter((_, j) => j !== i))} className="rounded p-1 text-subtle hover:bg-danger/10 hover:text-danger" aria-label="Remove step"><Trash2 className="h-3.5 w-3.5" /></button>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Select value={st.approverRole} disabled={locked} onChange={(e) => upd(w.id, w.steps.map((x, j) => (j === i ? { ...x, approverRole: e.target.value as WorkflowStep['approverRole'] } : x)))} aria-label="Approver">
                      {roleOptions.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
                    </Select>
                    <Select value={String(st.slaHours)} disabled={locked} onChange={(e) => upd(w.id, w.steps.map((x, j) => (j === i ? { ...x, slaHours: Number(e.target.value) } : x)))} aria-label="SLA">
                      {[0, 24, 48, 72, 120].map((h) => <option key={h} value={h}>{h ? `SLA ${h} h` : 'No SLA'}</option>)}
                    </Select>
                  </div>
                  <p className="mt-1.5 text-[11px] text-subtle">{st.mode === 'parallel' ? 'Runs in parallel with the next step' : 'Sequential'}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="flex gap-2 border-t border-border p-3">
            <Button size="sm" variant="ghost" icon={Plus} disabled={locked} onClick={() => upd(w.id, [...w.steps, { name: 'New step', approverRole: 'risk_reviewer', mode: 'sequential', slaHours: 48 }])}>Add step</Button>
            <Button size="sm" className="ml-auto" disabledReason={locked ? reason('workflows.configure') : undefined} onClick={() => toast({ tone: 'success', title: `${w.name} saved`, body: 'Applies to new requests; in-flight requests keep their workflow.' })}>Save</Button>
          </div>
        </Card>
      ))}
      <p className="text-xs text-muted xl:col-span-3">
        Default workflows follow the PRD: Low = owner + automatic; Medium = sponsor + risk reviewer; High = sponsor + risk reviewer + governance lead. Approvers are notified by email and Microsoft Teams, with reminders as the SLA approaches.
      </p>
    </div>
  );
}
