import { useState } from 'react';
import { Monitor, Moon, Plus, Sun, Trash2 } from 'lucide-react';
import { actions, useStore } from '../../data/store';
import { useLookup } from '../../lib/lookup';
import { usePermission } from '../../lib/rbac';
import { useToast } from '../../lib/toast';
import { useTheme, type ThemePref } from '../../lib/theme';
import { cn } from '../../lib/format';
import { Badge, Button, Card, CardHeader, ChipSelect, DataTable, DescList, Field, Input, Mono, PageHeader, Person, Segmented, Select, Switch, Tabs } from '../../components/ui';
import { kindMeta } from '../../components/domain';
import type { CustomField, ObjectKind } from '../../data/types';

type Tab = 'appearance' | 'units' | 'notifications' | 'fields' | 'tenant';

export default function Settings() {
  const [tab, setTab] = useState<Tab>('appearance');
  return (
    <div className="space-y-5">
      <PageHeader title="Settings" description="Workspace configuration. Changes are recorded in the audit log." />
      <Tabs value={tab} onChange={setTab} items={[{ value: 'appearance', label: 'Appearance' }, { value: 'units', label: 'Business units' }, { value: 'notifications', label: 'Notifications' }, { value: 'fields', label: 'Custom fields' }, { value: 'tenant', label: 'Tenant and SSO' }]} />
      {tab === 'appearance' && <Appearance />}
      {tab === 'units' && <Units />}
      {tab === 'notifications' && <Notifications />}
      {tab === 'fields' && <Fields />}
      {tab === 'tenant' && <Tenant />}
    </div>
  );
}

