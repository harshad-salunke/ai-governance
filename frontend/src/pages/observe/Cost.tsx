import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, Pencil, Plus, TrendingUp } from 'lucide-react';
import { actions, useStore } from '../../data/store';
import { useLookup } from '../../lib/lookup';
import { usePermission } from '../../lib/rbac';
import { useToast } from '../../lib/toast';
import { useChartColors } from '../../lib/theme';
import { compact, dateOnly, downloadFile, moneyShort, num, toCsv } from '../../lib/format';
import { Badge, Button, Callout, Card, CardHeader, ChipSelect, DataTable, Field, Input, Meter, Modal, PageHeader, Segmented, Select, Stat } from '../../components/ui';
import { ChartTooltip, Legend, axisProps } from '../../components/charts';
import type { Budget } from '../../data/types';

const MODELS = ['GPT-4o', 'GPT-4.1', 'GPT-4o mini', 'Phi-4', 'Other'] as const;

export default function Cost() {
  const s = useStore((x) => x);
  const L = useLookup();
  const c = useChartColors();
  const { can, reason } = usePermission();
  const toast = useToast();
  const [unit, setUnit] = useState<'cost' | 'tokens'>('cost');
  const [edit, setEdit] = useState<Budget | null>(null);
  const total = s.dailyCost.reduce((n, d) => n + MODELS.reduce((m, k) => m + d[k], 0), 0);
  const tokens = s.dailyCost.reduce((n, d) => n + d.tokens, 0);
  const spikeDay = s.dailyCost[24];
  const topAgents = [...s.agents].sort((a, b) => b.cost30d - a.cost30d).slice(0, 8);
  const deny = can('budgets.manage') ? undefined : reason('budgets.manage');

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cost and budgets"
        description="Tokens from traces and Azure OpenAI usage, priced per model deployment. Budgets alert at 50 / 80 / 100% and can block at the limit."
        actions={
          <Button icon={Download} onClick={() => { downloadFile('chargeback.csv', toCsv(s.costByBu.map((b) => ({ business_unit: L.buName(b.bu), cost_centre: s.businessUnits.find((x) => x.id === b.bu)!.costCentre, cost_inr: b.cost, previous_inr: b.prev }))), 'text/csv'); toast({ tone: 'success', title: 'Chargeback exported', body: 'chargeback.csv by business unit and cost centre' }); }} disabledReason={can('reports.export') ? undefined : reason('reports.export')}>
            Chargeback CSV
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Spend, last 30 days" value={moneyShort(total)} sub="+8.4% vs previous 30 days" />
        <Stat label="Tokens, last 30 days" value={compact(tokens)} />
        <Stat label="Budgets over 80%" value={s.budgets.filter((b) => b.spent / b.limit >= 0.8).length} tone="warning" />
        <Stat label="Cost per resolved ticket" value="₹3.86" sub="Support Resolution Agent · outcome event" />
      </div>

      <Callout tone="warning" icon={TrendingUp} title={`Spend spike on ${dateOnly(spikeDay.date)}: GPT-4o ${moneyShort(spikeDay['GPT-4o'])}, 1.9× the daily normal`}>
        Traced to Refund Triage Agent retries during INC-229. Idempotency fix shipped the next day.
      </Callout>

      <Card>
        <CardHeader title="Daily usage by model" actions={<Segmented size="xs" value={unit} onChange={setUnit} options={[{ value: 'cost', label: '₹ cost' }, { value: 'tokens', label: 'Tokens' }]} />} />
        <div className="p-4">
          {unit === 'cost' && <Legend className="mb-3" items={MODELS.map((m, i) => ({ label: m, color: c.series[i] }))} />}
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={s.dailyCost} margin={{ left: -4, right: 4, top: 4 }} barCategoryGap={3}>
                <CartesianGrid vertical={false} stroke={c.grid} />
                <XAxis dataKey="date" {...axisProps(c.subtle)} tickFormatter={(d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} minTickGap={28} />
                <YAxis {...axisProps(c.subtle)} tickFormatter={(v) => (unit === 'cost' ? moneyShort(v) : compact(v))} width={56} />
                <Tooltip content={<ChartTooltip format={unit === 'cost' ? moneyShort : (v) => compact(v)} total labelFormat={(d) => dateOnly(d)} />} cursor={{ fill: c.grid, opacity: 0.4 }} />
                {unit === 'cost'
                  ? MODELS.map((m, i) => <Bar key={m} dataKey={m} stackId="a" fill={c.series[i]} stroke={c.surface} strokeWidth={1} radius={i === MODELS.length - 1 ? [4, 4, 0, 0] : 0} />)
                  : <Bar dataKey="tokens" name="Tokens" fill={c.primary} radius={[4, 4, 0, 0]} />}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="By business unit" description="30 days vs previous 30" />
          <DataTable
            rows={s.costByBu.map((b) => ({ ...b, id: b.bu }))}
            columns={[
              { key: 'b', header: 'Business unit', cell: (b) => L.buName(b.bu) },
              { key: 'cc', header: 'Cost centre', hideBelow: 'sm', cell: (b) => <span className="font-mono text-xs text-muted">{s.businessUnits.find((x) => x.id === b.bu)!.costCentre}</span> },
              { key: 'c', header: 'Cost', align: 'right', sort: (b) => b.cost, cell: (b) => moneyShort(b.cost) },
              { key: 'd', header: 'Change', align: 'right', sort: (b) => b.cost / b.prev, cell: (b) => { const d = ((b.cost - b.prev) / b.prev) * 100; return <span className={d > 10 ? 'text-danger' : d < 0 ? 'text-success' : 'text-muted'}>{d > 0 ? '+' : ''}{d.toFixed(1)}%</span>; } },
            ]}
          />
        </Card>
        <Card>
          <CardHeader title="Top agents by cost" />
          <DataTable
            rows={topAgents}
            columns={[
              { key: 'a', header: 'Agent', cell: (a) => a.name },
              { key: 'r', header: 'Runs 7d', align: 'right', hideBelow: 'sm', cell: (a) => compact(a.runs7d) },
              { key: 'c', header: 'Cost 30d', align: 'right', sort: (a) => a.cost30d, cell: (a) => moneyShort(a.cost30d) },
              { key: 'p', header: 'Per run', align: 'right', hideBelow: 'md', cell: (a) => (a.runs7d ? `₹${(a.cost30d / (a.runs7d * 4.3)).toFixed(2)}` : '—') },
            ]}
          />
        </Card>
      </div>

      <Card>
        <CardHeader title="Budgets" description="Owner and FinOps manager are alerted at each threshold" actions={<Button size="sm" variant="primary" icon={Plus} disabledReason={deny} onClick={() => setEdit({ id: `bg-${s.budgets.length + 1}`, name: '', scope: 'agent', scopeId: 'ag-support', limit: 50000, spent: 0, period: 'Monthly', unit: 'INR', action: 'Alert only', alerts: [50, 80, 100] })}>New budget</Button>} />
        <ul className="divide-y divide-border">
          {s.budgets.map((b) => {
            const p = (b.spent / b.limit) * 100;
            const fmt = (n: number) => (b.unit === 'INR' ? moneyShort(n) : `${compact(n)} tokens`);
            return (
              <li key={b.id} className="grid items-center gap-3 px-4 py-3 md:grid-cols-[1.4fr_2fr_auto]">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{b.name}</p>
                  <p className="text-xs text-subtle">{b.scope === 'agent' ? 'Agent' : b.scope === 'team' ? 'Business unit' : 'Model'} · {b.period} · at limit: {b.action}</p>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="tabular">{fmt(b.spent)} <span className="text-subtle">of {fmt(b.limit)}</span></span>
                    <span className={p >= 100 ? 'font-semibold text-danger' : p >= 80 ? 'text-warning' : 'text-muted'}>{num(Math.round(p))}%</span>
                  </div>
                  <div className="relative">
                    <Meter value={b.spent} max={b.limit} tone="auto" label={`${b.name} budget`} />
                    {b.alerts.filter((a) => a < 100).map((a) => <span key={a} className="absolute top-[-2px] h-2.5 w-px bg-fg/40" style={{ left: `${a}%` }} aria-hidden />)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {p >= 100 && b.action === 'Block' && <Badge tone="danger">Blocking</Badge>}
                  <Button size="xs" variant="ghost" icon={Pencil} onClick={() => setEdit(b)} disabledReason={deny}>Edit</Button>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {edit && <BudgetModal key={edit.id} budget={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function BudgetModal({ budget, onClose }: { budget: Budget; onClose: () => void }) {
  const s = useStore((x) => x);
  const toast = useToast();
  const [b, setB] = useState(budget);
  const scopes = b.scope === 'agent' ? s.agents : b.scope === 'team' ? s.businessUnits : s.models;
  return (
    <Modal
      open
      onClose={onClose}
      title={budget.name ? `Edit ${budget.name}` : 'New budget'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!b.name.trim() || b.limit <= 0} onClick={() => { actions.saveBudget(b); toast({ tone: 'success', title: 'Budget saved' }); onClose(); }}>Save budget</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" className="sm:col-span-2" htmlFor="bn"><Input id="bn" value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} /></Field>
        <Field label="Scope" htmlFor="bs">
          <Select id="bs" value={b.scope} onChange={(e) => { const sc = e.target.value as Budget['scope']; setB({ ...b, scope: sc, scopeId: (sc === 'agent' ? s.agents : sc === 'team' ? s.businessUnits : s.models)[0].id }); }}>
            <option value="agent">Agent</option><option value="team">Business unit</option><option value="model">Model</option>
          </Select>
        </Field>
        <Field label="Applies to" htmlFor="bsi"><Select id="bsi" value={b.scopeId} onChange={(e) => setB({ ...b, scopeId: e.target.value })}>{scopes.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></Field>
        <Field label="Limit" htmlFor="bl"><Input id="bl" type="number" value={b.limit} onChange={(e) => setB({ ...b, limit: Number(e.target.value) })} /></Field>
        <Field label="Unit"><Segmented value={b.unit} onChange={(v) => setB({ ...b, unit: v })} options={[{ value: 'INR', label: '₹' }, { value: 'tokens', label: 'Tokens' }]} /></Field>
        <Field label="Period"><Segmented value={b.period} onChange={(v) => setB({ ...b, period: v })} options={[{ value: 'Monthly', label: 'Monthly' }, { value: 'Quarterly', label: 'Quarterly' }]} /></Field>
        <Field label="At the limit" htmlFor="ba"><Select id="ba" value={b.action} onChange={(e) => setB({ ...b, action: e.target.value as Budget['action'] })}><option>Alert only</option><option>Require approval</option><option>Block</option></Select></Field>
        <Field label="Alert at" className="sm:col-span-2">
          <ChipSelect values={b.alerts.map(String)} onChange={(v) => setB({ ...b, alerts: v.map(Number).sort((x, y) => x - y) })} options={['50', '80', '90', '100'].map((x) => ({ value: x, label: `${x}%` }))} />
        </Field>
      </div>
    </Modal>
  );
}
