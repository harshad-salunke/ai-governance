import type { ApiKey, AuditEvent, Budget, CustomField, Notification, ReportSchedule, ReportTemplate, Trace, TraceSpan } from '../types';
import { NOW, daysAgo, hex, hoursAgo, inDays, minsAgo, pick, rng } from '../seed';
import { agents, models } from './inventory';

// ---------------------------------------------------------------- traces
const tr = rng(7);

const scripts: { agent: string; msg: string; answer: string; steps: [TraceSpan['kind'], string, string?][] }[] = [
  { agent: 'ag-support', msg: 'My refund for order ORD-123 of ₹8,000 has not arrived.', answer: 'I have requested a refund of ₹8,000. A supervisor will confirm it shortly.', steps: [['llm', 'gpt4o-prod-cin · plan'], ['tool', 'get_customer'], ['policy', 'check get_customer', 'redact'], ['tool', 'get_transactions'], ['policy', 'check issue_refund', 'ask_human'], ['llm', 'gpt4o-prod-cin · respond']] },
  { agent: 'ag-support', msg: 'Please close my account and delete my data.', answer: 'I have raised a data-deletion request with our privacy team (ticket T-55210).', steps: [['llm', 'gpt4o-prod-cin · plan'], ['policy', 'check delete_customer', 'block'], ['tool', 'create_ticket'], ['policy', 'check create_ticket', 'allow'], ['llm', 'gpt4o-prod-cin · respond']] },
  { agent: 'ag-gmail', msg: 'Summarise today’s mail', answer: 'You have 14 new messages. 3 need action: budget sign-off, interview slot, vendor contract.', steps: [['policy', 'check list_mail', 'allow'], ['tool', 'list_mail'], ['policy', 'check read_mail', 'allow'], ['tool', 'read_mail'], ['llm', 'gpt4o-mini-cin · summarise']] },
  { agent: 'ag-loan', msg: 'Am I eligible for a ₹5 lakh personal loan?', answer: 'Based on your profile you are pre-qualified for up to ₹4.2 lakh at 11.4% for 36 months.', steps: [['retrieval', 'embed + search policy'], ['policy', 'check sql_query', 'allow'], ['tool', 'sql_query'], ['policy', 'check calc_emi', 'allow'], ['tool', 'calc_emi'], ['llm', 'gpt41-swc · decide']] },
  { agent: 'ag-payroll', msg: 'What is the salary band for E10293?', answer: 'You do not have access to salary information.', steps: [['llm', 'gpt4o-prod-cin · plan'], ['policy', 'check get_salary', 'block'], ['llm', 'gpt4o-prod-cin · respond']] },
  { agent: 'ag-ops', msg: 'Alert: p95 latency breach on payments-api', answer: 'Opened INC-4410 and posted a summary to #sre-oncall. Likely cause: DB connection pool exhaustion.', steps: [['tool', 'search_tickets'], ['policy', 'check search_tickets', 'allow'], ['llm', 'gpt4o-mini-cin · correlate'], ['policy', 'check create_ticket', 'allow'], ['tool', 'create_ticket'], ['tool', 'teams_notify']] },
  { agent: 'ag-research', msg: 'Daily market brief', answer: 'Nifty closed 0.6% higher; IT led gains. Three research notes summarised.', steps: [['policy', 'check web_scrape', 'audit'], ['tool', 'web_scrape'], ['llm', 'gpt4o-mini-cin · summarise']] },
  { agent: 'ag-advisor', msg: 'Review portfolio for client W-2291', answer: 'Equity allocation is 8% above target. Suggested rebalancing attached for RM review.', steps: [['tool', 'get_customer'], ['policy', 'check get_customer', 'redact'], ['tool', 'get_transactions'], ['retrieval', 'search house view'], ['llm', 'gpt41-swc · analyse'], ['llm', 'gpt41-swc · respond']] },
];

