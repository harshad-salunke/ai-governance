import type { AgentRole, ApprovalTask, Decision, DecisionRecord, RuntimePolicy } from '../types';
import { NOW, daysAgo, hoursAgo, inHours, inMinsFrom, minsAgo, pick, rng, weighted } from '../seed';
import { agents } from './inventory';

export const agentRoles: AgentRole[] = [
  { id: 'role-readonly', name: 'Read-only assistant', description: 'Answers questions. Can read approved internal and public data; cannot change anything.', allowedToolIds: ['t-search_docs', 't-read_document', 't-get_customer', 't-get_transactions', 't-sql_query'], allowedActions: ['read'], allowedModelIds: ['m-gpt4omini', 'm-gpt4o', 'm-gpt41', 'm-phi4', 'm-embed'], allowedRegions: ['Central India', 'South India', 'Sweden Central'], allowedDataClasses: ['Public', 'Internal', 'Confidential'], defaultDecision: 'block' },
  { id: 'role-support', name: 'Support agent', description: 'Customer support: look up, ticket, refund within limits and send confirmations.', allowedToolIds: ['t-get_customer', 't-update_customer', 't-create_ticket', 't-search_tickets', 't-issue_refund', 't-send_email', 't-get_transactions'], allowedActions: ['read', 'write', 'send', 'payment'], allowedModelIds: ['m-gpt4o', 'm-gpt4omini', 'm-embed'], allowedRegions: ['Central India'], allowedDataClasses: ['Internal', 'Personal', 'Financial'], defaultDecision: 'block' },
  { id: 'role-finance', name: 'Finance agent', description: 'Finance operations on India-region models only.', allowedToolIds: ['t-get_transactions', 't-sql_query', 't-issue_refund', 't-initiate_transfer', 't-upload_document'], allowedActions: ['read', 'write', 'payment'], allowedModelIds: ['m-gpt4o', 'm-phi4', 'm-gpt4omini'], allowedRegions: ['Central India', 'South India'], allowedDataClasses: ['Internal', 'Confidential', 'Financial'], defaultDecision: 'block' },
  { id: 'role-hr', name: 'HR agent', description: 'Employee data for HR staff only.', allowedToolIds: ['t-get_employee', 't-get_salary', 't-update_leave', 't-search_docs', 't-create_ticket', 't-sql_query'], allowedActions: ['read', 'write'], allowedModelIds: ['m-gpt4o', 'm-gpt4omini'], allowedRegions: ['Central India'], allowedDataClasses: ['Internal', 'Personal'], defaultDecision: 'block' },
  { id: 'role-lending', name: 'Lending agent', description: 'Loan eligibility, KYC and collections.', allowedToolIds: ['t-sql_query', 't-calc_emi', 't-kyc_lookup', 't-get_customer', 't-send_email'], allowedActions: ['read', 'send'], allowedModelIds: ['m-gpt4o', 'm-gpt4omini', 'm-gpt41'], allowedRegions: ['Central India', 'Sweden Central'], allowedDataClasses: ['Internal', 'Personal', 'Financial'], defaultDecision: 'block' },
  { id: 'role-mail', name: 'Mail assistant', description: 'Reads and drafts mail; sending is restricted to the corporate domain.', allowedToolIds: ['t-read_mail', 't-list_mail', 't-draft_reply', 't-send_email'], allowedActions: ['read', 'write', 'send'], allowedModelIds: ['m-gpt4omini'], allowedRegions: ['Central India'], allowedDataClasses: ['Internal', 'Personal'], defaultDecision: 'allow' },
  { id: 'role-ops', name: 'Ops agent', description: 'Incident triage: search, ticket and notify on-call.', allowedToolIds: ['t-search_tickets', 't-create_ticket', 't-teams_notify', 't-search_docs'], allowedActions: ['read', 'write', 'send'], allowedModelIds: ['m-gpt4omini', 'm-gpt4o'], allowedRegions: ['Central India'], allowedDataClasses: ['Internal'], defaultDecision: 'block' },
];

const hist = (v: number, by: string, notes: string[]) =>
  notes.slice(0, v).map((note, i) => ({ version: v - i, at: daysAgo(i * 17 + 2), by, note })).reverse();

