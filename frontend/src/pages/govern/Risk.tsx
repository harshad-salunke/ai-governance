import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCcw, Save } from 'lucide-react';
import { actions, useStore } from '../../data/store';
import { SIGNALS, defaultRiskConfig, tierFor } from '../../data/risk';
import { inScope, useLookup } from '../../lib/lookup';
import { usePermission } from '../../lib/rbac';
import { useToast } from '../../lib/toast';
import { useChartColors } from '../../lib/theme';
import { relTime } from '../../lib/format';
import { Badge, Button, Callout, Card, CardHeader, DataTable, FilterSelect, PageHeader, SearchInput, Switch, Tabs, Toolbar } from '../../components/ui';
import { LifecycleBadge, RiskFingerprint, TierBadge } from '../../components/domain';
import { Legend, SegmentBar } from '../../components/charts';
import type { RiskRuleConfig, RiskTier, SignalKey } from '../../data/types';

type Tab = 'assessments' | 'rules';

export default function Risk() {
  const [tab, setTab] = useState<Tab>('assessments');
  return (
    <div className="space-y-5">
      <PageHeader title="Risk" description="Scores come from what the scan found. Owners confirm facts; reviewers can adjust with a reason." />
      <Tabs value={tab} onChange={setTab} items={[{ value: 'assessments', label: 'Assessments' }, { value: 'rules', label: 'Scoring rules' }]} />
      {tab === 'assessments' ? <Assessments /> : <Rules />}
    </div>
  );
}

function Assessments() {
  const s = useStore((x) => x);
  const L = useLookup();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [tier, setTier] = useState('all');
  const [status, setStatus] = useState('all');
  const agents = inScope(s, s.agents);
  const rows = agents
    .map((a) => ({ ...a, ra: s.riskAssessments.filter((r) => r.agentId === a.id).sort((x, y) => y.version - x.version)[0] }))
    .filter((a) => (!q || a.name.toLowerCase().includes(q.toLowerCase())) && (tier === 'all' || a.tier === tier) && (status === 'all' || a.ra?.status === status));

  return (
    <Card>
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Search agents" className="w-full sm:w-60" />
        <FilterSelect label="Tier" value={tier} onChange={setTier} options={['Low', 'Medium', 'High', 'Prohibited'].map((t) => ({ value: t, label: t }))} />
        <FilterSelect label="Status" value={status} onChange={setStatus} options={['Auto-scored', 'Owner confirmed', 'Under review', 'Accepted', 'Adjusted'].map((t) => ({ value: t, label: t }))} />
      </Toolbar>
      <DataTable
        rows={rows}
        onRowClick={(a) => navigate(`/catalog/agent/${a.id}?tab=risk`)}
        initialSort={{ key: 'score', dir: 'desc' }}
        columns={[
          { key: 'n', header: 'Agent', sort: (a) => a.name, cell: (a) => <span className="font-medium">{a.name}</span> },
          { key: 'fp', header: 'Actions · Data · Autonomy · Exposure · Impact', cell: (a) => <RiskFingerprint signals={a.signals} size="md" /> },
          { key: 'score', header: 'Tier', sort: (a) => a.score + (a.tier === 'Prohibited' ? 100 : 0), cell: (a) => <TierBadge tier={a.tier} score={a.score} /> },
          { key: 'ov', header: 'Overrides', hideBelow: 'lg', cell: (a) => (a.ra?.overrides.length ? <Badge tone="danger">{a.ra.overrides.length} hit</Badge> : <span className="text-subtle">—</span>) },
          { key: 'st', header: 'Assessment', sort: (a) => a.ra?.status ?? '', cell: (a) => <Badge tone={a.ra?.status === 'Under review' ? 'info' : a.ra?.status === 'Auto-scored' ? 'warning' : 'outline'}>{a.ra?.status} · v{a.ra?.version}</Badge> },
          { key: 'lc', header: 'Lifecycle', hideBelow: 'md', cell: (a) => <LifecycleBadge state={a.lifecycle} /> },
          { key: 'rv', header: 'Reviewer', hideBelow: 'xl', cell: (a) => <span className="text-muted">{a.ra?.reviewer ? L.userName(a.ra.reviewer) : '—'}</span> },
          { key: 'at', header: 'Scored', hideBelow: 'lg', sort: (a) => a.ra?.createdAt ?? '', cell: (a) => <span className="text-muted">{relTime(a.ra?.createdAt)}</span> },
        ]}
      />
    </Card>
  );
}

