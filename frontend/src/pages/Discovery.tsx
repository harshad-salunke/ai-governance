import { Link } from 'react-router-dom';
import { ArrowLeftRight, Ghost } from 'lucide-react';
import { actions, useStore } from '../data/store';
import { useLookup } from '../lib/lookup';
import { relTime } from '../lib/format';
import { usePermission } from '../lib/rbac';
import { useToast } from '../lib/toast';
import { Badge, Button, Card, CardHeader, DataTable, EmptyState, Mono, PageHeader } from '../components/ui';
import { ChangeBadge, ObjectLink, PlatformLabel, kindMeta } from '../components/domain';

export default function Discovery() {
  const s = useStore((x) => x);
  const L = useLookup();
  const { can, reason } = usePermission();
  const toast = useToast();

  const changes = [
    ...s.agents.filter((a) => a.change).map((a) => ({ id: a.id, kind: 'agent' as const, name: a.name, change: a.change!, source: a.source, at: a.updatedAt, detail: a.change === 'changed' ? 'Tools changed: issue_refund schema updated' : `Discovered on ${a.platform}` })),
    ...s.tools.filter((t) => t.change).map((t) => ({ id: t.id, kind: 'tool' as const, name: t.name, change: t.change!, source: t.source, at: t.updatedAt, detail: t.previousHash ? `Schema hash ${t.previousHash} → ${t.schemaHash}` : 'New tool on server' })),
    ...s.models.filter((m) => m.change).map((m) => ({ id: m.id, kind: 'model' as const, name: m.name, change: m.change!, source: m.source, at: m.updatedAt, detail: `${m.deployment} · ${m.region}` })),
    ...s.mcpServers.filter((m) => m.change).map((m) => ({ id: m.id, kind: 'mcp' as const, name: m.name, change: m.change!, source: m.source, at: m.lastScanned, detail: m.change === 'changed' ? '1 tool schema changed' : m.url })),
    ...s.dataSources.filter((d) => d.change).map((d) => ({ id: d.id, kind: 'data' as const, name: d.name, change: d.change!, source: d.source, at: d.updatedAt, detail: d.change === 'changed' ? 'New column: aadhaar' : d.type })),
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Discovery signals" description="What changed in the last scan, likely duplicates, and AI running outside governance." />

      <Card>
        <CardHeader title="Changes since last scan" description={`${changes.length} objects new or changed. Tool schema changes are quarantined automatically.`} />
        <DataTable
          rows={changes}
          columns={[
            { key: 'n', header: 'Object', cell: (r) => <ObjectLink kind={r.kind} id={r.id} name={r.name} mono={r.kind === 'tool'} /> },
            { key: 'k', header: 'Type', hideBelow: 'sm', cell: (r) => <span className="text-muted">{kindMeta[r.kind].label}</span> },
            { key: 'c', header: 'Change', cell: (r) => <ChangeBadge change={r.change} /> },
            { key: 'd', header: 'Detail', hideBelow: 'md', cell: (r) => <span className="text-muted">{r.detail}</span> },
            { key: 's', header: 'Source', hideBelow: 'lg', cell: (r) => <span className="text-xs text-subtle">{r.source}</span> },
          ]}
        />
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader icon={Ghost} title="Shadow AI" description="Agents with no owner, unapproved models, unknown MCP servers, traces with no SDK" />
          <ul className="divide-y divide-border">
            {s.shadowHints.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Badge tone={h.kind === 'Unknown MCP server' || h.kind === 'Unapproved model' ? 'danger' : 'warning'}>{h.kind}</Badge>
                <div className="min-w-0 flex-1">
                  <ObjectLink kind={h.objectKind} id={h.objectId} name={L.objectName(h.objectId)} className="font-medium" />
                  <p className="text-xs text-muted">{h.detail}</p>
                </div>
                <span className="text-xs text-subtle">{relTime(h.detectedAt)}</span>
                {h.kind === 'No owner' && (
                  <Button size="xs" onClick={() => { actions.claimAgent(h.objectId); toast({ tone: 'success', title: 'Claim sent for admin confirmation' }); }} disabledReason={can('ownership.claim') ? undefined : reason('ownership.claim')}>
                    Claim
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader icon={ArrowLeftRight} title="Possible duplicates" description="Same agent found in two sources, or near-identical agents" />
          {s.duplicates.length ? (
            <ul className="divide-y divide-border">
              {s.duplicates.map((d) => (
                <li key={d.id} className="space-y-2 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="tabular text-sm font-semibold">{Math.round(d.similarity * 100)}% similar</span>
                    <Badge tone={d.status === 'Open' ? 'warning' : 'neutral'}>{d.status}</Badge>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {d.agentIds.map((id) => (
                      <div key={id} className="rounded-md border border-border p-2.5">
                        <Link to={`/catalog/agent/${id}`} className="text-sm font-medium hover:text-primary">{L.agentName(id)}</Link>
                        <div className="mt-1"><PlatformLabel platform={L.agent(id)!.platform} /></div>
                        <p className="mt-1 text-xs text-subtle">{L.agent(id)!.source} · <Mono>v{L.agent(id)!.version}</Mono></p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted">{d.reason}</p>
                  {d.status === 'Open' && (
                    <div className="flex gap-2">
                      <Button size="xs" variant="primary" onClick={() => { actions.resolveDuplicate(d.id, 'Merged'); toast({ tone: 'success', title: 'Marked as duplicate', body: 'The copy is linked to the original and inherits its owner.' }); }} disabledReason={can('ownership.confirm') ? undefined : reason('ownership.confirm')}>
                        Merge into original
                      </Button>
                      <Button size="xs" variant="ghost" onClick={() => actions.resolveDuplicate(d.id, 'Dismissed')} disabledReason={can('ownership.confirm') ? undefined : reason('ownership.confirm')}>
                        Not a duplicate
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No duplicates found" />
          )}
        </Card>
      </div>
    </div>
  );
}
