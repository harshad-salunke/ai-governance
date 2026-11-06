import type {
  ApprovalRequest,
  Claim,
  Connector,
  Control,
  ControlEvidence,
  Duplicate,
  ExceptionGrant,
  GovernancePolicy,
  GovernanceViolation,
  Incident,
  Orphan,
  OwnershipTransfer,
  Review,
  RiskAssessment,
  ShadowHint,
  Workflow,
} from '../types';
import { daysAgo, hoursAgo, inDays, inHours, minsAgo, rng } from '../seed';
import { agents, tools } from './inventory';
import { factsFor, tierFor } from '../risk';

// ---------------------------------------------------------------- connectors
const hist = (seed: number, items: number, failEvery = 0) => {
  const r = rng(seed);
  return Array.from({ length: 14 }, (_, i) => ({
    at: daysAgo(13 - i),
    status: (failEvery && i % failEvery === failEvery - 1 ? 'failed' : r() > 0.9 ? 'warning' : 'healthy') as 'healthy' | 'warning' | 'failed',
    items: Math.max(0, Math.round(items * (0.85 + r() * 0.2) - (13 - i) * 0.3)),
    durationSec: Math.round(40 + r() * 80),
  }));
};

export const connectors: Connector[] = [
  { id: 'con-foundry', name: 'Foundry · prod-hub', type: 'Azure AI Foundry', scope: 'Subscription corp-ai-prod / 4 projects', credentialsRef: 'kv://dgc-prod/foundry-prod-sp', schedule: 'Every 24 h at 02:00 IST', lastRun: minsAgo(42), nextRun: inHours(15.5), status: 'healthy', itemsFound: 61, newItems: 2, errors: [], durationSec: 74, history: hist(1, 61) },
  { id: 'con-foundry-eu', name: 'Foundry · eu-hub', type: 'Azure AI Foundry', scope: 'Subscription corp-ai-eu / 1 project', credentialsRef: 'kv://dgc-prod/foundry-eu-sp', schedule: 'Every 24 h at 02:30 IST', lastRun: hoursAgo(8), nextRun: inHours(16), status: 'warning', itemsFound: 7, newItems: 1, errors: ['Project "eu-sandbox": 403 Forbidden — service principal lacks Azure AI Developer role'], durationSec: 38, history: hist(2, 7) },
  { id: 'con-fabric', name: 'Fabric · tenant', type: 'Microsoft Fabric', scope: '6 workspaces (lending, hr-analytics, finance, sales, cx, wealth)', credentialsRef: 'kv://dgc-prod/fabric-sp', schedule: 'Every 24 h at 03:00 IST', lastRun: hoursAgo(3), nextRun: inHours(16.5), status: 'healthy', itemsFound: 23, newItems: 1, errors: [], durationSec: 112, history: hist(3, 23) },
  { id: 'con-mcp', name: 'MCP · internal gateway', type: 'MCP server', scope: '5 servers on mcp.corp.internal', credentialsRef: 'kv://dgc-prod/mcp-gateway-token', schedule: 'Every 6 h', lastRun: minsAgo(42), nextRun: inHours(5.3), status: 'healthy', itemsFound: 23, newItems: 0, errors: [], durationSec: 19, history: hist(4, 23) },
  { id: 'con-copilot', name: 'Copilot Studio · default env', type: 'Copilot Studio', scope: 'Environments HR, Ops', credentialsRef: 'kv://dgc-prod/pp-sp', schedule: 'Every 24 h at 04:00 IST', lastRun: hoursAgo(6), nextRun: inHours(17.5), status: 'healthy', itemsFound: 5, newItems: 0, errors: [], durationSec: 51, history: hist(5, 5) },
  { id: 'con-bedrock', name: 'AWS Bedrock · ap-south-1', type: 'AWS Bedrock', scope: 'Account 4417-xxxx-2290', credentialsRef: 'kv://dgc-prod/aws-bedrock-role', schedule: 'Every 24 h at 05:00 IST', lastRun: hoursAgo(5), nextRun: inHours(18.5), status: 'failed', itemsFound: 3, newItems: 3, errors: ['AssumeRole failed: ExternalId mismatch for role dgc-readonly', 'Partial results from previous run retained'], durationSec: 9, history: hist(6, 3, 4) },
];

