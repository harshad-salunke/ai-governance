import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Sparkles, Timer, Unlock } from 'lucide-react';
import { actions, useStore } from '../../data/store';
import { useLookup } from '../../lib/lookup';
import { usePermission } from '../../lib/rbac';
import { useToast } from '../../lib/toast';
import { compact, relTime } from '../../lib/format';
import { useShell } from '../../layout/shellContext';
import { Badge, Button, Card, DataTable, FilterSelect, Mono, PageHeader, SearchInput, Stat, Switch, Tabs, Toolbar } from '../../components/ui';
import { DecisionBadge, ModeBadge, ObjectLink } from '../../components/domain';
import type { RuntimePolicy } from '../../data/types';

type Tab = 'policies' | 'quarantine';

export default function RuntimePolicies() {
  const s = useStore((x) => x);
  const L = useLookup();
  const navigate = useNavigate();
  const { openPilot } = useShell();
  const { can, reason } = usePermission();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'policies';
  const [q, setQ] = useState('');
  const [type, setType] = useState('all');
  const [mode, setMode] = useState('all');
  const deny = can('runtime.policies') ? undefined : reason('runtime.policies');

  const rows = s.runtimePolicies.filter((p) => (!q || `${p.name} ${p.id} ${p.description}`.toLowerCase().includes(q.toLowerCase())) && (type === 'all' || p.type === type) && (mode === 'all' || p.mode === mode));
  const scopeLabel = (p: RuntimePolicy) => (p.scope.kind === 'all' ? 'All agents' : p.scope.kind === 'role' ? `Role · ${L.role(p.scope.id!)?.name}` : p.scope.kind === 'tool' ? `Tool · ${L.toolName(p.scope.id!)}` : `Agent · ${L.agentName(p.scope.id!)}`);
  const quarantined = s.tools.filter((t) => t.quarantined);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Runtime policies"
        description="Checked on every tool call through the SDK. Explicit block beats allow; the most specific scope wins. Changes reach every client within 30 seconds."
        actions={
          <>
            <Button icon={Sparkles} onClick={() => openPilot()}>Draft with PolicyPilot</Button>
            <Button variant="primary" icon={Plus} onClick={() => navigate('/runtime/policies/new')} disabledReason={deny}>New policy</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active policies" value={s.runtimePolicies.filter((p) => p.status === 'Active').length} sub={`${s.runtimePolicies.filter((p) => p.status === 'Active' && p.mode === 'monitor').length} in monitor mode`} />
        <Stat label="Matches, 7 days" value={compact(s.runtimePolicies.reduce((n, p) => n + p.hits7d, 0))} />
        <Stat label="Check latency p95" value={`${s.runtimeStats.p95} ms`} tone="success" sub={`p99 ${s.runtimeStats.p99} ms · target < 50 ms`} />
        <Stat label="Propagation" value={`${s.runtimeStats.propagationSec} s`} icon={Timer} sub="Last compile to all clients" />
      </div>

      <Tabs
        value={tab}
        onChange={(t) => setParams({ tab: t }, { replace: true })}
        items={[
          { value: 'policies', label: 'Policies', count: s.runtimePolicies.length },
          { value: 'quarantine', label: 'Quarantined tools', count: quarantined.length, alert: quarantined.length > 0 },
        ]}
      />

      {tab === 'policies' ? (
        <Card>
          <Toolbar>
            <SearchInput value={q} onChange={setQ} placeholder="Search name or ID" className="w-full sm:w-60" />
            <FilterSelect label="Type" value={type} onChange={setType} options={['Tool access', 'Parameter rule', 'Data rule', 'User context', 'Model access', 'Environment', 'Content'].map((x) => ({ value: x, label: x }))} />
            <FilterSelect label="Mode" value={mode} onChange={setMode} options={[{ value: 'enforce', label: 'Enforce' }, { value: 'monitor', label: 'Monitor' }]} />
          </Toolbar>
          <DataTable
            rows={rows}
            onRowClick={(p) => navigate(`/runtime/policies/${p.id}`)}
            columns={[
              { key: 'n', header: 'Policy', sort: (p) => p.name, cell: (p) => <div className="min-w-[240px]"><p className="font-medium">{p.name}</p><p className="text-xs text-subtle"><Mono>{p.id}</Mono> · v{p.version} · {p.type}</p></div> },
              { key: 'sc', header: 'Scope', hideBelow: 'lg', cell: (p) => <span className="text-muted">{scopeLabel(p)}</span> },
              { key: 'd', header: 'Decision', sort: (p) => p.decision, cell: (p) => <DecisionBadge decision={p.decision} /> },
              {
                key: 'm',
                header: 'Enforce',
                cell: (p) =>
                  p.status === 'Active' ? (
                    <span className="inline-flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Switch size="sm" checked={p.mode === 'enforce'} disabled={!!deny} title={deny} label={`Enforce ${p.name}`} onChange={(v) => { actions.setPolicyMode(p.id, v ? 'enforce' : 'monitor'); toast({ tone: 'success', title: v ? 'Now enforcing' : 'Switched to monitor', body: `${p.name} · live in all clients within 30 s` }); }} />
                      <ModeBadge mode={p.mode} />
                    </span>
                  ) : (
                    <Badge tone={p.status === 'Draft' ? 'neutral' : 'info'}>{p.status}</Badge>
                  ),
              },
              { key: 'h', header: 'Hits 7d', align: 'right', sort: (p) => p.hits7d, hideBelow: 'sm', cell: (p) => compact(p.hits7d) },
              { key: 'u', header: 'Updated', sort: (p) => p.updatedAt, hideBelow: 'xl', cell: (p) => <span className="text-muted">{relTime(p.updatedAt)} · {L.userName(p.author).split(' ')[0]}</span> },
            ]}
          />
        </Card>
      ) : (
        <Card>
          <DataTable
            rows={quarantined}
            columns={[
              { key: 'n', header: 'Tool', cell: (t) => <ObjectLink kind="tool" id={t.id} name={t.name} mono className="font-medium" /> },
              { key: 'm', header: 'Server', cell: (t) => <Mono>{L.mcp(t.mcpServerId)?.name}</Mono> },
              { key: 'h', header: 'Schema hash', cell: (t) => <Mono className="text-warning">{t.previousHash} → {t.schemaHash}</Mono> },
              { key: 'a', header: 'Agents affected', align: 'right', cell: (t) => s.agents.filter((a) => a.toolIds.includes(t.id)).length },
              { key: 'x', header: '', align: 'right', cell: (t) => <Button size="xs" icon={Unlock} onClick={() => { actions.releaseQuarantine(t.id); toast({ tone: 'success', title: `${t.name} re-approved` }); }} disabledReason={deny}>Re-approve</Button> },
            ]}
          />
        </Card>
      )}
    </div>
  );
}
