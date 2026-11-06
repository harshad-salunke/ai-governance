import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  FileDown,
  FolderClosed,
  Pencil,
  Power,
  PowerOff,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Tag,
  Unlock,
  UserCheck,
  Waypoints,
} from 'lucide-react';
import { actions, useStore } from '../../data/store';
import { buildCatalog, assetHref, classificationsFor, type CatalogAsset } from '../../lib/catalog';
import { useLookup } from '../../lib/lookup';
import { usePermission } from '../../lib/rbac';
import { useToast } from '../../lib/toast';
import { cn, compact, dateOnly, dateTime, moneyShort, pct, relTime } from '../../lib/format';
import { useShell } from '../../layout/shellContext';
import { Badge, Button, Callout, Card, CardHeader, CodeBlock, CopyButton, DataTable, EmptyState, Field, Input, Meter, Modal, Mono, Person, Segmented, Select, Tabs, Textarea } from '../../components/ui';
import { ActionBadge, AssetIcon, ChangeBadge, DecisionBadge, LifecycleBadge, ModeBadge, RiskFingerprint, SensitivityBadge, TierBadge, kindMeta } from '../../components/domain';
import { LineageGraph, flowEdges } from '../../components/lineage/LineageGraph';
import { AgentApprovals, AgentDecisions, AgentIncidents, AgentPolicies, ControlsTab, CostTab, KillSwitchModal, LifecycleMenu, RiskTab } from './agentTabs';
import type { Agent, AuditEvent, ObjectKind } from '../../data/types';
import { NotFound } from '../NotFound';

type TabDef = { value: string; label: string; count?: number; alert?: boolean };

export default function AssetPage() {
  const { kind, id } = useParams() as { kind: ObjectKind; id: string };
  const s = useStore((x) => x);
  const asset = useMemo(() => buildCatalog(s).find((a) => a.id === id && a.kind === kind), [s, id, kind]);
  if (!asset || !kindMeta[kind]) return <NotFound />;
  return <AssetView key={id} asset={asset} />;
}