// ---------------------------------------------------------------- risk
const toolName = (id: string) => tools.find((t) => t.id === id)?.name ?? id;

export const riskAssessments: RiskAssessment[] = agents.flatMap((a, i) => {
  const { total, overrides } = tierFor(a.signals, a);
  const facts = factsFor(a, toolName);
  const status: RiskAssessment['status'] =
    !a.managed ? 'Auto-scored' : a.lifecycle === 'In review' ? 'Under review' : a.lifecycle === 'Draft' ? 'Owner confirmed' : i % 5 === 0 ? 'Adjusted' : 'Accepted';
  const current: RiskAssessment = {
    id: `ra-${a.id}-v3`, agentId: a.id, version: 3, signals: a.signals, facts, overrides, total, tier: a.tier,
    reviewer: a.managed ? 'u-meera' : null, status, adjustedReason: status === 'Adjusted' ? 'Exposure lowered: channel restricted to authenticated RMs only.' : undefined,
    createdAt: a.change === 'changed' ? hoursAgo(1) : daysAgo(5 + (i % 20)),
  };
  if (!a.managed || a.lifecycle === 'Draft') return [current];
  const prevSignals = { ...a.signals, actions: Math.max(1, a.signals.actions - (a.change === 'changed' ? 1 : 0)) as 1 | 2 | 3 };
  const prev = tierFor(prevSignals, { ...a, toolIds: a.change === 'changed' ? a.toolIds.filter((t) => t !== 't-issue_refund') : a.toolIds });
  return [
    current,
    { ...current, id: `ra-${a.id}-v2`, version: 2, signals: prevSignals, total: prev.total, tier: prev.tier, status: 'Accepted', createdAt: daysAgo(60 + i * 3), adjustedReason: undefined },
    { ...current, id: `ra-${a.id}-v1`, version: 1, signals: prevSignals, total: prev.total, tier: prev.tier, status: 'Accepted', createdAt: daysAgo(160 + i * 4), adjustedReason: undefined },
  ];
});

// ---------------------------------------------------------------- controls
export const controls: Control[] = [
  { id: 'c-owner', code: 'ACC-01', name: 'Named owner and sponsor', description: 'Agent has an active technical owner and business sponsor in Entra ID.', tiers: ['Low', 'Medium', 'High'], evidence: 'Auto-checked from inventory', category: 'Accountability' },
  { id: 'c-card', code: 'ACC-02', name: 'Agent card complete', description: 'Purpose, intended users, tools, data, model and autonomy are documented.', tiers: ['Low', 'Medium', 'High'], evidence: 'Auto-checked from agent card', category: 'Accountability' },
  { id: 'c-train', code: 'ACC-03', name: 'Owner trained on Responsible AI', description: 'Owner completed the Responsible AI course in the last 12 months.', tiers: ['Medium', 'High'], evidence: 'LMS completion certificate', category: 'Accountability' },
  { id: 'c-pii', code: 'DAT-01', name: 'PII masked in prompts and logs', description: 'Personal data is masked before prompts are logged or sent to telemetry.', tiers: ['Medium', 'High'], evidence: 'Config screenshot or test report', category: 'Data protection', addedBySignal: 'data' },
  { id: 'c-min', code: 'DAT-02', name: 'Data minimisation review', description: 'Only columns needed for the purpose are exposed to the agent.', tiers: ['High'], evidence: 'Signed data-access review', category: 'Data protection', addedBySignal: 'data' },
  { id: 'c-dpia', code: 'DAT-03', name: 'Privacy impact assessment', description: 'DPIA completed and signed by the privacy office.', tiers: ['High'], evidence: 'DPIA document', category: 'Data protection' },
  { id: 'c-hitl', code: 'HUM-01', name: 'Human approval for payments', description: 'Every payment or refund above the threshold needs human approval.', tiers: ['High'], evidence: 'Runtime policy of type Parameter rule', category: 'Human oversight', linkedPolicyType: 'Parameter rule', addedBySignal: 'actions' },
  { id: 'c-override', code: 'HUM-02', name: 'Human can override decisions', description: 'Affected people can request human review of any decision.', tiers: ['High'], evidence: 'Process document and UI screenshot', category: 'Human oversight', addedBySignal: 'impact' },
  { id: 'c-sdk', code: 'SEC-01', name: 'Runtime SDK on every tool call', description: 'Agent calls dgcatalyst.check before every tool call.', tiers: ['Medium', 'High'], evidence: 'Auto-checked from decision log', category: 'Security', linkedPolicyType: 'Tool access' },
  { id: 'c-redteam', code: 'SEC-02', name: 'Red-team test passed', description: 'Prompt-injection and jailbreak tests run in the last 6 months.', tiers: ['High'], evidence: 'Red-team report', category: 'Security' },
  { id: 'c-secrets', code: 'SEC-03', name: 'Secrets in Key Vault', description: 'No credentials in code or prompts; all secrets referenced from Key Vault.', tiers: ['Low', 'Medium', 'High'], evidence: 'Repo scan result', category: 'Security' },
  { id: 'c-eval', code: 'QLT-01', name: 'Evaluation scores above threshold', description: 'Groundedness ≥ 4.0 and relevance ≥ 4.0 on the Foundry evaluation set.', tiers: ['Medium', 'High'], evidence: 'Foundry evaluation run', category: 'Quality' },
];

