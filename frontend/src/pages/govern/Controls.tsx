import { useState } from 'react';
import { Check, Link2, Minus, Paperclip, Zap } from 'lucide-react';
import { actions, useStore } from '../../data/store';
import { useLookup } from '../../lib/lookup';
import { usePermission } from '../../lib/rbac';
import { useToast } from '../../lib/toast';
import { relTime } from '../../lib/format';
import { SIGNALS } from '../../data/risk';
import { Badge, Button, Card, CardHeader, DataTable, FilterSelect, Mono, PageHeader, Tabs, Toolbar } from '../../components/ui';
import { ObjectLink, TierBadge } from '../../components/domain';

type Tab = 'library' | 'checklists' | 'evidence';

export default function Controls() {
  const s = useStore((x) => x);
  const L = useLookup();
  const { can, reason } = usePermission();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('library');
  const [status, setStatus] = useState('Submitted');
  const [ctl, setCtl] = useState('all');

  const evRows = s.evidence.filter((e) => (status === 'all' || e.status === status) && (ctl === 'all' || e.controlId === ctl));
  const review = can('evidence.review') ? undefined : reason('evidence.review');

  return (
    <div className="space-y-5">
      <PageHeader title="Controls" description="What each tier must prove before approval, and the evidence submitted for it." />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'library', label: 'Control library', count: s.controls.length },
          { value: 'checklists', label: 'Checklists by tier' },
          { value: 'evidence', label: 'Evidence review', count: s.evidence.filter((e) => e.status === 'Submitted').length },
        ]}
      />

      {tab === 'library' && (
        <Card>
          <DataTable
            rows={s.controls}
            columns={[
              { key: 'code', header: 'Code', sort: (c) => c.code, cell: (c) => <Mono className="text-fg">{c.code}</Mono> },
              { key: 'n', header: 'Control', sort: (c) => c.name, cell: (c) => <div className="min-w-[220px]"><p className="font-medium">{c.name}</p><p className="text-xs text-muted">{c.description}</p></div> },
              { key: 'cat', header: 'Category', hideBelow: 'md', sort: (c) => c.category, cell: (c) => <Badge tone="outline">{c.category}</Badge> },
              { key: 'ev', header: 'Evidence required', hideBelow: 'lg', cell: (c) => <span className="text-muted">{c.evidence}</span> },
              { key: 't', header: 'Tiers', cell: (c) => <span className="flex flex-wrap gap-1">{c.tiers.map((t) => <TierBadge key={t} tier={t} />)}</span> },
              { key: 'auto', header: 'Checked by', hideBelow: 'xl', cell: (c) => (c.linkedPolicyType ? <Badge tone="primary" icon={Link2}>Runtime policy</Badge> : c.evidence.startsWith('Auto') ? <Badge tone="info" icon={Zap}>Automatic</Badge> : <span className="text-subtle">Reviewer</span>) },
            ]}
          />
        </Card>
      )}

      {tab === 'checklists' && (
        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader title="Checklist templates" description="Controls required for each tier. Higher tiers include everything below." />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-2/60 text-xs text-muted">
                    <th className="px-4 py-2 text-left font-medium">Control</th>
                    {(['Low', 'Medium', 'High'] as const).map((t) => <th key={t} className="w-24 px-2 py-2 text-center font-medium"><TierBadge tier={t} /></th>)}
                  </tr>
                </thead>
                <tbody>
                  {s.controls.map((c) => (
                    <tr key={c.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2"><Mono className="mr-2">{c.code}</Mono>{c.name}</td>
                      {(['Low', 'Medium', 'High'] as const).map((t) => (
                        <td key={t} className="text-center">
                          {s.checklistTemplates[t].includes(c.id) ? <Check className="mx-auto h-4 w-4 text-primary" aria-label="Required" /> : <Minus className="mx-auto h-4 w-4 text-border-strong" aria-label="Not required" />}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card>
            <CardHeader title="Risk-to-control mapping" description="A signal scored High adds these controls, whatever the tier" />
            <ul className="divide-y divide-border">
              {SIGNALS.filter((sig) => s.controls.some((c) => c.addedBySignal === sig.key)).map((sig) => (
                <li key={sig.key} className="px-4 py-3">
                  <p className="text-sm font-medium">{sig.label} = 3</p>
                  <p className="text-xs text-subtle">{sig.levels[2]}</p>
                  <ul className="mt-2 space-y-1">
                    {s.controls.filter((c) => c.addedBySignal === sig.key).map((c) => (
                      <li key={c.id} className="text-sm text-muted"><Mono className="mr-1.5">{c.code}</Mono>{c.name}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {tab === 'evidence' && (
        <Card>
          <Toolbar>
            <FilterSelect label="Status" value={status} onChange={setStatus} options={['Submitted', 'Accepted', 'Rejected', 'Missing'].map((x) => ({ value: x, label: x }))} />
            <FilterSelect label="Control" value={ctl} onChange={setCtl} options={s.controls.map((c) => ({ value: c.id, label: `${c.code} ${c.name}` }))} />
          </Toolbar>
          <DataTable
            rows={evRows}
            columns={[
              { key: 'a', header: 'Agent', sort: (e) => L.agentName(e.agentId), cell: (e) => <ObjectLink kind="agent" id={e.agentId} name={L.agentName(e.agentId)} /> },
              { key: 'c', header: 'Control', cell: (e) => { const c = s.controls.find((x) => x.id === e.controlId)!; return <span><Mono className="mr-1.5">{c.code}</Mono>{c.name}</span>; } },
              { key: 'r', header: 'Evidence', hideBelow: 'lg', cell: (e) => (e.status === 'Missing' ? <span className="text-subtle">Not submitted</span> : <span className="inline-flex max-w-[240px] items-center gap-1 truncate text-muted"><Paperclip className="h-3 w-3 shrink-0" />{e.ref}</span>) },
              { key: 'b', header: 'Submitted', hideBelow: 'md', sort: (e) => e.submittedAt, cell: (e) => <span className="text-muted">{e.status === 'Missing' ? '—' : `${L.userName(e.submittedBy)} · ${relTime(e.submittedAt)}`}</span> },
              { key: 's', header: 'Status', cell: (e) => <Badge tone={e.status === 'Accepted' ? 'success' : e.status === 'Rejected' ? 'danger' : e.status === 'Submitted' ? 'info' : 'neutral'}>{e.status}</Badge> },
              {
                key: 'x',
                header: '',
                align: 'right',
                cell: (e) =>
                  e.status === 'Submitted' && (
                    <span className="inline-flex gap-1.5">
                      <Button size="xs" variant="primary" onClick={() => { actions.setEvidenceStatus(e.id, 'Accepted'); toast({ tone: 'success', title: 'Evidence accepted' }); }} disabledReason={review}>Accept</Button>
                      <Button size="xs" variant="ghost" onClick={() => { actions.setEvidenceStatus(e.id, 'Rejected'); toast({ tone: 'info', title: 'Evidence rejected', body: 'The owner has been asked to resubmit.' }); }} disabledReason={review}>Reject</Button>
                    </span>
                  ),
              },
            ]}
          />
        </Card>
      )}
    </div>
  );
}
