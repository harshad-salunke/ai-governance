import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, UserX } from 'lucide-react';
import { actions, useStore } from '../data/store';
import { inScope, useLookup } from '../lib/lookup';
import { dateOnly, relTime } from '../lib/format';
import { usePermission } from '../lib/rbac';
import { useToast } from '../lib/toast';
import { Badge, Button, Card, DataTable, EmptyState, Field, Modal, PageHeader, Person, Select, Stat, Tabs, Textarea } from '../components/ui';
import { LIFECYCLE_FLOW, LifecycleBadge, ObjectLink, PlatformLabel, TierBadge } from '../components/domain';
import type { Lifecycle } from '../data/types';

type Tab = 'unmanaged' | 'claims' | 'orphans' | 'lifecycle' | 'transfers';

export default function Ownership() {
  const s = useStore((x) => x);
  const L = useLookup();
  const navigate = useNavigate();
  const { can, reason } = usePermission();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('unmanaged');
  const [transfer, setTransfer] = useState<string | null>(null);
  const agents = inScope(s, s.agents);
  const unmanaged = agents.filter((a) => !a.managed);
  const pendingClaims = s.claims.filter((c) => c.status === 'Pending admin');
  const coverage = agents.filter((a) => a.owner && a.sponsor).length / Math.max(1, agents.length);

  return (
    <div className="space-y-5">
      <PageHeader title="Ownership and lifecycle" description="Every agent needs a technical owner and a business sponsor. Unclaimed agents stay unmanaged." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Owner and sponsor coverage" value={`${Math.round(coverage * 100)}%`} tone={coverage < 0.95 ? 'warning' : 'success'} sub="Target above 95% within 30 days" />
        <Stat label="Unmanaged agents" value={unmanaged.length} tone={unmanaged.length ? 'warning' : undefined} />
        <Stat label="Claims waiting for admin" value={pendingClaims.length} />
        <Stat label="Orphaned (owner left)" value={s.orphans.length} tone={s.orphans.length ? 'danger' : undefined} />
      </div>

      <Card>
        <div className="px-3 pt-1">
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { value: 'unmanaged', label: 'Unmanaged', count: unmanaged.length },
              { value: 'claims', label: 'Claim queue', count: pendingClaims.length },
              { value: 'orphans', label: 'Orphans', count: s.orphans.length, alert: s.orphans.length > 0 },
              { value: 'lifecycle', label: 'Lifecycle board' },
              { value: 'transfers', label: 'Transfer history', count: s.transfers.length },
            ]}
          />
        </div>

        {tab === 'unmanaged' && (
          <DataTable
            rows={unmanaged}
            onRowClick={(a) => navigate(`/catalog/agent/${a.id}`)}
            columns={[
              { key: 'n', header: 'Agent', cell: (a) => <div><p className="font-medium">{a.name}</p><p className="text-xs text-subtle">{a.purpose}</p></div> },
              { key: 'p', header: 'Platform', hideBelow: 'md', cell: (a) => <PlatformLabel platform={a.platform} /> },
              { key: 't', header: 'Risk', cell: (a) => <TierBadge tier={a.tier} score={a.score} /> },
              { key: 'f', header: 'Found', hideBelow: 'sm', cell: (a) => <span className="text-muted">{relTime(a.createdAt)}</span> },
              {
                key: 'a',
                header: '',
                align: 'right',
                cell: (a) => {
                  const claimed = s.claims.some((c) => c.agentId === a.id && c.status === 'Pending admin');
                  return claimed ? (
                    <Badge tone="info">Claim pending</Badge>
                  ) : (
                    <Button size="xs" onClick={(e) => { e.stopPropagation(); actions.claimAgent(a.id); toast({ tone: 'success', title: 'Claim sent', body: 'A platform admin will confirm.' }); }} disabledReason={can('ownership.claim') ? undefined : reason('ownership.claim')}>
                      Claim
                    </Button>
                  );
                },
              },
            ]}
            empty={<EmptyState title="Every agent has an owner" description="New discoveries will appear here until someone claims them." />}
          />
        )}

        {tab === 'claims' && (
          <DataTable
            rows={s.claims}
            columns={[
              { key: 'a', header: 'Agent', cell: (c) => <ObjectLink kind="agent" id={c.agentId} name={L.agentName(c.agentId)} /> },
              { key: 'c', header: 'Claimed by', cell: (c) => <Person name={L.userName(c.claimant)} sub={L.user(c.claimant)?.title} /> },
              { key: 't', header: 'When', hideBelow: 'sm', cell: (c) => <span className="text-muted">{relTime(c.at)}</span> },
              { key: 's', header: 'Status', cell: (c) => <Badge tone={c.status === 'Confirmed' ? 'success' : c.status === 'Rejected' ? 'danger' : 'info'} dot>{c.status}</Badge> },
              {
                key: 'x',
                header: '',
                align: 'right',
                cell: (c) =>
                  c.status === 'Pending admin' && (
                    <span className="inline-flex gap-1.5">
                      <Button size="xs" variant="primary" onClick={() => { actions.resolveClaim(c.id, true); toast({ tone: 'success', title: 'Ownership confirmed', body: `${L.agentName(c.agentId)} is now managed.` }); }} disabledReason={can('ownership.confirm') ? undefined : reason('ownership.confirm')}>Confirm</Button>
                      <Button size="xs" variant="ghost" onClick={() => actions.resolveClaim(c.id, false)} disabledReason={can('ownership.confirm') ? undefined : reason('ownership.confirm')}>Reject</Button>
                    </span>
                  ),
              },
            ]}
          />
        )}

        {tab === 'orphans' && (
          <DataTable
            rows={s.orphans}
            columns={[
              { key: 'a', header: 'Agent', cell: (o) => <ObjectLink kind="agent" id={o.agentId} name={L.agentName(o.agentId)} /> },
              { key: 'm', header: 'Missing', cell: (o) => <Badge tone="danger" icon={UserX}>{o.missing}</Badge> },
              { key: 'f', header: 'Former', cell: (o) => <Person name={L.userName(o.formerUser)} sub="Disabled in Entra ID" muted /> },
              { key: 's', header: 'Suggested (manager)', hideBelow: 'md', cell: (o) => <Person name={L.userName(o.suggested)} /> },
              { key: 'd', header: 'Detected', hideBelow: 'lg', cell: (o) => <span className="text-muted">{relTime(o.detectedAt)}</span> },
              { key: 'x', header: '', align: 'right', cell: (o) => <Button size="xs" variant="primary" onClick={() => setTransfer(o.agentId)} disabledReason={can('ownership.confirm') ? undefined : reason('ownership.confirm')}>Reassign</Button> },
            ]}
            empty={<EmptyState title="No orphaned agents" />}
          />
        )}

        {tab === 'lifecycle' && (
          <div className="grid gap-3 overflow-x-auto p-4 md:grid-cols-3 xl:grid-cols-6">
            {([...LIFECYCLE_FLOW.slice(0, 3), 'Review overdue', 'Suspended', 'Deprecated'] as Lifecycle[]).map((state) => {
              const list = agents.filter((a) => a.lifecycle === state);
              return (
                <div key={state} className="min-w-[200px] rounded-lg bg-surface-2/60 p-2">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <LifecycleBadge state={state} />
                    <span className="tabular text-xs text-subtle">{list.length}</span>
                  </div>
                  <ul className="space-y-1.5">
                    {list.map((a) => (
                      <li key={a.id}>
                        <button onClick={() => navigate(`/catalog/agent/${a.id}`)} className="w-full rounded-md border border-border bg-surface p-2 text-left hover:border-border-strong">
                          <p className="truncate text-sm font-medium">{a.name}</p>
                          <div className="mt-1 flex items-center justify-between">
                            <TierBadge tier={a.tier} />
                            <span className="truncate text-[11px] text-subtle">{a.owner ? L.userName(a.owner).split(' ')[0] : 'No owner'}</span>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'transfers' && (
          <DataTable
            rows={s.transfers}
            columns={[
              { key: 'o', header: 'Object', cell: (t) => <ObjectLink kind={L.objectKind(t.objectId)} id={t.objectId} name={L.objectName(t.objectId)} /> },
              { key: 'f', header: 'Change', cell: (t) => <span className="inline-flex items-center gap-2 text-sm"><span className="text-muted">{t.from ? L.userName(t.from) : 'Unowned'}</span><ArrowRight className="h-3.5 w-3.5 text-subtle" /><span>{L.userName(t.to)}</span></span> },
              { key: 'r', header: 'Reason', hideBelow: 'md', cell: (t) => <span className="text-muted">{t.reason}</span> },
              { key: 'b', header: 'By', hideBelow: 'lg', cell: (t) => L.userName(t.by) },
              { key: 'd', header: 'Date', hideBelow: 'sm', cell: (t) => <span className="text-muted">{dateOnly(t.at)}</span> },
            ]}
          />
        )}
      </Card>

      <TransferModal agentId={transfer} onClose={() => setTransfer(null)} />
    </div>
  );
}

function TransferModal({ agentId, onClose }: { agentId: string | null; onClose: () => void }) {
  const s = useStore((x) => x);
  const L = useLookup();
  const toast = useToast();
  const suggested = s.orphans.find((o) => o.agentId === agentId)?.suggested ?? '';
  const [to, setTo] = useState('');
  const [why, setWhy] = useState('Owner left the organisation');
  const target = to || suggested;
  return (
    <Modal
      open={!!agentId}
      onClose={onClose}
      title="Transfer ownership"
      description={agentId ? L.agentName(agentId) : ''}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!target} onClick={() => { actions.transferOwnership(agentId!, target, why); toast({ tone: 'success', title: 'Ownership transferred', body: `${L.userName(target)} has been notified.` }); onClose(); }}>
            Transfer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="New owner" htmlFor="to">
          <Select id="to" value={target} onChange={(e) => setTo(e.target.value)}>
            <option value="">Choose…</option>
            {s.users.filter((u) => u.status === 'active' && u.roles.includes('agent_owner')).map((u) => <option key={u.id} value={u.id}>{u.name}{u.id === suggested ? ' (manager, suggested)' : ''}</option>)}
          </Select>
        </Field>
        <Field label="Reason" htmlFor="why"><Textarea id="why" value={why} onChange={(e) => setWhy(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