export const checklistTemplates: Record<'Low' | 'Medium' | 'High', string[]> = {
  Low: controls.filter((c) => c.tiers.includes('Low')).map((c) => c.id),
  Medium: controls.filter((c) => c.tiers.includes('Medium')).map((c) => c.id),
  High: controls.filter((c) => c.tiers.includes('High')).map((c) => c.id),
};

const evR = rng(99);
export const evidence: ControlEvidence[] = agents
  .filter((a) => a.managed && a.tier !== 'Prohibited' && a.tier !== 'Unscored')
  .flatMap((a) => {
    const ids = checklistTemplates[a.tier as 'Low' | 'Medium' | 'High'];
    return ids.map((cid, i): ControlEvidence => {
      const c = controls.find((x) => x.id === cid)!;
      const auto = c.evidence.startsWith('Auto');
      let status: ControlEvidence['status'];
      if (a.lifecycle === 'Approved' || a.lifecycle === 'Suspended' || a.lifecycle === 'Deprecated') status = evR() > 0.06 ? 'Accepted' : 'Submitted';
      else if (a.lifecycle === 'In review') status = evR() > 0.45 ? 'Accepted' : evR() > 0.5 ? 'Submitted' : 'Missing';
      else if (a.lifecycle === 'Review overdue') status = evR() > 0.3 ? 'Accepted' : 'Rejected';
      else status = evR() > 0.7 ? 'Submitted' : 'Missing';
      if (auto && a.owner) status = 'Accepted';
      return {
        id: `ev-${a.id}-${cid}`,
        controlId: cid,
        agentId: a.id,
        kind: auto ? 'auto' : i % 3 === 0 ? 'link' : 'file',
        ref: auto ? 'Inventory check' : i % 3 === 0 ? `https://corp.sharepoint.com/sites/rai/${c.code.toLowerCase()}-${a.id}` : `${c.code}_${a.name.replace(/\W+/g, '_')}.pdf`,
        submittedBy: a.owner ?? 'system',
        submittedAt: daysAgo(2 + Math.floor(evR() * 40)),
        status,
        reviewer: status === 'Accepted' || status === 'Rejected' ? 'u-meera' : undefined,
      };
    });
  });

