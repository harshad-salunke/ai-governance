import { useState } from 'react';
import { BookCopy, Plus } from 'lucide-react';
import { actions, useStore } from '../../data/store';
import { useLookup } from '../../lib/lookup';
import { usePermission } from '../../lib/rbac';
import { useToast } from '../../lib/toast';
import { relTime } from '../../lib/format';
import { Badge, Button, Card, CardHeader, CodeBlock, DataTable, Drawer, FilterSelect, Mono, PageHeader, Switch, Tabs, Toolbar } from '../../components/ui';
import { ObjectLink, SeverityBadge } from '../../components/domain';
import type { GovernancePolicy } from '../../data/types';

const TEMPLATES = [
  { name: 'Only approved models', rule: 'agent.models.all(m => m.approved)', why: 'Stops teams wiring agents to sandbox or personal deployments.' },
  { name: 'Data residency: India only', rule: "agent.models.all(m => m.region in ['Central India','South India'])", why: 'For RBI / DPDP residency commitments.' },
  { name: 'Customer-facing needs director sponsor', rule: "agent.exposure == 'Customer' => sponsor.grade >= 'Director'", why: 'Senior accountability for public agents.' },
  { name: 'No orphaned agents', rule: 'agent.owner.active && agent.sponsor.active', why: 'Catches leavers within a day of Entra sync.' },
  { name: 'Payment tools need a human step', rule: "agent.tools.any(t => t.action == 'payment') => agent.humanInLoop", why: 'Pairs with the HUM-01 control.' },
  { name: 'Evaluation scores present', rule: "agent.tier != 'Low' => agent.evaluations.groundedness >= 4", why: 'Quality floor for Medium and High agents.' },
];

type Tab = 'policies' | 'violations' | 'templates';

export default function GovernancePolicies() {
  const s = useStore((x) => x);
  const L = useLookup();
  const { can, reason } = usePermission();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('policies');
  const [open, setOpen] = useState<GovernancePolicy | null>(null);
  const [pol, setPol] = useState('all');
  const [status, setStatus] = useState('Open');
  const deny = can('govpolicy.manage') ? undefined : reason('govpolicy.manage');
  const violations = s.governanceViolations.filter((v) => (pol === 'all' || v.policyId === pol) && (status === 'all' || v.status === status));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Governance policies"
        description="Organisation rules over inventory metadata, checked after every scan. Runtime rules live under Enforce."
        actions={<Button variant="primary" icon={Plus} disabledReason={deny} onClick={() => setTab('templates')}>New policy</Button>}
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'policies', label: 'Policies', count: s.governancePolicies.length },
          { value: 'violations', label: 'Violations', count: s.governanceViolations.filter((v) => v.status === 'Open').length, alert: true },
          { value: 'templates', label: 'Templates', count: TEMPLATES.length },
        ]}
      />

      {tab === 'policies' && (
        <Card>
          <DataTable
            rows={s.governancePolicies}
            onRowClick={setOpen}
            columns={[
              { key: 'on', header: 'On', width: '56px', cell: (p) => <span onClick={(e) => e.stopPropagation()}><Switch size="sm" checked={p.enabled} disabled={!!deny} title={deny} onChange={() => { actions.toggleGovPolicy(p.id); toast({ tone: 'info', title: p.enabled ? 'Policy disabled' : 'Policy enabled', body: p.name }); }} label={`Enable ${p.name}`} /></span> },
              { key: 'n', header: 'Policy', sort: (p) => p.name, cell: (p) => <div className="min-w-[240px]"><p className="font-medium">{p.name}</p><p className="text-xs text-muted">{p.description}</p></div> },
              { key: 'c', header: 'Category', hideBelow: 'md', sort: (p) => p.category, cell: (p) => <Badge tone="outline">{p.category}</Badge> },
              { key: 's', header: 'Severity', sort: (p) => ['Low', 'Medium', 'High', 'Critical'].indexOf(p.severity), cell: (p) => <SeverityBadge severity={p.severity} /> },
              { key: 'v', header: 'Open violations', align: 'right', sort: (p) => p.violations, cell: (p) => { const n = s.governanceViolations.filter((v) => v.policyId === p.id && v.status === 'Open').length; return <span className={n ? 'font-semibold text-danger' : 'text-subtle'}>{n}</span>; } },
            ]}
          />
        </Card>
      )}

      {tab === 'violations' && (
        <Card>
          <Toolbar>
            <FilterSelect label="Policy" value={pol} onChange={setPol} options={s.governancePolicies.map((p) => ({ value: p.id, label: p.name }))} />
            <FilterSelect label="Status" value={status} onChange={setStatus} options={['Open', 'Waived', 'Resolved'].map((x) => ({ value: x, label: x }))} />
          </Toolbar>
          <DataTable
            rows={violations}
            columns={[
              { key: 'a', header: 'Agent', sort: (v) => L.agentName(v.agentId), cell: (v) => <ObjectLink kind="agent" id={v.agentId} name={L.agentName(v.agentId)} /> },
              { key: 'p', header: 'Policy', cell: (v) => s.governancePolicies.find((p) => p.id === v.policyId)!.name },
              { key: 'd', header: 'Detail', hideBelow: 'md', cell: (v) => <span className="text-muted">{v.detail}</span> },
              { key: 's', header: 'Status', cell: (v) => <Badge tone={v.status === 'Open' ? 'danger' : v.status === 'Waived' ? 'warning' : 'success'} dot>{v.status}</Badge> },
              { key: 't', header: 'Detected', hideBelow: 'sm', sort: (v) => v.detectedAt, cell: (v) => <span className="text-muted">{relTime(v.detectedAt)}</span> },
            ]}
          />
        </Card>
      )}

      {tab === 'templates' && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {TEMPLATES.map((t) => (
            <Card key={t.name} className="flex flex-col p-4">
              <BookCopy className="h-4 w-4 text-subtle" />
              <p className="mt-2 font-medium">{t.name}</p>
              <p className="mt-0.5 flex-1 text-sm text-muted">{t.why}</p>
              <Mono className="mt-3 block truncate rounded bg-surface-2 px-2 py-1">{t.rule}</Mono>
              <Button size="sm" className="mt-3 self-start" disabledReason={deny} onClick={() => toast({ tone: 'success', title: 'Policy created from template', body: `${t.name} starts disabled so you can review matches first.` })}>Use template</Button>
            </Card>
          ))}
        </div>
      )}

      <Drawer open={!!open} onClose={() => setOpen(null)} title={open?.name} subtitle={open?.description}>
        {open && (
          <div className="space-y-4 p-5">
            <div className="flex gap-2"><SeverityBadge severity={open.severity} /><Badge tone="outline">{open.category}</Badge><Badge tone={open.enabled ? 'success' : 'neutral'} dot>{open.enabled ? 'Enabled' : 'Disabled'}</Badge></div>
            <CodeBlock title="Rule over metadata" code={open.rule} lang="text" />
            <Card>
              <CardHeader title="Current violations" />
              <ul className="divide-y divide-border">
                {s.governanceViolations.filter((v) => v.policyId === open.id).map((v) => (
                  <li key={v.id} className="flex items-center gap-2 px-4 py-2.5 text-sm">
                    <ObjectLink kind="agent" id={v.agentId} name={L.agentName(v.agentId)} className="flex-1" />
                    <Badge tone={v.status === 'Open' ? 'danger' : 'neutral'}>{v.status}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}
      </Drawer>
    </div>
  );
}