function Rules() {
  const s = useStore((x) => x);
  const c = useChartColors();
  const { can, reason } = usePermission();
  const toast = useToast();
  const [cfg, setCfg] = useState<RiskRuleConfig>(s.riskConfig);
  const locked = !can('risk.configure');
  const dirty = JSON.stringify(cfg) !== JSON.stringify(s.riskConfig);

  // Impact preview: how many agents would change tier under the edited rules.
  const preview = useMemo(() => {
    const scored = s.agents.filter((a) => a.tier !== 'Prohibited').map((a) => ({ a, next: tierFor(a.signals, a, cfg).tier }));
    return { changed: scored.filter((x) => x.next !== x.a.tier), dist: (['Low', 'Medium', 'High'] as RiskTier[]).map((t) => ({ t, now: scored.filter((x) => x.a.tier === t).length, next: scored.filter((x) => x.next === t).length })) };
  }, [cfg, s.agents]);

  const setW = (k: SignalKey, v: number) => setCfg({ ...cfg, weights: { ...cfg.weights, [k]: v } });

  return (
    <div className="space-y-4">
      {locked && <Callout tone="info" title="View only">{reason('risk.configure')}</Callout>}
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader title="Signals and weights" description="Each signal scores 1–3. Total = Σ score × weight." />
            <ul className="divide-y divide-border">
              {SIGNALS.map((sig) => (
                <li key={sig.key} className="grid items-center gap-3 px-4 py-3 sm:grid-cols-[180px_1fr_60px]">
                  <div>
                    <p className="text-sm font-medium">{sig.label}</p>
                    <p className="text-xs text-subtle">{sig.source}</p>
                  </div>
                  <div>
                    <input type="range" min={0.5} max={2} step={0.25} value={cfg.weights[sig.key]} disabled={locked} onChange={(e) => setW(sig.key, Number(e.target.value))} className="w-full accent-[rgb(var(--primary))]" aria-label={`${sig.label} weight`} />
                    <p className="mt-0.5 flex justify-between text-[11px] text-subtle"><span>1 = {sig.levels[0]}</span><span>3 = {sig.levels[2]}</span></p>
                  </div>
                  <span className="tabular text-right text-sm font-medium">×{cfg.weights[sig.key].toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Tier thresholds" description="Inclusive score ranges" />
            <div className="grid gap-4 p-4 sm:grid-cols-3">
              {(['low', 'medium', 'high'] as const).map((k) => (
                <div key={k} className="rounded-md border border-border p-3">
                  <TierBadge tier={(k[0].toUpperCase() + k.slice(1)) as RiskTier} />
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <input type="number" className="input-base h-8 w-16" value={cfg.thresholds[k][0]} disabled={locked} onChange={(e) => setCfg({ ...cfg, thresholds: { ...cfg.thresholds, [k]: [Number(e.target.value), cfg.thresholds[k][1]] } })} aria-label={`${k} from`} />
                    <span className="text-subtle">to</span>
                    <input type="number" className="input-base h-8 w-16" value={cfg.thresholds[k][1]} disabled={locked} onChange={(e) => setCfg({ ...cfg, thresholds: { ...cfg.thresholds, [k]: [cfg.thresholds[k][0], Number(e.target.value)] } })} aria-label={`${k} to`} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Override rules" description="A hit jumps straight to the result tier, whatever the score" />
            <ul className="divide-y divide-border">
              {cfg.overrides.map((o) => (
                <li key={o.id} className="flex items-center gap-3 px-4 py-3">
                  <Switch checked={o.enabled} disabled={locked} onChange={(v) => setCfg({ ...cfg, overrides: cfg.overrides.map((x) => (x.id === o.id ? { ...x, enabled: v } : x)) })} label={o.rule} />
                  <span className={o.enabled ? 'flex-1 text-sm' : 'flex-1 text-sm text-subtle'}>{o.rule}</span>
                  <TierBadge tier={o.result} />
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <Card className="p-4">
            <p className="text-sm font-medium">Impact of these changes</p>
            <p className="mt-0.5 text-xs text-muted">Applied to {s.agents.length} agents before you save.</p>
            <div className="mt-4 space-y-3">
              <div>
                <p className="mb-1 text-xs text-subtle">Now</p>
                <SegmentBar label="Current tiers" segments={preview.dist.map((d) => ({ label: d.t, value: d.now, color: c.tier[d.t] }))} />
              </div>
              <div>
                <p className="mb-1 text-xs text-subtle">After save</p>
                <SegmentBar label="Tiers after save" segments={preview.dist.map((d) => ({ label: d.t, value: d.next, color: c.tier[d.t] }))} />
              </div>
              <Legend items={preview.dist.map((d) => ({ label: d.t, color: c.tier[d.t], value: d.now === d.next ? d.next : `${d.now}→${d.next}` }))} />
            </div>
            {preview.changed.length > 0 ? (
              <ul className="mt-4 space-y-1.5 border-t border-border pt-3 text-xs">
                {preview.changed.slice(0, 6).map(({ a }) => (
                  <li key={a.id} className="flex items-center justify-between gap-2"><span className="truncate">{a.name}</span><span className="shrink-0 text-muted">{a.tier} → {tierFor(a.signals, a, cfg).tier}</span></li>
                ))}
                <li className="pt-1 text-warning">Agents moving up a tier go back to review.</li>
              </ul>
            ) : (
              <p className="mt-4 border-t border-border pt-3 text-xs text-muted">No agent changes tier.</p>
            )}
            <div className="mt-4 flex gap-2">
              <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => setCfg(defaultRiskConfig)} disabled={locked}>Defaults</Button>
              <Button size="sm" variant="primary" icon={Save} className="flex-1" disabled={!dirty} disabledReason={locked ? reason('risk.configure') : undefined} onClick={() => { actions.updateRiskConfig(cfg); toast({ tone: 'success', title: 'Scoring rules saved', body: `${preview.changed.length} agents will be re-scored on the next run.` }); }}>
                Save rules
              </Button>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