// ---------------------------------------------------------------- workflows + approvals
export const workflows: Workflow[] = [
  { id: 'wf-low', name: 'Low risk — owner sign-off', tier: 'Low', steps: [{ name: 'Owner attestation', approverRole: 'owner', mode: 'sequential', slaHours: 24 }, { name: 'Auto-approve when controls pass', approverRole: 'auto', mode: 'sequential', slaHours: 0 }] },
  { id: 'wf-med', name: 'Medium risk — sponsor + risk', tier: 'Medium', steps: [{ name: 'Business sponsor', approverRole: 'business_sponsor', mode: 'parallel', slaHours: 48 }, { name: 'Risk reviewer', approverRole: 'risk_reviewer', mode: 'parallel', slaHours: 72 }] },
  { id: 'wf-high', name: 'High risk — full committee', tier: 'High', steps: [{ name: 'Business sponsor', approverRole: 'business_sponsor', mode: 'sequential', slaHours: 48 }, { name: 'Risk reviewer', approverRole: 'risk_reviewer', mode: 'sequential', slaHours: 72 }, { name: 'AI governance lead', approverRole: 'governance_lead', mode: 'sequential', slaHours: 72 }] },
];

const ctlCount = (agentId: string) => {
  const ev = evidence.filter((e) => e.agentId === agentId);
  return { controlsReady: ev.filter((e) => e.status === 'Accepted').length, controlsTotal: ev.length };
};

