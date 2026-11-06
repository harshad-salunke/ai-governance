import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, PowerOff } from 'lucide-react';
import { actions, useStore } from '../../data/store';
import { useLookup } from '../../lib/lookup';
import { usePermission } from '../../lib/rbac';
import { useToast } from '../../lib/toast';
import { dateTime, relTime } from '../../lib/format';
import { NOW } from '../../data/seed';
import { Badge, Button, Callout, Card, Checkbox, DataTable, Drawer, Field, FilterSelect, Input, Mono, PageHeader, Person, Select, Textarea, Toolbar } from '../../components/ui';
import { DecisionBadge, ObjectLink, SeverityBadge } from '../../components/domain';
import type { Incident, Severity } from '../../data/types';

const blank = (owner: string): Incident => ({ id: '', key: '', agentId: 'ag-support', title: '', severity: 'Medium', description: '', linkedDecisionIds: [], owner, status: 'Open', openedAt: new Date(NOW).toISOString(), agentSuspended: false });

export default function Incidents() {
  const s = useStore((x) => x);
  const L = useLookup();
  const { can, reason } = usePermission();
  const [edit, setEdit] = useState<Incident | null>(null);
  const [status, setStatus] = useState('open');
  const [sev, setSev] = useState('all');
  const rows = s.incidents.filter((i) => (status === 'all' || (status === 'open' ? i.status !== 'Resolved' : i.status === 'Resolved')) && (sev === 'all' || i.severity === sev));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Incidents"
        description="Problems caused by an agent, linked to the runtime decisions involved. A High or Critical incident can suspend the agent."
        actions={<Button variant="primary" icon={Plus} onClick={() => setEdit(blank(s.session.userId))} disabledReason={can('incidents.manage') ? undefined : reason('incidents.manage')}>Log incident</Button>}
      />
      <Card>
        <Toolbar>
          <FilterSelect label="Status" value={status} onChange={setStatus} options={[{ value: 'open', label: 'Open' }, { value: 'resolved', label: 'Resolved' }]} />
          <FilterSelect label="Severity" value={sev} onChange={setSev} options={['Critical', 'High', 'Medium', 'Low'].map((x) => ({ value: x, label: x }))} />
        </Toolbar>
        <DataTable
          rows={rows}
          onRowClick={setEdit}
          columns={[
            { key: 'k', header: 'Key', cell: (i) => <Mono className="text-fg">{i.key}</Mono> },
            { key: 't', header: 'Incident', cell: (i) => <div className="min-w-[240px]"><p className="font-medium">{i.title}</p><ObjectLink kind="agent" id={i.agentId} name={L.agentName(i.agentId)} className="text-xs text-muted" /></div> },
            { key: 's', header: 'Severity', sort: (i) => ['Low', 'Medium', 'High', 'Critical'].indexOf(i.severity), cell: (i) => <SeverityBadge severity={i.severity} /> },
            { key: 'st', header: 'Status', cell: (i) => <Badge tone={i.status === 'Resolved' ? 'success' : i.status === 'Mitigated' ? 'info' : 'warning'} dot>{i.status}</Badge> },
            { key: 'ks', header: 'Agent', hideBelow: 'md', cell: (i) => (i.agentSuspended ? <Badge tone="danger" icon={PowerOff}>Suspended</Badge> : <span className="text-subtle">Running</span>) },
            { key: 'o', header: 'Owner', hideBelow: 'lg', cell: (i) => <Person name={L.userName(i.owner)} /> },
            { key: 'at', header: 'Opened', sort: (i) => i.openedAt, hideBelow: 'sm', cell: (i) => <span className="text-muted">{relTime(i.openedAt)}</span> },
          ]}
        />
      </Card>
      {edit && <IncidentDrawer key={edit.id || 'new'} incident={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function IncidentDrawer({ incident, onClose }: { incident: Incident; onClose: () => void }) {
  const s = useStore((x) => x);
  const L = useLookup();
  const { can } = usePermission();
  const toast = useToast();
  const [f, setF] = useState<Incident>(incident);
  const isNew = !incident.id;
  const set = <K extends keyof Incident>(k: K, v: Incident[K]) => setF({ ...f, [k]: v });
  const decisions = s.decisions.filter((d) => d.agentId === f.agentId && d.decision !== 'allow').slice(0, 8);
  const locked = !can('incidents.manage');

  const save = () => {
    const id = isNew ? `inc-${s.incidents.length + 1}` : f.id;
    const key = isNew ? `INC-${232 + s.incidents.length - 5}` : f.key;
    actions.saveIncident({ ...f, id, key });
    if (f.agentSuspended && !L.agent(f.agentId)!.suspended) actions.setSuspended(f.agentId, true, `${key}: ${f.title}`);
    toast({ tone: 'success', title: isNew ? `${key} logged` : `${key} updated`, body: f.agentSuspended ? 'Agent suspended. All checks now return block.' : undefined });
    onClose();
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={isNew ? 'Log an incident' : `${f.key} · ${f.title}`}
      subtitle={isNew ? 'Record what happened and link the decisions involved.' : `Opened ${dateTime(f.openedAt)}`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={locked || f.title.trim().length < 5}>{isNew ? 'Log incident' : 'Save changes'}</Button>
        </>
      }
    >
      <div className="space-y-4 p-5">
        <Field label="Title" required htmlFor="it"><Input id="it" value={f.title} disabled={locked} onChange={(e) => set('title', e.target.value)} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Agent" htmlFor="ia"><Select id="ia" value={f.agentId} disabled={locked || !isNew} onChange={(e) => set('agentId', e.target.value)}>{s.agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
          <Field label="Severity" htmlFor="is"><Select id="is" value={f.severity} disabled={locked} onChange={(e) => set('severity', e.target.value as Severity)}>{['Low', 'Medium', 'High', 'Critical'].map((x) => <option key={x}>{x}</option>)}</Select></Field>
          <Field label="Status" htmlFor="ist"><Select id="ist" value={f.status} disabled={locked} onChange={(e) => set('status', e.target.value as Incident['status'])}>{['Open', 'Investigating', 'Mitigated', 'Resolved'].map((x) => <option key={x}>{x}</option>)}</Select></Field>
          <Field label="Owner" htmlFor="io"><Select id="io" value={f.owner} disabled={locked} onChange={(e) => set('owner', e.target.value)}>{s.users.filter((u) => u.status === 'active').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
        </div>
        <Field label="What happened" htmlFor="id"><Textarea id="id" value={f.description} disabled={locked} onChange={(e) => set('description', e.target.value)} /></Field>
        <Field label="Fix" htmlFor="if"><Textarea id="if" value={f.fix ?? ''} disabled={locked} onChange={(e) => set('fix', e.target.value)} placeholder="What changed so it doesn't happen again" /></Field>

        <div>
          <p className="mb-2 text-sm font-medium">Linked runtime decisions</p>
          <ul className="divide-y divide-border rounded-md border border-border">
            {decisions.map((d) => (
              <li key={d.id} className="px-3 py-2">
                <Checkbox
                  checked={f.linkedDecisionIds.includes(d.id)}
                  disabled={locked}
                  onChange={(v) => set('linkedDecisionIds', v ? [...f.linkedDecisionIds, d.id] : f.linkedDecisionIds.filter((x) => x !== d.id))}
                  label={<span className="flex flex-wrap items-center gap-2"><Mono>{d.id}</Mono><span className="font-mono text-[12px]">{L.toolName(d.toolId)}</span><DecisionBadge decision={d.decision} /></span>}
                  description={`${relTime(d.at)} · ${d.user} · ${d.reason}`}
                />
              </li>
            ))}
          </ul>
          <Link to={`/runtime/decisions?agent=${f.agentId}`} className="link mt-1.5 inline-block text-xs">Search the decision log</Link>
        </div>

        {(f.severity === 'High' || f.severity === 'Critical') && (
          <Callout tone="danger" icon={PowerOff} title="Suspend the agent?">
            <Checkbox checked={f.agentSuspended} disabled={locked || !can('runtime.killswitch')} onChange={(v) => set('agentSuspended', v)} label="Use the kill switch for this agent" description={can('runtime.killswitch') ? 'All checks return block within 30 seconds.' : 'Needs Security admin.'} />
          </Callout>
        )}
      </div>
    </Drawer>
  );
}
