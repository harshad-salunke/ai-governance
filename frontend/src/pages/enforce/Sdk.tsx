import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { useStore } from '../../data/store';
import { useLookup } from '../../lib/lookup';
import { compact, relTime } from '../../lib/format';
import { Badge, ButtonLink, Card, CardHeader, CodeBlock, DataTable, Mono, PageHeader, Select, Stat, Tabs } from '../../components/ui';
import { TierBadge } from '../../components/domain';

type Snip = 'quickstart' | 'mcp' | 'decorator' | 'langchain' | 'rest';

export default function Sdk() {
  const s = useStore((x) => x);
  const L = useLookup();
  const navigate = useNavigate();
  const [snip, setSnip] = useState<Snip>('quickstart');
  const [agentId, setAgentId] = useState('ag-support');
  const agent = L.agent(agentId)!;
  const slug = agent.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '');

  const code: Record<Snip, { lang: 'python' | 'bash' | 'json'; code: string }> = {
    quickstart: {
      lang: 'python',
      code: `# pip install dgcatalyst
from dgcatalyst import Catalyst

cat = Catalyst(agent_id="${slug}", client_secret=os.environ["DGC_SECRET"], region="centralindia")

# 1. Only give the LLM the tools this agent may use
tools = cat.allowed_tools(user="user@corp.com")

# 2. Check before running the tool the LLM picked
d = cat.check(user="user@corp.com", tool="issue_refund",
              params={"order_id": "ORD-123", "amount": 8000})

if d.decision == "allow":
    result = issue_refund(order_id="ORD-123", amount=8000)
elif d.decision == "ask_human":
    result = cat.wait_for_approval(d.decision_id, timeout=300)
else:
    result = f"Not allowed: {d.reason}"`,
    },
    mcp: {
      lang: 'python',
      code: `from dgcatalyst import Catalyst

cat = Catalyst(agent_id="${slug}", client_secret=os.environ["DGC_SECRET"])

# Every call_tool on this session is checked automatically.
session = cat.wrap(mcp_session, user="user@corp.com")
await session.call_tool("get_customer", {"customer_id": "C88213"})`,
    },
    decorator: {
      lang: 'python',
      code: `from dgcatalyst import Catalyst

cat = Catalyst(agent_id="${slug}", client_secret=os.environ["DGC_SECRET"],
               fail_mode="closed",   # block if the decision service is unreachable
               cache_ttl=10)         # seconds; last-known policies are cached locally

@cat.protect()
def issue_refund(order_id: str, amount: int):
    ...`,
    },
    langchain: {
      lang: 'python',
      code: `from dgcatalyst.integrations.langchain import CatalystCallbackHandler

agent = create_tool_calling_agent(llm, tools, prompt)
executor = AgentExecutor(agent=agent, tools=tools,
                         callbacks=[CatalystCallbackHandler(cat, user="user@corp.com")])

# Also available: dgcatalyst.integrations.langgraph, .openai_agents, .semantic_kernel`,
    },
    rest: {
      lang: 'json',
      code: `// POST /api/v1/runtime/check
{"agent_id": "${slug}", "user": "user@corp.com",
 "tool": "issue_refund", "params": {"order_id": "ORD-123", "amount": 8000},
 "run_id": "a1b2", "environment": "prod"}

// response
{"decision": "ask_human", "reason": "Refund above 5,000 needs approval",
 "policy_id": "pol-118", "decision_id": "dec_9f31", "mode": "enforce"}`,
    },
  };

  const managed = s.agents.filter((a) => a.managed && a.tier !== 'Low' && a.lifecycle !== 'Draft');
  const coverage = managed.filter((a) => a.sdkConnected).length / Math.max(1, managed.length);

  return (
    <div className="space-y-5">
      <PageHeader
        title="SDK and integrations"
        description="The dgcatalyst Python package checks every tool call against your policies. Fail-closed by default, with a short local cache."
        actions={<ButtonLink to="/admin/keys" variant="primary" icon={KeyRound}>Create agent credential</ButtonLink>}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Agents on the SDK" value={s.agents.filter((a) => a.sdkConnected).length} sub={`of ${s.agents.length} in inventory`} />
        <Stat label="Medium + High coverage" value={`${Math.round(coverage * 100)}%`} tone={coverage >= 0.8 ? 'success' : 'warning'} sub="Target above 80%" />
        <Stat label="Checks, 24 h" value={compact(s.runtimeStats.checks24h)} />
        <Stat label="p95 / p99" value={`${s.runtimeStats.p95} / ${s.runtimeStats.p99} ms`} tone="success" />
      </div>

      <Card>
        <CardHeader
          title="Add DG Catalyst to an agent"
          actions={
            <Select value={agentId} onChange={(e) => setAgentId(e.target.value)} aria-label="Agent for snippet" className="w-64">
              {s.agents.filter((a) => a.managed).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          }
        />
        <div className="px-4 pt-1">
          <Tabs value={snip} onChange={setSnip} items={[{ value: 'quickstart', label: 'Quickstart' }, { value: 'mcp', label: 'MCP session' }, { value: 'decorator', label: '@protect' }, { value: 'langchain', label: 'LangChain / LangGraph' }, { value: 'rest', label: 'REST' }]} />
        </div>
        <div className="p-4">
          <CodeBlock code={code[snip].code} lang={code[snip].lang} title={snip === 'rest' ? 'HTTP' : 'Python'} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Medium and High agents" description="Agents with traces but no checks are flagged — the SDK is a required control (SEC-01)." />
        <DataTable
          rows={managed}
          onRowClick={(a) => navigate(`/catalog/agent/${a.id}?tab=decisions`)}
          columns={[
            { key: 'n', header: 'Agent', sort: (a) => a.name, cell: (a) => <span className="font-medium">{a.name}</span> },
            { key: 't', header: 'Tier', cell: (a) => <TierBadge tier={a.tier} /> },
            { key: 'id', header: 'Agent ID', hideBelow: 'md', cell: (a) => <Mono>{a.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '')}</Mono> },
            { key: 's', header: 'SDK', sort: (a) => Number(a.sdkConnected), cell: (a) => (a.sdkConnected ? <Badge tone="success" dot>Connected</Badge> : <Badge tone="danger" dot>Not connected</Badge>) },
            { key: 'l', header: 'Last check', hideBelow: 'sm', cell: (a) => { const d = s.decisions.find((x) => x.agentId === a.id); return <span className="text-muted">{d ? relTime(d.at) : '—'}</span>; } },
            { key: 'r', header: 'Runs 7d', align: 'right', hideBelow: 'lg', cell: (a) => compact(a.runs7d) },
          ]}
        />
      </Card>
    </div>
  );
}
