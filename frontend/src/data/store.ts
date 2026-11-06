import { useSyncExternalStore } from 'react';
import type {
  Agent,
  ApiKey,
  AuditEvent,
  Connector,
  ExceptionGrant,
  Incident,
  RiskRuleConfig,
  RiskTier,
  RoleKey,
  RuntimePolicy,
} from './types';
import { businessUnits, users } from './mock/org';
import { agents, applications, dataSources, lineage, mcpServers, models, tools } from './mock/inventory';
import {
  approvals,
  checklistTemplates,
  claims,
  connectors,
  controls,
  duplicates,
  evidence,
  exceptions,
  governancePolicies,
  governanceViolations,
  incidents,
  orphans,
  reviews,
  riskAssessments,
  shadowHints,
  transfers,
  workflows,
} from './mock/governance';
import { agentRoles, approvalTasks, decisions, runtimePolicies, runtimeStats } from './mock/runtime';
import {
  apiKeys,
  auditEvents,
  budgets,
  costByBu,
  customFields,
  dailyCost,
  notifications,
  reportSchedules,
  reportTemplates,
  traces,
} from './mock/observe';
import { defaultRiskConfig } from './risk';
import { NOW } from './seed';

// ---------------------------------------------------------------- state
const initial = {
  businessUnits,
  users,
  agents,
  applications,
  models,
  tools,
  mcpServers,
  dataSources,
  lineage,
  connectors,
  riskAssessments,
  riskConfig: defaultRiskConfig as RiskRuleConfig,
  controls,
  checklistTemplates,
  evidence,
  workflows,
  approvals,
  governancePolicies,
  governanceViolations,
  reviews,
  exceptions,
  incidents,
  duplicates,
  shadowHints,
  claims,
  orphans,
  transfers,
  agentRoles,
  runtimePolicies,
  decisions,
  approvalTasks,
  runtimeStats,
  traces,
  dailyCost,
  costByBu,
  budgets,
  auditEvents,
  reportTemplates,
  reportSchedules,
  apiKeys,
  customFields,
  notifications,
  notificationPrefs: {
    email: true,
    teams: true,
    digest: 'daily' as 'off' | 'daily' | 'weekly',
    events: { approvals: true, violations: true, incidents: true, scans: false, budgets: true, reviews: true } as Record<string, boolean>,
  },
  session: loadSession(),
};

export type State = typeof initial;

interface Session {
  signedIn: boolean;
  userId: string;
  activeRole: RoleKey;
  buScope: string; // 'all' or a business unit id
}

function loadSession(): Session {
  const fallback: Session = { signedIn: false, userId: 'u-harshad', activeRole: 'governance_lead', buScope: 'all' };
  try {
    const raw = localStorage.getItem('dgc.session');
    const saved = raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
    // Discard a saved session that no longer matches the demo data.
    const user = users.find((u) => u.id === saved.userId && u.status === 'active');
    if (!user) return fallback;
    const buOk = saved.buScope === 'all' || businessUnits.some((b) => b.id === saved.buScope);
    return { ...saved, buScope: buOk ? saved.buScope : 'all' };
  } catch {
    return fallback;
  }
}

let state: State = initial;
const listeners = new Set<() => void>();