function AssetView({ asset }: { asset: CatalogAsset }) {
  const s = useStore((x) => x);
  const L = useLookup();
  const toast = useToast();
  const { openPilot } = useShell();
  const { can, reason } = usePermission();
  const [params, setParams] = useSearchParams();
  const [killOpen, setKillOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const { kind, id } = asset;

  const agent = kind === 'agent' ? s.agents.find((a) => a.id === id)! : null;
  const tool = kind === 'tool' ? s.tools.find((t) => t.id === id)! : null;
  const app = kind === 'application' ? s.applications.find((a) => a.id === id)! : null;
  const parentApp = agent?.applicationId ? L.app(agent.applicationId) : null;
  const history = s.auditEvents.filter((e) => e.objectId === id);

  const tabs: TabDef[] = [{ value: 'overview', label: 'Overview' }];
  if (kind === 'agent') {
    const ev = s.evidence.filter((e) => e.agentId === id);
    const openInc = s.incidents.filter((i) => i.agentId === id && i.status !== 'Resolved').length;
    tabs.push(
      { value: 'properties', label: 'Properties' },
      { value: 'lineage', label: 'Lineage' },
      { value: 'risk', label: 'Risk' },
      { value: 'controls', label: 'Controls', count: ev.filter((e) => e.status !== 'Accepted').length || undefined, alert: ev.some((e) => e.status === 'Missing' || e.status === 'Rejected') },
      { value: 'policies', label: 'Policies' },
      { value: 'runtime', label: 'Runtime activity' },
      { value: 'approvals', label: 'Approvals' },
      { value: 'incidents', label: 'Incidents', count: openInc || undefined, alert: openInc > 0 },
      { value: 'cost', label: 'Cost' },
    );
  } else if (kind === 'tool') tabs.push({ value: 'schema', label: 'Schema' }, { value: 'lineage', label: 'Lineage' }, { value: 'policies', label: 'Policies' }, { value: 'properties', label: 'Properties' });
  else if (kind === 'mcp') tabs.push({ value: 'tools', label: 'Tools', count: s.mcpServers.find((m) => m.id === id)!.toolIds.length }, { value: 'lineage', label: 'Lineage' }, { value: 'properties', label: 'Properties' });
  else if (kind === 'data') tabs.push({ value: 'schema', label: 'Schema' }, { value: 'lineage', label: 'Lineage' }, { value: 'properties', label: 'Properties' });
  else if (kind === 'application') tabs.push({ value: 'agents', label: 'Agents', count: app!.agentIds.length }, { value: 'lineage', label: 'Lineage' }, { value: 'properties', label: 'Properties' });
  else tabs.push({ value: 'lineage', label: 'Lineage' }, { value: 'properties', label: 'Properties' });
  tabs.push({ value: 'history', label: 'History' });

  const tab = tabs.some((t) => t.value === params.get('tab')) ? params.get('tab')! : 'overview';
  const setTab = (t: string) => setParams(t === 'overview' ? {} : { tab: t }, { replace: true });

  const breadcrumbs = [
    { label: 'AI catalog', to: '/catalog' },
    { label: L.buName(asset.collection), to: `/catalog?collection=${asset.collection}` },
    ...(parentApp ? [{ label: parentApp.name, to: assetHref('application', parentApp.id) }] : []),
  ];

  return (
    <div>
      {/* Breadcrumb hierarchy */}
      <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1.5 text-sm">
        {breadcrumbs.map((b) => (
          <span key={b.to} className="inline-flex items-center gap-1.5">
            <Link to={b.to} className="text-primary hover:underline">{b.label}</Link>
            <span className="text-subtle">/</span>
          </span>
        ))}
        <span className="text-muted">{asset.name}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-wrap items-start gap-4">
        <AssetIcon kind={kind} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className={cn('break-words text-2xl font-semibold leading-tight', kind === 'tool' && 'font-mono')}>{asset.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {kindMeta[kind].label} <span className="text-border-strong">|</span> {asset.sourceType} <span className="text-border-strong">|</span> {asset.source}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {asset.tier && <TierBadge tier={asset.tier} score={agent?.score} />}
            {asset.lifecycle && <LifecycleBadge state={asset.lifecycle} />}
            {asset.status && <Badge tone={asset.status === 'Approved' ? 'success' : asset.status === 'Unmanaged' ? 'warning' : 'danger'}>{asset.status}</Badge>}
            <ChangeBadge change={asset.change} />
          </div>
        </div>
      </div>

      {/* Command bar */}
      <div className="mt-4 flex flex-wrap items-center gap-0.5 border-y border-border py-1">
        <Button variant="ghost" icon={Pencil} onClick={() => setEditOpen(true)} disabledReason={can('inventory.register') || can('admin.manage') ? undefined : reason('inventory.register')}>Edit</Button>
        <Button variant="ghost" icon={RefreshCw} onClick={() => toast({ tone: 'success', title: 'Rescan requested', body: `${asset.name} will be refreshed from ${asset.source}.` })}>Refresh</Button>
        <Button variant="ghost" icon={Waypoints} onClick={() => setTab('lineage')}>View lineage</Button>
        {(kind === 'agent' || kind === 'tool') && <Button variant="ghost" icon={Sparkles} onClick={() => openPilot({ kind, id })}>Ask PolicyPilot</Button>}
        {kind === 'agent' && <Button variant="ghost" icon={FileDown} onClick={() => toast({ tone: 'success', title: 'Agent dossier generated', body: `${asset.name}.pdf with metadata, lineage, risk history, approvals, evidence, policies, incidents and cost.` })}>Download dossier</Button>}
        {tool?.quarantined && (
          <Button variant="ghost" icon={Unlock} onClick={() => { actions.releaseQuarantine(id); toast({ tone: 'success', title: 'Schema re-approved', body: 'Calls are allowed again within 30 seconds.' }); }} disabledReason={can('runtime.policies') ? undefined : reason('runtime.policies')}>Re-approve schema</Button>
        )}
        {agent && (
          <>
            <span className="mx-1 h-5 w-px bg-border" aria-hidden />
            {agent.suspended ? (
              <Button variant="ghost" icon={Power} onClick={() => { actions.setSuspended(id, false); toast({ tone: 'success', title: 'Agent resumed', body: 'SDK clients pick this up within 30 seconds.' }); }} disabledReason={can('runtime.killswitch') ? undefined : reason('runtime.killswitch')}>Resume agent</Button>
            ) : (
              <Button variant="ghost" icon={PowerOff} className="text-danger" onClick={() => setKillOpen(true)} disabledReason={can('runtime.killswitch') ? undefined : reason('runtime.killswitch')}>Suspend agent</Button>
            )}
            <div className="ml-auto"><LifecycleMenu agent={agent} /></div>
          </>
        )}
      </div>

      {/* Contextual alerts */}
      <div className="mt-4 space-y-3 empty:hidden">
        {agent?.suspended && <Callout tone="danger" icon={PowerOff} title="This agent is suspended. Every policy check returns block." />}
        {agent?.tier === 'Prohibited' && <Callout tone="danger" icon={ShieldAlert} title="Prohibited use: this agent can't be approved">Override rule: fully automated adverse credit decision with no human review.</Callout>}
        {asset.status === 'Unmanaged' && (
          <Callout
            tone="warning"
            icon={UserCheck}
            title="No owner has claimed this asset"
            action={agent && <Button size="sm" variant="primary" onClick={() => { actions.claimAgent(id); toast({ tone: 'success', title: 'Claim sent', body: 'A platform admin will confirm your ownership.' }); }} disabledReason={can('ownership.claim') ? undefined : reason('ownership.claim')}>Claim ownership</Button>}
          >
            It was discovered by a scan and stays unmanaged until an owner claims it.
          </Callout>
        )}
        {tool?.quarantined && <Callout tone="danger" icon={ShieldAlert} title="Quarantined: the input schema changed since approval">Hash {tool.previousHash} → {tool.schemaHash}. Every call is blocked until the schema is re-approved.</Callout>}
      </div>

      <Tabs value={tab} onChange={setTab} items={tabs} className="mt-4" ariaLabel="Asset sections" />
      <div className="mt-4">
        {tab === 'overview' && <Overview asset={asset} onLineage={() => setTab('lineage')} />}
        {tab === 'lineage' && <LineageGraph focusId={id} height={620} />}
        {tab === 'properties' && <Properties asset={asset} />}
        {tab === 'history' && <History asset={asset} history={history} />}
        {tab === 'schema' && kind === 'tool' && <ToolSchema toolId={id} />}
        {tab === 'schema' && kind === 'data' && <DataSchema dataId={id} />}
        {tab === 'policies' && kind === 'tool' && <ToolPolicies toolId={id} />}
        {tab === 'tools' && <McpTools mcpId={id} />}
        {tab === 'agents' && app && <AppAgents agentIds={app.agentIds} />}
        {agent && tab === 'risk' && <RiskTab agent={agent} assessments={s.riskAssessments.filter((r) => r.agentId === id).sort((a, b) => b.version - a.version)} />}
        {agent && tab === 'controls' && <ControlsTab agentId={id} />}
        {agent && tab === 'policies' && <AgentPolicies agent={agent} />}
        {agent && tab === 'runtime' && <AgentDecisions agent={agent} />}
        {agent && tab === 'approvals' && <AgentApprovals agent={agent} />}
        {agent && tab === 'incidents' && <AgentIncidents agent={agent} />}
        {agent && tab === 'cost' && <CostTab agent={agent} />}
      </div>

      {agent && <KillSwitchModal agent={agent} open={killOpen} onClose={() => setKillOpen(false)} />}
      {editOpen && <EditModal asset={asset} onClose={() => setEditOpen(false)} />}
    </div>
  );
}

// ---------------------------------------------------------------- overview
function Overview({ asset, onLineage }: { asset: CatalogAsset; onLineage: () => void }) {
  const s = useStore((x) => x);
  const L = useLookup();
  const agent = asset.kind === 'agent' ? s.agents.find((a) => a.id === asset.id)! : null;
  const edges = flowEdges(s);
  const upstream = edges.filter((e) => e.to === asset.id).map((e) => e.from);
  const downstream = edges.filter((e) => e.from === asset.id).map((e) => e.to);
  const catalog = new Map(buildCatalog(s).map((a) => [a.id, a]));

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-4">
        <Card>
          <CardHeader title="Description" />
          <div className="space-y-4 p-4">
            <p className="text-base leading-relaxed">{asset.description}</p>
            {agent && (
              <dl className="grid gap-x-8 gap-y-3 border-t border-border pt-4 sm:grid-cols-2">
                <Prop k="Purpose" v={agent.purpose} />
                <Prop k="Intended users" v={agent.intendedUsers} />
                <Prop k="Autonomy" v={agent.autonomy} />
                <Prop k="Human approval step" v={agent.humanInLoop ? 'Yes' : 'No'} />
                <Prop k="Framework" v={`${agent.framework}, version ${agent.version}`} />
                <Prop k="Agent role" v={L.role(agent.agentRoleId)?.name ?? 'Not assigned'} />
                <Prop k="Runtime SDK" v={agent.sdkConnected ? 'Connected' : 'Not connected'} />
                <Prop k="Next periodic review" v={agent.nextReview ? `${dateOnly(agent.nextReview)} (${relTime(agent.nextReview)})` : 'Not scheduled'} />
              </dl>
            )}
          </div>
        </Card>

        {agent && (
          <Card>
            <CardHeader title="Governance summary" />
            <div className="grid gap-px overflow-hidden bg-border sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCell label="Risk assessment">
                <div className="flex items-center gap-2"><RiskFingerprint signals={agent.signals} size="md" /><TierBadge tier={agent.tier} score={agent.score} /></div>
              </SummaryCell>
              <SummaryCell label="Required controls">
                {(() => {
                  const ev = s.evidence.filter((e) => e.agentId === agent.id);
                  const ok = ev.filter((e) => e.status === 'Accepted').length;
                  return ev.length ? (
                    <>
                      <p className="tabular text-sm"><b>{ok}</b> of {ev.length} accepted</p>
                      <Meter className="mt-1.5" value={ok} max={ev.length} tone={ok === ev.length ? 'success' : 'warning'} label="Controls" />
                    </>
                  ) : <p className="text-sm text-muted">No checklist</p>;
                })()}
              </SummaryCell>
              <SummaryCell label="Runs, last 7 days"><p className="tabular text-lg font-semibold">{compact(agent.runs7d)}</p><p className="text-xs text-muted">{pct(agent.blockRate)} of checks blocked</p></SummaryCell>
              <SummaryCell label="Cost, last 30 days"><p className="tabular text-lg font-semibold">{moneyShort(agent.cost30d)}</p></SummaryCell>
            </div>
          </Card>
        )}

        <Card>
          <CardHeader title="Direct relationships" description="Assets one hop upstream and downstream" actions={<Button size="sm" variant="ghost" icon={Waypoints} onClick={onLineage}>Open lineage</Button>} />
          <div className="grid gap-px bg-border md:grid-cols-[1fr_auto_1fr]">
            <RelList title={`Upstream (${upstream.length})`} ids={upstream} catalog={catalog} empty="Nothing feeds this asset." />
            <div className="hidden items-center bg-surface px-3 md:flex"><ArrowRight className="h-4 w-4 text-subtle" /></div>
            <RelList title={`Downstream (${downstream.length})`} ids={downstream} catalog={catalog} empty="Nothing consumes this asset." />
          </div>
        </Card>
      </div>

      <AboutPanel asset={asset} />
    </div>
  );
}

function Prop({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-muted">{k}</dt>
      <dd className="mt-0.5 break-words text-sm">{v}</dd>
    </div>
  );
}

function SummaryCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bg-surface px-4 py-3">
      <p className="mb-1.5 text-sm text-muted">{label}</p>
      {children}
    </div>
  );
}

