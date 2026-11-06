import { useState } from 'react';
import { Check, CheckCircle2, ChevronLeft, ChevronRight, KeyRound, Loader2, Pause, Play, Plus, RefreshCw, TriangleAlert, XCircle } from 'lucide-react';
import { actions, useStore } from '../data/store';
import { usePermission } from '../lib/rbac';
import { useToast } from '../lib/toast';
import { cn, dateTime, relTime } from '../lib/format';
import { NOW } from '../data/seed';
import { Badge, Button, Card, Checkbox, Field, Input, Modal, Mono, PageHeader, Select, Stat, type Tone } from '../components/ui';
import type { Connector } from '../data/types';

const statusMeta: Record<Connector['status'], { tone: Tone; label: string }> = {
  healthy: { tone: 'success', label: 'Healthy' },
  warning: { tone: 'warning', label: 'Partial' },
  failed: { tone: 'danger', label: 'Failed' },
  paused: { tone: 'neutral', label: 'Paused' },
};

const TYPES: { type: Connector['type']; blurb: string; fields: string[]; scopes: string[] }[] = [
  { type: 'Azure AI Foundry', blurb: 'Projects, agents, model deployments, tools and knowledge sources.', fields: ['Tenant ID', 'Client ID', 'Subscription'], scopes: ['prod-hub', 'finance', 'wealth', 'sandbox'] },
  { type: 'Microsoft Fabric', blurb: 'Workspaces, data agents, lakehouses, warehouses and sensitivity labels.', fields: ['Tenant ID', 'Client ID'], scopes: ['lending', 'hr-analytics', 'finance', 'sales', 'cx', 'wealth'] },
  { type: 'MCP server', blurb: 'Calls list_tools and stores each tool with its description and input schema.', fields: ['Server URL', 'Bearer token'], scopes: ['All tools'] },
  { type: 'Copilot Studio', blurb: 'Environments, copilots, topics and actions.', fields: ['Tenant ID', 'Client ID'], scopes: ['Default', 'HR', 'Ops'] },
  { type: 'AWS Bedrock', blurb: 'Agents, knowledge bases and model access in an AWS account.', fields: ['Role ARN', 'External ID', 'Region'], scopes: ['ap-south-1', 'us-east-1'] },
];