export const runtimePolicies: RuntimePolicy[] = [
  { id: 'pol-101', name: 'Support agents cannot delete customers', description: 'Deleting customer records is reserved for the data-protection team.', type: 'Tool access', scope: { kind: 'role', id: 'role-support' }, toolId: 't-delete_customer', conditions: [], decision: 'block', reason: 'Customer deletion is not allowed for support agents', mode: 'enforce', version: 2, author: 'u-vikram', updatedAt: daysAgo(48), status: 'Active', hits7d: 31, priority: 10, history: hist(2, 'u-vikram', ['Created', 'Moved to enforce']) },
  { id: 'pol-118', name: 'Refunds above ₹5,000 need approval', description: 'Larger refunds are routed to the agent sponsor for approval.', type: 'Parameter rule', scope: { kind: 'role', id: 'role-support' }, toolId: 't-issue_refund', conditions: [{ field: 'params.amount', op: '>', value: '5000' }], decision: 'ask_human', reason: 'Refund above 5,000 needs approval', mode: 'enforce', version: 4, author: 'u-vikram', updatedAt: daysAgo(3), status: 'Active', hits7d: 412, priority: 20, history: hist(4, 'u-vikram', ['Created at ₹10,000', 'Lowered to ₹5,000', 'Applied to retries (INC-229)', 'Moved to enforce']) },
  { id: 'pol-122', name: 'No agent reads the salary table', description: 'Salary data is only reachable through the HR tools with HR group context.', type: 'Data rule', scope: { kind: 'all' }, toolId: 't-sql_query', conditions: [{ field: 'params.table', op: 'contains', value: 'salary' }], decision: 'block', reason: 'Salary table is restricted', mode: 'enforce', version: 1, author: 'u-vikram', updatedAt: daysAgo(90), status: 'Active', hits7d: 58, priority: 5, history: hist(1, 'u-vikram', ['Created']) },
  { id: 'pol-130', name: 'HR tools only for the HR group', description: 'Only members of HR-Staff may trigger HR agent tools.', type: 'User context', scope: { kind: 'role', id: 'role-hr' }, toolId: null, conditions: [{ field: 'user.groups', op: 'contains', value: '!HR-Staff' }], decision: 'block', reason: 'Only HR staff can use HR tools', mode: 'enforce', version: 3, author: 'u-vikram', updatedAt: daysAgo(20), status: 'Active', hits7d: 97, priority: 15, history: hist(3, 'u-vikram', ['Created in monitor', 'Added contractors exclusion', 'Moved to enforce after INC-217']) },
  { id: 'pol-134', name: 'Finance agents use India-region models', description: 'Financial data may only be processed by models in India regions.', type: 'Model access', scope: { kind: 'role', id: 'role-finance' }, toolId: null, conditions: [{ field: 'model.region', op: 'in', value: 'Central India, South India' }], decision: 'block', reason: 'Finance agents must use India-region models', mode: 'enforce', version: 1, author: 'u-vikram', updatedAt: daysAgo(70), status: 'Active', hits7d: 4, priority: 15, history: hist(1, 'u-vikram', ['Created']) },
  { id: 'pol-140', name: 'No production writes from dev agents', description: 'Agents tagged dev may not call write, delete or payment tools in prod.', type: 'Environment', scope: { kind: 'all' }, toolId: null, conditions: [{ field: 'environment', op: '=', value: 'prod' }, { field: 'agent.environment', op: '=', value: 'dev' }, { field: 'tool.action', op: 'in', value: 'write, delete, payment' }], decision: 'block', reason: 'Dev agents cannot write to production', mode: 'monitor', version: 1, author: 'u-vikram', updatedAt: daysAgo(6), status: 'Active', hits7d: 12, priority: 8, history: hist(1, 'u-vikram', ['Created in monitor']) },
  { id: 'pol-145', name: 'Redact PII in tool output', description: 'Mask PAN, Aadhaar, card numbers and phone numbers in tool responses.', type: 'Content', scope: { kind: 'all' }, toolId: null, conditions: [{ field: 'output', op: 'regex', value: '\\b\\d{4}[ -]?\\d{4}[ -]?\\d{4}\\b|[A-Z]{5}\\d{4}[A-Z]' }], decision: 'redact', reason: 'PII masked in tool output', mode: 'enforce', version: 5, author: 'u-vikram', updatedAt: daysAgo(1), status: 'Active', hits7d: 2840, priority: 30, history: hist(5, 'u-vikram', ['Created', 'Added Aadhaar', 'Added phone', 'Added card numbers', 'Fix after INC-231']) },
  { id: 'pol-150', name: 'Never send email outside corp.com', description: 'send_email recipients must be on the corporate domain.', type: 'Parameter rule', scope: { kind: 'tool', id: 't-send_email' }, toolId: 't-send_email', conditions: [{ field: 'params.to', op: 'regex', value: '!@corp\\.com$' }], decision: 'block', reason: 'Email can only be sent to corp.com addresses', mode: 'enforce', version: 2, author: 'u-vikram', updatedAt: daysAgo(15), status: 'Active', hits7d: 76, priority: 12, history: hist(2, 'u-vikram', ['Drafted with PolicyPilot', 'Moved to enforce']) },
  { id: 'pol-152', name: 'Only Operators can read mail', description: 'Users with the Reader role cannot read mail. Only Operators can read mail.', type: 'User context', scope: { kind: 'agent', id: 'ag-gmail' }, toolId: 't-read_mail', conditions: [{ field: 'user.role', op: '≠', value: 'Operator' }], decision: 'block', reason: 'Only Operators can read mail', mode: 'monitor', version: 1, author: 'u-karan', updatedAt: minsAgo(35), status: 'Pending approval', hits7d: 0, priority: 12, history: hist(1, 'u-karan', ['Drafted with PolicyPilot']) },
  { id: 'pol-160', name: 'Block treasury transfers above ₹10 lakh', description: 'Large transfers must go through the manual treasury desk.', type: 'Parameter rule', scope: { kind: 'agent', id: 'ag-transfer' }, toolId: 't-initiate_transfer', conditions: [{ field: 'params.amount', op: '>', value: '1000000' }], decision: 'block', reason: 'Transfers above ₹10 lakh need the treasury desk', mode: 'enforce', version: 1, author: 'u-vikram', updatedAt: daysAgo(4), status: 'Draft', hits7d: 0, priority: 10, history: hist(1, 'u-vikram', ['Created']) },
  { id: 'pol-165', name: 'Audit every KYC lookup', description: 'Log all KYC registry lookups for the regulator.', type: 'Tool access', scope: { kind: 'tool', id: 't-kyc_lookup' }, toolId: 't-kyc_lookup', conditions: [], decision: 'audit', reason: 'KYC lookups are audited', mode: 'enforce', version: 1, author: 'u-vikram', updatedAt: daysAgo(120), status: 'Active', hits7d: 14100, priority: 40, history: hist(1, 'u-vikram', ['Created']) },
  { id: 'pol-170', name: 'Block unknown MCP servers', description: 'Calls to MCP servers not registered in the inventory are blocked.', type: 'Tool access', scope: { kind: 'all' }, toolId: null, conditions: [{ field: 'tool.mcp_server.known', op: '=', value: 'false' }], decision: 'block', reason: 'MCP server is not registered', mode: 'monitor', version: 1, author: 'u-vikram', updatedAt: hoursAgo(10), status: 'Active', hits7d: 101, priority: 5, history: hist(1, 'u-vikram', ['Created after INC-224']) },
];