function set(updater: (s: State) => Partial<State>) {
  state = { ...state, ...updater(state) };
  try {
    localStorage.setItem('dgc.session', JSON.stringify(state.session));
  } catch {
    /* storage may be unavailable */
  }
  listeners.forEach((l) => l());
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

// The snapshot is the whole (immutable) state object, so selectors may derive
// new arrays freely without breaking useSyncExternalStore's identity check.
export function useStore<T>(selector: (s: State) => T): T {
  const snapshot = useSyncExternalStore(subscribe, () => state);
  return selector(snapshot);
}

export const getState = () => state;

// ---------------------------------------------------------------- helpers
let clock = 0;
const now = () => new Date(NOW + ++clock * 1000).toISOString();

function chainHash(input: string) {
  // Small non-cryptographic hash used only to make the demo chain look real.
  let h1 = 0x811c9dc5;
  let out = '';
  for (let round = 0; round < 8; round++) {
    for (let i = 0; i < input.length; i++) {
      h1 ^= input.charCodeAt(i) + round;
      h1 = Math.imul(h1, 16777619);
    }
    out += (h1 >>> 0).toString(16).padStart(8, '0');
  }
  return out;
}

function audit(s: State, e: Omit<AuditEvent, 'id' | 'hash' | 'prevHash' | 'at' | 'actor'> & { actor?: AuditEvent['actor'] }): AuditEvent[] {
  const prevHash = s.auditEvents[0]?.hash ?? '0'.repeat(64);
  const at = now();
  const actor = e.actor ?? s.session.userId;
  const hash = chainHash(prevHash + at + actor + e.action + e.objectId);
  return [{ ...e, actor, at, id: `aud-${2000 + s.auditEvents.length}`, hash, prevHash }, ...s.auditEvents];
}

const patch = <T extends { id: string }>(list: T[], id: string, p: Partial<T> | ((x: T) => Partial<T>)) =>
  list.map((x) => (x.id === id ? { ...x, ...(typeof p === 'function' ? p(x) : p) } : x));

// ---------------------------------------------------------------- actions
export const actions = {
  signIn(userId: string) {
    const u = state.users.find((x) => x.id === userId)!;
    set((s) => ({ session: { ...s.session, signedIn: true, userId, activeRole: u.roles[0] } }));
  },
  signOut() {
    set((s) => ({ session: { ...s.session, signedIn: false } }));
  },
  setRole(role: RoleKey) {
    set((s) => ({ session: { ...s.session, activeRole: role } }));
  },
  setBuScope(buScope: string) {
    set((s) => ({ session: { ...s.session, buScope } }));
  },

  // approvals
  decideApproval(id: string, decision: 'approved' | 'rejected' | 'changes', comment: string) {
    set((s) => {
      const req = s.approvals.find((a) => a.id === id)!;
      const steps = req.steps.map((st, i) =>
        i === req.currentStep ? { ...st, decision, at: now(), comment, approver: st.approver ?? s.session.userId } : st,
      );
      const last = req.currentStep >= steps.length - 1;
      let status = req.status;
      let currentStep = req.currentStep;
      if (decision === 'rejected') status = 'Rejected';
      else if (decision === 'changes') status = 'Changes requested';
      else if (last) status = 'Approved';
      else {
        currentStep += 1;
        steps[currentStep] = { ...steps[currentStep], decision: 'pending' };
      }
      let agentsNext = s.agents;
      let toolsNext = s.tools;
      let policiesNext = s.runtimePolicies;
      if (status === 'Approved') {
        if (req.objectKind === 'agent' && s.agents.some((a) => a.id === req.objectId))
          agentsNext = patch(s.agents, req.objectId, { lifecycle: 'Approved', change: null });
        if (req.objectKind === 'tool') toolsNext = patch(s.tools, req.objectId, { approved: true, quarantined: false, change: null });
        if (req.objectId.startsWith('pol-')) policiesNext = patch(s.runtimePolicies, req.objectId, { status: 'Active', mode: 'monitor' });
      }
      if (status === 'Changes requested' && req.objectKind === 'agent') agentsNext = patch(s.agents, req.objectId, { lifecycle: 'Draft' });
      return {
        approvals: patch(s.approvals, id, { steps, status, currentStep }),
        agents: agentsNext,
        tools: toolsNext,
        runtimePolicies: policiesNext,
        auditEvents: audit(s, { action: `approval.${decision === 'changes' ? 'changes_requested' : decision}`, objectKind: 'Approval', objectId: id, objectName: req.title, after: comment || undefined }),
      };
    });
  },

  // ownership
  claimAgent(agentId: string) {
    set((s) => ({
      claims: [{ id: `cl-${s.claims.length + 1}`, agentId, claimant: s.session.userId, at: now(), status: 'Pending admin' as const }, ...s.claims],
      auditEvents: audit(s, { action: 'ownership.claimed', objectKind: 'Agent', objectId: agentId, objectName: s.agents.find((a) => a.id === agentId)?.name ?? agentId }),
    }));
  },
  resolveClaim(claimId: string, confirm: boolean) {
    set((s) => {
      const c = s.claims.find((x) => x.id === claimId)!;
      const agent = s.agents.find((a) => a.id === c.agentId)!;
      return {
        claims: patch(s.claims, claimId, { status: confirm ? 'Confirmed' : 'Rejected' }),
        agents: confirm ? patch(s.agents, c.agentId, { owner: c.claimant, managed: true }) : s.agents,
        transfers: confirm ? [{ id: `tr-${s.transfers.length + 1}`, objectId: c.agentId, from: null, to: c.claimant, reason: 'Claimed after discovery', at: now(), by: s.session.userId }, ...s.transfers] : s.transfers,
        auditEvents: audit(s, { action: confirm ? 'ownership.claim_confirmed' : 'ownership.claim_rejected', objectKind: 'Agent', objectId: c.agentId, objectName: agent.name }),
      };
    });
  },
  transferOwnership(objectId: string, to: string, reason: string) {
    set((s) => {
      const agent = s.agents.find((a) => a.id === objectId);
      return {
        agents: agent ? patch(s.agents, objectId, { owner: to, managed: true }) : s.agents,
        orphans: s.orphans.filter((o) => o.agentId !== objectId),
        transfers: [{ id: `tr-${s.transfers.length + 1}`, objectId, from: agent?.owner ?? null, to, reason, at: now(), by: s.session.userId }, ...s.transfers],
        auditEvents: audit(s, { action: 'ownership.transferred', objectKind: 'Agent', objectId, objectName: agent?.name ?? objectId, after: s.users.find((u) => u.id === to)?.name }),
      };
    });
  },
  setLifecycle(agentId: string, lifecycle: Agent['lifecycle']) {
    set((s) => ({
      agents: patch(s.agents, agentId, { lifecycle }),
      auditEvents: audit(s, { action: 'agent.lifecycle_changed', objectKind: 'Agent', objectId: agentId, objectName: s.agents.find((a) => a.id === agentId)!.name, after: lifecycle }),
    }));
  },
  resolveDuplicate(id: string, status: 'Merged' | 'Dismissed') {
    set((s) => ({ duplicates: patch(s.duplicates, id, { status }) }));
  },

  // registration
  registerAgent(a: Agent) {
    set((s) => ({
      agents: [a, ...s.agents],
      lineage: [
        ...s.lineage,
        ...(a.applicationId ? [{ id: `e-m${s.lineage.length}`, from: a.applicationId, to: a.id, relation: 'contains' as const, source: 'manual' as const }] : []),
        ...a.modelIds.map((m, i) => ({ id: `e-m${s.lineage.length}-m${i}`, from: a.id, to: m, relation: 'uses' as const, source: 'manual' as const })),
        ...a.toolIds.map((t, i) => ({ id: `e-m${s.lineage.length}-t${i}`, from: a.id, to: t, relation: 'calls' as const, source: 'manual' as const })),
        ...a.dataSourceIds.map((d, i) => ({ id: `e-m${s.lineage.length}-d${i}`, from: a.id, to: d, relation: 'reads' as const, source: 'manual' as const })),
      ],
      auditEvents: audit(s, { action: 'agent.registered', objectKind: 'Agent', objectId: a.id, objectName: a.name, after: `tier: ${a.tier}` }),
    }));
  },

  // catalog metadata
  editAsset(kind: string, id: string, p: { description?: string; owner?: string | null; tags?: string[] }) {
    set((s) => {
      const name = [...s.agents, ...s.applications, ...s.tools, ...s.mcpServers, ...s.dataSources, ...s.models].find((x) => x.id === id)?.name ?? id;
      const next: Partial<State> = {};
      if (kind === 'agent') next.agents = patch(s.agents, id, { ...(p.description !== undefined && { description: p.description }), ...(p.owner !== undefined && { owner: p.owner, managed: p.owner ? true : undefined }), ...(p.tags && { tags: p.tags }), updatedAt: now() } as Partial<Agent>);
      if (kind === 'application') next.applications = patch(s.applications, id, { ...(p.description !== undefined && { description: p.description }), ...(p.owner && { owner: p.owner }), updatedAt: now() });
      if (kind === 'tool') next.tools = patch(s.tools, id, { ...(p.description !== undefined && { description: p.description }), ...(p.owner !== undefined && { owner: p.owner }), updatedAt: now() });
      if (kind === 'mcp') next.mcpServers = patch(s.mcpServers, id, { ...(p.owner !== undefined && { owner: p.owner }), updatedAt: now() });
      if (kind === 'data') next.dataSources = patch(s.dataSources, id, { ...(p.owner !== undefined && { owner: p.owner }), updatedAt: now() });
      return { ...next, auditEvents: audit(s, { action: 'asset.updated', objectKind: kind, objectId: id, objectName: name }) };
    });
  },

  // lineage
  addEdge(from: string, to: string, relation: State['lineage'][number]['relation']) {
    set((s) => ({
      lineage: [...s.lineage, { id: `e-man-${s.lineage.length + 1}`, from, to, relation, source: 'manual' as const }],
      auditEvents: audit(s, { action: 'lineage.edge_added', objectKind: 'Lineage edge', objectId: from, objectName: `${from} → ${to}`, after: relation }),
    }));
  },
  removeEdge(id: string) {
    set((s) => {
      const e = s.lineage.find((x) => x.id === id)!;
      return { lineage: s.lineage.filter((x) => x.id !== id), auditEvents: audit(s, { action: 'lineage.edge_removed', objectKind: 'Lineage edge', objectId: e.from, objectName: `${e.from} → ${e.to}` }) };
    });
  },

  // connectors
  scanConnector(id: string) {
    set((s) => ({ connectors: patch(s.connectors, id, { status: 'healthy' as const, lastRun: now(), errors: [], newItems: 0 }), auditEvents: audit(s, { actor: 'system', action: 'connector.scan_completed', objectKind: 'Connector', objectId: id, objectName: s.connectors.find((c) => c.id === id)!.name }) }));
  },
  addConnector(c: Connector) {
    set((s) => ({ connectors: [...s.connectors, c], auditEvents: audit(s, { action: 'connector.created', objectKind: 'Connector', objectId: c.id, objectName: c.name }) }));
  },
  toggleConnectorPause(id: string) {
    set((s) => ({ connectors: patch(s.connectors, id, (c) => ({ status: c.status === 'paused' ? ('healthy' as const) : ('paused' as const) })) }));
  },

  // risk & controls
  updateRiskConfig(cfg: RiskRuleConfig) {
    set((s) => ({ riskConfig: cfg, auditEvents: audit(s, { action: 'risk_rules.updated', objectKind: 'Risk rules', objectId: 'rr', objectName: 'Risk rules' }) }));
  },
  adjustTier(agentId: string, tier: RiskTier, reason: string) {
    set((s) => {
      const a = s.agents.find((x) => x.id === agentId)!;
      const cur = s.riskAssessments.find((r) => r.agentId === agentId)!;
      return {
        agents: patch(s.agents, agentId, { tier }),
        riskAssessments: [{ ...cur, id: `ra-${agentId}-v${cur.version + 1}`, version: cur.version + 1, tier, status: 'Adjusted' as const, adjustedReason: reason, reviewer: s.session.userId, createdAt: now() }, ...s.riskAssessments],
        auditEvents: audit(s, { action: 'risk.tier_adjusted', objectKind: 'Agent', objectId: agentId, objectName: a.name, before: a.tier, after: `${tier} — ${reason}` }),
      };
    });
  },
  setEvidenceStatus(id: string, status: 'Accepted' | 'Rejected' | 'Submitted') {
    set((s) => ({ evidence: patch(s.evidence, id, { status, reviewer: s.session.userId, submittedAt: status === 'Submitted' ? now() : s.evidence.find((e) => e.id === id)!.submittedAt }) }));
  },
  toggleGovPolicy(id: string) {
    set((s) => ({ governancePolicies: patch(s.governancePolicies, id, (p) => ({ enabled: !p.enabled })) }));
  },

  // exceptions & incidents
  grantException(e: ExceptionGrant) {
    set((s) => ({ exceptions: [e, ...s.exceptions], auditEvents: audit(s, { action: 'exception.granted', objectKind: 'Exception', objectId: e.id, objectName: s.agents.find((a) => a.id === e.agentId)!.name }) }));
  },
  revokeException(id: string) {
    set((s) => ({ exceptions: patch(s.exceptions, id, { status: 'Revoked' }) }));
  },
  saveIncident(i: Incident) {
    set((s) => {
      const exists = s.incidents.some((x) => x.id === i.id);
      return {
        incidents: exists ? patch(s.incidents, i.id, i) : [i, ...s.incidents],
        auditEvents: audit(s, { action: exists ? 'incident.updated' : 'incident.opened', objectKind: 'Incident', objectId: i.id, objectName: i.key, after: i.status }),
      };
    });
  },

  // runtime
  setSuspended(agentId: string, suspended: boolean, reason = '') {
    set((s) => {
      const a = s.agents.find((x) => x.id === agentId)!;
      return {
        agents: patch(s.agents, agentId, { suspended, lifecycle: suspended ? 'Suspended' : 'Approved' }),
        auditEvents: audit(s, { action: suspended ? 'agent.suspended' : 'agent.resumed', objectKind: 'Agent', objectId: agentId, objectName: a.name, before: a.lifecycle, after: suspended ? `Suspended${reason ? ` — ${reason}` : ''}` : 'Approved' }),
      };
    });
  },
  setPolicyMode(id: string, mode: RuntimePolicy['mode']) {
    set((s) => {
      const p = s.runtimePolicies.find((x) => x.id === id)!;
      return {
        runtimePolicies: patch(s.runtimePolicies, id, { mode, updatedAt: now() }),
        auditEvents: audit(s, { action: 'policy.mode_changed', objectKind: 'Runtime policy', objectId: id, objectName: p.name, before: p.mode, after: mode }),
      };
    });
  },
  savePolicy(p: RuntimePolicy, note: string) {
    set((s) => {
      const existing = s.runtimePolicies.find((x) => x.id === p.id);
      const version = existing ? existing.version + 1 : 1;
      const next: RuntimePolicy = { ...p, version, updatedAt: now(), history: [...(existing?.history ?? []), { version, at: now(), by: s.session.userId, note }] };
      return {
        runtimePolicies: existing ? patch(s.runtimePolicies, p.id, next) : [next, ...s.runtimePolicies],
        auditEvents: audit(s, { action: existing ? 'policy.updated' : 'policy.created', objectKind: 'Runtime policy', objectId: p.id, objectName: p.name, before: existing ? `v${existing.version}` : undefined, after: `v${version}` }),
      };
    });
  },
  submitPolicyForApproval(p: RuntimePolicy, conversation: string) {
    actions.savePolicy({ ...p, status: 'Pending approval', mode: 'monitor' }, 'Drafted with PolicyPilot');
    set((s) => ({
      approvals: [
        {
          id: `apr-${1050 + s.approvals.length}`, objectId: p.id, objectKind: 'agent', title: `Policy draft: ${p.name}`, workflowId: 'wf-med', requestedBy: s.session.userId, requestedAt: now(), dueAt: new Date(NOW + 86_400_000).toISOString(), currentStep: 0, status: 'Pending',
          reason: conversation, steps: [{ name: 'Security admin', approver: 'u-vikram', role: 'Security admin', decision: 'pending' }], controlsReady: 0, controlsTotal: 0,
        },
        ...s.approvals,
      ],
    }));
  },
  releaseQuarantine(toolId: string) {
    set((s) => ({
      tools: patch(s.tools, toolId, { quarantined: false, approved: true, change: null }),
      auditEvents: audit(s, { action: 'tool.released', objectKind: 'Tool', objectId: toolId, objectName: s.tools.find((t) => t.id === toolId)!.name }),
    }));
  },
  decideTask(id: string, status: 'Approved' | 'Denied') {
    set((s) => {
      const t = s.approvalTasks.find((x) => x.id === id)!;
      return {
        approvalTasks: patch(s.approvalTasks, id, { status }),
        auditEvents: audit(s, { action: `runtime.task_${status.toLowerCase()}`, objectKind: 'Approval task', objectId: t.decisionId, objectName: `${s.tools.find((x) => x.id === t.toolId)!.name} · ${t.user}` }),
      };
    });
  },
  saveRole(roleId: string, p: Partial<State['agentRoles'][number]>) {
    set((s) => ({ agentRoles: patch(s.agentRoles, roleId, p), auditEvents: audit(s, { action: 'agent_role.updated', objectKind: 'Agent role', objectId: roleId, objectName: s.agentRoles.find((r) => r.id === roleId)!.name }) }));
  },

  // observe & admin
  saveBudget(b: State['budgets'][number]) {
    set((s) => ({ budgets: s.budgets.some((x) => x.id === b.id) ? patch(s.budgets, b.id, b) : [...s.budgets, b] }));
  },
  toggleSchedule(id: string) {
    set((s) => ({ reportSchedules: patch(s.reportSchedules, id, (r) => ({ enabled: !r.enabled })) }));
  },
  createApiKey(k: ApiKey) {
    set((s) => ({ apiKeys: [k, ...s.apiKeys], auditEvents: audit(s, { action: 'api_key.created', objectKind: 'API key', objectId: k.id, objectName: k.name }) }));
  },
  revokeApiKey(id: string) {
    set((s) => ({ apiKeys: patch(s.apiKeys, id, { status: 'Revoked' }), auditEvents: audit(s, { action: 'api_key.revoked', objectKind: 'API key', objectId: id, objectName: s.apiKeys.find((k) => k.id === id)!.name }) }));
  },
  setUserRoles(userId: string, roles: RoleKey[]) {
    set((s) => {
      const u = s.users.find((x) => x.id === userId)!;
      return { users: patch(s.users, userId, { roles }), auditEvents: audit(s, { action: 'role.assigned', objectKind: 'User', objectId: userId, objectName: u.name, before: u.roles.join(', '), after: roles.join(', ') }) };
    });
  },
  addCustomField(f: State['customFields'][number]) {
    set((s) => ({ customFields: [...s.customFields, f] }));
  },
  removeCustomField(id: string) {
    set((s) => ({ customFields: s.customFields.filter((f) => f.id !== id) }));
  },
  setNotificationPrefs(p: Partial<State['notificationPrefs']>) {
    set((s) => ({ notificationPrefs: { ...s.notificationPrefs, ...p } }));
  },
  markAllRead() {
    set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) }));
  },
};