export const traces: Trace[] = Array.from({ length: 48 }, (_, i) => {
  const s = scripts[i % scripts.length];
  let t = 0;
  const spans: TraceSpan[] = [{ id: 'root', name: agents.find((a) => a.id === s.agent)!.name, kind: 'agent', start: 0, duration: 0, status: 'ok', depth: 0 }];
  let tokensIn = 0;
  let tokensOut = 0;
  s.steps.forEach(([kind, name, decision], j) => {
    const dur = kind === 'llm' ? 600 + tr() * 1800 : kind === 'policy' ? 6 + tr() * 30 : kind === 'retrieval' ? 120 + tr() * 200 : 80 + tr() * 600;
    const tin = kind === 'llm' ? Math.round(800 + tr() * 2600) : undefined;
    const tout = kind === 'llm' ? Math.round(80 + tr() * 500) : undefined;
    tokensIn += tin ?? 0;
    tokensOut += tout ?? 0;
    const blocked = decision === 'block';
    const err = kind === 'tool' && tr() > 0.94;
    spans.push({
      id: `s${j}`,
      name,
      kind,
      start: Math.round(t),
      duration: Math.round(dur),
      status: blocked ? 'blocked' : err ? 'error' : 'ok',
      decision: decision as TraceSpan['decision'],
      tokensIn: tin,
      tokensOut: tout,
      depth: 1,
      detail: kind === 'policy' ? `Decision: ${decision}` : kind === 'tool' ? `${name}(…) → ${err ? 'timeout after 30s' : '200 OK'}` : undefined,
    });
    t += dur + 4 + tr() * 20;
  });
  spans[0].duration = Math.round(t);
  const status: Trace['status'] = spans.some((x) => x.status === 'error') ? 'error' : spans.some((x) => x.status === 'blocked') ? 'blocked' : 'ok';
  return {
    id: `tr-${hex(tr, 12)}`,
    agentId: s.agent,
    user: pick(tr, ['cust-88213', 'anita.k@corp.com', 'rm.delhi@corp.com', 'oncall-bot', 'cust-55102']),
    startedAt: new Date(NOW - Math.floor(tr() * 36 * 60) * 60_000).toISOString(),
    durationMs: Math.round(t),
    status,
    userMessage: s.msg,
    finalAnswer: s.answer,
    tokensIn,
    tokensOut,
    cost: +(tokensIn * 0.00021 + tokensOut * 0.00084).toFixed(2),
    spans,
  };
}).sort((a, b) => b.startedAt.localeCompare(a.startedAt));

// ---------------------------------------------------------------- usage + cost (₹)
const ur = rng(31);
export const dailyCost = Array.from({ length: 30 }, (_, i) => {
  const day = new Date(NOW - (29 - i) * 86_400_000);
  const weekend = day.getDay() === 0 || day.getDay() === 6;
  const scale = (weekend ? 0.55 : 1) * (0.92 + i * 0.006);
  const spike = i === 24 ? 1.9 : 1;
  const row = {
    date: day.toISOString().slice(0, 10),
    'GPT-4o': Math.round(12800 * scale * (0.9 + ur() * 0.2) * spike),
    'GPT-4.1': Math.round(5200 * scale * (0.9 + ur() * 0.2)),
    'GPT-4o mini': Math.round(1500 * scale * (0.9 + ur() * 0.2)),
    'Phi-4': Math.round(260 * scale * (0.9 + ur() * 0.2)),
    Other: Math.round(620 * scale * (0.8 + ur() * 0.4) * (i > 20 ? 1.6 : 1)),
    tokens: 0,
  };
  row.tokens = Math.round((row['GPT-4o'] / 0.4 + row['GPT-4.1'] / 0.32 + row['GPT-4o mini'] / 0.025 + row['Phi-4'] / 0.008) * 1000);
  return row;
});

export const costByBu = [
  { bu: 'bu-cs', cost: 231100, prev: 204000 },
  { bu: 'bu-retail', cost: 164200, prev: 171800 },
  { bu: 'bu-wealth', cost: 70300, prev: 52100 },
  { bu: 'bu-fin', cost: 36000, prev: 38900 },
  { bu: 'bu-hr', cost: 25800, prev: 23300 },
  { bu: 'bu-it', cost: 9600, prev: 8800 },
  { bu: 'bu-ops', cost: 9000, prev: 9400 },
];

export const budgets: Budget[] = [
  { id: 'bg-1', name: 'Support Resolution Agent', scope: 'agent', scopeId: 'ag-support', limit: 200000, spent: 186400, period: 'Monthly', unit: 'INR', action: 'Require approval', alerts: [50, 80, 100] },
  { id: 'bg-2', name: 'Customer Service BU', scope: 'team', scopeId: 'bu-cs', limit: 260000, spent: 231100, period: 'Monthly', unit: 'INR', action: 'Alert only', alerts: [50, 80, 100] },
  { id: 'bg-3', name: 'Loan Eligibility Agent', scope: 'agent', scopeId: 'ag-loan', limit: 60000, spent: 71200, period: 'Monthly', unit: 'INR', action: 'Block', alerts: [50, 80, 100] },
  { id: 'bg-4', name: 'GPT-4.1 deployment', scope: 'model', scopeId: 'm-gpt41', limit: 180000, spent: 122700, period: 'Monthly', unit: 'INR', action: 'Alert only', alerts: [80, 100] },
  { id: 'bg-5', name: 'Wealth Management BU', scope: 'team', scopeId: 'bu-wealth', limit: 90000, spent: 70300, period: 'Monthly', unit: 'INR', action: 'Alert only', alerts: [50, 80, 100] },
  { id: 'bg-6', name: 'Gmail Summary Agent tokens', scope: 'agent', scopeId: 'ag-gmail', limit: 60_000_000, spent: 31_400_000, period: 'Monthly', unit: 'tokens', action: 'Block', alerts: [80, 100] },
  { id: 'bg-7', name: 'Finance BU', scope: 'team', scopeId: 'bu-fin', limit: 120000, spent: 36000, period: 'Quarterly', unit: 'INR', action: 'Alert only', alerts: [50, 80, 100] },
];

