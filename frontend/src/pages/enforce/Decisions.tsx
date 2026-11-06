import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, TriangleAlert } from 'lucide-react';
import { useStore } from '../../data/store';
import { useLookup } from '../../lib/lookup';
import { useToast } from '../../lib/toast';
import { dateTime, downloadFile, num, pct, toCsv } from '../../lib/format';
import { Badge, Button, Card, CardHeader, CodeBlock, DataTable, DescList, Drawer, FilterSelect, Mono, PageHeader, SearchInput, Stat, Tabs, Toolbar } from '../../components/ui';
import { DecisionBadge, ModeBadge, ObjectLink } from '../../components/domain';
import type { DecisionRecord } from '../../data/types';

type Tab = 'log' | 'violations';

export default function Decisions() {
  const s = useStore((x) => x);
  const L = useLookup();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>('log');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<DecisionRecord | null>(null);
  const f = (k: string) => params.get(k) ?? 'all';
  const setF = (k: string, v: string) => { const n = new URLSearchParams(params); v === 'all' ? n.delete(k) : n.set(k, v); setParams(n, { replace: true }); };

  const rows = useMemo(
    () => s.decisions.filter((d) => (f('agent') === 'all' || d.agentId === f('agent')) && (f('decision') === 'all' || d.decision === f('decision')) && (f('tool') === 'all' || d.toolId === f('tool')) && (f('policy') === 'all' || d.policyId === f('policy')) && (!q || `${d.user} ${d.reason} ${JSON.stringify(d.params)}`.toLowerCase().includes(q.toLowerCase()))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.decisions, params, q],
  );
  const blocks = s.decisions.filter((d) => d.decision === 'block');
  const lat = [...s.decisions].map((d) => d.latencyMs).sort((a, b) => a - b);
  const p95 = lat[Math.floor(lat.length * 0.95)];

  // Repeated violations (P3-LOG-03): agent + policy pairs with 3+ blocks.
  const repeat = Object.entries(blocks.reduce<Record<string, number>>((m, d) => { const k = `${d.agentId}|${d.policyId ?? 'role'}`; m[k] = (m[k] ?? 0) + 1; return m; }, {}))
    .filter(([, n]) => n >= 3)
    .map(([k, n]) => ({ id: k, agentId: k.split('|')[0], policyId: k.split('|')[1], n }))
    .sort((a, b) => b.n - a.n);

  const agents = Array.from(new Set(s.decisions.map((d) => d.agentId)));
  const tools = Array.from(new Set(s.decisions.map((d) => d.toolId)));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Decision log"
        description="Every policy check from the SDK: agent, user, tool, redacted parameters, matched policy, decision and latency. Partitioned by month."
        actions={<Button icon={Download} onClick={() => { downloadFile('decisions.csv', toCsv(rows.map((d) => ({ id: d.id, at: d.at, agent: L.agentName(d.agentId), user: d.user, tool: L.toolName(d.toolId), decision: d.decision, policy: d.policyId ?? '', latency_ms: d.latencyMs, params: d.params }))), 'text/csv'); toast({ tone: 'success', title: `Exported ${rows.length} decisions` }); }}>Export</Button>}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Checks sampled, 7 days" value={num(s.decisions.length)} sub={`≈ ${num(s.decisions.length * 412)} total`} />
        <Stat label="Blocked" value={pct((blocks.length / s.decisions.length) * 100)} tone="danger" />
        <Stat label="Sent to a human" value={num(s.decisions.filter((d) => d.decision === 'ask_human').length)} tone="warning" />
        <Stat label="Latency p95" value={`${p95} ms`} tone={p95 < 50 ? 'success' : 'danger'} sub="Target under 50 ms" />
      </div>

      <Tabs value={tab} onChange={setTab} items={[{ value: 'log', label: 'All decisions' }, { value: 'violations', label: 'Violations', count: blocks.length }]} />

      {tab === 'log' ? (
        <Card>
          <Toolbar>
            <SearchInput value={q} onChange={setQ} placeholder="Search user, reason or parameters" className="w-full sm:w-72" />
            <FilterSelect label="Agent" value={f('agent')} onChange={(v) => setF('agent', v)} options={agents.map((a) => ({ value: a, label: L.agentName(a) }))} />
            <FilterSelect label="Tool" value={f('tool')} onChange={(v) => setF('tool', v)} options={tools.map((t) => ({ value: t, label: L.toolName(t) }))} />
            <FilterSelect label="Decision" value={f('decision')} onChange={(v) => setF('decision', v)} options={['allow', 'block', 'ask_human', 'redact', 'audit'].map((d) => ({ value: d, label: d.replace('_', ' ') }))} />
            <FilterSelect label="Policy" value={f('policy')} onChange={(v) => setF('policy', v)} options={s.runtimePolicies.map((p) => ({ value: p.id, label: `${p.id} ${p.name}` }))} />
          </Toolbar>
          <DataTable
            rows={rows}
            dense
            pageSize={20}
            onRowClick={setOpen}
            columns={[
              { key: 'at', header: 'Time', sort: (d) => d.at, cell: (d) => <span className="whitespace-nowrap tabular text-muted">{dateTime(d.at)}</span> },
              { key: 'a', header: 'Agent', cell: (d) => <span className="whitespace-nowrap">{L.agentName(d.agentId)}</span> },
              { key: 't', header: 'Tool', cell: (d) => <Mono className="text-fg">{L.toolName(d.toolId)}</Mono> },
              { key: 'u', header: 'User', hideBelow: 'lg', cell: (d) => <span className="text-muted">{d.user}</span> },
              { key: 'd', header: 'Decision', sort: (d) => d.decision, cell: (d) => <DecisionBadge decision={d.decision} /> },
              { key: 'p', header: 'Policy', hideBelow: 'md', cell: (d) => (d.policyId ? <Link to={`/runtime/policies/${d.policyId}`} onClick={(e) => e.stopPropagation()} className="font-mono text-xs text-primary hover:underline">{d.policyId}</Link> : <span className="text-xs text-subtle">role</span>) },
              { key: 'r', header: 'Reason', hideBelow: 'xl', cell: (d) => <span className="line-clamp-1 max-w-xs text-muted">{d.reason}</span> },
              { key: 'l', header: 'Latency', align: 'right', sort: (d) => d.latencyMs, hideBelow: 'sm', cell: (d) => <span className={d.latencyMs > 50 ? 'text-warning' : 'text-muted'}>{d.latencyMs} ms</span> },
            ]}
          />
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader title="Blocked calls" />
            <DataTable
              rows={blocks}
              dense
              pageSize={15}
              onRowClick={setOpen}
              columns={[
                { key: 'at', header: 'Time', cell: (d) => <span className="whitespace-nowrap text-muted">{dateTime(d.at)}</span> },
                { key: 'a', header: 'Agent', cell: (d) => L.agentName(d.agentId) },
                { key: 't', header: 'Tool', cell: (d) => <Mono className="text-fg">{L.toolName(d.toolId)}</Mono> },
                { key: 'r', header: 'Reason', hideBelow: 'md', cell: (d) => <span className="text-muted">{d.reason}</span> },
              ]}
            />
          </Card>
          <Card>
            <CardHeader icon={TriangleAlert} title="Repeated violations" description="3 or more blocks from the same agent and policy alert the owner and security admin" />
            <ul className="divide-y divide-border">
              {repeat.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <ObjectLink kind="agent" id={r.agentId} name={L.agentName(r.agentId)} className="text-sm" />
                    <p className="text-xs text-subtle">{r.policyId === 'role' ? 'Outside agent role' : `${r.policyId} · ${L.policy(r.policyId)?.name ?? 'Quarantine / kill switch'}`}</p>
                  </div>
                  <Badge tone="danger">{r.n}×</Badge>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      <Drawer open={!!open} onClose={() => setOpen(null)} title={open ? `Decision ${open.id}` : ''} subtitle={open && dateTime(open.at)}>
        {open && (
          <div className="space-y-4 p-5">
            <div className="flex items-center gap-2"><DecisionBadge decision={open.decision} /><ModeBadge mode={open.mode} /><Badge tone="outline">{open.environment}</Badge></div>
            <p className="text-sm">{open.reason}</p>
            <DescList
              cols={2}
              items={[
                ['Agent', <ObjectLink kind="agent" id={open.agentId} name={L.agentName(open.agentId)} />],
                ['Tool', <ObjectLink kind="tool" id={open.toolId} name={L.toolName(open.toolId)} mono />],
                ['User', open.user],
                ['Policy', open.policyId ? <Link to={`/runtime/policies/${open.policyId}`} className="link">{open.policyId}</Link> : 'Agent role'],
                ['Latency', `${open.latencyMs} ms`],
                ['Mode', open.mode],
              ]}
            />
            <CodeBlock title="Parameters (PII redacted before storage)" code={JSON.stringify(open.params, null, 2)} />
          </div>
        )}
      </Drawer>
    </div>
  );
}
