import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '../../data/store';
import { useLookup } from '../../lib/lookup';
import { useChartColors } from '../../lib/theme';
import { compact, pct, relTime } from '../../lib/format';
import { NOW } from '../../data/seed';
import { Badge, Card, CardHeader, DataTable, FilterSelect, Mono, PageHeader, SearchInput, Toolbar } from '../../components/ui';
import { ChartTooltip, Legend, axisProps } from '../../components/charts';

export default function Traces() {
  const s = useStore((x) => x);
  const L = useLookup();
  const c = useChartColors();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [agent, setAgent] = useState('all');
  const [status, setStatus] = useState('all');
  const rows = s.traces.filter((t) => (agent === 'all' || t.agentId === agent) && (status === 'all' || t.status === status) && (!q || `${t.userMessage} ${t.user} ${t.id}`.toLowerCase().includes(q.toLowerCase())));

  // Per-agent metrics (P4-OBS-03)
  const metrics = useMemo(() => {
    const by = new Map<string, typeof s.traces>();
    s.traces.forEach((t) => by.set(t.agentId, [...(by.get(t.agentId) ?? []), t]));
    return [...by.entries()].map(([id, ts]) => {
      const d = ts.map((t) => t.durationMs).sort((a, b) => a - b);
      return {
        id,
        runs: L.agent(id)!.runs7d,
        errors: (ts.filter((t) => t.status === 'error').length / ts.length) * 100,
        blocks: (ts.filter((t) => t.status === 'blocked').length / ts.length) * 100,
        p50: d[Math.floor(d.length * 0.5)],
        p95: d[Math.min(d.length - 1, Math.floor(d.length * 0.95))],
        tools: ts.reduce((n, t) => n + t.spans.filter((x) => x.kind === 'tool').length, 0) / ts.length,
      };
    });
  }, [s.traces, L]);

  // Hourly latency, last 24 h, in one chart (single axis: milliseconds).
  const latency = Array.from({ length: 24 }, (_, i) => {
    const h = new Date(NOW - (23 - i) * 3_600_000);
    const base = 1800 + Math.sin(i / 3) * 300;
    return { hour: `${String(h.getHours()).padStart(2, '0')}:00`, p50: Math.round(base), p95: Math.round(base * 1.9 + (i === 17 ? 2400 : 0)) };
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Traces" description="Each run end to end: the user message, LLM calls, tool calls, policy decisions and the final answer. Prompts are captured with PII redacted." />
      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <CardHeader title="Run latency, last 24 hours" description="All agents" />
          <div className="p-4">
            <Legend className="mb-2" items={[{ label: 'p50', color: c.series[0] }, { label: 'p95', color: c.series[1] }]} />
            <div className="h-48">
              <ResponsiveContainer>
                <LineChart data={latency} margin={{ left: -8, right: 4, top: 4 }}>
                  <CartesianGrid vertical={false} stroke={c.grid} />
                  <XAxis dataKey="hour" {...axisProps(c.subtle)} interval={5} />
                  <YAxis {...axisProps(c.subtle)} tickFormatter={(v) => `${(v / 1000).toFixed(1)}s`} width={44} />
                  <Tooltip content={<ChartTooltip format={(v) => `${(v / 1000).toFixed(2)} s`} />} cursor={{ stroke: c.border }} />
                  <Line dataKey="p50" name="p50" stroke={c.series[0]} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: c.surface }} />
                  <Line dataKey="p95" name="p95" stroke={c.series[1]} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: c.surface }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-warning">Drift alert at {latency[17].hour}: p95 above 2× the 7-day normal for Support Resolution Agent.</p>
          </div>
        </Card>
        <Card className="xl:col-span-3">
          <CardHeader title="Per-agent metrics" description="Sampled traces, last 36 hours" />
          <DataTable
            rows={metrics}
            dense
            columns={[
              { key: 'a', header: 'Agent', cell: (m) => <span className="whitespace-nowrap">{L.agentName(m.id)}</span> },
              { key: 'r', header: 'Runs 7d', align: 'right', sort: (m) => m.runs, cell: (m) => compact(m.runs) },
              { key: 'p', header: 'p50 / p95', align: 'right', cell: (m) => <span className="whitespace-nowrap">{(m.p50 / 1000).toFixed(1)} / {(m.p95 / 1000).toFixed(1)} s</span> },
              { key: 't', header: 'Tools / run', align: 'right', hideBelow: 'md', cell: (m) => m.tools.toFixed(1) },
              { key: 'e', header: 'Errors', align: 'right', sort: (m) => m.errors, cell: (m) => <span className={m.errors > 5 ? 'text-danger' : ''}>{pct(m.errors, 0)}</span> },
              { key: 'b', header: 'Blocked', align: 'right', sort: (m) => m.blocks, cell: (m) => <span className={m.blocks > 20 ? 'text-warning' : ''}>{pct(m.blocks, 0)}</span> },
            ]}
          />
        </Card>
      </div>

      <Card>
        <Toolbar>
          <SearchInput value={q} onChange={setQ} placeholder="Search message, user or trace ID" className="w-full sm:w-72" />
          <FilterSelect label="Agent" value={agent} onChange={setAgent} options={Array.from(new Set(s.traces.map((t) => t.agentId))).map((a) => ({ value: a, label: L.agentName(a) }))} />
          <FilterSelect label="Status" value={status} onChange={setStatus} options={[{ value: 'ok', label: 'OK' }, { value: 'blocked', label: 'Blocked' }, { value: 'error', label: 'Error' }]} />
        </Toolbar>
        <DataTable
          rows={rows}
          pageSize={15}
          onRowClick={(t) => navigate(`/observe/traces/${t.id}`)}
          columns={[
            { key: 'id', header: 'Trace', cell: (t) => <Mono>{t.id}</Mono> },
            { key: 'a', header: 'Agent', hideBelow: 'md', cell: (t) => <span className="whitespace-nowrap">{L.agentName(t.agentId)}</span> },
            { key: 'm', header: 'User message', cell: (t) => <span className="line-clamp-1 max-w-md">{t.userMessage}</span> },
            { key: 's', header: 'Status', cell: (t) => <Badge tone={t.status === 'ok' ? 'success' : t.status === 'blocked' ? 'warning' : 'danger'} dot>{t.status}</Badge> },
            { key: 'd', header: 'Duration', align: 'right', sort: (t) => t.durationMs, cell: (t) => `${(t.durationMs / 1000).toFixed(2)} s` },
            { key: 'tk', header: 'Tokens', align: 'right', hideBelow: 'lg', sort: (t) => t.tokensIn + t.tokensOut, cell: (t) => compact(t.tokensIn + t.tokensOut) },
            { key: 'c', header: 'Cost', align: 'right', hideBelow: 'lg', cell: (t) => `₹${t.cost.toFixed(2)}` },
            { key: 'at', header: 'Started', sort: (t) => t.startedAt, hideBelow: 'sm', cell: (t) => <span className="whitespace-nowrap text-muted">{relTime(t.startedAt)}</span> },
          ]}
        />
      </Card>
    </div>
  );
}
