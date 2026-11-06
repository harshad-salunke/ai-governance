import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BadgeCheck, Bot, ChevronRight, FileDown, Hand, Plug, Plus, Radar, Search, ShieldAlert, Siren, Timer, UserX, Wrench } from 'lucide-react';
import { useStore } from '../data/store';
import { inScope, useLookup } from '../lib/lookup';
import { useChartColors } from '../lib/theme';
import { cn, compact, moneyShort, num, pct, relTime } from '../lib/format';
import { NOW } from '../data/seed';
import { Button, ButtonLink, Card, CardHeader, DataTable, PageHeader, Person, Stat } from '../components/ui';
import { AssetIcon, LifecycleBadge, TierBadge, decisionMeta, kindMeta } from '../components/domain';
import { ChartTooltip, Legend, SegmentBar, axisProps } from '../components/charts';
import type { Decision, RiskTier } from '../data/types';
import { useToast } from '../lib/toast';
import { usePermission } from '../lib/rbac';
import { buildCatalog, KIND_ORDER, type CatalogAsset } from '../lib/catalog';

const inScopeCatalog = (list: CatalogAsset[], scope: string) => (scope === 'all' ? list : list.filter((a) => a.collection === scope));

export default function Overview() {
  const s = useStore((x) => x);
  const L = useLookup();
  const c = useChartColors();
  const navigate = useNavigate();
  const toast = useToast();
  const { can, reason } = usePermission();

  const agents = inScope(s, s.agents);
  const ids = new Set(agents.map((a) => a.id));
  const managed = agents.filter((a) => a.managed);
  const withOwnerSponsor = agents.filter((a) => a.owner && a.sponsor).length;
  const high = agents.filter((a) => a.tier === 'High' || a.tier === 'Prohibited');
  const decisions = s.decisions.filter((d) => ids.has(d.agentId));
  const blocked = decisions.filter((d) => d.decision === 'block').length;
  const costMtd = s.dailyCost.reduce((sum, d) => sum + d['GPT-4o'] + d['GPT-4.1'] + d['GPT-4o mini'] + d['Phi-4'] + d.Other, 0);

  // ---------------------------------------------- needs attention (action-first)
  const attention = [
    { n: s.approvals.filter((a) => a.status === 'Pending' && Date.parse(a.dueAt) < NOW).length, label: 'approvals past their SLA', icon: Timer, to: '/approvals', tone: 'danger' },
    { n: s.incidents.filter((i) => i.severity === 'Critical' && i.status !== 'Resolved').length, label: 'critical incident open', icon: Siren, to: '/incidents', tone: 'danger' },
    { n: s.tools.filter((t) => t.quarantined).length, label: 'tool quarantined after a schema change', icon: Wrench, to: '/runtime/policies?tab=quarantine', tone: 'warning' },
    { n: agents.filter((a) => !a.managed).length, label: 'unmanaged agents need an owner', icon: UserX, to: '/ownership', tone: 'warning' },
    { n: s.connectors.filter((x) => x.status === 'failed').length, label: 'connector failing', icon: Plug, to: '/connectors', tone: 'danger' },
    { n: s.approvalTasks.filter((t) => t.status === 'Pending').length, label: 'runtime requests waiting for a human', icon: Hand, to: '/runtime/human-approvals', tone: 'warning' },
    { n: s.reviews.filter((r) => r.status === 'Overdue' && ids.has(r.agentId)).length, label: 'periodic reviews overdue', icon: BadgeCheck, to: '/reviews', tone: 'danger' },
    { n: s.shadowHints.length, label: 'shadow AI signals', icon: Radar, to: '/discovery', tone: 'neutral' },
  ].filter((x) => x.n > 0);

  // ---------------------------------------------- charts
  const tiers: RiskTier[] = ['Low', 'Medium', 'High', 'Prohibited'];
  const platformRows = useMemo(() => {
    const plats = ['Azure AI Foundry', 'Microsoft Fabric', 'Copilot Studio', 'Custom', 'AWS Bedrock'] as const;
    return plats.map((p) => {
      const row: Record<string, string | number> = { platform: p.replace('Azure AI ', '').replace('Microsoft ', '') };
      tiers.forEach((t) => (row[t] = agents.filter((a) => a.platform === p && a.tier === t).length));
      return row;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents]);

  const decisionSeries = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => new Date(NOW - (6 - i) * 86_400_000).toISOString().slice(0, 10));
    return days.map((d) => {
      const row: Record<string, string | number> = { day: d };
      (Object.keys(decisionMeta) as Decision[]).forEach((k) => (row[k] = decisions.filter((x) => x.at.startsWith(d) && x.decision === k).length * 412));
      return row;
    });
  }, [decisions]);
  const decisionColor: Record<Decision, string> = { allow: c.success, block: c.danger, ask_human: c.warning, redact: c.violet, audit: c.info };

  const topRisk = [...agents].filter((a) => a.tier !== 'Low').sort((a, b) => b.score - a.score || Number(a.managed) - Number(b.managed)).slice(0, 7);

  const catalog = useMemo(() => inScopeCatalog(buildCatalog(s), s.session.buScope), [s]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Home"
        description={`AI estate across ${s.session.buScope === 'all' ? `${s.businessUnits.length} business units` : L.buName(s.session.buScope)}. Last scan ${relTime(s.connectors[0].lastRun)}.`}
        actions={
          <>
            <Button icon={FileDown} onClick={() => toast({ tone: 'success', title: 'Executive summary queued', body: 'The PDF will be ready in Reports in about a minute.' })}>
              Executive report
            </Button>
            {can('inventory.register') ? (
              <ButtonLink to="/catalog/register" variant="primary" icon={Plus}>
                Register agent
              </ButtonLink>
            ) : (
              <Button variant="primary" icon={Plus} disabledReason={reason('inventory.register')}>
                Register agent
              </Button>
            )}
          </>
        }
      />

      <Card className="p-5">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            const q = new FormData(e.currentTarget).get('q')?.toString().trim();
            navigate(q ? `/catalog?q=${encodeURIComponent(q)}` : '/catalog');
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input name="q" placeholder="Search the AI catalog for agents, models, tools, MCP servers and data" aria-label="Search the AI catalog" className="input-base h-10 pl-9 text-base" />
          </div>
          <Button type="submit" variant="primary" className="h-10 px-5">Search</Button>
        </form>
        <p className="mb-2 mt-5 text-sm font-semibold">Browse assets by type</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {KIND_ORDER.map((k) => (
            <Link key={k} to={`/catalog?type=${k}`} className="flex items-center gap-3 rounded border border-border p-3 transition-colors hover:border-border-strong hover:bg-surface-2">
              <AssetIcon kind={k} />
              <span className="min-w-0">
                <span className="tabular block text-lg font-semibold leading-6">{catalog.filter((a) => a.kind === k).length}</span>
                <span className="block truncate text-sm text-muted">{kindMeta[k].plural}</span>
              </span>
            </Link>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:grid-rows-[auto_1fr]">
          <Stat label="AI agents" value={num(agents.length)} icon={Bot} to="/catalog" sub={`${managed.length} managed · ${agents.length - managed.length} unmanaged`} />
          <Stat
            label="Owner & sponsor coverage"
            value={pct((withOwnerSponsor / Math.max(1, agents.length)) * 100, 0)}
            sub="Target above 95%"
            tone={withOwnerSponsor / agents.length < 0.95 ? 'warning' : 'success'}
            to="/ownership"
          />
          <Stat label="High or prohibited" value={high.length} icon={ShieldAlert} tone="danger" to="/risk" sub={`${agents.filter((a) => a.tier === 'Medium').length} medium · ${agents.filter((a) => a.tier === 'Low').length} low`} />
          <Stat label="Spend, last 30 days" value={moneyShort(costMtd)} to="/observe/cost" sub="Azure OpenAI and Bedrock" />

          <Card className="col-span-2 lg:col-span-4">
            <CardHeader title="Runtime decisions, last 7 days" description={`${compact(decisions.length * 412)} checks · ${pct((blocked / Math.max(1, decisions.length)) * 100)} blocked`} actions={<Link to="/runtime/decisions" className="text-xs text-primary hover:underline">Decision log</Link>} />
            <div className="p-4">
              <Legend className="mb-3" items={(Object.keys(decisionMeta) as Decision[]).map((k) => ({ label: decisionMeta[k].label, color: decisionColor[k] }))} />
              <div className="h-56">
                <ResponsiveContainer>
                  <AreaChart data={decisionSeries} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
                    <CartesianGrid vertical={false} stroke={c.grid} strokeDasharray="0" />
                    <XAxis dataKey="day" {...axisProps(c.subtle)} tickFormatter={(d) => new Date(d).toLocaleDateString('en-IN', { weekday: 'short' })} />
                    <YAxis {...axisProps(c.subtle)} tickFormatter={(v) => compact(v)} width={48} />
                    <Tooltip content={<ChartTooltip format={(v) => num(v)} total labelFormat={(d) => new Date(d).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })} />} cursor={{ stroke: c.border }} />
                    {(['allow', 'audit', 'redact', 'ask_human', 'block'] as Decision[]).map((k) => (
                      <Area key={k} type="monotone" dataKey={k} name={decisionMeta[k].label} stackId="1" stroke={decisionColor[k]} strokeWidth={2} fill={decisionColor[k]} fillOpacity={0.18} />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>
        </div>

        <Card className="flex flex-col">
          <CardHeader title="Needs attention" description="Sorted by urgency for your scope" />
          <ul className="flex-1 divide-y divide-border">
            {attention.map((a) => (
              <li key={a.label}>
                <Link to={a.to} className="group flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2/60">
                  <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md', a.tone === 'danger' ? 'bg-danger/10 text-danger' : a.tone === 'warning' ? 'bg-warning/10 text-warning' : 'bg-surface-2 text-muted')}>
                    <a.icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="flex-1 text-sm">
                    <span className="tabular font-semibold">{a.n}</span> <span className="text-muted">{a.label}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-subtle transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card>
          <CardHeader title="Agents by platform and tier" description="Discovered by connectors or registered manually" actions={<Link to="/connectors" className="text-xs text-primary hover:underline">Connectors</Link>} />
          <div className="p-4">
            <SegmentBar label="Agents by tier" height={10} segments={tiers.map((t) => ({ label: t, value: agents.filter((a) => a.tier === t).length, color: c.tier[t] }))} />
            <Legend className="mb-3 mt-2.5" items={tiers.map((t) => ({ label: t, color: c.tier[t], value: agents.filter((a) => a.tier === t).length }))} />
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={platformRows} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 8 }} barCategoryGap={10}>
                  <CartesianGrid horizontal={false} stroke={c.grid} />
                  <XAxis type="number" allowDecimals={false} {...axisProps(c.subtle)} />
                  <YAxis type="category" dataKey="platform" width={92} {...axisProps(c.muted)} />
                  <Tooltip content={<ChartTooltip total />} cursor={{ fill: c.grid, opacity: 0.4 }} />
                  {tiers.map((t, i) => (
                    <Bar key={t} dataKey={t} stackId="a" fill={c.tier[t]} stroke={c.surface} strokeWidth={2} radius={i === tiers.length - 1 ? [0, 4, 4, 0] : 0} maxBarSize={20} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Highest-risk agents" description="Sorted by risk score" actions={<Link to="/catalog?type=agent" className="text-xs text-primary hover:underline">All agents</Link>} />
          <DataTable
            rows={topRisk}
            onRowClick={(a) => navigate(`/catalog/agent/${a.id}`)}
            columns={[
              { key: 'name', header: 'Agent', cell: (a) => <span className="font-medium">{a.name}</span> },
              { key: 'tier', header: 'Tier', cell: (a) => <TierBadge tier={a.tier} score={a.score} /> },
              { key: 'state', header: 'Lifecycle', cell: (a) => <LifecycleBadge state={a.lifecycle} /> },
              { key: 'owner', header: 'Owner', hideBelow: 'lg', cell: (a) => <Person name={a.owner ? L.userName(a.owner) : undefined} unassigned="No owner" /> },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