export default function Connectors() {
  const s = useStore((x) => x);
  const { can, reason } = usePermission();
  const toast = useToast();
  const [wizard, setWizard] = useState(false);
  const [scanning, setScanning] = useState<string | null>(null);
  const deny = can('connectors.manage') ? undefined : reason('connectors.manage');

  const scan = (c: Connector) => {
    setScanning(c.id);
    setTimeout(() => {
      actions.scanConnector(c.id);
      setScanning(null);
      toast({ tone: 'success', title: `Scan finished: ${c.name}`, body: `${c.itemsFound} items found, no new changes.` });
    }, 1600);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Connectors"
        description="Sources that DG Catalyst scans for agents, models, tools and data. Credentials stay in Key Vault."
        actions={<Button variant="primary" icon={Plus} onClick={() => setWizard(true)} disabledReason={deny}>Add connector</Button>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Connectors" value={s.connectors.length} sub={`${s.connectors.filter((c) => c.status === 'healthy').length} healthy`} />
        <Stat label="Items discovered" value={s.connectors.reduce((n, c) => n + c.itemsFound, 0)} sub="Across all sources" />
        <Stat label="New since last scan" value={s.connectors.reduce((n, c) => n + c.newItems, 0)} tone="primary" />
        <Stat label="Failing" value={s.connectors.filter((c) => c.status === 'failed').length} tone={s.connectors.some((c) => c.status === 'failed') ? 'danger' : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {s.connectors.map((c) => {
          const m = statusMeta[c.status];
          const busy = scanning === c.id;
          return (
            <Card key={c.id} className={cn('flex flex-col', c.status === 'failed' && 'border-danger/40')}>
              <div className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-semibold">{c.name}</h3>
                    <Badge tone={m.tone} dot>{m.label}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted">{c.type} · {c.scope}</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Button size="sm" variant="ghost" icon={c.status === 'paused' ? Play : Pause} onClick={() => actions.toggleConnectorPause(c.id)} disabledReason={deny} aria-label={c.status === 'paused' ? 'Resume schedule' : 'Pause schedule'} />
                  <Button size="sm" icon={busy ? Loader2 : RefreshCw} onClick={() => scan(c)} disabled={busy || c.status === 'paused'} disabledReason={deny} className={busy ? '[&>svg]:animate-spin' : ''}>
                    {busy ? 'Scanning…' : 'Scan now'}
                  </Button>
                </div>
              </div>

              <dl className="grid grid-cols-3 gap-px border-y border-border bg-border text-sm">
                {[
                  ['Last run', relTime(c.lastRun)],
                  ['Items found', `${c.itemsFound}${c.newItems ? ` (+${c.newItems})` : ''}`],
                  ['Next run', c.status === 'paused' ? 'Paused' : relTime(c.nextRun)],
                ].map(([k, v]) => (
                  <div key={k} className="bg-surface px-4 py-2.5">
                    <dt className="text-xs text-subtle">{k}</dt>
                    <dd className="tabular mt-0.5">{v}</dd>
                  </div>
                ))}
              </dl>

              <div className="flex-1 space-y-3 p-4">
                <div>
                  <p className="mb-1.5 text-xs text-subtle">Last 14 runs</p>
                  <div className="flex h-7 items-end gap-[3px]" role="img" aria-label={`Run history: ${c.history.filter((h) => h.status === 'failed').length} failed of 14`}>
                    {c.history.map((h, i) => (
                      <span
                        key={i}
                        title={`${dateTime(h.at)} · ${h.status} · ${h.items} items · ${h.durationSec}s`}
                        className={cn('flex-1 rounded-sm', h.status === 'healthy' ? 'bg-success/70' : h.status === 'warning' ? 'bg-warning' : 'bg-danger')}
                        style={{ height: `${h.status === 'failed' ? 100 : 40 + (h.items / Math.max(...c.history.map((x) => x.items), 1)) * 60}%` }}
                      />
                    ))}
                  </div>
                </div>
                {c.errors.length > 0 && (
                  <ul className="space-y-1.5">
                    {c.errors.map((e) => (
                      <li key={e} className="flex gap-2 rounded-md bg-danger/5 px-2.5 py-1.5 text-xs text-danger">
                        <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" /> {e}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="flex items-center gap-1.5 text-xs text-subtle">
                  <KeyRound className="h-3 w-3" /> <Mono>{c.credentialsRef}</Mono> · {c.schedule}
                </p>
              </div>
            </Card>
          );
        })}
      </div>

      <ConnectorWizard open={wizard} onClose={() => setWizard(false)} />
    </div>
  );
}

function ConnectorWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [type, setType] = useState<(typeof TYPES)[number] | null>(null);
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [test, setTest] = useState<'idle' | 'running' | 'ok' | 'fail'>('idle');
  const [scopes, setScopes] = useState<string[]>([]);
  const [schedule, setSchedule] = useState('Every 24 h at 02:00 IST');
  const steps = ['Type', 'Credentials', 'Test', 'Scope'];

  const reset = () => { setStep(0); setType(null); setCreds({}); setTest('idle'); setScopes([]); };
  const close = () => { reset(); onClose(); };
  const canNext = [!!type, !!type && type.fields.every((f) => creds[f]?.trim()), test === 'ok', scopes.length > 0][step];

  const runTest = () => {
    setTest('running');
    setTimeout(() => setTest(creds[type!.fields[0]]?.includes('fail') ? 'fail' : 'ok'), 1300);
  };

  const finish = () => {
    const id = `con-${type!.type.toLowerCase().replace(/\W+/g, '-')}-${Date.now() % 1000}`;
    actions.addConnector({
      id, name: `${type!.type === 'MCP server' ? 'MCP' : type!.type.split(' ').pop()} · ${scopes.join(', ')}`, type: type!.type, scope: scopes.join(', '), credentialsRef: `kv://dgc-prod/${id}`, schedule,
      lastRun: new Date(NOW).toISOString(), nextRun: new Date(NOW + 86_400_000).toISOString(), status: 'healthy', itemsFound: 0, newItems: 0, errors: [], durationSec: 0, history: [],
    });
    toast({ tone: 'success', title: 'Connector added', body: 'The first scan has started. New objects appear in the inventory as unmanaged.' });
    close();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title="Add a connector"
      description={<span className="flex flex-wrap gap-x-3">{steps.map((st, i) => <span key={st} className={cn(i === step ? 'font-medium text-fg' : i < step ? 'text-primary' : 'text-subtle')}>{i + 1}. {st}</span>)}</span>}
      footer={
        <>
          {step > 0 && <Button variant="ghost" icon={ChevronLeft} onClick={() => setStep(step - 1)} className="mr-auto">Back</Button>}
          <Button onClick={close}>Cancel</Button>
          {step < 3 ? <Button variant="primary" iconRight={ChevronRight} disabled={!canNext} onClick={() => setStep(step + 1)}>Continue</Button> : <Button variant="primary" disabled={!canNext} onClick={finish}>Save and scan</Button>}
        </>
      }
    >
      {step === 0 && (
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Connector type">
          {TYPES.map((t) => (
            <button key={t.type} role="radio" aria-checked={type?.type === t.type} onClick={() => setType(t)} className={cn('rounded-lg border p-3 text-left transition-colors', type?.type === t.type ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-border hover:border-border-strong')}>
              <span className="flex items-center justify-between text-sm font-medium">{t.type}{type?.type === t.type && <Check className="h-4 w-4 text-primary" />}</span>
              <span className="mt-1 block text-xs text-muted">{t.blurb}</span>
            </button>
          ))}
        </div>
      )}
      {step === 1 && type && (
        <div className="space-y-4">
          {type.fields.map((f) => (
            <Field key={f} label={f} required htmlFor={f}>
              <Input id={f} type={/token|secret/i.test(f) ? 'password' : 'text'} value={creds[f] ?? ''} onChange={(e) => setCreds({ ...creds, [f]: e.target.value })} placeholder={f === 'Server URL' ? 'https://mcp.corp.internal/…' : ''} />
            </Field>
          ))}
          <p className="flex items-center gap-1.5 text-xs text-muted"><KeyRound className="h-3.5 w-3.5" /> Stored in Azure Key Vault. DG Catalyst keeps only a reference.</p>
        </div>
      )}
      {step === 2 && (
        <div className="flex flex-col items-center py-6 text-center">
          {test === 'idle' && <Button variant="primary" onClick={runTest}>Test connection</Button>}
          {test === 'running' && <p className="flex items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin text-primary" /> Authenticating and listing resources…</p>}
          {test === 'ok' && <p className="flex items-center gap-2 text-sm text-success"><CheckCircle2 className="h-5 w-5" /> Connected. Read-only permissions confirmed.</p>}
          {test === 'fail' && (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-sm text-danger"><XCircle className="h-5 w-5" /> Authentication failed: the service principal was not found in this tenant.</p>
              <Button onClick={runTest}>Try again</Button>
            </div>
          )}
        </div>
      )}
      {step === 3 && type && (
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium">What to scan</p>
            <div className="space-y-2">{type.scopes.map((sc) => <Checkbox key={sc} checked={scopes.includes(sc)} onChange={(v) => setScopes(v ? [...scopes, sc] : scopes.filter((x) => x !== sc))} label={sc} />)}</div>
          </div>
          <Field label="Schedule" htmlFor="sched">
            <Select id="sched" value={schedule} onChange={(e) => setSchedule(e.target.value)}>
              <option>Every 24 h at 02:00 IST</option>
              <option>Every 12 h</option>
              <option>Every 6 h</option>
              <option>Every hour</option>
            </Select>
          </Field>
        </div>
      )}
    </Modal>
  );
}