function Appearance() {
  const { pref, setPref } = useTheme();
  const opts: { v: ThemePref; label: string; icon: typeof Sun; preview: string }[] = [
    { v: 'light', label: 'Light', icon: Sun, preview: 'light' },
    { v: 'dark', label: 'Dark', icon: Moon, preview: 'dark' },
    { v: 'system', label: 'Match system', icon: Monitor, preview: 'split' },
  ];
  return (
    <Card>
      <CardHeader title="Theme" description="Saved on this device" />
      <div className="grid gap-3 p-4 sm:grid-cols-3" role="radiogroup" aria-label="Theme">
        {opts.map((o) => (
          <button key={o.v} role="radio" aria-checked={pref === o.v} onClick={() => setPref(o.v)} className={cn('overflow-hidden rounded-lg border text-left transition-colors', pref === o.v ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-border-strong')}>
            <div className="flex h-24">
              {(o.preview === 'light' || o.preview === 'split') && <ThemeSwatch dark={false} />}
              {(o.preview === 'dark' || o.preview === 'split') && <ThemeSwatch dark />}
            </div>
            <div className="flex items-center gap-2 border-t border-border px-3 py-2 text-sm font-medium"><o.icon className="h-4 w-4 text-subtle" />{o.label}</div>
          </button>
        ))}
      </div>
    </Card>
  );
}

function ThemeSwatch({ dark }: { dark: boolean }) {
  const bg = dark ? '#0A0E15' : '#F5F6F8';
  const surface = dark ? '#10151F' : '#FFFFFF';
  const line = dark ? '#232C3C' : '#E0E4EA';
  const accent = dark ? '#2DD4BF' : '#0D766E';
  return (
    <div className="flex flex-1 gap-1.5 p-2" style={{ background: bg }} aria-hidden>
      <div className="w-6 rounded" style={{ background: surface, border: `1px solid ${line}` }}>
        <div className="mx-1 mt-1.5 h-1 rounded" style={{ background: accent }} />
      </div>
      <div className="flex-1 space-y-1.5 rounded p-1.5" style={{ background: surface, border: `1px solid ${line}` }}>
        <div className="h-1.5 w-1/2 rounded" style={{ background: line }} />
        <div className="h-1.5 w-3/4 rounded" style={{ background: line }} />
        <div className="h-3 w-8 rounded" style={{ background: accent }} />
      </div>
    </div>
  );
}

function Units() {
  const s = useStore((x) => x);
  const L = useLookup();
  return (
    <Card>
      <CardHeader title="Business units" description="Roles and data can be scoped to a business unit" />
      <DataTable
        rows={s.businessUnits}
        columns={[
          { key: 'n', header: 'Name', cell: (b) => <span className="font-medium">{b.name}</span> },
          { key: 'h', header: 'Head', cell: (b) => <Person name={L.userName(b.head)} /> },
          { key: 'c', header: 'Cost centre', hideBelow: 'sm', cell: (b) => <Mono>{b.costCentre}</Mono> },
          { key: 'a', header: 'Agents', align: 'right', cell: (b) => s.agents.filter((a) => a.businessUnitId === b.id).length },
          { key: 'u', header: 'People', align: 'right', hideBelow: 'md', cell: (b) => s.users.filter((u) => u.businessUnitId === b.id).length },
        ]}
      />
    </Card>
  );
}

function Notifications() {
  const prefs = useStore((x) => x.notificationPrefs);
  const toast = useToast();
  const labels: Record<string, string> = { approvals: 'Approvals assigned to me', violations: 'Policy violations and repeated blocks', incidents: 'Incidents on agents I own or sponsor', scans: 'Connector scan results', budgets: 'Budget thresholds', reviews: 'Upcoming and overdue reviews' };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Channels" />
        <div className="space-y-4 p-4">
          <label className="flex items-center justify-between gap-4"><span><span className="block text-sm font-medium">Email</span><span className="text-xs text-muted">Approve or reject from the email itself</span></span><Switch checked={prefs.email} onChange={(v) => actions.setNotificationPrefs({ email: v })} label="Email" /></label>
          <label className="flex items-center justify-between gap-4"><span><span className="block text-sm font-medium">Microsoft Teams</span><span className="text-xs text-muted">Adaptive cards for approvals and ask-human requests</span></span><Switch checked={prefs.teams} onChange={(v) => actions.setNotificationPrefs({ teams: v })} label="Teams" /></label>
          <Field label="Digest"><Segmented value={prefs.digest} onChange={(v) => actions.setNotificationPrefs({ digest: v })} options={[{ value: 'off', label: 'Off' }, { value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }]} /></Field>
        </div>
      </Card>
      <Card>
        <CardHeader title="Events" actions={<Button size="sm" onClick={() => toast({ tone: 'success', title: 'Test notification sent', body: 'Check your inbox and Teams activity feed.' })}>Send test</Button>} />
        <ul className="divide-y divide-border">
          {Object.entries(labels).map(([k, label]) => (
            <li key={k} className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="text-sm">{label}</span>
              <Switch size="sm" checked={prefs.events[k]} onChange={(v) => actions.setNotificationPrefs({ events: { ...prefs.events, [k]: v } })} label={label} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Fields() {
  const s = useStore((x) => x);
  const { can, reason } = usePermission();
  const toast = useToast();
  const [f, setF] = useState<CustomField>({ id: '', label: '', type: 'text', appliesTo: ['agent'], required: false });
  const [opts, setOpts] = useState('');
  const deny = can('admin.manage') ? undefined : reason('admin.manage');
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader title="Custom metadata fields" description="Shown on registration forms and detail pages" />
        <DataTable
          rows={s.customFields}
          columns={[
            { key: 'l', header: 'Label', cell: (c) => <span className="font-medium">{c.label}</span> },
            { key: 't', header: 'Type', cell: (c) => <Badge tone="outline">{c.type}</Badge> },
            { key: 'a', header: 'Applies to', cell: (c) => <span className="text-muted">{c.appliesTo.map((k) => kindMeta[k].plural).join(', ')}</span> },
            { key: 'o', header: 'Options', hideBelow: 'md', cell: (c) => <span className="text-muted">{c.options?.join(', ') ?? '—'}</span> },
            { key: 'r', header: 'Required', cell: (c) => (c.required ? 'Yes' : 'No') },
            { key: 'x', header: '', align: 'right', cell: (c) => <Button size="xs" variant="ghost" icon={Trash2} aria-label={`Delete ${c.label}`} onClick={() => actions.removeCustomField(c.id)} disabledReason={deny} /> },
          ]}
        />
      </Card>
      <Card className="self-start">
        <CardHeader title="Add a field" />
        <div className="space-y-4 p-4">
          <Field label="Label" htmlFor="fl"><Input id="fl" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="e.g. Model card URL" /></Field>
          <Field label="Type" htmlFor="ft"><Select id="ft" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as CustomField['type'] })}><option value="text">Text</option><option value="list">List</option><option value="date">Date</option></Select></Field>
          {f.type === 'list' && <Field label="Options" hint="Comma-separated" htmlFor="fo"><Input id="fo" value={opts} onChange={(e) => setOpts(e.target.value)} /></Field>}
          <Field label="Applies to"><ChipSelect values={f.appliesTo} onChange={(v) => setF({ ...f, appliesTo: v as ObjectKind[] })} options={(Object.keys(kindMeta) as ObjectKind[]).map((k) => ({ value: k, label: kindMeta[k].plural }))} /></Field>
          <label className="flex items-center gap-2 text-sm"><Switch size="sm" checked={f.required} onChange={(v) => setF({ ...f, required: v })} label="Required" /> Required</label>
          <Button variant="primary" icon={Plus} disabled={!f.label.trim() || !f.appliesTo.length} disabledReason={deny} onClick={() => { actions.addCustomField({ ...f, id: `cf-${Date.now()}`, options: f.type === 'list' ? opts.split(',').map((o) => o.trim()).filter(Boolean) : undefined }); toast({ tone: 'success', title: 'Field added' }); setF({ id: '', label: '', type: 'text', appliesTo: ['agent'], required: false }); setOpts(''); }}>
            Add field
          </Button>
        </div>
      </Card>
    </div>
  );
}

function Tenant() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Tenant" />
        <div className="p-4">
          <DescList items={[['Tenant ID', <Mono className="text-fg">corp-india · 7f3c…a91e</Mono>], ['Region', 'Central India'], ['Azure OpenAI for built-in AI', 'gpt4o-prod-cin (Central India)'], ['Data retention', 'Audit 7 years · traces 90 days hot, then archive'], ['Decision service', 'Azure Container Apps · 3 replicas · Redis cache']]} />
        </div>
      </Card>
      <Card>
        <CardHeader title="Single sign-on" />
        <div className="p-4">
          <DescList items={[['Identity provider', 'Microsoft Entra ID'], ['App registration', <Mono className="text-fg">dg-catalyst-portal</Mono>], ['Group sync', 'Every 30 minutes · 19 users · 8 groups'], ['Login', 'SSO only; local accounts disabled'], ['Session lifetime', '8 hours, re-auth for kill switch and key creation']]} />
        </div>
      </Card>
    </div>
  );
}
