import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { CircleCheck, CircleDashed, CircleX, MoreHorizontal, Paperclip, PowerOff, ShieldAlert } from 'lucide-react';
import { actions, useStore } from '../../data/store';
import { useLookup } from '../../lib/lookup';
import { SIGNALS } from '../../data/risk';
import { usePermission } from '../../lib/rbac';
import { useToast } from '../../lib/toast';
import { useChartColors } from '../../lib/theme';
import { cn, dateOnly, dateTime, moneyShort, num, pct, relTime } from '../../lib/format';
import { NOW } from '../../data/seed';
import { Badge, Button, Card, CardHeader, DataTable, EmptyState, Field, MenuItem, Meter, Modal, Mono, Popover, Select, Textarea } from '../../components/ui';
import { DecisionBadge, LIFECYCLE_FLOW, ModeBadge, RiskFingerprint, SeverityBadge, TierBadge } from '../../components/domain';
import { ChartTooltip, axisProps } from '../../components/charts';
import type { Agent, RiskAssessment, RiskTier } from '../../data/types';

// Agent-specific tab bodies, rendered by the catalog asset page.

export function AgentApprovals({ agent }: { agent: Agent }) {
  const approvals = useStore((s) => s.approvals.filter((a) => a.objectId === agent.id));
  return (
    <Card>
      {approvals.length ? (
        <ul className="divide-y divide-border">
          {approvals.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <Link to={`/approvals?id=${a.id}`} className="font-semibold text-primary hover:underline">{a.title}</Link>
                <p className="text-sm text-muted">{a.reason}</p>
              </div>
              <Badge tone={a.status === 'Approved' ? 'success' : a.status === 'Rejected' ? 'danger' : a.status === 'Pending' ? 'info' : 'warning'}>{a.status}</Badge>
              <span className="text-xs text-subtle">{relTime(a.requestedAt)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No approval requests yet" description="Request approval once required controls have evidence." />
      )}
    </Card>
  );
}

export function AgentPolicies({ agent }: { agent: Agent }) {
  const s = useStore((x) => x);
  const L = useLookup();
  const policies = s.runtimePolicies.filter(
    (p) => p.scope.kind === 'all' || (p.scope.kind === 'agent' && p.scope.id === agent.id) || (p.scope.kind === 'role' && p.scope.id === agent.agentRoleId) || (p.scope.kind === 'tool' && agent.toolIds.includes(p.scope.id!)),
  );
  const role = L.role(agent.agentRoleId);
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={`Agent role: ${role?.name ?? 'None'}`} description={role?.description ?? 'Assign a role to set allowed tools, models and data classes.'} actions={<Link to="/runtime/roles" className="text-sm text-primary hover:underline">Manage roles</Link>} />
        {role && (
          <div className="p-4">
            <p className="mb-2 text-sm text-muted">Tools this agent has, checked against its role</p>
            <div className="flex flex-wrap gap-1.5">
              {agent.toolIds.map((t) => {
                const ok = role.allowedToolIds.includes(t);
                return (
                  <Badge key={t} tone={ok ? 'success' : 'danger'} icon={ok ? CircleCheck : CircleX}>
                    {L.toolName(t)}
                  </Badge>
                );
              })}
            </div>
            {agent.id === 'ag-support' && (
              <p className="mt-3 text-sm text-muted">
                Least privilege: <b className="text-fg">update_customer</b> was not called in the last 30 days. Consider removing it.
              </p>
            )}
          </div>
        )}
      </Card>
      <Card>
        <CardHeader title="Runtime policies that apply" description="Explicit block beats allow; the most specific scope wins." />
        <DataTable
          rows={policies}
          columns={[
            { key: 'name', header: 'Policy', cell: (p) => <Link to={`/runtime/policies/${p.id}`} className="text-primary hover:underline">{p.name}</Link> },
            { key: 'id', header: 'ID', hideBelow: 'md', cell: (p) => <Mono>{p.id}</Mono> },
            { key: 'scope', header: 'Scope', hideBelow: 'sm', cell: (p) => <span className="text-muted">{p.scope.kind === 'all' ? 'All agents' : p.scope.kind === 'role' ? L.role(p.scope.id!)?.name : p.scope.kind === 'tool' ? `Tool: ${L.toolName(p.scope.id!)}` : 'This agent'}</span> },
            { key: 'decision', header: 'Decision', cell: (p) => <DecisionBadge decision={p.decision} /> },
            { key: 'mode', header: 'Mode', cell: (p) => <ModeBadge mode={p.mode} /> },
          ]}
        />
      </Card>
    </div>
  );
}

export function AgentDecisions({ agent }: { agent: Agent }) {
  const decisions = useStore((s) => s.decisions.filter((d) => d.agentId === agent.id));
  const L = useLookup();
  return (
    <Card>
      <CardHeader
        title="Recent runtime decisions"
        description={`${num(decisions.length)} sampled checks, ${pct((decisions.filter((d) => d.decision === 'block').length / Math.max(1, decisions.length)) * 100)} blocked`}
        actions={<Link to={`/runtime/decisions?agent=${agent.id}`} className="text-sm text-primary hover:underline">Open in decision log</Link>}
      />
      <DataTable
        rows={decisions.slice(0, 50)}
        pageSize={12}
        dense
        columns={[
          { key: 'at', header: 'Time', cell: (d) => <span className="whitespace-nowrap text-muted">{dateTime(d.at)}</span> },
          { key: 'tool', header: 'Tool', cell: (d) => <Mono className="text-fg">{L.toolName(d.toolId)}</Mono> },
          { key: 'user', header: 'User', hideBelow: 'md', cell: (d) => <span className="text-muted">{d.user}</span> },
          { key: 'decision', header: 'Decision', cell: (d) => <DecisionBadge decision={d.decision} /> },
          { key: 'reason', header: 'Reason', hideBelow: 'lg', cell: (d) => <span className="text-muted">{d.reason}</span> },
          { key: 'lat', header: 'Latency', align: 'right', hideBelow: 'sm', cell: (d) => `${d.latencyMs} ms` },
        ]}
        empty={<EmptyState title="No decisions recorded" description={agent.sdkConnected ? 'Nothing in the selected window.' : 'This agent does not call the runtime SDK yet. See SDK & integrations.'} />}
      />
    </Card>
  );
}

export function AgentIncidents({ agent }: { agent: Agent }) {
  const incidents = useStore((s) => s.incidents.filter((i) => i.agentId === agent.id));
  return (
    <Card>
      {incidents.length ? (
        <ul className="divide-y divide-border">
          {incidents.map((i) => (
            <li key={i.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
              <SeverityBadge severity={i.severity} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  <Mono className="mr-1.5">{i.key}</Mono>
                  {i.title}
                </p>
                <p className="text-sm text-muted">{i.description}</p>
                {i.fix && <p className="mt-1 text-sm text-success">Fix: {i.fix}</p>}
              </div>
              <Badge tone={i.status === 'Resolved' ? 'success' : 'warning'}>{i.status}</Badge>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No incidents" description="Incidents linked to this agent will appear here." />
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- risk
export function RiskTab({ agent, assessments }: { agent: Agent; assessments: RiskAssessment[] }) {
  const { can, reason } = usePermission();
  const L = useLookup();
  const [open, setOpen] = useState(false);
  const current = assessments[0];
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader
          title="Why this tier"
          description="Each signal's score and the scanned fact that produced it"
          actions={<Button size="sm" onClick={() => setOpen(true)} disabledReason={can('risk.adjust') ? undefined : reason('risk.adjust')}>Adjust tier</Button>}
        />
        <div className="flex flex-wrap items-end gap-8 border-b border-border px-4 py-5">
          <RiskFingerprint signals={agent.signals} size="lg" showLabels />
          <div>
            <p className="text-xs text-subtle">Total</p>
            <p className="tabular text-3xl font-semibold">{agent.score}<span className="text-base font-normal text-subtle"> / 15</span></p>
            <div className="mt-1"><TierBadge tier={agent.tier} /></div>
          </div>
        </div>
        <ul className="divide-y divide-border">
          {SIGNALS.map((sig) => {
            const lv = agent.signals[sig.key];
            return (
              <li key={sig.key} className="grid gap-2 px-4 py-3 sm:grid-cols-[160px_96px_1fr]">
                <div>
                  <p className="text-sm font-medium">{sig.label}</p>
                  <p className="text-xs text-subtle">{sig.source}</p>
                </div>
                <div>
                  <Badge tone={lv === 3 ? 'danger' : lv === 2 ? 'warning' : 'success'}>{['Low', 'Medium', 'High'][lv - 1]} ({lv})</Badge>
                </div>
                <div className="text-sm">
                  <p className="text-fg">{current?.facts[sig.key]}</p>
                  <p className="text-xs text-subtle">{sig.levels[lv - 1]}</p>
                </div>
              </li>
            );
          })}
        </ul>
        {current?.overrides.length ? (
          <div className="border-t border-border p-4">
            <p className="mb-2 text-xs font-medium text-muted">Override rules hit</p>
            <ul className="space-y-1">
              {current.overrides.map((o) => (
                <li key={o} className="flex items-center gap-2 text-sm text-danger"><ShieldAlert className="h-4 w-4" />{o} → High</li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>
      <Card>
        <CardHeader title="Assessment history" description="A new version on every re-score" />
        <ol className="divide-y divide-border">
          {assessments.map((r) => (
            <li key={r.id} className="space-y-1 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">Version {r.version}</span>
                <span className="text-xs text-subtle">{dateOnly(r.createdAt)}</span>
              </div>
              <div className="flex items-center gap-2">
                <RiskFingerprint signals={r.signals} />
                <TierBadge tier={r.tier} score={r.total} />
                <Badge tone="outline">{r.status}</Badge>
              </div>
              {r.adjustedReason && <p className="text-xs text-muted">“{r.adjustedReason}” — {L.userName(r.reviewer)}</p>}
            </li>
          ))}
        </ol>
      </Card>
      <AdjustTierModal agent={agent} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function AdjustTierModal({ agent, open, onClose }: { agent: Agent; open: boolean; onClose: () => void }) {
  const [tier, setTier] = useState<RiskTier>(agent.tier);
  const [why, setWhy] = useState('');
  const toast = useToast();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Adjust risk tier"
      description="The reason is mandatory and recorded in the assessment history."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={why.trim().length < 10 || tier === agent.tier} onClick={() => { actions.adjustTier(agent.id, tier, why.trim()); toast({ tone: 'success', title: `Tier set to ${tier}`, body: 'Saved as a new assessment version.' }); onClose(); }}>
            Save adjustment
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="New tier" htmlFor="tier">
          <Select id="tier" value={tier} onChange={(e) => setTier(e.target.value as RiskTier)}>
            {(['Low', 'Medium', 'High', 'Prohibited'] as RiskTier[]).map((t) => <option key={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="Reason" required hint="At least 10 characters. Visible to the owner and auditors." htmlFor="why">
          <Textarea id="why" value={why} onChange={(e) => setWhy(e.target.value)} placeholder="e.g. Exposure lowered: channel restricted to authenticated relationship managers." />
        </Field>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- controls
export function ControlsTab({ agentId }: { agentId: string }) {
  const s = useStore((x) => x);
  const L = useLookup();
  const { can, reason } = usePermission();
  const toast = useToast();
  const rows = s.evidence.filter((e) => e.agentId === agentId);
  if (!rows.length) return <Card><EmptyState title="No checklist yet" description="A checklist is attached once the agent has a Low, Medium or High tier." /></Card>;
  const icon = { Accepted: <CircleCheck className="h-4 w-4 text-success" />, Submitted: <CircleDashed className="h-4 w-4 text-info" />, Rejected: <CircleX className="h-4 w-4 text-danger" />, Missing: <CircleDashed className="h-4 w-4 text-subtle" /> };
  return (
    <Card>
      <CardHeader title="Required controls" description={`Checklist for the ${L.agent(agentId)!.tier} tier, plus controls added by High signals`} />
      <ul className="divide-y divide-border">
        {rows.map((e) => {
          const c = s.controls.find((x) => x.id === e.controlId)!;
          return (
            <li key={e.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
              <span className="mt-0.5">{icon[e.status]}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium"><Mono className="mr-1.5">{c.code}</Mono>{c.name}</p>
                <p className="text-xs text-muted">{c.description}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-subtle">
                  <Paperclip className="h-3 w-3" />
                  {e.status === 'Missing' ? `Needs: ${c.evidence}` : `${e.ref} · ${L.userName(e.submittedBy)} · ${relTime(e.submittedAt)}`}
                </p>
              </div>
              <Badge tone={e.status === 'Accepted' ? 'success' : e.status === 'Rejected' ? 'danger' : e.status === 'Submitted' ? 'info' : 'neutral'}>{e.status}</Badge>
              <div className="flex gap-1.5">
                {(e.status === 'Missing' || e.status === 'Rejected') && (
                  <Button size="xs" icon={Paperclip} onClick={() => { actions.setEvidenceStatus(e.id, 'Submitted'); toast({ tone: 'success', title: 'Evidence submitted', body: `${c.code} sent to the risk reviewer.` }); }} disabledReason={can('evidence.submit') ? undefined : reason('evidence.submit')}>
                    Upload
                  </Button>
                )}
                {e.status === 'Submitted' && (
                  <>
                    <Button size="xs" onClick={() => actions.setEvidenceStatus(e.id, 'Accepted')} disabledReason={can('evidence.review') ? undefined : reason('evidence.review')}>Accept</Button>
                    <Button size="xs" variant="ghost" onClick={() => actions.setEvidenceStatus(e.id, 'Rejected')} disabledReason={can('evidence.review') ? undefined : reason('evidence.review')}>Reject</Button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ---------------------------------------------------------------- cost
export function CostTab({ agent }: { agent: Agent }) {
  const c = useChartColors();
  const budget = useStore((s) => s.budgets.find((b) => b.scope === 'agent' && b.scopeId === agent.id));
  const series = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(NOW - (29 - i) * 86_400_000);
    const wk = d.getDay() === 0 || d.getDay() === 6 ? 0.55 : 1;
    return { date: d.toISOString().slice(0, 10), cost: Math.round((agent.cost30d / 26) * wk * (0.85 + ((i * 37) % 30) / 100)) };
  });
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader title="Daily cost, last 30 days" description="Tokens priced per model deployment" />
        <div className="h-64 p-4">
          <ResponsiveContainer>
            <AreaChart data={series} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={c.grid} />
              <XAxis dataKey="date" {...axisProps(c.subtle)} tickFormatter={(d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} minTickGap={24} />
              <YAxis {...axisProps(c.subtle)} tickFormatter={(v) => moneyShort(v)} width={56} />
              <Tooltip content={<ChartTooltip format={moneyShort} labelFormat={(d) => dateOnly(d)} />} cursor={{ stroke: c.border }} />
              <Area type="monotone" dataKey="cost" name="Cost" stroke={c.primary} strokeWidth={2} fill={c.primary} fillOpacity={0.12} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card className="p-4">
        <p className="text-sm font-medium">Budget</p>
        {budget ? (
          <>
            <p className="tabular mt-2 text-2xl font-semibold">{moneyShort(budget.spent)} <span className="text-sm font-normal text-subtle">of {moneyShort(budget.limit)}</span></p>
            <Meter className="mt-3" value={budget.spent} max={budget.limit} tone="auto" label="Budget used" />
            <p className="mt-2 text-xs text-muted">At limit: <b className="text-fg">{budget.action}</b>. Alerts at {budget.alerts.join('%, ')}%.</p>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">No budget set. <Link to="/observe/cost" className="link">Create one</Link></p>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- lifecycle + kill switch
export function LifecycleMenu({ agent }: { agent: Agent }) {
  const { can } = usePermission();
  const toast = useToast();
  const navigate = useNavigate();
  return (
    <Popover
      className="w-56 p-1"
      trigger={({ toggle }) => (
        <button onClick={toggle} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-muted hover:bg-surface-2 hover:text-fg" aria-label="More actions">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      )}
    >
      {(close) => (
        <>
          <p className="px-2 pb-1 pt-1.5 text-xs text-subtle">Move lifecycle to</p>
          {LIFECYCLE_FLOW.filter((l) => l !== agent.lifecycle).map((l) => (
            <MenuItem
              key={l}
              disabled={(l === 'Approved') || !(can('approvals.decide') || can('inventory.register'))}
              onClick={() => {
                actions.setLifecycle(agent.id, l);
                toast({ tone: 'success', title: `Moved to ${l}`, body: l === 'Retired' ? 'SDK clients stop receiving this agent.' : undefined });
                close();
              }}
            >
              {l}
              {l === 'Approved' && <span className="ml-auto text-[11px] text-subtle">via approval</span>}
            </MenuItem>
          ))}
          <div className="my-1 border-t border-border" />
          <MenuItem onClick={() => { close(); navigate('/ownership'); }}>Transfer ownership</MenuItem>
        </>
      )}
    </Popover>
  );
}

export function KillSwitchModal({ agent, open, onClose }: { agent: Agent; open: boolean; onClose: () => void }) {
  const [reasonText, setReason] = useState('');
  const [confirm, setConfirm] = useState('');
  const toast = useToast();
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={`Suspend ${agent.name}?`}
      description="Every policy check from this agent will return block within 30 seconds, across all SDK clients."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="danger"
            icon={PowerOff}
            disabled={confirm !== 'SUSPEND' || reasonText.trim().length < 5}
            onClick={() => {
              actions.setSuspended(agent.id, true, reasonText.trim());
              toast({ tone: 'warning', title: 'Agent suspended', body: 'Owner, sponsor and security admins have been notified.' });
              onClose();
            }}
          >
            Suspend agent
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Reason" required htmlFor="ks-reason">
          <Textarea id="ks-reason" value={reasonText} onChange={(e) => setReason(e.target.value)} placeholder="e.g. INC-231: PII leaked in chat transcript" />
        </Field>
        <Field label={<>Type <span className="font-mono">SUSPEND</span> to confirm</>} htmlFor="ks-confirm">
          <input id="ks-confirm" className={cn('input-base font-mono')} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
        </Field>
      </div>
    </Modal>
  );
}
