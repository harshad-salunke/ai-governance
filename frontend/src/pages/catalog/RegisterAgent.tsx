import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, Link2, Loader2, Sparkles } from 'lucide-react';
import { actions, useStore } from '../../data/store';
import { tierFor } from '../../data/risk';
import { useToast } from '../../lib/toast';
import { usePermission } from '../../lib/rbac';
import { cn } from '../../lib/format';
import { Badge, Button, Callout, Card, ChipSelect, Field, Input, PageHeader, Segmented, Select, Textarea } from '../../components/ui';
import { ActionBadge, RiskFingerprint, SensitivityBadge, TierBadge } from '../../components/domain';
import type { Agent, Platform, SignalScores } from '../../data/types';
import { NOW } from '../../data/seed';

const STEPS = ['Basics', 'Agent card', 'Connections', 'Review'] as const;

export default function RegisterAgent() {
  const s = useStore((x) => x);
  const navigate = useNavigate();
  const toast = useToast();
  const { can, reason } = usePermission();
  const [step, setStep] = useState(0);
  const [fetching, setFetching] = useState(false);
  const [cardUrl, setCardUrl] = useState('');
  const [f, setF] = useState({
    name: '',
    description: '',
    platform: 'Custom' as Platform,
    framework: 'LangGraph',
    version: '0.1.0',
    businessUnitId: 'bu-cs',
    applicationId: '',
    owner: s.session.userId,
    sponsor: '',
    purpose: '',
    intendedUsers: '',
    autonomy: 'Acts after approval' as Agent['autonomy'],
    humanInLoop: true,
    exposure: 'Internal' as 'Few' | 'Internal' | 'Customer',
    toolIds: [] as string[],
    modelIds: [] as string[],
    dataSourceIds: [] as string[],
    custom: {} as Record<string, string>,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  // Live risk preview from the selections (same engine the scan uses).
  const signals: SignalScores = useMemo(() => {
    const acts = f.toolIds.map((t) => s.tools.find((x) => x.id === t)!.actionType);
    const actions_ = acts.some((a) => a === 'payment' || a === 'delete' || a === 'send') ? 3 : acts.some((a) => a === 'write') ? 2 : 1;
    const sens = f.dataSourceIds.map((d) => s.dataSources.find((x) => x.id === d)!.sensitivity);
    const data = sens.some((x) => ['Personal', 'Financial', 'Health'].includes(x)) ? 3 : sens.some((x) => x === 'Internal' || x === 'Confidential') ? 2 : 1;
    const autonomy = f.autonomy === 'Suggests only' ? 1 : f.autonomy === 'Acts after approval' ? 2 : 3;
    const exposure = f.exposure === 'Few' ? 1 : f.exposure === 'Internal' ? 2 : 3;
    const impact = /loan|credit|salary|insurance|health|hiring|job/i.test(f.purpose + f.description) ? 3 : /draft|report|summar|reconcil/i.test(f.purpose + f.description) ? 2 : 1;
    return { actions: actions_ as 1 | 2 | 3, data: data as 1 | 2 | 3, autonomy: autonomy as 1 | 2 | 3, exposure: exposure as 1 | 2 | 3, impact: impact as 1 | 2 | 3 };
  }, [f, s.tools, s.dataSources]);
  const risk = tierFor(signals, { humanInLoop: f.humanInLoop, toolIds: f.toolIds, tags: [], dataSourceIds: f.dataSourceIds });

  const autofill = () => {
    setFetching(true);
    setTimeout(() => {
      setF((x) => ({
        ...x,
        name: 'Claims Triage Agent',
        description: 'Reads motor insurance claims, checks policy coverage and routes them to the right adjuster.',
        platform: 'Azure AI Foundry',
        framework: 'Semantic Kernel',
        version: '1.0.0',
        purpose: 'Route claims to adjusters faster.',
        intendedUsers: 'Claims operations team',
        toolIds: ['t-get_customer', 't-create_ticket', 't-search_docs'],
        modelIds: ['m-gpt4o'],
        dataSourceIds: ['d-crm', 'd-kb'],
      }));
      setFetching(false);
      toast({ tone: 'info', title: 'Filled from agent card', body: 'Review every field. AI-suggested values are marked.' });
    }, 900);
  };

  const errors = {
    name: !f.name.trim() ? 'Give the agent a name' : s.agents.some((a) => a.name.toLowerCase() === f.name.trim().toLowerCase()) ? 'An agent with this name already exists' : '',
    description: f.description.trim().length < 20 ? 'Describe what it does in at least 20 characters' : '',
    sponsor: !f.sponsor ? 'Pick a business sponsor' : f.sponsor === f.owner ? 'Owner and sponsor must be different people' : '',
    purpose: !f.purpose.trim() ? 'State the purpose' : '',
    models: !f.modelIds.length ? 'Pick at least one model' : '',
  };
  const stepValid = [!errors.name && !errors.description && !errors.sponsor, !errors.purpose, !errors.models, true][step];
  const [touched, setTouched] = useState(false);

  const submit = () => {
    const id = `ag-${f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24)}`;
    const agent: Agent = {
      id,
      businessUnitId: f.businessUnitId,
      createdAt: new Date(NOW).toISOString(),
      updatedAt: new Date(NOW).toISOString(),
      createdBy: s.session.userId,
      source: 'manual',
      name: f.name.trim(),
      description: f.description.trim(),
      purpose: f.purpose.trim(),
      intendedUsers: f.intendedUsers.trim() || '—',
      platform: f.platform,
      framework: f.framework,
      lifecycle: 'Draft',
      tier: risk.tier,
      score: risk.total,
      signals,
      owner: f.owner,
      sponsor: f.sponsor,
      agentRoleId: null,
      managed: true,
      version: f.version,
      applicationId: f.applicationId || null,
      modelIds: f.modelIds,
      toolIds: f.toolIds,
      dataSourceIds: f.dataSourceIds,
      humanInLoop: f.humanInLoop,
      autonomy: f.autonomy,
      change: 'new',
      suspended: false,
      sdkConnected: false,
      runs7d: 0,
      blockRate: 0,
      cost30d: 0,
      lastScanned: new Date(NOW).toISOString(),
      nextReview: null,
      tags: [],
    };
    actions.registerAgent(agent);
    toast({ tone: 'success', title: 'Agent registered', body: `${agent.name} is in Draft with a ${risk.tier} tier. Add evidence, then request approval.` });
    navigate(`/catalog/agent/${id}`);
  };

  const people = s.users.filter((u) => u.status === 'active');
  const sponsors = people.filter((u) => u.roles.includes('business_sponsor'));

  return (
    <div>
      <PageHeader breadcrumbs={[{ label: 'AI catalog', to: '/catalog' }, { label: 'Register asset' }]} title="Register an AI agent" description="For agents connectors can't see. The same fields are available through POST /api/v1/agents for CI/CD." />

      {!can('inventory.register') && (
        <div className="mb-4">
          <Callout tone="warning" title="Read-only for your role">{reason('inventory.register')}</Callout>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <ol className="flex flex-wrap gap-x-6 gap-y-2 border-b border-border px-5 py-4" aria-label="Steps">
            {STEPS.map((label, i) => (
              <li key={label} className="flex items-center gap-2 text-sm" aria-current={i === step ? 'step' : undefined}>
                <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold', i < step ? 'bg-primary text-primary-fg' : i === step ? 'bg-primary/15 text-primary ring-1 ring-primary/40' : 'bg-surface-2 text-subtle')}>
                  {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className={i === step ? 'font-medium text-fg' : 'text-muted'}>{label}</span>
              </li>
            ))}
          </ol>

          <div className="space-y-5 p-5">
            {step === 0 && (
              <>
                <div className="rounded-lg border border-dashed border-border-strong bg-surface-2/40 p-4">
                  <p className="text-sm font-medium">Start from an agent card or MCP server URL</p>
                  <p className="text-xs text-muted">We read its metadata and fill the form. You confirm everything before saving.</p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <Input value={cardUrl} onChange={(e) => setCardUrl(e.target.value)} placeholder="https://claims.corp.internal/.well-known/agent.json" aria-label="Agent card URL" />
                    <Button icon={fetching ? Loader2 : Link2} onClick={autofill} disabled={fetching}>
                      {fetching ? 'Reading…' : 'Auto-fill'}
                    </Button>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Name" required error={touched ? errors.name : undefined} className="sm:col-span-2" htmlFor="n">
                    <Input id="n" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Claims Triage Agent" />
                  </Field>
                  <Field label="Description" required error={touched ? errors.description : undefined} className="sm:col-span-2" hint="Plain language. The impact classifier reads this." htmlFor="d">
                    <Textarea id="d" value={f.description} onChange={(e) => set('description', e.target.value)} />
                  </Field>
                  <Field label="Platform" htmlFor="p">
                    <Select id="p" value={f.platform} onChange={(e) => set('platform', e.target.value as Platform)}>
                      {['Azure AI Foundry', 'Microsoft Fabric', 'Copilot Studio', 'Custom', 'AWS Bedrock'].map((p) => <option key={p}>{p}</option>)}
                    </Select>
                  </Field>
                  <Field label="Framework" htmlFor="fw">
                    <Input id="fw" value={f.framework} onChange={(e) => set('framework', e.target.value)} />
                  </Field>
                  <Field label="Business unit" htmlFor="bu">
                    <Select id="bu" value={f.businessUnitId} onChange={(e) => set('businessUnitId', e.target.value)}>
                      {s.businessUnits.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </Select>
                  </Field>
                  <Field label="Version" htmlFor="v">
                    <Input id="v" value={f.version} onChange={(e) => set('version', e.target.value)} />
                  </Field>
                  <Field label="Technical owner" required htmlFor="o">
                    <Select id="o" value={f.owner} onChange={(e) => set('owner', e.target.value)}>
                      {people.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </Select>
                  </Field>
                  <Field label="Business sponsor" required error={touched ? errors.sponsor : undefined} hint="Separation of duties: can't be the owner." htmlFor="sp">
                    <Select id="sp" value={f.sponsor} onChange={(e) => set('sponsor', e.target.value)}>
                      <option value="">Choose…</option>
                      {sponsors.map((u) => <option key={u.id} value={u.id}>{u.name} — {u.title}</option>)}
                    </Select>
                  </Field>
                </div>
              </>
            )}

            {step === 1 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Purpose" required error={touched ? errors.purpose : undefined} className="sm:col-span-2" htmlFor="pu">
                  <Input id="pu" value={f.purpose} onChange={(e) => set('purpose', e.target.value)} placeholder="What business outcome is it for?" />
                </Field>
                <Field label="Intended users" className="sm:col-span-2" htmlFor="iu">
                  <Input id="iu" value={f.intendedUsers} onChange={(e) => set('intendedUsers', e.target.value)} placeholder="e.g. Claims operations team" />
                </Field>
                <Field label="Who uses it" className="sm:col-span-2">
                  <Segmented value={f.exposure} onChange={(v) => set('exposure', v)} options={[{ value: 'Few', label: 'A few internal users' }, { value: 'Internal', label: 'Whole organisation' }, { value: 'Customer', label: 'Customers or public' }]} />
                </Field>
                <Field label="Autonomy" className="sm:col-span-2">
                  <Segmented value={f.autonomy} onChange={(v) => set('autonomy', v)} options={[{ value: 'Suggests only', label: 'Suggests only' }, { value: 'Acts after approval', label: 'Acts after approval' }, { value: 'Acts alone', label: 'Acts alone' }]} />
                </Field>
                <Field label="Human-in-the-loop step" className="sm:col-span-2" hint="A person approves before consequential actions run.">
                  <Segmented value={f.humanInLoop ? 'y' : 'n'} onChange={(v) => set('humanInLoop', v === 'y')} options={[{ value: 'y', label: 'Yes' }, { value: 'n', label: 'No' }]} />
                </Field>
                {s.customFields.filter((c) => c.appliesTo.includes('agent')).map((c) => (
                  <Field key={c.id} label={c.label} required={c.required} htmlFor={c.id} hint="Custom field">
                    {c.type === 'list' ? (
                      <Select id={c.id} value={f.custom[c.id] ?? ''} onChange={(e) => set('custom', { ...f.custom, [c.id]: e.target.value })}>
                        <option value="">Choose…</option>
                        {c.options!.map((o) => <option key={o}>{o}</option>)}
                      </Select>
                    ) : (
                      <Input id={c.id} type={c.type === 'date' ? 'date' : 'text'} value={f.custom[c.id] ?? ''} onChange={(e) => set('custom', { ...f.custom, [c.id]: e.target.value })} />
                    )}
                  </Field>
                ))}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <Field label="Application" htmlFor="app">
                  <Select id="app" value={f.applicationId} onChange={(e) => set('applicationId', e.target.value)}>
                    <option value="">None</option>
                    {s.applications.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </Select>
                </Field>
                <Field label="Models" required error={touched ? errors.models : undefined}>
                  <ChipSelect values={f.modelIds} onChange={(v) => set('modelIds', v)} options={s.models.map((m) => ({ value: m.id, label: `${m.name} · ${m.region}${m.approved ? '' : ' (unapproved)'}` }))} />
                </Field>
                <Field label="Tools">
                  <ChipSelect values={f.toolIds} onChange={(v) => set('toolIds', v)} options={s.tools.filter((t) => t.approved).map((t) => ({ value: t.id, label: `${t.name} · ${t.actionType}` }))} />
                </Field>
                <Field label="Data sources">
                  <ChipSelect values={f.dataSourceIds} onChange={(v) => set('dataSourceIds', v)} options={s.dataSources.map((d) => ({ value: d.id, label: `${d.name} · ${d.sensitivity}` }))} />
                </Field>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4 text-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Review label="Name" value={f.name} />
                  <Review label="Platform" value={`${f.platform} · ${f.framework} · v${f.version}`} />
                  <Review label="Owner / sponsor" value={`${s.users.find((u) => u.id === f.owner)?.name} / ${s.users.find((u) => u.id === f.sponsor)?.name ?? '—'}`} />
                  <Review label="Autonomy" value={`${f.autonomy}${f.humanInLoop ? ', human approval step' : ''}`} />
                </div>
                <div>
                  <p className="mb-1.5 text-xs text-subtle">Tools</p>
                  <div className="flex flex-wrap gap-1.5">{f.toolIds.length ? f.toolIds.map((t) => { const x = s.tools.find((y) => y.id === t)!; return <span key={t} className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 font-mono text-xs">{x.name}<ActionBadge action={x.actionType} /></span>; }) : <span className="text-muted">None</span>}</div>
                </div>
                <div>
                  <p className="mb-1.5 text-xs text-subtle">Data</p>
                  <div className="flex flex-wrap gap-1.5">{f.dataSourceIds.length ? f.dataSourceIds.map((d) => { const x = s.dataSources.find((y) => y.id === d)!; return <span key={d} className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-xs">{x.name}<SensitivityBadge value={x.sensitivity} /></span>; }) : <span className="text-muted">None</span>}</div>
                </div>
                <Callout tone="info" title="What happens next">The agent is created in Draft. Its checklist is attached for the {risk.tier} tier. Submit evidence, then request approval from the agent page.</Callout>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border px-5 py-3">
            <Button variant="ghost" icon={ChevronLeft} onClick={() => (step ? setStep(step - 1) : navigate('/catalog'))}>
              {step ? 'Back' : 'Cancel'}
            </Button>
            {step < STEPS.length - 1 ? (
              <Button variant="primary" iconRight={ChevronRight} onClick={() => { setTouched(true); if (stepValid) { setTouched(false); setStep(step + 1); } }}>
                Continue
              </Button>
            ) : (
              <Button variant="primary" onClick={submit} disabledReason={can('inventory.register') ? undefined : reason('inventory.register')}>
                Register agent
              </Button>
            )}
          </div>
        </Card>

        <aside className="xl:sticky xl:top-20 xl:self-start">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Risk preview</p>
              <Badge tone="violet" icon={Sparkles}>Live</Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted">Recomputed as you fill the form, using the same rules as the scan.</p>
            <div className="mt-4 flex items-end justify-between">
              <RiskFingerprint signals={signals} size="lg" showLabels />
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
              <span className="tabular text-2xl font-semibold">{risk.total}<span className="text-sm font-normal text-subtle"> / 15</span></span>
              <TierBadge tier={risk.tier} />
            </div>
            {risk.overrides.length > 0 && <p className="mt-2 text-xs text-danger">Override: {risk.overrides[0]}</p>}
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Review({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border px-3 py-2">
      <p className="text-xs text-subtle">{label}</p>
      <p className="mt-0.5 truncate text-sm">{value || '—'}</p>
    </div>
  );
}