export const approvals: ApprovalRequest[] = [
  {
    id: 'apr-1042', objectId: 'ag-refund', objectKind: 'agent', title: 'Refund Triage Agent v1.2.0', workflowId: 'wf-high', requestedBy: 'u-rahul', requestedAt: hoursAgo(26), dueAt: inHours(22), currentStep: 1, status: 'Pending',
    reason: 'Re-scored High after issue_refund gained an "instant" parameter. Returned to review automatically.',
    steps: [
      { name: 'Business sponsor', approver: 'u-kavya', role: 'Business sponsor', decision: 'approved', at: hoursAgo(20), comment: 'Business case unchanged; refund cap stays ₹5,000.' },
      { name: 'Risk reviewer', approver: 'u-meera', role: 'Risk reviewer', decision: 'pending' },
      { name: 'AI governance lead', approver: 'u-ananya', role: 'AI governance lead', decision: 'waiting' },
    ],
    ...ctlCount('ag-refund'),
  },
  {
    id: 'apr-1039', objectId: 'ag-loan', objectKind: 'agent', title: 'Loan Eligibility Agent v2.0.0-rc2', workflowId: 'wf-high', requestedBy: 'u-arjun', requestedAt: daysAgo(4), dueAt: hoursAgo(6), currentStep: 1, status: 'Pending',
    reason: 'New major version: adds salary-based eligibility and bureau pull.',
    steps: [
      { name: 'Business sponsor', approver: 'u-sanjay', role: 'Business sponsor', decision: 'approved', at: daysAgo(3) },
      { name: 'Risk reviewer', approver: 'u-meera', role: 'Risk reviewer', decision: 'pending' },
      { name: 'AI governance lead', approver: 'u-ananya', role: 'AI governance lead', decision: 'waiting' },
    ],
    ...ctlCount('ag-loan'),
  },
  {
    id: 'apr-1045', objectId: 'ag-onboard', objectKind: 'agent', title: 'Employee Onboarding Agent v1', workflowId: 'wf-med', requestedBy: 'u-rohan', requestedAt: hoursAgo(9), dueAt: inHours(39), currentStep: 0, status: 'Pending',
    reason: 'First release to new joiners in Bengaluru and Pune.',
    steps: [
      { name: 'Business sponsor', approver: 'u-lakshmi', role: 'Business sponsor', decision: 'pending' },
      { name: 'Risk reviewer', approver: 'u-meera', role: 'Risk reviewer', decision: 'pending' },
    ],
    ...ctlCount('ag-onboard'),
  },
  {
    id: 'apr-1046', objectId: 't-issue_refund', objectKind: 'tool', title: 'Tool schema change: issue_refund', workflowId: 'wf-med', requestedBy: 'system', requestedAt: hoursAgo(1), dueAt: inHours(47), currentStep: 0, status: 'Pending',
    reason: 'Schema hash changed (a91c04e7d2 → new). New boolean parameter "instant". Tool quarantined until re-approved.',
    steps: [
      { name: 'Tool owner', approver: 'u-priya', role: 'Agent owner', decision: 'pending' },
      { name: 'Security admin', approver: 'u-vikram', role: 'Security admin', decision: 'waiting' },
    ],
    controlsReady: 0, controlsTotal: 0,
  },
  {
    id: 'apr-1047', objectId: 'pol-152', objectKind: 'agent', title: 'Policy draft: Only Operators can read mail', workflowId: 'wf-med', requestedBy: 'u-karan', requestedAt: minsAgo(35), dueAt: inHours(23), currentStep: 0, status: 'Pending',
    reason: 'Drafted with PolicyPilot for Gmail Summary Agent. 4 examples simulated, no conflicts.',
    steps: [{ name: 'Security admin', approver: 'u-vikram', role: 'Security admin', decision: 'pending' }],
    controlsReady: 0, controlsTotal: 0,
  },
  {
    id: 'apr-1031', objectId: 'ag-collections', objectKind: 'agent', title: 'Collections Reminder Agent v3.0.1', workflowId: 'wf-high', requestedBy: 'u-arjun', requestedAt: daysAgo(12), dueAt: daysAgo(8), currentStep: 3, status: 'Approved',
    reason: 'Tone update for SMS reminders.',
    steps: [
      { name: 'Business sponsor', approver: 'u-sanjay', role: 'Business sponsor', decision: 'approved', at: daysAgo(11) },
      { name: 'Risk reviewer', approver: 'u-meera', role: 'Risk reviewer', decision: 'approved', at: daysAgo(10) },
      { name: 'AI governance lead', approver: 'u-ananya', role: 'AI governance lead', decision: 'approved', at: daysAgo(9), comment: 'Approved with the condition that opt-out is honoured within 24 h.' },
    ],
    ...ctlCount('ag-collections'),
  },
  {
    id: 'apr-1028', objectId: 'ag-research', objectKind: 'agent', title: 'Market Research Summariser — add web_scrape', workflowId: 'wf-low', requestedBy: 'u-amit', requestedAt: daysAgo(15), dueAt: daysAgo(14), currentStep: 0, status: 'Rejected',
    reason: 'Requested access to web_scrape on tools-hub.dev.',
    steps: [{ name: 'Security admin', approver: 'u-vikram', role: 'Security admin', decision: 'rejected', at: daysAgo(14), comment: 'tools-hub.dev is an unknown external MCP server. Use the approved research feed instead.' }],
    controlsReady: 3, controlsTotal: 3,
  },
  {
    id: 'apr-1035', objectId: 'ag-transfer', objectKind: 'agent', title: 'Treasury Transfer Agent v0.3.0', workflowId: 'wf-high', requestedBy: 'u-priya', requestedAt: daysAgo(6), dueAt: daysAgo(4), currentStep: 1, status: 'Changes requested',
    reason: 'Pilot for daily liquidity sweeps.',
    steps: [
      { name: 'Business sponsor', approver: 'u-ishaan', role: 'Business sponsor', decision: 'approved', at: daysAgo(5) },
      { name: 'Risk reviewer', approver: 'u-meera', role: 'Risk reviewer', decision: 'changes', at: daysAgo(4), comment: 'Add a human-approval step for transfers above ₹10 lakh and attach the DPIA.' },
      { name: 'AI governance lead', approver: 'u-ananya', role: 'AI governance lead', decision: 'waiting' },
    ],
    ...ctlCount('ag-transfer'),
  },
];

