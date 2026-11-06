import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, FlaskConical, Plus, Save, Trash2, TriangleAlert, XCircle } from 'lucide-react';
import { actions, useStore } from '../../data/store';
import { evaluate } from '../../data/policyEngine';
import { useLookup } from '../../lib/lookup';
import { usePermission } from '../../lib/rbac';
import { useToast } from '../../lib/toast';
import { dateTime } from '../../lib/format';
import { NOW } from '../../data/seed';
import { Badge, Button, Callout, Card, CardHeader, Field, Input, PageHeader, Segmented, Select, Textarea } from '../../components/ui';
import { DecisionBadge, ModeBadge } from '../../components/domain';
import type { Decision, Operator, PolicyCondition, RuntimePolicy } from '../../data/types';
import { NotFound } from '../NotFound';

const OPS: Operator[] = ['=', '≠', '>', '<', 'in', 'contains', 'regex'];
const TYPES: RuntimePolicy['type'][] = ['Tool access', 'Parameter rule', 'Data rule', 'User context', 'Model access', 'Environment', 'Content'];
const DECISIONS: Decision[] = ['allow', 'block', 'ask_human', 'redact', 'audit'];

export default function PolicyEditor() {
  const { id } = useParams();
  const s = useStore((x) => x);
  const existing = s.runtimePolicies.find((p) => p.id === id);
  if (id !== 'new' && !existing) return <NotFound />;
  return <Editor key={id} initial={existing ?? newPolicy(s.session.userId)} isNew={!existing} />;
}

const newPolicy = (author: string): RuntimePolicy => ({
  id: `pol-${200 + Math.floor((NOW / 1000) % 700)}`, name: '', description: '', type: 'Parameter rule', scope: { kind: 'role', id: 'role-support' }, toolId: 't-issue_refund',
  conditions: [{ field: 'params.amount', op: '>', value: '10000' }], decision: 'block', reason: '', mode: 'monitor', version: 0, author, updatedAt: '', status: 'Draft', hits7d: 0, priority: 20, history: [],
});