// ---------------------------------------------------------------- decision log
const userPool = ['cust-88213', 'cust-10477', 'cust-55102', 'cust-90311', 'rahul.menon@corp.com', 'anita.k@corp.com', 'hrbp.pune@corp.com', 'rm.delhi@corp.com', 'oncall-bot', 'vivek.s@corp.com', 'finance.analyst@corp.com'];

type Gen = { agent: string; tool: string; params: () => Record<string, string | number | boolean>; outcome: () => [Decision, string | null, string] };

const r = rng(2026);
const amount = () => Math.round((r() * 12000 + 200) / 10) * 10;

const gens: Gen[] = [
  { agent: 'ag-support', tool: 't-issue_refund', params: () => ({ order_id: `ORD-${Math.floor(10000 + r() * 89999)}`, amount: amount() }), outcome: () => [r() > 0.62 ? 'ask_human' : 'allow', 'pol-118', 'Refund above 5,000 needs approval'] },
  { agent: 'ag-support', tool: 't-get_customer', params: () => ({ customer_id: `C${Math.floor(r() * 900000)}` }), outcome: () => (r() > 0.4 ? ['redact', 'pol-145', 'PII masked in tool output'] : ['allow', null, 'Allowed by role Support agent']) },
  { agent: 'ag-support', tool: 't-delete_customer', params: () => ({ customer_id: `C${Math.floor(r() * 900000)}`, reason: 'customer request' }), outcome: () => ['block', 'pol-101', 'Customer deletion is not allowed for support agents'] },
  { agent: 'ag-support', tool: 't-send_email', params: () => ({ to: r() > 0.85 ? 'someone@gmail.com' : 'cust.care@corp.com', subject: 'Your refund' }), outcome: () => ['allow', null, 'Allowed by role Support agent'] },
  { agent: 'ag-refund', tool: 't-issue_refund', params: () => ({ order_id: `ORD-${Math.floor(10000 + r() * 89999)}`, amount: amount(), instant: true }), outcome: () => ['block', null, 'Tool quarantined: schema changed, awaiting re-approval'] },
  { agent: 'ag-gmail', tool: 't-read_mail', params: () => ({ folder: 'inbox' }), outcome: () => (r() > 0.8 ? ['audit', 'pol-152', 'Monitor: would block — only Operators can read mail'] : ['allow', null, 'Allowed by role Mail assistant']) },
  { agent: 'ag-gmail', tool: 't-send_email', params: () => ({ to: r() > 0.7 ? 'vendor@partner.io' : 'team@corp.com' }), outcome: () => ['block', 'pol-150', 'Email can only be sent to corp.com addresses'] },
  { agent: 'ag-payroll', tool: 't-get_salary', params: () => ({ employee_id: `E${Math.floor(10000 + r() * 9000)}` }), outcome: () => (r() > 0.5 ? ['block', 'pol-130', 'Only HR staff can use HR tools'] : ['allow', null, 'Allowed by role HR agent']) },
  { agent: 'ag-loan', tool: 't-sql_query', params: () => ({ warehouse: 'lending', table: r() > 0.85 ? 'hr.salary_bands' : 'loan_book' }), outcome: () => ['allow', null, 'Allowed by role Lending agent'] },
  { agent: 'ag-kyc', tool: 't-kyc_lookup', params: () => ({ pan: 'ABCDE****F', aadhaar_last4: '****' }), outcome: () => ['audit', 'pol-165', 'KYC lookups are audited'] },
  { agent: 'ag-research', tool: 't-web_scrape', params: () => ({ url: 'https://news.example.com/markets' }), outcome: () => ['audit', 'pol-170', 'Monitor: would block — MCP server is not registered'] },
  { agent: 'ag-ops', tool: 't-teams_notify', params: () => ({ channel: '#sre-oncall', message: 'P2 incident summary' }), outcome: () => ['allow', null, 'Allowed by role Ops agent'] },
  { agent: 'ag-collections', tool: 't-send_email', params: () => ({ to: 'borrower@corp.com', subject: 'EMI reminder' }), outcome: () => ['allow', null, 'Allowed by role Lending agent'] },
  { agent: 'ag-fraud', tool: 't-get_transactions', params: () => ({ customer_id: `C${Math.floor(r() * 900000)}` }), outcome: () => ['block', null, 'Agent suspended (kill switch)'] },
  { agent: 'ag-close', tool: 't-sql_query', params: () => ({ warehouse: 'finance', table: 'gl_entries' }), outcome: () => ['allow', null, 'Allowed by role Finance agent'] },
  { agent: 'ag-leave', tool: 't-update_leave', params: () => ({ employee_id: `E${Math.floor(10000 + r() * 9000)}`, action: 'apply', days: Math.ceil(r() * 4) }), outcome: () => ['allow', null, 'Allowed by role HR agent'] },
];