// ---------------------------------------------------------------- governance policies
export const governancePolicies: GovernancePolicy[] = [
  { id: 'gp-1', name: 'Only approved models', description: 'Agents may only use model deployments marked approved in the inventory.', rule: 'agent.models.all(m => m.approved == true)', severity: 'High', enabled: true, violations: 4, category: 'Models' },
  { id: 'gp-2', name: 'Customer-facing agents need a director-level sponsor', description: 'Any agent in a customer channel needs a sponsor at director level or above.', rule: "agent.exposure == 'Customer' => sponsor.grade >= 'Director'", severity: 'Medium', enabled: true, violations: 1, category: 'Accountability' },
  { id: 'gp-3', name: 'No customer data on models outside India', description: 'Agents reading Personal or Financial data must use models hosted in India regions.', rule: "agent.data.any(d => d.sensitivity in ['Personal','Financial']) => agent.models.all(m => m.region in ['Central India','South India'])", severity: 'High', enabled: true, violations: 3, category: 'Data residency' },
  { id: 'gp-4', name: 'Every agent has an owner', description: 'Unmanaged agents must be claimed within 14 days of discovery.', rule: 'agent.owner != null || agent.discoveredDays < 14', severity: 'Medium', enabled: true, violations: 4, category: 'Accountability' },
  { id: 'gp-5', name: 'Only known MCP servers', description: 'Agents may only call tools on MCP servers registered in the inventory.', rule: 'agent.tools.all(t => t.mcpServer.known)', severity: 'High', enabled: true, violations: 2, category: 'Tools' },
  { id: 'gp-6', name: 'High-risk agents use the runtime SDK', description: 'Medium and High agents must have SDK checks in the decision log.', rule: "agent.tier in ['Medium','High'] => agent.sdkConnected", severity: 'Medium', enabled: true, violations: 2, category: 'Runtime' },
  { id: 'gp-7', name: 'Retire agents with no runs in 90 days', description: 'Flag agents idle for 90 days for retirement.', rule: 'agent.lastRun > now - 90d', severity: 'Low', enabled: false, violations: 0, category: 'Lifecycle' },
];

export const governanceViolations: GovernanceViolation[] = [
  { id: 'gv-1', policyId: 'gp-1', agentId: 'ag-claims', detail: 'Uses Llama 3.1 70B (Bedrock), not approved', detectedAt: hoursAgo(5), status: 'Open' },
  { id: 'gv-2', policyId: 'gp-1', agentId: 'ag-scraper', detail: 'Uses Mistral Large (France Central), not approved', detectedAt: hoursAgo(11), status: 'Open' },
  { id: 'gv-3', policyId: 'gp-1', agentId: 'ag-denial', detail: 'Uses o3-mini (East US 2), not approved', detectedAt: daysAgo(5), status: 'Open' },
  { id: 'gv-4', policyId: 'gp-1', agentId: 'ag-support-eu', detail: 'Uses GPT-4.1 in Sweden Central — approved model, residency flagged separately', detectedAt: daysAgo(3), status: 'Waived' },
  { id: 'gv-5', policyId: 'gp-3', agentId: 'ag-loan', detail: 'Reads Loan book (Financial) using GPT-4.1 in Sweden Central', detectedAt: daysAgo(2), status: 'Open' },
  { id: 'gv-6', policyId: 'gp-3', agentId: 'ag-advisor', detail: 'Reads Customer 360 (Personal) using GPT-4.1 in Sweden Central', detectedAt: daysAgo(9), status: 'Waived' },
  { id: 'gv-7', policyId: 'gp-3', agentId: 'ag-support-eu', detail: 'Reads Customer 360 (Personal) using GPT-4.1 in Sweden Central', detectedAt: daysAgo(3), status: 'Open' },
  { id: 'gv-8', policyId: 'gp-4', agentId: 'ag-claims', detail: 'No owner 14 days after discovery', detectedAt: hoursAgo(5), status: 'Open' },
  { id: 'gv-9', policyId: 'gp-4', agentId: 'ag-scraper', detail: 'No owner', detectedAt: hoursAgo(11), status: 'Open' },
  { id: 'gv-10', policyId: 'gp-4', agentId: 'ag-sales', detail: 'No owner', detectedAt: daysAgo(2), status: 'Open' },
  { id: 'gv-11', policyId: 'gp-4', agentId: 'ag-support-eu', detail: 'No owner', detectedAt: daysAgo(3), status: 'Open' },
  { id: 'gv-12', policyId: 'gp-5', agentId: 'ag-research', detail: 'Calls web_scrape on tools-hub.dev (unknown server)', detectedAt: hoursAgo(11), status: 'Open' },
  { id: 'gv-13', policyId: 'gp-5', agentId: 'ag-scraper', detail: 'Calls run_python on tools-hub.dev (unknown server)', detectedAt: hoursAgo(11), status: 'Open' },
  { id: 'gv-14', policyId: 'gp-6', agentId: 'ag-claims', detail: 'High tier, no SDK checks recorded', detectedAt: hoursAgo(5), status: 'Open' },
  { id: 'gv-15', policyId: 'gp-6', agentId: 'ag-onboard', detail: 'Medium tier, no SDK checks recorded', detectedAt: daysAgo(1), status: 'Open' },
  { id: 'gv-16', policyId: 'gp-2', agentId: 'ag-support', detail: 'Sponsor Kavya Reddy is VP — compliant after grade sync', detectedAt: daysAgo(20), status: 'Resolved' },
];

