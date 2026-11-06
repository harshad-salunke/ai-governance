import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleCheck, CircleDot, CircleMinus, Eye, OctagonX, Play } from 'lucide-react';
import { useStore } from '../../data/store';
import { evaluate, type CheckResult, type TraceStep } from '../../data/policyEngine';
import { usePermission } from '../../lib/rbac';
import { cn } from '../../lib/format';
import { Button, Callout, Card, CardHeader, CodeBlock, Field, Input, PageHeader, Segmented, Select, Textarea } from '../../components/ui';
import { DecisionBadge } from '../../components/domain';

const PRESETS = [
  { label: 'Refund ₹8,000', agentId: 'ag-support', toolId: 't-issue_refund', role: 'Customer', groups: 'Customers', params: { order_id: 'ORD-123', amount: 8000 } },
  { label: 'Delete a customer', agentId: 'ag-support', toolId: 't-delete_customer', role: 'Agent', groups: 'Support-Staff', params: { customer_id: 'C88213', reason: 'customer request' } },
  { label: 'Salary as non-HR', agentId: 'ag-payroll', toolId: 't-get_salary', role: 'Analyst', groups: 'Finance', params: { employee_id: 'E10293' } },
  { label: 'Email outside domain', agentId: 'ag-gmail', toolId: 't-send_email', role: 'Operator', groups: 'All-Staff', params: { to: 'vendor@partner.io', subject: 'Invoice' } },
  { label: 'Suspended agent', agentId: 'ag-fraud', toolId: 't-get_transactions', role: 'Customer', groups: 'Customers', params: { customer_id: 'C10477' } },
];