export const priceTable = models.map((m) => ({ modelId: m.id, in: m.pricePer1kIn, out: m.pricePer1kOut }));

// ---------------------------------------------------------------- audit log (hash-chained)
const ar = rng(404);
const auditSeeds: Omit<AuditEvent, 'id' | 'hash' | 'prevHash'>[] = [
  { at: minsAgo(4), actor: 'sdk', action: 'runtime.ask_human', objectKind: 'Decision', objectId: 'dec-9f31', objectName: 'issue_refund ₹8,000 · Support Resolution Agent' },
  { at: minsAgo(35), actor: 'u-karan', action: 'policy.submitted', objectKind: 'Runtime policy', objectId: 'pol-152', objectName: 'Only Operators can read mail', after: 'status: Pending approval' },
  { at: minsAgo(42), actor: 'system', action: 'connector.scan_completed', objectKind: 'Connector', objectId: 'con-foundry', objectName: 'Foundry · prod-hub', after: '61 items, 2 new' },
  { at: hoursAgo(1), actor: 'system', action: 'tool.quarantined', objectKind: 'Tool', objectId: 't-issue_refund', objectName: 'issue_refund', before: 'hash a91c04e7d2', after: 'hash changed; quarantined' },
  { at: hoursAgo(1), actor: 'system', action: 'risk.rescored', objectKind: 'Agent', objectId: 'ag-refund', objectName: 'Refund Triage Agent', before: 'tier High (13)', after: 'tier High (14); back to review' },
  { at: hoursAgo(10), actor: 'u-vikram', action: 'policy.created', objectKind: 'Runtime policy', objectId: 'pol-170', objectName: 'Block unknown MCP servers', after: 'mode: monitor' },
  { at: hoursAgo(18), actor: 'u-vikram', action: 'agent.suspended', objectKind: 'Agent', objectId: 'ag-fraud', objectName: 'Fraud Alert Explainer', before: 'Approved', after: 'Suspended (INC-231)' },
  { at: hoursAgo(18), actor: 'u-arjun', action: 'incident.opened', objectKind: 'Incident', objectId: 'inc-1', objectName: 'INC-231' },
  { at: hoursAgo(20), actor: 'u-kavya', action: 'approval.step_approved', objectKind: 'Approval', objectId: 'apr-1042', objectName: 'Refund Triage Agent v1.2.0' },
  { at: hoursAgo(20), actor: 'u-arjun', action: 'ownership.claimed', objectKind: 'Agent', objectId: 'ag-sales', objectName: 'Sales Insights Agent' },
  { at: daysAgo(1), actor: 'u-vikram', action: 'policy.updated', objectKind: 'Runtime policy', objectId: 'pol-145', objectName: 'Redact PII in tool output', before: 'v4', after: 'v5' },
  { at: daysAgo(1), actor: 'u-harshad', action: 'role.assigned', objectKind: 'User', objectId: 'u-neha', objectName: 'Neha Joshi', after: '+ FinOps manager (Finance)' },
  { at: daysAgo(2), actor: 'u-ananya', action: 'risk_rules.updated', objectKind: 'Risk rules', objectId: 'rr', objectName: 'Risk rules', before: 'ov-5 enabled', after: 'ov-5 disabled' },
  { at: daysAgo(3), actor: 'u-vikram', action: 'policy.mode_changed', objectKind: 'Runtime policy', objectId: 'pol-118', objectName: 'Refunds above ₹5,000 need approval', before: 'monitor', after: 'enforce' },
  { at: daysAgo(3), actor: 'u-ananya', action: 'exception.granted', objectKind: 'Exception', objectId: 'ex-2', objectName: 'Support Resolution Agent (EU copy)' },
  { at: daysAgo(4), actor: 'u-meera', action: 'approval.changes_requested', objectKind: 'Approval', objectId: 'apr-1035', objectName: 'Treasury Transfer Agent v0.3.0' },
  { at: daysAgo(5), actor: 'u-arjun', action: 'agent.registered', objectKind: 'Agent', objectId: 'ag-denial', objectName: 'Automated Credit Denial Bot', after: 'tier: Prohibited' },
  { at: daysAgo(6), actor: 'u-harshad', action: 'api_key.rotated', objectKind: 'API key', objectId: 'key-2', objectName: 'support-agent prod' },
  { at: daysAgo(9), actor: 'u-ananya', action: 'approval.approved', objectKind: 'Approval', objectId: 'apr-1031', objectName: 'Collections Reminder Agent v3.0.1' },
  { at: daysAgo(14), actor: 'u-vikram', action: 'approval.rejected', objectKind: 'Approval', objectId: 'apr-1028', objectName: 'Market Research Summariser — add web_scrape' },
  { at: daysAgo(20), actor: 'u-vikram', action: 'policy.mode_changed', objectKind: 'Runtime policy', objectId: 'pol-130', objectName: 'HR tools only for the HR group', before: 'monitor', after: 'enforce' },
  { at: daysAgo(30), actor: 'u-harshad', action: 'ownership.transferred', objectKind: 'Application', objectId: 'app-mail', objectName: 'Inbox Assist', before: 'Vikram Rao', after: 'Karan Malhotra' },
  { at: daysAgo(40), actor: 'u-harshad', action: 'ownership.transferred', objectKind: 'Agent', objectId: 'ag-close', objectName: 'Month-end Close Agent', before: 'Deepa Krishnan', after: 'Priya Sharma' },
  { at: daysAgo(44), actor: 'u-harshad', action: 'connector.created', objectKind: 'Connector', objectId: 'con-bedrock', objectName: 'AWS Bedrock · ap-south-1' },
];