// ---------------------------------------------------------------- reviews, exceptions, incidents
export const reviews: Review[] = agents
  .filter((a) => a.nextReview)
  .map((a) => {
    const due = new Date(a.nextReview!).getTime() - Date.parse(daysAgo(0));
    const days = due / 86_400_000;
    return {
      id: `rev-${a.id}`,
      agentId: a.id,
      dueAt: a.nextReview!,
      cadence: a.tier === 'High' ? '6 months' : '12 months',
      status: days < 0 ? 'Overdue' : days < 30 ? 'Due' : 'Upcoming',
      reviewer: 'u-meera',
    } as Review;
  });

export const exceptions: ExceptionGrant[] = [
  { id: 'ex-1', agentId: 'ag-advisor', waived: 'Policy: No customer data on models outside India', reason: 'GPT-4.1 not yet available in Central India; migration planned for Dec 2026.', approver: 'u-ananya', grantedAt: daysAgo(40), expiresAt: inDays(20), status: 'Expiring' },
  { id: 'ex-2', agentId: 'ag-support-eu', waived: 'Policy: Only approved models', reason: 'Temporary EU pilot during GDPR assessment.', approver: 'u-ananya', grantedAt: daysAgo(3), expiresAt: inDays(27), status: 'Active' },
  { id: 'ex-3', agentId: 'ag-payroll', waived: 'Control DAT-02: Data minimisation review', reason: 'Review scheduled with privacy office; payroll season freeze.', approver: 'u-meera', grantedAt: daysAgo(70), expiresAt: daysAgo(10), status: 'Expired' },
  { id: 'ex-4', agentId: 'ag-close', waived: 'Control QLT-01: Evaluation scores', reason: 'Evaluation set being rebuilt after chart-of-accounts change.', approver: 'u-meera', grantedAt: daysAgo(12), expiresAt: inDays(48), status: 'Active' },
];

export const incidents: Incident[] = [
  { id: 'inc-1', key: 'INC-231', agentId: 'ag-fraud', title: 'Agent disclosed partial card number in chat transcript', severity: 'Critical', description: 'Customer transcript included the first 12 digits of a card number after a tool output was not redacted.', linkedDecisionIds: ['dec-0007', 'dec-0019'], owner: 'u-arjun', status: 'Investigating', openedAt: hoursAgo(18), agentSuspended: true },
  { id: 'inc-2', key: 'INC-229', agentId: 'ag-refund', title: 'Refund loop: same order refunded twice', severity: 'High', description: 'Retry after timeout issued a second refund for ORD-88213. Idempotency key missing.', linkedDecisionIds: ['dec-0004'], owner: 'u-rahul', status: 'Mitigated', fix: 'Added idempotency key to issue_refund; policy pol-118 now applies to retries.', openedAt: daysAgo(3), agentSuspended: false },
  { id: 'inc-3', key: 'INC-224', agentId: 'ag-research', title: 'Calls to unknown external MCP server', severity: 'Medium', description: 'Traces show web_scrape calls to tools-hub.dev, not in the approved server list.', linkedDecisionIds: [], owner: 'u-amit', status: 'Open', openedAt: hoursAgo(11), agentSuspended: false },
  { id: 'inc-4', key: 'INC-217', agentId: 'ag-payroll', title: 'Salary figures returned to non-HR user', severity: 'High', description: 'A finance analyst received salary bands via a shared Teams channel.', linkedDecisionIds: [], owner: 'u-rohan', status: 'Resolved', fix: 'pol-130 (HR tools only for HR group) moved to enforce.', openedAt: daysAgo(21), agentSuspended: false },
  { id: 'inc-5', key: 'INC-210', agentId: 'ag-gmail', title: 'Draft reply quoted an internal-only thread', severity: 'Low', description: 'Draft included content from an internal thread when replying externally. Not sent.', linkedDecisionIds: [], owner: 'u-karan', status: 'Resolved', fix: 'Prompt updated to exclude internal threads from external replies.', openedAt: daysAgo(34), agentSuspended: false },
];

