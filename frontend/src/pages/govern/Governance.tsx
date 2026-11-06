import { Link, useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BadgeCheck, BookLock, RefreshCcw, ShieldOff, Siren, UserX } from 'lucide-react';
import { useStore } from '../../data/store';
import { inScope, useLookup } from '../../lib/lookup';
import { useChartColors } from '../../lib/theme';
import { cn, relTime } from '../../lib/format';
import { NOW } from '../../data/seed';
import { Badge, Card, CardHeader, PageHeader, Stat } from '../../components/ui';
import { LifecycleBadge, SeverityBadge, tierTone } from '../../components/domain';
import { ChartTooltip, axisProps } from '../../components/charts';
import type { Lifecycle, RiskTier } from '../../data/types';

export default function Governance() {
  const s = useStore((x) => x);
  const L = useLookup();
  const c = useChartColors();
  const navigate = useNavigate();
  const agents = inScope(s, s.agents);

  const pending = s.approvals.filter((a) => a.status === 'Pending');
  const overdue = s.reviews.filter((r) => r.status === 'Overdue');
  const openEx = s.exceptions.filter((e) => e.status === 'Active' || e.status === 'Expiring');
  const openInc = s.incidents.filter((i) => i.status !== 'Resolved');
  const openViol = s.governanceViolations.filter((v) => v.status === 'Open');

  const tiers: RiskTier[] = ['Low', 'Medium', 'High', 'Prohibited'];
  const states: Lifecycle[] = ['Draft', 'In review', 'Approved', 'Review overdue', 'Suspended', 'Deprecated'];
  const max = Math.max(1, ...tiers.flatMap((t) => states.map((st) => agents.filter((a) => a.tier === t && a.lifecycle === st).length)));

  const violByPolicy = s.governancePolicies
    .map((p) => ({ name: p.name.length > 34 ? p.name.slice(0, 32) + '…' : p.name, Violations: s.governanceViolations.filter((v) => v.policyId === p.id && v.status === 'Open').length }))
    .filter((x) => x.Violations > 0)
    .sort((a, b) => b.Violations - a.Violations);

  return (
    <div className="space-y-5">
      <PageHeader title="Governance" description="Whether each agent is allowed: risk, approvals, reviews, exceptions, incidents and policy violations." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Pending approvals" value={pending.length} icon={BadgeCheck} to="/approvals" sub={`${pending.filter((p) => Date.parse(p.dueAt) < NOW).length} past SLA`} />
        <Stat label="Overdue reviews" value={overdue.length} icon={RefreshCcw} tone={overdue.length ? 'danger' : undefined} to="/reviews" />
        <Stat label="Open exceptions" value={openEx.length} icon={ShieldOff} to="/reviews?tab=exceptions" sub={`${s.exceptions.filter((e) => e.status === 'Expiring').length} expiring soon`} />
        <Stat label="Open incidents" value={openInc.length} icon={Siren} tone={openInc.some((i) => i.severity === 'Critical') ? 'danger' : undefined} to="/incidents" />
        <Stat label="Policy violations" value={openViol.length} icon={BookLock} tone="warning" to="/governance-policies" />
        <Stat label="Unmanaged agents" value={agents.filter((a) => !a.managed).length} icon={UserX} to="/ownership" />
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader title="Agents by tier and state" description="Darker cells hold more agents. Click a cell to open the matching catalog search." />
          <div className="overflow-x-auto p-4">
            <table className="w-full min-w-[560px] border-separate border-spacing-1 text-sm">
              <thead>
                <tr>
                  <th className="w-24" />
                  {states.map((st) => <th key={st} className="pb-1 text-left text-xs font-medium text-muted">{st}</th>)}
                </tr>
              </thead>
              <tbody>
                {tiers.map((t) => (
                  <tr key={t}>
                    <th className="pr-2 text-left"><Badge tone={tierTone[t]} dot>{t}</Badge></th>
                    {states.map((st) => {
                      const n = agents.filter((a) => a.tier === t && a.lifecycle === st).length;
                      return (
                        <td key={st}>
                          <button
                            disabled={!n}
                            onClick={() => navigate(`/catalog?type=agent&tier=${t}&lifecycle=${encodeURIComponent(st)}`)}
                            className={cn('tabular flex h-10 w-full items-center justify-center rounded-md text-sm font-medium transition-[filter] hover:brightness-95 disabled:cursor-default', n ? 'text-fg' : 'text-subtle')}
                            style={{ background: n ? `color-mix(in srgb, ${c.tier[t]} ${12 + (n / max) * 45}%, transparent)` : 'rgb(var(--surface-2))' }}
                            aria-label={`${n} ${t} agents in ${st}`}
                          >
                            {n || '·'}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Open policy violations" description="Governance rules over inventory metadata" actions={<Link to="/governance-policies" className="text-xs text-primary hover:underline">All policies</Link>} />
          <div className="h-64 p-4">
            <ResponsiveContainer>
              <BarChart data={violByPolicy} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke={c.grid} />
                <XAxis type="number" allowDecimals={false} {...axisProps(c.subtle)} />
                <YAxis type="category" dataKey="name" width={170} {...axisProps(c.muted)} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: c.grid, opacity: 0.4 }} />
                <Bar dataKey="Violations" fill={c.warning} radius={[0, 4, 4, 0]} maxBarSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Approvals waiting" actions={<Link to="/approvals" className="text-xs text-primary hover:underline">Open queue</Link>} />
          <ul className="divide-y divide-border">
            {pending.map((a) => {
              const late = Date.parse(a.dueAt) < NOW;
              return (
                <li key={a.id}>
                  <Link to={`/approvals?id=${a.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2/60">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.title}</p>
                      <p className="text-xs text-subtle">Step {a.currentStep + 1} of {a.steps.length}: {a.steps[a.currentStep].name}</p>
                    </div>
                    <Badge tone={late ? 'danger' : 'neutral'}>{late ? `Overdue ${relTime(a.dueAt).replace(' ago', '')}` : `Due ${relTime(a.dueAt)}`}</Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Incidents and reviews" actions={<Link to="/incidents" className="text-xs text-primary hover:underline">Incidents</Link>} />
          <ul className="divide-y divide-border">
            {openInc.map((i) => (
              <li key={i.id} className="flex items-center gap-3 px-4 py-2.5">
                <SeverityBadge severity={i.severity} />
                <p className="min-w-0 flex-1 truncate text-sm">{i.key} · {i.title}</p>
                <span className="text-xs text-subtle">{relTime(i.openedAt)}</span>
              </li>
            ))}
            {overdue.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                <LifecycleBadge state="Review overdue" />
                <Link to={`/catalog/agent/${r.agentId}`} className="min-w-0 flex-1 truncate text-sm hover:text-primary">{L.agentName(r.agentId)}</Link>
                <span className="text-xs text-danger">due {relTime(r.dueAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