function RelList({ title, ids, catalog, empty }: { title: string; ids: string[]; catalog: Map<string, CatalogAsset>; empty: string }) {
  return (
    <div className="bg-surface p-4">
      <p className="mb-2 text-sm font-semibold">{title}</p>
      {ids.length ? (
        <ul className="space-y-2">
          {ids.map((rid) => {
            const r = catalog.get(rid)!;
            return (
              <li key={rid} className="flex items-center gap-2.5">
                <AssetIcon kind={r.kind} size="sm" />
                <Link to={assetHref(r.kind, r.id)} className={cn('min-w-0 truncate text-sm text-primary hover:underline', r.kind === 'tool' && 'font-mono text-[13px]')}>{r.name}</Link>
                <span className="ml-auto shrink-0 text-xs text-subtle">{kindMeta[r.kind].label}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-subtle">{empty}</p>
      )}
    </div>
  );
}

/** Right-hand "About" panel, as in Purview and DataHub. */
function AboutPanel({ asset }: { asset: CatalogAsset }) {
  const s = useStore((x) => x);
  const L = useLookup();
  const agent = asset.kind === 'agent' ? s.agents.find((a) => a.id === asset.id) : null;
  const app = asset.kind === 'application' ? s.applications.find((a) => a.id === asset.id) : null;
  const sponsor = agent?.sponsor ?? app?.sponsor ?? null;
  const ownerUser = L.user(asset.owner);
  const raw = [s.agents, s.applications, s.models, s.tools, s.mcpServers, s.dataSources].flat().find((x) => x.id === asset.id)!;

  const Section = ({ title, children }: { title: string; children: ReactNode }) => (
    <section className="border-b border-border px-4 py-3.5 last:border-0">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );

  return (
    <Card className="self-start">
      <Section title="Collection">
        <Link to={`/catalog?collection=${asset.collection}`} className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
          <FolderClosed className="h-4 w-4 text-warning" /> {L.buName(asset.collection)}
        </Link>
      </Section>
      <Section title="Contacts">
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-xs text-muted">Owner</p>
            {asset.owner ? <Person name={L.userName(asset.owner)} sub={ownerUser?.status === 'disabled' ? 'Disabled in Entra ID' : ownerUser?.title} muted={ownerUser?.status === 'disabled'} size="md" /> : <p className="text-sm italic text-subtle">Not assigned</p>}
          </div>
          {(asset.kind === 'agent' || asset.kind === 'application') && (
            <div>
              <p className="mb-1 text-xs text-muted">Business sponsor</p>
              {sponsor ? <Person name={L.userName(sponsor)} sub={L.user(sponsor)?.title} size="md" /> : <p className="text-sm italic text-subtle">Not assigned</p>}
            </div>
          )}
        </div>
      </Section>
      <Section title="Classifications">
        {asset.classifications.length ? (
          <div className="flex flex-wrap gap-1.5">{asset.classifications.map((c) => <Badge key={c} tone="neutral" icon={Tag}>{c}</Badge>)}</div>
        ) : (
          <p className="text-sm text-subtle">None detected</p>
        )}
      </Section>
      <Section title="Tags">
        {asset.tags.length ? <div className="flex flex-wrap gap-1.5">{asset.tags.map((t) => <Badge key={t} tone="outline">{t}</Badge>)}</div> : <p className="text-sm text-subtle">No tags</p>}
      </Section>
      <Section title="Source">
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-muted">Platform</dt><dd className="text-right">{asset.sourceType}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">Discovered by</dt><dd className="text-right">{asset.source}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">Created</dt><dd className="text-right">{dateOnly(raw.createdAt)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">Last modified</dt><dd className="text-right">{relTime(asset.updatedAt)}</dd></div>
        </dl>
      </Section>
      <Section title="Qualified name">
        <div className="flex items-start gap-1">
          <p className="min-w-0 flex-1 break-all font-mono text-xs text-muted">{asset.qualifiedName}</p>
          <CopyButton text={asset.qualifiedName} />
        </div>
      </Section>
    </Card>
  );
}

// ---------------------------------------------------------------- properties
function Properties({ asset }: { asset: CatalogAsset }) {
  const s = useStore((x) => x);
  const L = useLookup();
  const raw = [s.agents, s.applications, s.models, s.tools, s.mcpServers, s.dataSources].flat().find((x) => x.id === asset.id)! as unknown as Record<string, unknown>;
  const rows: [string, ReactNode][] = [
    ['Asset ID', <Mono className="text-fg">{asset.id}</Mono>],
    ['Asset type', kindMeta[asset.kind].label],
    ['Qualified name', <Mono className="break-all text-fg">{asset.qualifiedName}</Mono>],
    ['Collection', L.buName(asset.collection)],
    ['Source', asset.source],
    ['Platform', asset.sourceType],
    ['Created', dateTime(raw.createdAt as string)],
    ['Created by', L.userName(raw.createdBy as string)],
    ['Last modified', dateTime(asset.updatedAt)],
  ];
  const skip = new Set(['id', 'businessUnitId', 'createdAt', 'updatedAt', 'createdBy', 'source', 'platform', 'name', 'description', 'schema', 'signals', 'history', 'toolIds', 'modelIds', 'dataSourceIds', 'agentIds']);
  const label = (k: string) => k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).replace(/ Id$/, '');
  Object.entries(raw).forEach(([k, v]) => {
    if (skip.has(k) || v === undefined) return;
    const val = v === null ? '—' : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : Array.isArray(v) ? (v.length ? v.join(', ') : '—') : typeof v === 'number' ? String(v) : /^\d{4}-\d\d-\d\dT/.test(String(v)) ? dateTime(String(v)) : /^u-/.test(String(v)) ? L.userName(String(v)) : String(v);
    if (!rows.some(([existing]) => existing === label(k))) rows.push([label(k), val]);
  });
  return (
    <Card>
      <CardHeader title="Technical properties" description="Metadata captured from the source on the last scan" />
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-b border-border last:border-0">
              <th scope="row" className="w-60 px-4 py-2 text-left align-top font-normal text-muted">{k}</th>
              <td className="px-4 py-2 align-top">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

// ---------------------------------------------------------------- schema / children
function ToolSchema({ toolId }: { toolId: string }) {
  const t = useStore((s) => s.tools.find((x) => x.id === toolId)!);
  const [view, setView] = useState<'table' | 'json'>('table');
  const params = Object.entries(t.schema).map(([name, p]) => ({ id: name, name, ...p }));
  return (
    <Card>
      <CardHeader title="Input schema" description={`From list_tools on the last scan. Schema hash ${t.schemaHash}${t.previousHash ? `, previously ${t.previousHash}` : ''}.`} actions={<Segmented size="xs" value={view} onChange={setView} options={[{ value: 'table', label: 'Table' }, { value: 'json', label: 'JSON' }]} />} />
      {view === 'table' ? (
        <DataTable
          rows={params}
          columns={[
            { key: 'n', header: 'Parameter', cell: (p) => <span className="flex items-center gap-2"><Mono className="text-fg">{p.name}</Mono>{t.previousHash && p.name === 'instant' && <Badge tone="warning">Added</Badge>}</span> },
            { key: 't', header: 'Data type', cell: (p) => <Mono>{p.type}</Mono> },
            { key: 'e', header: 'Allowed values', hideBelow: 'md', cell: (p) => (p.enum ? p.enum.join(', ') : <span className="text-subtle">Any</span>) },
            { key: 'd', header: 'Description', cell: (p) => <span className="text-muted">{p.description ?? '—'}</span> },
          ]}
        />
      ) : (
        <div className="p-4"><CodeBlock code={JSON.stringify({ name: t.name, description: t.description, inputSchema: { type: 'object', properties: t.schema } }, null, 2)} /></div>
      )}
      <div className="flex items-center gap-2 border-t border-border px-4 py-3 text-sm">Action type: <ActionBadge action={t.actionType} /></div>
    </Card>
  );
}

function DataSchema({ dataId }: { dataId: string }) {
  const d = useStore((s) => s.dataSources.find((x) => x.id === dataId)!);
  const rows = d.columnsOfInterest.map((c) => ({ id: c, name: c, cls: classificationsFor([c])[0] }));
  return (
    <Card>
      <CardHeader title="Columns of interest" description={`Columns that drive the sensitivity of this ${d.type.toLowerCase()}. Label: ${d.label ?? 'none (classified automatically)'}.`} actions={<SensitivityBadge value={d.sensitivity} />} />
      <DataTable
        rows={rows}
        empty={<EmptyState title="No sensitive columns detected" description="This source holds no personal, financial or health fields." />}
        columns={[
          { key: 'n', header: 'Column', cell: (r) => <Mono className="text-fg">{r.name}</Mono> },
          { key: 'c', header: 'Classification', cell: (r) => (r.cls ? <Badge icon={Tag}>{r.cls}</Badge> : <span className="text-subtle">—</span>) },
          { key: 's', header: 'Detected by', hideBelow: 'sm', cell: () => <span className="text-muted">{d.label ? 'Sensitivity label' : 'Sensitivity tagger (AI suggested)'}</span> },
        ]}
      />
    </Card>
  );
}

function ToolPolicies({ toolId }: { toolId: string }) {
  const L = useLookup();
  const pols = useStore((s) => s.runtimePolicies.filter((p) => p.toolId === toolId || (p.scope.kind === 'tool' && p.scope.id === toolId)));
  return (
    <Card>
      <CardHeader title="Runtime policies on this tool" description="Checked whenever any agent calls it" />
      <DataTable
        rows={pols}
        empty={<EmptyState title="No policies target this tool" description="Calls fall back to each agent role's defaults." />}
        columns={[
          { key: 'n', header: 'Policy', cell: (p) => <Link to={`/runtime/policies/${p.id}`} className="text-primary hover:underline">{p.name}</Link> },
          { key: 's', header: 'Scope', hideBelow: 'md', cell: (p) => (p.scope.kind === 'all' ? 'All agents' : p.scope.kind === 'role' ? L.role(p.scope.id!)?.name : p.scope.kind === 'agent' ? L.agentName(p.scope.id!) : 'Every agent using this tool') },
          { key: 'd', header: 'Decision', cell: (p) => <DecisionBadge decision={p.decision} /> },
          { key: 'm', header: 'Mode', cell: (p) => <ModeBadge mode={p.mode} /> },
        ]}
      />
    </Card>
  );
}

function McpTools({ mcpId }: { mcpId: string }) {
  const s = useStore((x) => x);
  const navigate = useNavigate();
  const m = s.mcpServers.find((x) => x.id === mcpId)!;
  return (
    <Card>
      <CardHeader title="Tools exposed by this server" description={`From list_tools, scanned ${relTime(m.lastScanned)}`} />
      <DataTable
        rows={m.toolIds.map((t) => s.tools.find((x) => x.id === t)!)}
        onRowClick={(t) => navigate(assetHref('tool', t.id))}
        columns={[
          { key: 'n', header: 'Tool', cell: (t) => <span className="font-mono text-[13px] text-primary">{t.name}</span> },
          { key: 'd', header: 'Description', hideBelow: 'md', cell: (t) => <span className="text-muted">{t.description}</span> },
          { key: 'a', header: 'Action', cell: (t) => <ActionBadge action={t.actionType} /> },
          { key: 'p', header: 'Parameters', align: 'right', hideBelow: 'sm', cell: (t) => Object.keys(t.schema).length },
          { key: 's', header: 'Status', cell: (t) => <Badge tone={t.quarantined ? 'danger' : t.approved ? 'success' : 'warning'}>{t.quarantined ? 'Quarantined' : t.approved ? 'Approved' : 'Not approved'}</Badge> },
        ]}
      />
    </Card>
  );
}

function AppAgents({ agentIds }: { agentIds: string[] }) {
  const s = useStore((x) => x);
  const L = useLookup();
  const navigate = useNavigate();
  return (
    <Card>
      <DataTable
        rows={agentIds.map((a) => s.agents.find((x) => x.id === a)!) as Agent[]}
        onRowClick={(a) => navigate(assetHref('agent', a.id))}
        columns={[
          { key: 'n', header: 'Agent', cell: (a) => <span className="flex items-center gap-2.5"><AssetIcon kind="agent" size="sm" /><span className="text-primary">{a.name}</span></span> },
          { key: 'p', header: 'Platform', hideBelow: 'md', cell: (a) => a.platform },
          { key: 't', header: 'Risk', cell: (a) => <TierBadge tier={a.tier} /> },
          { key: 'l', header: 'Lifecycle', cell: (a) => <LifecycleBadge state={a.lifecycle} /> },
          { key: 'o', header: 'Owner', hideBelow: 'lg', cell: (a) => (a.owner ? L.userName(a.owner) : <span className="italic text-subtle">Not assigned</span>) },
        ]}
      />
    </Card>
  );
}

// ---------------------------------------------------------------- history
function History({ asset, history }: { asset: CatalogAsset; history: AuditEvent[] }) {
  const L = useLookup();
  return (
    <Card>
      <CardHeader title="Change history" description="Every change to this asset's metadata, risk and state, from the audit log" />
      <DataTable
        rows={history}
        empty={<EmptyState title="No changes recorded" description={`Created from ${asset.source}. Later edits and scans will appear here.`} />}
        columns={[
          { key: 'at', header: 'Date', cell: (e) => <span className="whitespace-nowrap text-muted">{dateTime(e.at)}</span> },
          { key: 'a', header: 'Changed by', cell: (e) => L.userName(e.actor) },
          { key: 'ac', header: 'Change', cell: (e) => <Mono className="text-fg">{e.action}</Mono> },
          { key: 'd', header: 'Details', hideBelow: 'md', cell: (e) => <span className="text-sm">{e.before && <span className="text-muted line-through">{e.before}</span>}{e.before && e.after && ' → '}{e.after}</span> },
        ]}
      />
    </Card>
  );
}

// ---------------------------------------------------------------- edit
function EditModal({ asset, onClose }: { asset: CatalogAsset; onClose: () => void }) {
  const s = useStore((x) => x);
  const toast = useToast();
  const [description, setDescription] = useState(asset.description);
  const [owner, setOwner] = useState(asset.owner ?? '');
  const [tags, setTags] = useState(asset.tags.join(', '));
  const canOwn = asset.kind !== 'model';
  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit ${asset.name}`}
      description="Changes are versioned and recorded in the audit log."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              actions.editAsset(asset.kind, asset.id, { description: description.trim(), owner: owner || null, tags: tags.split(',').map((t) => t.trim()).filter(Boolean) });
              toast({ tone: 'success', title: 'Asset updated' });
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Description" htmlFor="ed"><Textarea id="ed" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        {canOwn && (
          <Field label="Owner" htmlFor="eo">
            <Select id="eo" value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="">Not assigned</option>
              {s.users.filter((u) => u.status === 'active').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </Field>
        )}
        {asset.kind === 'agent' && <Field label="Tags" hint="Comma-separated" htmlFor="et"><Input id="et" value={tags} onChange={(e) => setTags(e.target.value)} /></Field>}
      </div>
    </Modal>
  );
}