function Editor({ initial, isNew }: { initial: RuntimePolicy; isNew: boolean }) {
  const s = useStore((x) => x);
  const L = useLookup();
  const navigate = useNavigate();
  const { can, reason } = usePermission();
  const toast = useToast();
  const [p, setP] = useState<RuntimePolicy>(initial);
  const [view, setView] = useState<'form' | 'json'>('form');
  const [json, setJson] = useState('');
  const [jsonErr, setJsonErr] = useState('');
  const [note, setNote] = useState('');
  const locked = !can('runtime.policies');
  const set = <K extends keyof RuntimePolicy>(k: K, v: RuntimePolicy[K]) => setP((x) => ({ ...x, [k]: v }));
  const setCond = (i: number, c: Partial<PolicyCondition>) => set('conditions', p.conditions.map((x, j) => (j === i ? { ...x, ...c } : x)));

  const tool = s.tools.find((t) => t.id === p.toolId);

  // P3-POL-04: validate parameter names against the tool's schema.
  const issues = useMemo(() => {
    const out: string[] = [];
    if (!p.name.trim()) out.push('Give the policy a name.');
    if (!p.reason.trim()) out.push('Add the reason shown to the agent when it matches.');
    p.conditions.forEach((c) => {
      if (c.field.startsWith('params.') && tool && !(c.field.slice(7) in tool.schema)) out.push(`“${c.field.slice(7)}” is not a parameter of ${tool.name}. Known: ${Object.keys(tool.schema).join(', ')}.`);
      if ((c.op === '>' || c.op === '<') && isNaN(Number(c.value))) out.push(`${c.field} ${c.op} needs a number.`);
      if (c.op === 'regex') { try { new RegExp(c.value.replace(/^!/, '')); } catch { out.push(`Invalid regex for ${c.field}.`); } }
    });
    return out;
  }, [p, tool]);

  // P3-POL-05: conflicts with other active policies on the same tool and scope.
  const conflicts = s.runtimePolicies.filter((x) => x.id !== p.id && x.status !== 'Draft' && x.toolId && x.toolId === p.toolId && x.decision !== p.decision && (x.scope.kind === 'all' || p.scope.kind === 'all' || x.scope.id === p.scope.id));

  const toJson = () => JSON.stringify({ id: p.id, name: p.name, type: p.type, scope: p.scope, tool: tool?.name ?? null, conditions: p.conditions, decision: p.decision, reason: p.reason, mode: p.mode, priority: p.priority }, null, 2);
  const switchView = (v: 'form' | 'json') => {
    if (v === 'json') { setJson(toJson()); setJsonErr(''); }
    else if (json) {
      try {
        const o = JSON.parse(json);
        const tId = s.tools.find((t) => t.name === o.tool)?.id ?? null;
        setP((x) => ({ ...x, name: o.name ?? x.name, type: o.type ?? x.type, scope: o.scope ?? x.scope, toolId: tId, conditions: o.conditions ?? x.conditions, decision: o.decision ?? x.decision, reason: o.reason ?? x.reason, mode: o.mode ?? x.mode, priority: o.priority ?? x.priority }));
      } catch (e) {
        setJsonErr((e as Error).message);
        return;
      }
    }
    setView(v);
  };

  // Inline test against the shared engine.
  const [test, setTest] = useState({ agentId: s.agents.find((a) => a.toolIds.includes(p.toolId ?? ''))?.id ?? 'ag-support', role: 'Operator', groups: 'Support-Staff', params: '{"amount": 12000}' });
  const testResult = useMemo(() => {
    try {
      const params = JSON.parse(test.params || '{}');
      const draft = { ...p, status: 'Active' as const };
      const policies = [draft, ...s.runtimePolicies.filter((x) => x.id !== p.id)];
      return evaluate({ ...s, runtimePolicies: policies }, { agentId: test.agentId, toolId: p.toolId ?? s.agents.find((a) => a.id === test.agentId)!.toolIds[0], user: 'tester@corp.com', userRole: test.role, userGroups: test.groups.split(',').map((g) => g.trim()), environment: 'prod', params });
    } catch {
      return null;
    }
  }, [test, p, s]);

  const save = () => {
    actions.savePolicy({ ...p, status: p.status === 'Draft' ? 'Active' : p.status }, note || (isNew ? 'Created' : 'Edited in form'));
    toast({ tone: 'success', title: isNew ? 'Policy created' : `Saved as v${p.version + 1}`, body: `Compiled and pushed to the decision service. Mode: ${p.mode}.` });
    navigate(`/runtime/policies/${p.id}`);
  };

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Runtime policies', to: '/runtime/policies' }, { label: isNew ? 'New policy' : p.id }]}
        title={isNew ? 'New runtime policy' : initial.name}
        meta={!isNew && <><DecisionBadge decision={initial.decision} /><ModeBadge mode={initial.mode} /><Badge tone="outline">v{initial.version}</Badge><Badge tone={initial.status === 'Active' ? 'success' : 'info'} dot>{initial.status}</Badge></>}
        actions={
          <>
            <Button onClick={() => navigate('/runtime/policies')}>Cancel</Button>
            <Button variant="primary" icon={Save} onClick={save} disabled={issues.length > 0} disabledReason={locked ? reason('runtime.policies') : undefined}>{isNew ? 'Create policy' : 'Save new version'}</Button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Definition" actions={<Segmented size="xs" value={view} onChange={switchView} options={[{ value: 'form', label: 'Form' }, { value: 'json', label: 'JSON' }]} ariaLabel="Editor view" />} />
            {view === 'form' ? (
              <div className="grid gap-4 p-4 sm:grid-cols-2">
                <Field label="Name" required className="sm:col-span-2" htmlFor="pn"><Input id="pn" value={p.name} disabled={locked} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Refunds above ₹10,000 are blocked" /></Field>
                <Field label="Description" className="sm:col-span-2" htmlFor="pd"><Textarea id="pd" value={p.description} disabled={locked} onChange={(e) => set('description', e.target.value)} className="min-h-[60px]" /></Field>
                <Field label="Type" htmlFor="pt"><Select id="pt" value={p.type} disabled={locked} onChange={(e) => set('type', e.target.value as RuntimePolicy['type'])}>{TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
                <Field label="Tool" htmlFor="ptl">
                  <Select id="ptl" value={p.toolId ?? ''} disabled={locked} onChange={(e) => set('toolId', e.target.value || null)}>
                    <option value="">Any tool</option>
                    {s.tools.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.actionType})</option>)}
                  </Select>
                </Field>
                <Field label="Scope" htmlFor="psk">
                  <Select id="psk" value={p.scope.kind} disabled={locked} onChange={(e) => { const k = e.target.value as RuntimePolicy['scope']['kind']; set('scope', { kind: k, id: k === 'all' ? undefined : k === 'agent' ? s.agents[0].id : k === 'role' ? s.agentRoles[0].id : p.toolId ?? s.tools[0].id }); }}>
                    <option value="all">All agents</option>
                    <option value="role">Agent role</option>
                    <option value="agent">One agent</option>
                    <option value="tool">Every agent using a tool</option>
                  </Select>
                </Field>
                {p.scope.kind !== 'all' && (
                  <Field label={p.scope.kind === 'role' ? 'Role' : p.scope.kind === 'agent' ? 'Agent' : 'Tool'} htmlFor="psi">
                    <Select id="psi" value={p.scope.id} disabled={locked} onChange={(e) => set('scope', { ...p.scope, id: e.target.value })}>
                      {(p.scope.kind === 'role' ? s.agentRoles : p.scope.kind === 'agent' ? s.agents : s.tools).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </Select>
                  </Field>
                )}

                <div className="sm:col-span-2">
                  <p className="mb-1.5 text-sm font-medium">Conditions <span className="font-normal text-subtle">— all must match. Prefix a value with ! to negate.</span></p>
                  <div className="space-y-2">
                    {p.conditions.map((c, i) => (
                      <div key={i} className="grid grid-cols-[1fr_90px_1fr_auto] gap-2">
                        <Input value={c.field} disabled={locked} onChange={(e) => setCond(i, { field: e.target.value })} list="policy-fields" aria-label="Field" className="font-mono text-[13px]" />
                        <Select value={c.op} disabled={locked} onChange={(e) => setCond(i, { op: e.target.value as Operator })} aria-label="Operator">{OPS.map((o) => <option key={o}>{o}</option>)}</Select>
                        <Input value={c.value} disabled={locked} onChange={(e) => setCond(i, { value: e.target.value })} aria-label="Value" className="font-mono text-[13px]" />
                        <button disabled={locked} onClick={() => set('conditions', p.conditions.filter((_, j) => j !== i))} className="rounded-md px-2 text-subtle hover:bg-danger/10 hover:text-danger" aria-label="Remove condition"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    ))}
                    <datalist id="policy-fields">
                      {tool && Object.keys(tool.schema).map((k) => <option key={k} value={`params.${k}`} />)}
                      {['user.role', 'user.groups', 'environment', 'agent.environment', 'tool.action', 'tool.name', 'model.region', 'output'].map((f) => <option key={f} value={f} />)}
                    </datalist>
                    <Button size="xs" variant="ghost" icon={Plus} disabled={locked} onClick={() => set('conditions', [...p.conditions, { field: tool ? `params.${Object.keys(tool.schema)[0]}` : 'user.role', op: '=', value: '' }])}>Add condition</Button>
                  </div>
                </div>

                <Field label="Decision" className="sm:col-span-2">
                  <div className="flex flex-wrap gap-2">
                    {DECISIONS.map((d) => (
                      <button key={d} disabled={locked} onClick={() => set('decision', d)} className={`rounded-full p-0.5 ${p.decision === d ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface' : 'opacity-60 hover:opacity-100'}`} aria-pressed={p.decision === d}>
                        <DecisionBadge decision={d} />
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Reason shown to the agent" required className="sm:col-span-2" htmlFor="pr"><Input id="pr" value={p.reason} disabled={locked} onChange={(e) => set('reason', e.target.value)} placeholder="e.g. Refunds above 10,000 need the finance desk" /></Field>
                <Field label="Rollout mode" hint="Monitor logs what would happen without blocking anything.">
                  <Segmented value={p.mode} onChange={(v) => !locked && set('mode', v)} options={[{ value: 'monitor', label: 'Monitor' }, { value: 'enforce', label: 'Enforce' }]} />
                </Field>
                <Field label="Change note" htmlFor="cn" hint="Saved with this version"><Input id="cn" value={note} disabled={locked} onChange={(e) => setNote(e.target.value)} placeholder="What changed and why" /></Field>
              </div>
            ) : (
              <div className="p-4">
                <textarea value={json} onChange={(e) => setJson(e.target.value)} disabled={locked} spellCheck={false} aria-label="Policy JSON" className="input-base h-[420px] resize-y py-3 font-mono text-[12.5px] leading-relaxed" />
                {jsonErr && <p className="mt-2 text-xs text-danger">Invalid JSON: {jsonErr}</p>}
                <p className="mt-2 text-xs text-subtle">Policy-as-code. Switch back to the form to apply edits; the same JSON is accepted by PUT /api/v1/policies/{p.id}.</p>
              </div>
            )}
          </Card>

          {!isNew && (
            <Card>
              <CardHeader title="Version history" />
              <ol className="divide-y divide-border">
                {[...initial.history].reverse().map((h) => (
                  <li key={h.version} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <Badge tone="outline">v{h.version}</Badge>
                    <span className="flex-1">{h.note}</span>
                    <span className="text-xs text-subtle">{L.userName(h.by)} · {dateTime(h.at)}</span>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <Card className="p-4">
            <p className="text-sm font-medium">Validation</p>
            {issues.length ? (
              <ul className="mt-2 space-y-1.5">{issues.map((i) => <li key={i} className="flex gap-2 text-xs text-danger"><XCircle className="mt-px h-3.5 w-3.5 shrink-0" />{i}</li>)}</ul>
            ) : (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-success"><CheckCircle2 className="h-3.5 w-3.5" /> Fields match the {tool?.name ?? 'tool'} schema</p>
            )}
            {conflicts.length > 0 && (
              <div className="mt-3 space-y-1.5 border-t border-border pt-3">
                {conflicts.map((c) => (
                  <p key={c.id} className="flex gap-2 text-xs"><TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0 text-warning" /><span>Overlaps <b>{c.id}</b> “{c.name}” ({c.decision}). Block beats allow; most specific scope wins.</span></p>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader icon={FlaskConical} title="Try it" description="Runs this draft through the simulator" />
            <div className="space-y-3 p-4">
              <Field label="Agent" htmlFor="ta"><Select id="ta" value={test.agentId} onChange={(e) => setTest({ ...test, agentId: e.target.value })}>{s.agents.filter((a) => a.lifecycle === 'Approved').map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="User role" htmlFor="tr"><Input id="tr" value={test.role} onChange={(e) => setTest({ ...test, role: e.target.value })} /></Field>
                <Field label="Groups" htmlFor="tg"><Input id="tg" value={test.groups} onChange={(e) => setTest({ ...test, groups: e.target.value })} /></Field>
              </div>
              <Field label="Parameters (JSON)" htmlFor="tp"><Textarea id="tp" value={test.params} onChange={(e) => setTest({ ...test, params: e.target.value })} className="min-h-[60px] font-mono text-[12.5px]" /></Field>
              {testResult ? (
                <div className="rounded-md border border-border bg-surface-2/50 p-3">
                  <div className="flex items-center justify-between"><DecisionBadge decision={testResult.decision} /><span className="tabular text-xs text-subtle">{testResult.latencyMs} ms</span></div>
                  <p className="mt-1.5 text-xs text-muted">{testResult.reason}</p>
                </div>
              ) : (
                <Callout tone="warning" title="Parameters must be valid JSON" />
              )}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
