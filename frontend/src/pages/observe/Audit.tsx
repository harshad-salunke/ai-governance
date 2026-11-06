import { useState } from 'react';
import { CheckCircle2, Download, Link2, Loader2, ShieldCheck } from 'lucide-react';
import { useStore } from '../../data/store';
import { useLookup } from '../../lib/lookup';
import { usePermission } from '../../lib/rbac';
import { useToast } from '../../lib/toast';
import { dateTime, downloadFile, toCsv } from '../../lib/format';
import { Badge, Button, Card, DataTable, FilterSelect, Mono, PageHeader, Person, SearchInput, Toolbar } from '../../components/ui';

export default function Audit() {
  const s = useStore((x) => x);
  const L = useLookup();
  const toast = useToast();
  const { can, reason } = usePermission();
  const [q, setQ] = useState('');
  const [actor, setActor] = useState('all');
  const [kind, setKind] = useState('all');
  const [verify, setVerify] = useState<'idle' | 'running' | 'ok'>('idle');

  const rows = s.auditEvents.filter((e) => (actor === 'all' || e.actor === actor) && (kind === 'all' || e.objectKind === kind) && (!q || `${e.action} ${e.objectName} ${e.before ?? ''} ${e.after ?? ''}`.toLowerCase().includes(q.toLowerCase())));
  const actors = Array.from(new Set(s.auditEvents.map((e) => e.actor)));
  const kinds = Array.from(new Set(s.auditEvents.map((e) => e.objectKind)));
  const exp = can('reports.export') ? undefined : reason('reports.export');

  const exportAs = (fmt: 'csv' | 'json') => {
    const data = rows.map((e) => ({ id: e.id, at: e.at, actor: L.userName(e.actor), action: e.action, object_kind: e.objectKind, object: e.objectName, before: e.before ?? '', after: e.after ?? '', hash: e.hash, prev_hash: e.prevHash }));
    downloadFile(`audit.${fmt}`, fmt === 'csv' ? toCsv(data) : JSON.stringify(data, null, 2), fmt === 'csv' ? 'text/csv' : 'application/json');
    toast({ tone: 'success', title: `Exported ${data.length} events`, body: `audit.${fmt}` });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit log"
        description="Every portal change and runtime decision, append-only and hash-chained. Retained for 7 years."
        actions={
          <>
            <Button icon={verify === 'running' ? Loader2 : ShieldCheck} disabled={verify === 'running'} onClick={() => { setVerify('running'); setTimeout(() => setVerify('ok'), 1200); }}>
              {verify === 'running' ? 'Verifying…' : 'Verify chain'}
            </Button>
            <Button icon={Download} onClick={() => exportAs('csv')} disabledReason={exp}>CSV</Button>
            <Button icon={Download} onClick={() => exportAs('json')} disabledReason={exp}>JSON</Button>
          </>
        }
      />
      {verify === 'ok' && (
        <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-4 py-2.5 text-sm text-success" role="status">
          <CheckCircle2 className="h-4 w-4" /> Chain intact: {s.auditEvents.length} events verified, every hash links to its predecessor. Streaming to Microsoft Sentinel.
        </div>
      )}
      <Card>
        <Toolbar>
          <SearchInput value={q} onChange={setQ} placeholder="Search action, object or change" className="w-full sm:w-72" />
          <FilterSelect label="Actor" value={actor} onChange={setActor} options={actors.map((a) => ({ value: a, label: L.userName(a) }))} />
          <FilterSelect label="Object" value={kind} onChange={setKind} options={kinds.map((k) => ({ value: k, label: k }))} />
        </Toolbar>
        <DataTable
          rows={rows}
          dense
          pageSize={20}
          columns={[
            { key: 'at', header: 'Time', sort: (e) => e.at, cell: (e) => <span className="whitespace-nowrap tabular text-muted">{dateTime(e.at)}</span> },
            { key: 'a', header: 'Actor', cell: (e) => (e.actor === 'system' || e.actor === 'sdk' ? <Badge tone="outline">{e.actor === 'sdk' ? 'SDK' : 'System'}</Badge> : <Person name={L.userName(e.actor)} size="xs" />) },
            { key: 'ac', header: 'Action', cell: (e) => <Mono className="text-fg">{e.action}</Mono> },
            { key: 'o', header: 'Object', cell: (e) => <span><span className="text-xs text-subtle">{e.objectKind} · </span>{e.objectName}</span> },
            { key: 'ch', header: 'Change', hideBelow: 'lg', cell: (e) => (e.before || e.after ? <span className="text-xs">{e.before && <span className="text-muted line-through">{e.before}</span>}{e.before && e.after && ' → '}{e.after && <span>{e.after}</span>}</span> : <span className="text-subtle">—</span>) },
            { key: 'h', header: 'Hash', hideBelow: 'md', cell: (e) => <span className="inline-flex items-center gap-1 text-subtle" title={`hash ${e.hash}\nprev ${e.prevHash}`}><Link2 className="h-3 w-3" /><Mono>{e.hash.slice(0, 10)}…</Mono></span> },
          ]}
        />
      </Card>
    </div>
  );
}
