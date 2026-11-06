import { useState } from 'react';
import { CalendarClock, FileText, Loader2 } from 'lucide-react';
import { actions, useStore } from '../../data/store';
import { usePermission } from '../../lib/rbac';
import { useToast } from '../../lib/toast';
import { dateOnly, relTime } from '../../lib/format';
import { Badge, Button, Card, CardHeader, DataTable, Field, PageHeader, Select, Switch } from '../../components/ui';

export default function Reports() {
  const s = useStore((x) => x);
  const { can, reason } = usePermission();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [dossier, setDossier] = useState('ag-support');
  const exp = can('reports.export') ? undefined : reason('reports.export');

  const generate = (id: string, name: string) => {
    setBusy(id);
    setTimeout(() => {
      setBusy(null);
      toast({ tone: 'success', title: `${name} ready`, body: 'PDF saved to Blob Storage and available for 30 days.' });
    }, 1200);
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Reports" description="Audit-ready reports on demand or on a schedule, emailed as PDF to the roles you choose." />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {s.reportTemplates.map((t) => (
          <Card key={t.id} className="flex flex-col p-4">
            <FileText className="h-4 w-4 text-subtle" />
            <p className="mt-2 font-medium">{t.name}</p>
            <p className="mt-0.5 flex-1 text-sm text-muted">{t.description}</p>
            <p className="mt-3 text-xs text-subtle">{t.sections.join(' · ')}</p>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-subtle">Last {relTime(t.lastGenerated)}</span>
              <Button size="xs" icon={busy === t.id ? Loader2 : undefined} disabled={busy === t.id} onClick={() => generate(t.id, t.name)} disabledReason={exp}>Generate</Button>
            </div>
          </Card>
        ))}
        <Card className="flex flex-col border-primary/30 bg-primary/[0.03] p-4">
          <FileText className="h-4 w-4 text-primary" />
          <p className="mt-2 font-medium">Agent dossier</p>
          <p className="mt-0.5 text-sm text-muted">Everything about one agent: metadata, lineage, risk history, approvals, evidence, policies, incidents and cost.</p>
          <Field label="Agent" className="mt-3" htmlFor="dos">
            <Select id="dos" value={dossier} onChange={(e) => setDossier(e.target.value)}>{s.agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
          </Field>
          <Button size="sm" variant="primary" className="mt-3 self-start" icon={busy === 'dossier' ? Loader2 : undefined} disabled={busy === 'dossier'} onClick={() => generate('dossier', `${s.agents.find((a) => a.id === dossier)!.name} dossier`)} disabledReason={exp}>
            Generate dossier
          </Button>
        </Card>
      </div>

      <Card>
        <CardHeader icon={CalendarClock} title="Schedules" description="Delivered by email; the governance pack also posts to Microsoft Teams" />
        <DataTable
          rows={s.reportSchedules}
          columns={[
            { key: 'n', header: 'Report', cell: (r) => <span className="font-medium">{s.reportTemplates.find((t) => t.id === r.templateId)!.name}</span> },
            { key: 'c', header: 'Cadence', cell: (r) => r.cadence },
            { key: 'r', header: 'Recipients', hideBelow: 'md', cell: (r) => <span className="flex flex-wrap gap-1">{r.recipients.map((x) => <Badge key={x} tone="outline">{x}</Badge>)}</span> },
            { key: 'f', header: 'Format', hideBelow: 'sm', cell: (r) => r.format },
            { key: 'nx', header: 'Next run', cell: (r) => <span className="text-muted">{r.enabled ? dateOnly(r.nextRun) : 'Paused'}</span> },
            { key: 'e', header: 'On', align: 'right', cell: (r) => <Switch size="sm" checked={r.enabled} label="Enabled" disabled={!!exp} onChange={() => actions.toggleSchedule(r.id)} /> },
          ]}
        />
      </Card>
    </div>
  );
}