let prev = '0'.repeat(64);
export const auditEvents: AuditEvent[] = auditSeeds
  .slice()
  .reverse()
  .map((e, i) => {
    const hash = hex(ar, 64);
    const ev: AuditEvent = { ...e, id: `aud-${String(1000 + i)}`, hash, prevHash: prev };
    prev = hash;
    return ev;
  })
  .reverse();

// ---------------------------------------------------------------- reports
export const reportTemplates: ReportTemplate[] = [
  { id: 'rt-exec', name: 'Executive summary', description: 'One page: inventory, risk posture, violations and cost trend.', sections: ['Inventory', 'Risk tiers', 'Violations', 'Cost trend'], lastGenerated: daysAgo(1) },
  { id: 'rt-inv', name: 'AI inventory', description: 'Every application, agent, model, tool, MCP server and data source with owners.', sections: ['Applications', 'Agents', 'Models', 'Tools', 'Unmanaged'], lastGenerated: daysAgo(7) },
  { id: 'rt-risk', name: 'Risk posture', description: 'Agents by tier, re-scores this period, overrides and adjustments.', sections: ['Tier distribution', 'Re-scores', 'Adjustments'], lastGenerated: daysAgo(7) },
  { id: 'rt-apr', name: 'Approvals and overdue reviews', description: 'Pending approvals with SLA status and reviews past due.', sections: ['Pending', 'Decided', 'Overdue reviews'], lastGenerated: daysAgo(2) },
  { id: 'rt-viol', name: 'Policy violations', description: 'Runtime blocks and governance violations by agent and policy.', sections: ['Runtime', 'Governance', 'Repeat offenders'], lastGenerated: daysAgo(1) },
  { id: 'rt-inc', name: 'Incidents', description: 'Open and resolved incidents with linked decisions.', sections: ['Open', 'Resolved', 'Time to mitigate'], lastGenerated: daysAgo(14) },
  { id: 'rt-cost', name: 'Cost and usage', description: 'Spend by business unit, agent and model with chargeback.', sections: ['By BU', 'By agent', 'By model', 'Budgets'], lastGenerated: daysAgo(1) },
];

export const reportSchedules: ReportSchedule[] = [
  { id: 'rs-1', templateId: 'rt-exec', cadence: 'Monthly', recipients: ['AI governance lead', 'Security admin', 'Auditor'], nextRun: inDays(30), format: 'PDF', enabled: true },
  { id: 'rs-2', templateId: 'rt-viol', cadence: 'Weekly', recipients: ['Security admin'], nextRun: inDays(2), format: 'PDF', enabled: true },
  { id: 'rs-3', templateId: 'rt-cost', cadence: 'Monthly', recipients: ['FinOps manager'], nextRun: inDays(30), format: 'CSV', enabled: true },
  { id: 'rs-4', templateId: 'rt-apr', cadence: 'Weekly', recipients: ['Risk reviewer', 'AI governance lead'], nextRun: inDays(2), format: 'PDF', enabled: false },
];