const genWeights: [Gen, number][] = gens.map((g, i) => [g, [16, 14, 2, 6, 4, 10, 4, 5, 6, 8, 3, 5, 6, 3, 4, 5][i]]);

export const decisions: DecisionRecord[] = Array.from({ length: 320 }, (_, i) => {
  const g = weighted(r, genWeights);
  const params = g.params();
  let [decision, policyId, reason] = g.outcome();
  if (g.tool === 't-issue_refund' && g.agent === 'ag-support') {
    if ((params.amount as number) > 5000) [decision, policyId, reason] = ['ask_human', 'pol-118', 'Refund above 5,000 needs approval'];
    else [decision, policyId, reason] = ['allow', null, 'Allowed by role Support agent'];
  }
  if (g.tool === 't-sql_query' && String(params.table).includes('salary')) [decision, policyId, reason] = ['block', 'pol-122', 'Salary table is restricted'];
  if (g.tool === 't-send_email' && g.agent !== 'ag-gmail') {
    if (!String(params.to).endsWith('@corp.com')) [decision, policyId, reason] = ['block', 'pol-150', 'Email can only be sent to corp.com addresses'];
  }
  const minutes = Math.floor(Math.pow(r(), 1.6) * 7 * 24 * 60);
  return {
    id: `dec-${String(i + 1).padStart(4, '0')}`,
    at: new Date(NOW - minutes * 60_000 - (i < 6 ? 0 : 0)).toISOString(),
    agentId: g.agent,
    user: pick(r, userPool),
    toolId: g.tool,
    params,
    policyId,
    decision,
    mode: decision === 'audit' && reason.startsWith('Monitor') ? 'monitor' : 'enforce',
    latencyMs: Math.round(6 + Math.pow(r(), 3) * 70),
    reason,
    environment: weighted(r, [['prod', 85], ['staging', 10], ['dev', 5]] as const),
  } satisfies DecisionRecord;
}).sort((a, b) => b.at.localeCompare(a.at));