// ---------------------------------------------------------------- discovery signals + ownership
export const duplicates: Duplicate[] = [
  { id: 'dup-1', agentIds: ['ag-support', 'ag-support-eu'], similarity: 0.96, reason: 'Same instructions hash, 3 of 6 tools shared, different Foundry hub', status: 'Open' },
  { id: 'dup-2', agentIds: ['ag-hrhelp', 'ag-docqa'], similarity: 0.71, reason: 'Both answer from SharePoint policy libraries with similar prompts', status: 'Dismissed' },
];

export const shadowHints: ShadowHint[] = [
  { id: 'sh-1', kind: 'No owner', objectId: 'ag-claims', objectKind: 'agent', detail: 'Discovered on AWS Bedrock; reads Health claims', detectedAt: hoursAgo(5) },
  { id: 'sh-2', kind: 'Unapproved model', objectId: 'm-llama', objectKind: 'model', detail: 'Llama 3.1 70B used by 1 agent with health data', detectedAt: hoursAgo(5) },
  { id: 'sh-3', kind: 'Unknown MCP server', objectId: 'mcp-ext', objectKind: 'mcp', detail: 'tools-hub.dev called by 2 agents (web_scrape, run_python)', detectedAt: hoursAgo(11) },
  { id: 'sh-4', kind: 'Traces without SDK', objectId: 'ag-scraper', objectKind: 'agent', detail: '340 runs in 7 days with no policy checks', detectedAt: hoursAgo(11) },
  { id: 'sh-5', kind: 'Unapproved model', objectId: 'm-mistral', objectKind: 'model', detail: 'Mistral Large in France Central used by Lead Scraper Bot', detectedAt: daysAgo(1) },
  { id: 'sh-6', kind: 'No owner', objectId: 'ag-sales', objectKind: 'agent', detail: 'Fabric data agent in sales workspace', detectedAt: daysAgo(2) },
];

export const claims: Claim[] = [
  { id: 'cl-1', agentId: 'ag-sales', claimant: 'u-arjun', at: hoursAgo(20), status: 'Pending admin' },
  { id: 'cl-2', agentId: 'ag-support-eu', claimant: 'u-rahul', at: hoursAgo(6), status: 'Pending admin' },
];

export const orphans: Orphan[] = [
  { id: 'or-1', agentId: 'ag-churn', missing: 'owner', formerUser: 'u-deepa', suggested: 'u-amit', detectedAt: daysAgo(41) },
];

export const transfers: OwnershipTransfer[] = [
  { id: 'tr-1', objectId: 'ag-ops', from: 'u-rahul', to: 'u-karan', reason: 'Team reorg: SRE owns incident tooling', at: daysAgo(64), by: 'u-harshad' },
  { id: 'tr-2', objectId: 'ag-close', from: 'u-deepa', to: 'u-priya', reason: 'Owner left the organisation', at: daysAgo(40), by: 'u-harshad' },
  { id: 'tr-3', objectId: 'app-mail', from: 'u-vikram', to: 'u-karan', reason: 'Moved from security pilot to production', at: daysAgo(30), by: 'u-harshad' },
  { id: 'tr-4', objectId: 'ag-advisor', from: null, to: 'u-amit', reason: 'Claimed after discovery', at: daysAgo(250), by: 'u-harshad' },
];