export default function Simulator() {
  const s = useStore((x) => x);
  const { can, reason } = usePermission();
  const approved = s.agents.filter((a) => a.managed);
  const [f, setF] = useState({ agentId: 'ag-support', toolId: 't-issue_refund', user: 'cust-88213', role: 'Customer', groups: 'Customers', env: 'prod' as 'prod' | 'staging' | 'dev', params: JSON.stringify({ order_id: 'ORD-123', amount: 8000 }, null, 2) });
  const [result, setResult] = useState<CheckResult | null>(null);
  const agent = s.agents.find((a) => a.id === f.agentId)!;
  const tool = s.tools.find((t) => t.id === f.toolId);
  const paramsOk = useMemo(() => { try { JSON.parse(f.params); return true; } catch { return false; } }, [f.params]);

  const run = (override?: Partial<typeof f>) => {
    const x = { ...f, ...override };
    setResult(evaluate(s, { agentId: x.agentId, toolId: x.toolId, user: x.user, userRole: x.role, userGroups: x.groups.split(',').map((g) => g.trim()), environment: x.env, params: JSON.parse(x.params) }));
  };

  const icon = (o: TraceStep['outcome']) => ({ pass: <CircleCheck className="h-4 w-4 text-success" />, match: <CircleDot className="h-4 w-4 text-primary" />, skip: <CircleMinus className="h-4 w-4 text-subtle" />, stop: <OctagonX className="h-4 w-4 text-danger" />, monitor: <Eye className="h-4 w-4 text-info" /> })[o];

  return (
    <div className="space-y-5">
      <PageHeader title="Policy simulator" description="Test a sample tool call and see which policy matches, in order, and why. Nothing is logged as a real decision." />
      {!can('runtime.simulate') && <Callout tone="info" title="View only">{reason('runtime.simulate')}</Callout>}

      <div className="flex flex-wrap gap-2">
        <span className="self-center text-sm text-muted">Try:</span>
        {PRESETS.map((p) => (
          <Button key={p.label} size="sm" variant="subtle" onClick={() => { const next = { agentId: p.agentId, toolId: p.toolId, role: p.role, groups: p.groups, params: JSON.stringify(p.params, null, 2) }; setF({ ...f, ...next }); run(next); }}>
            {p.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Sample call" description="Same shape as POST /api/v1/runtime/check" />
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <Field label="Agent" htmlFor="sa">
              <Select id="sa" value={f.agentId} onChange={(e) => { const a = s.agents.find((x) => x.id === e.target.value)!; setF({ ...f, agentId: a.id, toolId: a.toolIds[0] ?? f.toolId }); setResult(null); }}>
                {approved.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </Field>
            <Field label="Tool" htmlFor="st">
              <Select id="st" value={f.toolId} onChange={(e) => { setF({ ...f, toolId: e.target.value }); setResult(null); }}>
                {s.tools.map((t) => <option key={t.id} value={t.id}>{t.name}{agent.toolIds.includes(t.id) ? '' : ' (not on agent)'}</option>)}
              </Select>
            </Field>
            <Field label="User" htmlFor="su"><Input id="su" value={f.user} onChange={(e) => setF({ ...f, user: e.target.value })} /></Field>
            <Field label="Environment"><Segmented value={f.env} onChange={(v) => setF({ ...f, env: v })} options={[{ value: 'prod', label: 'prod' }, { value: 'staging', label: 'staging' }, { value: 'dev', label: 'dev' }]} /></Field>
            <Field label="User role" htmlFor="sr"><Input id="sr" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} /></Field>
            <Field label="Entra groups" hint="Comma-separated" htmlFor="sg"><Input id="sg" value={f.groups} onChange={(e) => setF({ ...f, groups: e.target.value })} /></Field>
            <Field label="Parameters" className="sm:col-span-2" error={paramsOk ? undefined : 'Must be valid JSON'} hint={tool ? `Schema: ${Object.entries(tool.schema).map(([k, v]) => `${k}: ${v.type}`).join(', ')}` : undefined} htmlFor="sp">
              <Textarea id="sp" value={f.params} onChange={(e) => setF({ ...f, params: e.target.value })} className="min-h-[110px] font-mono text-[12.5px]" spellCheck={false} />
            </Field>
            <div className="sm:col-span-2">
              <Button variant="primary" icon={Play} onClick={() => run()} disabled={!paramsOk} disabledReason={can('runtime.simulate') ? undefined : reason('runtime.simulate')}>Run check</Button>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Result" />
          {result ? (
            <div className="space-y-4 p-4">
              <div className={cn('flex flex-wrap items-center gap-3 rounded-lg border p-4', result.decision === 'block' ? 'border-danger/30 bg-danger/5' : result.decision === 'allow' ? 'border-success/30 bg-success/5' : 'border-warning/30 bg-warning/5')}>
                <DecisionBadge decision={result.decision} />
                <p className="min-w-0 flex-1 text-sm font-medium">{result.reason}</p>
                <span className="tabular text-xs text-subtle">{result.latencyMs} ms</span>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">Evaluation order</p>
                <ol className="space-y-0">
                  {result.trace.map((t, i) => (
                    <li key={i} className="flex gap-3 border-l border-border py-2 pl-4" style={{ marginLeft: 7 }}>
                      <span className="-ml-[25px] mt-0.5 bg-surface">{icon(t.outcome)}</span>
                      <div className="min-w-0">
                        <p className="text-sm">{t.policyId ? <Link to={`/runtime/policies/${t.policyId}`} className="font-medium hover:text-primary">{t.label}</Link> : <span className="font-medium">{t.label}</span>}{t.policyId && <span className="ml-1.5 font-mono text-xs text-subtle">{t.policyId}</span>}</p>
                        <p className="text-xs text-muted">{t.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
              <CodeBlock title="Response" code={JSON.stringify({ decision: result.decision, reason: result.reason, policy_id: result.policyId, decision_id: 'sim_' + Math.abs(result.reason.length * 7919).toString(16), mode: result.mode }, null, 2)} />
            </div>
          ) : (
            <p className="p-8 text-center text-sm text-muted">Choose a preset or fill in a call, then run the check.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