// ---------------------------------------------------------------- human approval tasks
export const approvalTasks: ApprovalTask[] = [
  { id: 'hat-1', decisionId: 'dec-9f31', agentId: 'ag-support', user: 'cust-88213', toolId: 't-issue_refund', params: { order_id: 'ORD-123', amount: 8000 }, reason: 'Refund above 5,000 needs approval', approver: 'u-kavya', createdAt: minsAgo(3), timeoutAt: inMinsFrom(2), status: 'Pending', channel: 'Teams' },
  { id: 'hat-2', decisionId: 'dec-9f12', agentId: 'ag-support', user: 'cust-10477', toolId: 't-issue_refund', params: { order_id: 'ORD-56102', amount: 11250 }, reason: 'Refund above 5,000 needs approval', approver: 'u-kavya', createdAt: minsAgo(11), timeoutAt: inMinsFrom(-6), status: 'Pending', channel: 'Portal' },
  { id: 'hat-3', decisionId: 'dec-9e88', agentId: 'ag-support', user: 'cust-55102', toolId: 't-issue_refund', params: { order_id: 'ORD-33190', amount: 6400 }, reason: 'Refund above 5,000 needs approval', approver: 'u-kavya', createdAt: minsAgo(26), timeoutAt: inMinsFrom(-21), status: 'Approved', channel: 'Teams' },
  { id: 'hat-4', decisionId: 'dec-9e40', agentId: 'ag-support', user: 'cust-90311', toolId: 't-issue_refund', params: { order_id: 'ORD-77001', amount: 24990 }, reason: 'Refund above 5,000 needs approval', approver: 'u-kavya', createdAt: hoursAgo(2), timeoutAt: hoursAgo(1.9), status: 'Denied', channel: 'Email' },
  { id: 'hat-5', decisionId: 'dec-9d02', agentId: 'ag-support', user: 'cust-41220', toolId: 't-issue_refund', params: { order_id: 'ORD-10022', amount: 5200 }, reason: 'Refund above 5,000 needs approval', approver: 'u-kavya', createdAt: hoursAgo(5), timeoutAt: hoursAgo(4.9), status: 'Timed out', channel: 'Teams' },
  { id: 'hat-6', decisionId: 'dec-9c71', agentId: 'ag-leave', user: 'vivek.s@corp.com', toolId: 't-update_leave', params: { employee_id: 'E12044', action: 'approve', days: 12 }, reason: 'Leave over 10 days needs HR approval', approver: 'u-lakshmi', createdAt: minsAgo(48), timeoutAt: inHours(23), status: 'Pending', channel: 'Teams' },
];

export const runtimeStats = {
  p50: 9,
  p95: 31,
  p99: 88,
  checks24h: decisions.filter((d) => Date.parse(d.at) > NOW - 86_400_000).length * 412,
  agentsConnected: agents.filter((a) => a.sdkConnected).length,
  propagationSec: 12,
};
