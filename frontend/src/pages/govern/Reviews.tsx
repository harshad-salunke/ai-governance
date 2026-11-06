import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { actions, useStore } from '../../data/store';
import { useLookup } from '../../lib/lookup';
import { usePermission } from '../../lib/rbac';
import { useToast } from '../../lib/toast';
import { dateOnly, relTime } from '../../lib/format';
import { NOW } from '../../data/seed';
import { Badge, Button, Card, DataTable, Field, Input, Modal, PageHeader, Person, Select, Stat, Tabs, Textarea } from '../../components/ui';
import { ObjectLink, TierBadge } from '../../components/domain';

type Tab = 'reviews' | 'exceptions';

export default function Reviews() {
  const s = useStore((x) => x);
  const L = useLookup();
  const { can, reason } = usePermission();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'reviews';
  const [grant, setGrant] = useState(false);
  const order = { Overdue: 0, Due: 1, Upcoming: 2, Completed: 3 };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reviews and exceptions"
        description="High-risk agents are re-approved every 6 months, Medium every 12. Exceptions waive a control or policy until they expire."
        actions={tab === 'exceptions' && <Button variant="primary" icon={Plus} onClick={() => setGrant(true)} disabledReason={can('exceptions.grant') ? undefined : reason('exceptions.grant')}>Grant exception</Button>}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Overdue reviews" value={s.reviews.filter((r) => r.status === 'Overdue').length} tone="danger" sub="Agent state set to Review overdue" />
        <Stat label="Due in 30 days" value={s.reviews.filter((r) => r.status === 'Due').length} tone="warning" />
        <Stat label="Active exceptions" value={s.exceptions.filter((e) => e.status === 'Active' || e.status === 'Expiring').length} />
        <Stat label="Expiring in 30 days" value={s.exceptions.filter((e) => e.status === 'Expiring').length} tone="warning" />
      </div>
      <Tabs value={tab} onChange={(t) => setParams({ tab: t }, { replace: true })} items={[{ value: 'reviews', label: 'Periodic reviews', count: s.reviews.length }, { value: 'exceptions', label: 'Exceptions', count: s.exceptions.length }]} />

      {tab === 'reviews' && (
        <Card>
          <DataTable
            rows={[...s.reviews].sort((a, b) => order[a.status] - order[b.status] || a.dueAt.localeCompare(b.dueAt))}
            columns={[
              { key: 'a', header: 'Agent', cell: (r) => <ObjectLink kind="agent" id={r.agentId} name={L.agentName(r.agentId)} className="font-medium" /> },
              { key: 't', header: 'Tier', cell: (r) => <TierBadge tier={L.agent(r.agentId)!.tier} /> },
              { key: 'c', header: 'Cadence', hideBelow: 'md', cell: (r) => <span className="text-muted">Every {r.cadence}</span> },
              { key: 'd', header: 'Due', sort: (r) => r.dueAt, cell: (r) => <span className={r.status === 'Overdue' ? 'font-medium text-danger' : ''}>{dateOnly(r.dueAt)} <span className="text-xs text-subtle">({relTime(r.dueAt)})</span></span> },
              { key: 's', header: 'Status', cell: (r) => <Badge tone={r.status === 'Overdue' ? 'danger' : r.status === 'Due' ? 'warning' : r.status === 'Completed' ? 'success' : 'neutral'} dot>{r.status}</Badge> },
              { key: 'r', header: 'Reviewer', hideBelow: 'lg', cell: (r) => <Person name={L.userName(r.reviewer)} /> },
              { key: 'x', header: '', align: 'right', cell: (r) => (r.status === 'Overdue' || r.status === 'Due') && <Button size="xs" onClick={() => toast({ tone: 'success', title: 'Review started', body: `Re-approval request opened for ${L.agentName(r.agentId)}.` })} disabledReason={can('approvals.decide') ? undefined : reason('approvals.decide')}>Start review</Button> },
            ]}
          />
        </Card>
      )}

      {tab === 'exceptions' && (
        <Card>
          <DataTable
            rows={s.exceptions}
            columns={[
              { key: 'a', header: 'Agent', cell: (e) => <ObjectLink kind="agent" id={e.agentId} name={L.agentName(e.agentId)} className="font-medium" /> },
              { key: 'w', header: 'Waived', cell: (e) => <div className="min-w-[200px]"><p className="text-sm">{e.waived}</p><p className="text-xs text-muted">{e.reason}</p></div> },
              { key: 'p', header: 'Approver', hideBelow: 'lg', cell: (e) => <Person name={L.userName(e.approver)} /> },
              { key: 'x', header: 'Expires', sort: (e) => e.expiresAt, cell: (e) => <span className={Date.parse(e.expiresAt) < NOW ? 'text-danger' : ''}>{dateOnly(e.expiresAt)}</span> },
              { key: 's', header: 'Status', cell: (e) => <Badge tone={e.status === 'Active' ? 'success' : e.status === 'Expiring' ? 'warning' : 'neutral'} dot>{e.status}</Badge> },
              { key: 'r', header: '', align: 'right', cell: (e) => (e.status === 'Active' || e.status === 'Expiring') && <Button size="xs" variant="ghost" onClick={() => { actions.revokeException(e.id); toast({ tone: 'info', title: 'Exception revoked' }); }} disabledReason={can('exceptions.grant') ? undefined : reason('exceptions.grant')}>Revoke</Button> },
            ]}
          />
        </Card>
      )}

      <GrantModal open={grant} onClose={() => setGrant(false)} />
    </div>
  );
}

function GrantModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStore((x) => x);
  const toast = useToast();
  const [agentId, setAgentId] = useState('ag-loan');
  const [waived, setWaived] = useState('Policy: No customer data on models outside India');
  const [why, setWhy] = useState('');
  const [days, setDays] = useState(30);
  const valid = why.trim().length >= 10 && days > 0 && days <= 180;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Grant an exception"
      description="Time-limited. Expired exceptions re-open the violation automatically."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!valid} onClick={() => {
            actions.grantException({ id: `ex-${s.exceptions.length + 1}`, agentId, waived, reason: why.trim(), approver: s.session.userId, grantedAt: new Date(NOW).toISOString(), expiresAt: new Date(NOW + days * 86_400_000).toISOString(), status: 'Active' });
            toast({ tone: 'success', title: 'Exception granted', body: `Expires in ${days} days.` });
            onClose();
          }}>Grant exception</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Agent" htmlFor="ea"><Select id="ea" value={agentId} onChange={(e) => setAgentId(e.target.value)}>{s.agents.filter((a) => a.managed).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
        <Field label="Control or policy to waive" htmlFor="ew">
          <Select id="ew" value={waived} onChange={(e) => setWaived(e.target.value)}>
            {s.governancePolicies.map((p) => <option key={p.id}>Policy: {p.name}</option>)}
            {s.controls.map((c) => <option key={c.id}>Control {c.code}: {c.name}</option>)}
          </Select>
        </Field>
        <Field label="Reason" required hint="At least 10 characters" htmlFor="er"><Textarea id="er" value={why} onChange={(e) => setWhy(e.target.value)} /></Field>
        <Field label="Expires after (days)" hint="Maximum 180 days" htmlFor="ed"><Input id="ed" type="number" min={1} max={180} value={days} onChange={(e) => setDays(Number(e.target.value))} /></Field>
      </div>
    </Modal>
  );
}
