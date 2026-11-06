import type { State } from './store';
import type { Decision, PolicyCondition, RuntimePolicy } from './types';

export interface CheckInput {
  agentId: string;
  toolId: string;
  user: string;
  userRole: string;
  userGroups: string[];
  environment: 'prod' | 'staging' | 'dev';
  params: Record<string, string | number | boolean>;
}

export interface TraceStep {
  label: string;
  outcome: 'pass' | 'match' | 'skip' | 'stop' | 'monitor';
  detail: string;
  policyId?: string;
}

export interface CheckResult {
  decision: Decision;
  reason: string;
  policyId: string | null;
  mode: 'enforce' | 'monitor';
  latencyMs: number;
  trace: TraceStep[];
}

const SPECIFICITY = { agent: 4, tool: 3, role: 2, all: 1 } as const;
const STRENGTH: Record<Decision, number> = { block: 5, ask_human: 4, redact: 3, audit: 2, allow: 1 };

function resolve(field: string, ctx: Record<string, unknown>): unknown {
  return field.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), ctx);
}

function test(c: PolicyCondition, ctx: Record<string, unknown>): boolean {
  const actual = resolve(c.field, ctx);
  const negate = c.value.startsWith('!');
  const raw = negate ? c.value.slice(1) : c.value;
  const list = raw.split(',').map((x) => x.trim());
  let r: boolean;
  switch (c.op) {
    case '=': r = String(actual) === raw; break;
    case '≠': r = String(actual) !== raw; break;
    case '>': r = Number(actual) > Number(raw); break;
    case '<': r = Number(actual) < Number(raw); break;
    case 'in': r = list.includes(String(actual)); break;
    case 'contains': r = Array.isArray(actual) ? actual.map(String).includes(raw) : String(actual ?? '').toLowerCase().includes(raw.toLowerCase()); break;
    case 'regex':
      try { r = new RegExp(raw).test(String(actual ?? '')); } catch { r = false; }
      break;
    default: r = false;
  }
  return negate ? !r : r;
}

export function evaluate(s: Pick<State, 'agents' | 'tools' | 'agentRoles' | 'runtimePolicies' | 'mcpServers' | 'models'>, input: CheckInput): CheckResult {
  const t0 = performance.now();
  const trace: TraceStep[] = [];
  const agent = s.agents.find((a) => a.id === input.agentId)!;
  const tool = s.tools.find((t) => t.id === input.toolId)!;
  const role = s.agentRoles.find((r) => r.id === agent.agentRoleId);
  const mcp = s.mcpServers.find((m) => m.id === tool.mcpServerId);
  const model = s.models.find((m) => m.id === agent.modelIds[0]);
  const done = (decision: Decision, reason: string, policyId: string | null, mode: 'enforce' | 'monitor' = 'enforce'): CheckResult => ({
    decision, reason, policyId, mode, trace, latencyMs: Math.max(3, Math.round(performance.now() - t0 + 6 + trace.length * 1.5)),
  });

  if (agent.suspended) {
    trace.push({ label: 'Kill switch', outcome: 'stop', detail: 'Agent is suspended; every check returns block.' });
    return done('block', 'Agent suspended (kill switch)', null);
  }
  trace.push({ label: 'Kill switch', outcome: 'pass', detail: 'Agent is active.' });

  if (agent.lifecycle !== 'Approved' && agent.lifecycle !== 'Review overdue') {
    trace.push({ label: 'Approval before visibility', outcome: 'stop', detail: `Agent is ${agent.lifecycle}; only approved agents are served to SDK clients.` });
    return done('block', `Agent is not approved (${agent.lifecycle})`, null);
  }

  if (tool.quarantined) {
    trace.push({ label: 'Tool quarantine', outcome: 'stop', detail: `Schema hash changed (${tool.previousHash} → ${tool.schemaHash}); blocked until re-approved.` });
    return done('block', 'Tool quarantined: schema changed, awaiting re-approval', null);
  }
  trace.push({ label: 'Tool quarantine', outcome: 'pass', detail: 'Schema matches the approved hash.' });

  if (role) {
    if (!role.allowedToolIds.includes(tool.id)) {
      const explicit = s.runtimePolicies.find((p) => p.status === 'Active' && p.toolId === tool.id && p.decision === 'block' && (p.scope.kind === 'all' || p.scope.id === role.id));
      trace.push({ label: `Agent role: ${role.name}`, outcome: 'stop', detail: `${tool.name} is not in the role's allowed tools. Default for unmatched calls: block.` });
      return done('block', explicit?.reason ?? `${tool.name} is not allowed for role ${role.name}`, explicit?.id ?? null);
    }
    trace.push({ label: `Agent role: ${role.name}`, outcome: 'pass', detail: `${tool.name} is allowed for this role.` });
  } else {
    trace.push({ label: 'Agent role', outcome: 'skip', detail: 'No role assigned; policies only.' });
  }

  const ctx = {
    params: input.params,
    user: { id: input.user, role: input.userRole, groups: input.userGroups },
    environment: input.environment,
    agent: { id: agent.id, environment: input.environment === 'dev' ? 'dev' : 'prod', tier: agent.tier },
    tool: { name: tool.name, action: tool.actionType, mcp_server: { known: String(mcp?.known ?? true) } },
    model: { region: model?.region ?? '' },
    output: '',
  };

  const applicable = s.runtimePolicies
    .filter((p) => p.status === 'Active')
    .filter((p) => (p.toolId ? p.toolId === tool.id : true))
    .filter((p) => p.scope.kind === 'all' || (p.scope.kind === 'agent' && p.scope.id === agent.id) || (p.scope.kind === 'role' && p.scope.id === agent.agentRoleId) || (p.scope.kind === 'tool' && p.scope.id === tool.id))
    .filter((p) => p.type !== 'Content' && p.type !== 'Model access')
    .sort((a, b) => SPECIFICITY[b.scope.kind] - SPECIFICITY[a.scope.kind] || STRENGTH[b.decision] - STRENGTH[a.decision]);

  const matched: RuntimePolicy[] = [];
  for (const p of applicable) {
    const ok = p.conditions.every((c) => test(c, ctx));
    if (!ok) {
      trace.push({ label: p.name, outcome: 'skip', policyId: p.id, detail: `Conditions not met: ${p.conditions.map((c) => `${c.field} ${c.op} ${c.value}`).join(' and ') || 'none'}` });
      continue;
    }
    if (p.mode === 'monitor') {
      trace.push({ label: p.name, outcome: 'monitor', policyId: p.id, detail: `Would ${p.decision.replace('_', ' ')} — monitor mode logs only.` });
      matched.push(p);
      continue;
    }
    trace.push({ label: p.name, outcome: 'match', policyId: p.id, detail: `Matched → ${p.decision.replace('_', ' ')}` });
    matched.push(p);
  }

  const enforced = matched.filter((p) => p.mode === 'enforce').sort((a, b) => STRENGTH[b.decision] - STRENGTH[a.decision]);
  if (enforced.length) {
    const p = enforced[0];
    return done(p.decision, p.reason, p.id);
  }
  const monitored = matched.find((p) => p.mode === 'monitor');
  if (monitored) return done('audit', `Monitor: would ${monitored.decision.replace('_', ' ')} — ${monitored.reason}`, monitored.id, 'monitor');
  return done('allow', role ? `Allowed by role ${role.name}` : 'No policy matched; default allow', null);
}