// ---------------------------------------------------------------- admin
export const apiKeys: ApiKey[] = [
  { id: 'key-1', name: 'CI registration pipeline', prefix: 'dgc_reg_7Hq2', scope: 'registration', createdBy: 'u-harshad', createdAt: daysAgo(120), lastUsed: hoursAgo(3), expiresAt: inDays(245), status: 'Active' },
  { id: 'key-2', name: 'support-agent prod', prefix: 'dgc_rt_K9vX', scope: 'runtime', agentId: 'ag-support', createdBy: 'u-harshad', createdAt: daysAgo(6), lastUsed: minsAgo(0.2), expiresAt: inDays(84), status: 'Active' },
  { id: 'key-3', name: 'loan-agent staging', prefix: 'dgc_rt_p2Lm', scope: 'runtime', agentId: 'ag-loan', createdBy: 'u-arjun', createdAt: daysAgo(80), lastUsed: minsAgo(9), expiresAt: inDays(10), status: 'Expiring' },
  { id: 'key-4', name: 'Sentinel SIEM export', prefix: 'dgc_ro_Xa31', scope: 'read-only', createdBy: 'u-vikram', createdAt: daysAgo(200), lastUsed: minsAgo(15), expiresAt: inDays(165), status: 'Active' },
  { id: 'key-5', name: 'gmail-agent prod', prefix: 'dgc_rt_Qe88', scope: 'runtime', agentId: 'ag-gmail', createdBy: 'u-karan', createdAt: daysAgo(70), lastUsed: minsAgo(1), expiresAt: inDays(20), status: 'Active' },
  { id: 'key-6', name: 'old hackathon key', prefix: 'dgc_rt_0ldK', scope: 'runtime', createdBy: 'u-rahul', createdAt: daysAgo(300), lastUsed: daysAgo(190), expiresAt: daysAgo(5), status: 'Revoked' },
];

export const customFields: CustomField[] = [
  { id: 'cf-1', label: 'Cost centre', type: 'text', appliesTo: ['application', 'agent'], required: true },
  { id: 'cf-2', label: 'Regulatory scope', type: 'list', appliesTo: ['agent'], options: ['RBI', 'SEBI', 'IRDAI', 'None'], required: false },
  { id: 'cf-3', label: 'Go-live date', type: 'date', appliesTo: ['application', 'agent'], required: false },
  { id: 'cf-4', label: 'Data retention', type: 'list', appliesTo: ['data'], options: ['30 days', '1 year', '7 years'], required: true },
];

export const notifications: Notification[] = [
  { id: 'n-1', at: minsAgo(3), title: 'Refund of ₹8,000 waiting for approval', body: 'Support Resolution Agent · cust-88213', kind: 'approval', href: '/runtime/human-approvals', read: false },
  { id: 'n-2', at: minsAgo(35), title: 'Policy draft submitted for approval', body: 'Only Operators can read mail · by Karan Malhotra', kind: 'approval', href: '/approvals', read: false },
  { id: 'n-3', at: hoursAgo(1), title: 'Tool quarantined after schema change', body: 'issue_refund on payments-mcp gained parameter "instant"', kind: 'scan', href: '/catalog/tool/t-issue_refund', read: false },
  { id: 'n-4', at: hoursAgo(5), title: 'Connector failed: AWS Bedrock', body: 'AssumeRole failed: ExternalId mismatch', kind: 'scan', href: '/connectors', read: false },
  { id: 'n-5', at: hoursAgo(11), title: 'Unknown MCP server discovered', body: 'tools-hub.dev called by 2 agents', kind: 'violation', href: '/discovery', read: true },
  { id: 'n-6', at: hoursAgo(18), title: 'Critical incident INC-231 opened', body: 'Fraud Alert Explainer suspended', kind: 'incident', href: '/incidents', read: true },
  { id: 'n-7', at: daysAgo(1), title: 'Budget at 93%: Support Resolution Agent', body: '₹1.86 L of ₹2.00 L used this month', kind: 'budget', href: '/observe/cost', read: true },
  { id: 'n-8', at: daysAgo(2), title: 'Review overdue: Payroll Query Agent', body: 'High tier · due 9 days ago', kind: 'review', href: '/reviews', read: true },
];
