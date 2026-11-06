import type {
  Agent,
  Application,
  DataSource,
  LineageEdge,
  McpServer,
  Model,
  SignalScores,
  Tool,
} from '../types';
import { daysAgo, hoursAgo, inDays, minsAgo } from '../seed';
import { tierFor } from '../risk';

const base = (id: string, bu: string, createdDays: number, source = 'manual', by = 'u-harshad') => ({
  id,
  businessUnitId: bu,
  createdAt: daysAgo(createdDays),
  updatedAt: daysAgo(Math.max(0, Math.floor(createdDays / 6))),
  createdBy: by,
  source,
});

// ---------------------------------------------------------------- models
export const models: Model[] = [
  { ...base('m-gpt4o', 'bu-it', 220, 'Foundry · prod-hub'), provider: 'Azure OpenAI', name: 'GPT-4o', version: '2024-11-20', deployment: 'gpt4o-prod-cin', region: 'Central India', approved: true, pricePer1kIn: 0.21, pricePer1kOut: 0.84, change: null },
  { ...base('m-gpt4omini', 'bu-it', 200, 'Foundry · prod-hub'), provider: 'Azure OpenAI', name: 'GPT-4o mini', version: '2024-07-18', deployment: 'gpt4o-mini-cin', region: 'Central India', approved: true, pricePer1kIn: 0.013, pricePer1kOut: 0.05, change: null },
  { ...base('m-gpt41', 'bu-it', 90, 'Foundry · prod-hub'), provider: 'Azure OpenAI', name: 'GPT-4.1', version: '2025-04-14', deployment: 'gpt41-swc', region: 'Sweden Central', approved: true, pricePer1kIn: 0.17, pricePer1kOut: 0.67, change: null },
  { ...base('m-o3mini', 'bu-it', 30, 'Foundry · sandbox'), provider: 'Azure OpenAI', name: 'o3-mini', version: '2025-01-31', deployment: 'o3mini-eus2', region: 'East US 2', approved: false, pricePer1kIn: 0.09, pricePer1kOut: 0.37, change: 'new' },
  { ...base('m-embed', 'bu-it', 210, 'Foundry · prod-hub'), provider: 'Azure OpenAI', name: 'text-embedding-3-large', version: '1', deployment: 'embed-large-cin', region: 'Central India', approved: true, pricePer1kIn: 0.011, pricePer1kOut: 0, change: null },
  { ...base('m-phi4', 'bu-it', 70, 'Foundry · prod-hub'), provider: 'Microsoft', name: 'Phi-4', version: '7', deployment: 'phi4-serverless-sin', region: 'South India', approved: true, pricePer1kIn: 0.006, pricePer1kOut: 0.012, change: null },
  { ...base('m-llama', 'bu-wealth', 12, 'AWS Bedrock · ap-south-1'), provider: 'Meta (Bedrock)', name: 'Llama 3.1 70B', version: 'v1:0', deployment: 'bedrock-llama31-70b', region: 'ap-south-1', approved: false, pricePer1kIn: 0.06, pricePer1kOut: 0.08, change: 'new' },
  { ...base('m-mistral', 'bu-it', 6, 'Foundry · sandbox'), provider: 'Mistral AI', name: 'Mistral Large', version: '2411', deployment: 'mistral-large-frc', region: 'France Central', approved: false, pricePer1kIn: 0.17, pricePer1kOut: 0.5, change: 'new' },
];

// ---------------------------------------------------------------- MCP servers
export const mcpServers: McpServer[] = [
  { ...base('mcp-crm', 'bu-cs', 160, 'MCP · crm'), name: 'crm-mcp', url: 'https://mcp.corp.internal/crm', transport: 'streamable-http', owner: 'u-rahul', toolIds: ['t-get_customer', 't-update_customer', 't-delete_customer', 't-create_ticket', 't-search_tickets'], lastScanned: minsAgo(42), known: true, change: null },
  { ...base('mcp-mail', 'bu-it', 120, 'MCP · mail'), name: 'outlook-mcp', url: 'https://mcp.corp.internal/mail', transport: 'streamable-http', owner: 'u-karan', toolIds: ['t-read_mail', 't-list_mail', 't-send_email', 't-draft_reply'], lastScanned: minsAgo(42), known: true, change: null },
  { ...base('mcp-pay', 'bu-fin', 140, 'MCP · payments'), name: 'payments-mcp', url: 'https://mcp.corp.internal/payments', transport: 'streamable-http', owner: 'u-priya', toolIds: ['t-issue_refund', 't-get_transactions', 't-initiate_transfer'], lastScanned: minsAgo(42), known: true, change: 'changed' },
  { ...base('mcp-hr', 'bu-hr', 100, 'MCP · workday'), name: 'workday-mcp', url: 'https://mcp.corp.internal/workday', transport: 'sse', owner: 'u-rohan', toolIds: ['t-get_employee', 't-get_salary', 't-update_leave'], lastScanned: hoursAgo(3), known: true, change: null },
  { ...base('mcp-docs', 'bu-ops', 180, 'MCP · sharepoint'), name: 'sharepoint-mcp', url: 'https://mcp.corp.internal/sharepoint', transport: 'streamable-http', owner: 'u-karan', toolIds: ['t-search_docs', 't-read_document', 't-upload_document'], lastScanned: hoursAgo(3), known: true, change: null },
  { ...base('mcp-ext', 'bu-wealth', 4, 'Trace discovery'), name: 'tools-hub.dev', url: 'https://mcp.tools-hub.dev/v1', transport: 'sse', owner: null, toolIds: ['t-web_scrape', 't-run_python'], lastScanned: hoursAgo(11), known: false, change: 'new' },
];

// ---------------------------------------------------------------- tools
type ToolSeed = [id: string, name: string, desc: string, action: Tool['actionType'], mcp: string | null, bu: string, schema: Tool['schema'], extra?: Partial<Tool>];

const toolSeeds: ToolSeed[] = [
  ['t-get_customer', 'get_customer', 'Fetch a customer profile by customer ID or phone number.', 'read', 'mcp-crm', 'bu-cs', { customer_id: { type: 'string' }, phone: { type: 'string' } }],
  ['t-update_customer', 'update_customer', 'Update contact details or preferences on a customer record.', 'write', 'mcp-crm', 'bu-cs', { customer_id: { type: 'string' }, fields: { type: 'object' } }],
  ['t-delete_customer', 'delete_customer', 'Permanently delete a customer record and linked tickets.', 'delete', 'mcp-crm', 'bu-cs', { customer_id: { type: 'string' }, reason: { type: 'string' } }],
  ['t-create_ticket', 'create_ticket', 'Open a support ticket against a customer.', 'write', 'mcp-crm', 'bu-cs', { customer_id: { type: 'string' }, subject: { type: 'string' }, priority: { type: 'string', enum: ['low', 'normal', 'high'] } }],
  ['t-search_tickets', 'search_tickets', 'Full-text search across support tickets.', 'read', 'mcp-crm', 'bu-cs', { query: { type: 'string' }, status: { type: 'string' } }],
  ['t-read_mail', 'read_mail', 'Read messages from a mailbox folder.', 'read', 'mcp-mail', 'bu-it', { folder: { type: 'string' }, since: { type: 'string' } }],
  ['t-list_mail', 'list_mail', 'List message headers, optionally unread only.', 'read', 'mcp-mail', 'bu-it', { folder: { type: 'string' }, unread: { type: 'boolean' } }],
  ['t-send_email', 'send_email', 'Send an email on behalf of the signed-in user.', 'send', 'mcp-mail', 'bu-it', { to: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' } }],
  ['t-draft_reply', 'draft_reply', 'Create a draft reply without sending it.', 'write', 'mcp-mail', 'bu-it', { message_id: { type: 'string' }, body: { type: 'string' } }],
  ['t-issue_refund', 'issue_refund', 'Refund a card or UPI transaction to the customer.', 'payment', 'mcp-pay', 'bu-fin', { order_id: { type: 'string' }, amount: { type: 'number', description: 'INR' }, reason_code: { type: 'string' }, instant: { type: 'boolean', description: 'Added in latest scan' } }, { approved: false, quarantined: true, change: 'changed', previousHash: 'a91c04e7d2' }],
  ['t-get_transactions', 'get_transactions', 'List card and account transactions for a customer.', 'read', 'mcp-pay', 'bu-fin', { customer_id: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' } }],
  ['t-initiate_transfer', 'initiate_transfer', 'Initiate a treasury transfer between accounts.', 'payment', 'mcp-pay', 'bu-fin', { from_account: { type: 'string' }, to_account: { type: 'string' }, amount: { type: 'number' } }],
  ['t-get_employee', 'get_employee', 'Look up an employee profile from Workday.', 'read', 'mcp-hr', 'bu-hr', { employee_id: { type: 'string' } }],
  ['t-get_salary', 'get_salary', 'Return salary and compensation details for an employee.', 'read', 'mcp-hr', 'bu-hr', { employee_id: { type: 'string' } }],
  ['t-update_leave', 'update_leave', 'Apply, approve or cancel leave for an employee.', 'write', 'mcp-hr', 'bu-hr', { employee_id: { type: 'string' }, action: { type: 'string', enum: ['apply', 'approve', 'cancel'] }, days: { type: 'number' } }],
  ['t-search_docs', 'search_docs', 'Semantic search over SharePoint policy libraries.', 'read', 'mcp-docs', 'bu-ops', { query: { type: 'string' }, site: { type: 'string' } }],
  ['t-read_document', 'read_document', 'Read a document by SharePoint URL.', 'read', 'mcp-docs', 'bu-ops', { url: { type: 'string' } }],
  ['t-upload_document', 'upload_document', 'Upload a file to a SharePoint library.', 'write', 'mcp-docs', 'bu-ops', { site: { type: 'string' }, path: { type: 'string' } }],
  ['t-web_scrape', 'web_scrape', 'Fetch and parse arbitrary web pages.', 'read', 'mcp-ext', 'bu-wealth', { url: { type: 'string' } }, { approved: false, change: 'new' }],
  ['t-run_python', 'run_python', 'Execute Python code in a remote sandbox.', 'write', 'mcp-ext', 'bu-wealth', { code: { type: 'string' } }, { approved: false, change: 'new' }],
  ['t-sql_query', 'sql_query', 'Run a read-only SQL query against a Fabric warehouse.', 'read', null, 'bu-retail', { warehouse: { type: 'string' }, table: { type: 'string' }, query: { type: 'string' } }],
  ['t-calc_emi', 'calc_emi', 'Calculate EMI for a loan amount, rate and tenure.', 'read', null, 'bu-retail', { principal: { type: 'number' }, rate: { type: 'number' }, months: { type: 'number' } }],
  ['t-kyc_lookup', 'kyc_lookup', 'Verify PAN and Aadhaar against the KYC registry.', 'read', null, 'bu-retail', { pan: { type: 'string' }, aadhaar_last4: { type: 'string' } }],
  ['t-teams_notify', 'teams_notify', 'Post a message to a Microsoft Teams channel.', 'send', null, 'bu-ops', { channel: { type: 'string' }, message: { type: 'string' } }],
];

const owners: Record<string, string> = { 'mcp-crm': 'u-rahul', 'mcp-mail': 'u-karan', 'mcp-pay': 'u-priya', 'mcp-hr': 'u-rohan', 'mcp-docs': 'u-karan' };

export const tools: Tool[] = toolSeeds.map(([id, name, description, actionType, mcp, bu, schema, extra], i) => ({
  ...base(id, bu, 150 - i * 4, mcp ? `MCP · ${mcp.replace('mcp-', '')}` : 'Foundry · prod-hub'),
  name,
  description,
  actionType,
  mcpServerId: mcp,
  schema,
  schemaHash: (((i + 7) * 2654435761) >>> 0).toString(16).padStart(8, '0') + 'e3',
  approved: true,
  quarantined: false,
  change: null,
  owner: mcp ? owners[mcp] ?? null : 'u-arjun',
  ...extra,
}));

// ---------------------------------------------------------------- data sources
export const dataSources: DataSource[] = [
  { ...base('d-crm', 'bu-cs', 300, 'Fabric · cx-workspace'), name: 'Customer 360', type: 'Fabric lakehouse', sensitivity: 'Personal', columnsOfInterest: ['customer_name', 'phone', 'email', 'pan'], owner: 'u-rahul', label: 'Confidential – PII', change: null },
  { ...base('d-loans', 'bu-retail', 260, 'Fabric · lending'), name: 'Loan book', type: 'Fabric warehouse', sensitivity: 'Financial', columnsOfInterest: ['loan_amount', 'credit_score', 'salary', 'emi'], owner: 'u-arjun', label: 'Highly confidential', change: null },
  { ...base('d-hrdb', 'bu-hr', 240, 'Azure SQL · hr-core'), name: 'HR core (Workday mirror)', type: 'Azure SQL', sensitivity: 'Personal', columnsOfInterest: ['salary', 'aadhaar', 'bank_account', 'dob'], owner: 'u-rohan', label: 'Highly confidential', change: 'changed' },
  { ...base('d-kb', 'bu-ops', 400, 'SharePoint · policies'), name: 'Policy knowledge base', type: 'SharePoint', sensitivity: 'Internal', columnsOfInterest: [], owner: 'u-karan', label: 'General', change: null },
  { ...base('d-tickets', 'bu-cs', 280, 'Dataverse · service'), name: 'Support tickets', type: 'Dataverse', sensitivity: 'Personal', columnsOfInterest: ['customer_email', 'phone', 'transcript'], owner: 'u-rahul', label: 'Confidential – PII', change: null },
  { ...base('d-txn', 'bu-fin', 310, 'Azure SQL · cards'), name: 'Card transactions', type: 'Azure SQL', sensitivity: 'Financial', columnsOfInterest: ['card_number', 'merchant', 'amount'], owner: 'u-priya', label: 'PCI', change: null },
  { ...base('d-market', 'bu-wealth', 120, 'Blob · research'), name: 'Market research', type: 'Blob storage', sensitivity: 'Public', columnsOfInterest: [], owner: 'u-amit', change: null },
  { ...base('d-claims', 'bu-wealth', 18, 'AWS Bedrock · kb'), name: 'Health claims', type: 'Cosmos DB', sensitivity: 'Health', columnsOfInterest: ['diagnosis', 'policy_no', 'claim_amount'], owner: null, change: 'new' },
  { ...base('d-sales', 'bu-retail', 60, 'Fabric · sales'), name: 'Sales pipeline', type: 'Fabric lakehouse', sensitivity: 'Confidential', columnsOfInterest: ['deal_value', 'account'], owner: 'u-arjun', label: 'Confidential', change: null },
];

// ---------------------------------------------------------------- applications
export const applications: Application[] = [
  { ...base('app-care', 'bu-cs', 280), name: 'CarePoint Assistant', description: 'Customer-facing support assistant on web, app and WhatsApp.', url: 'https://care.corp.com', owner: 'u-rahul', sponsor: 'u-kavya', agentIds: ['ag-support', 'ag-refund', 'ag-support-eu'], channel: 'Customer', users: 412000 },
  { ...base('app-lend', 'bu-retail', 200), name: 'LendSmart', description: 'Personal-loan origination and servicing journey.', url: 'https://lend.corp.com', owner: 'u-arjun', sponsor: 'u-sanjay', agentIds: ['ag-loan', 'ag-kyc', 'ag-collections', 'ag-fraud', 'ag-denial'], channel: 'Customer', users: 86000 },
  { ...base('app-people', 'bu-hr', 160), name: 'PeopleDesk', description: 'HR helpdesk in Microsoft Teams for all employees.', url: 'https://teams.corp.com/peopledesk', owner: 'u-rohan', sponsor: 'u-lakshmi', agentIds: ['ag-hrhelp', 'ag-payroll', 'ag-leave', 'ag-onboard'], channel: 'Internal', users: 14200 },
  { ...base('app-fin', 'bu-fin', 140), name: 'FinOps Copilot', description: 'Assists the finance team with month-end close and reconciliation.', url: 'https://fin.corp.internal', owner: 'u-priya', sponsor: 'u-ishaan', agentIds: ['ag-close', 'ag-invoice', 'ag-transfer'], channel: 'Internal', users: 160 },
  { ...base('app-wealth', 'bu-wealth', 190), name: 'Wealth Advisor Pro', description: 'Relationship-manager and client portfolio assistant.', url: 'https://wealth.corp.com', owner: 'u-amit', sponsor: 'u-sunita', agentIds: ['ag-advisor', 'ag-research', 'ag-churn', 'ag-claims'], channel: 'Customer', users: 9400 },
  { ...base('app-ops', 'bu-ops', 110), name: 'OpsCenter', description: 'Incident triage and runbook assistant for SRE.', url: 'https://ops.corp.internal', owner: 'u-karan', sponsor: 'u-gaurav', agentIds: ['ag-ops', 'ag-docqa'], channel: 'Internal', users: 220 },
  { ...base('app-mail', 'bu-it', 80), name: 'Inbox Assist', description: 'Mailbox summaries and drafted replies for employees.', url: 'https://outlook.office.com', owner: 'u-karan', sponsor: 'u-gaurav', agentIds: ['ag-gmail'], channel: 'Internal', users: 3800 },
];

// ---------------------------------------------------------------- agents
type AgentSeed = Omit<Agent, Exclude<keyof ReturnType<typeof base>, 'id'> | 'tier' | 'score' | 'lastScanned'> & { bu: string; created: number; source: string; tierOverride?: Agent['tier'] };

const s = (actions: 1 | 2 | 3, data: 1 | 2 | 3, autonomy: 1 | 2 | 3, exposure: 1 | 2 | 3, impact: 1 | 2 | 3): SignalScores => ({ actions, data, autonomy, exposure, impact });

const agentSeeds: AgentSeed[] = [
  {
    id: 'ag-support', bu: 'bu-cs', created: 240, source: 'Foundry · prod-hub', name: 'Support Resolution Agent',
    description: 'Resolves customer queries end to end: looks up the customer, opens tickets, issues small refunds and emails confirmations.',
    purpose: 'Reduce average handle time for tier-1 support.', intendedUsers: 'Retail customers via CarePoint', platform: 'Azure AI Foundry', framework: 'Semantic Kernel',
    lifecycle: 'Approved', signals: s(3, 3, 2, 3, 2), owner: 'u-rahul', sponsor: 'u-kavya', agentRoleId: 'role-support', managed: true, version: '3.4.1',
    applicationId: 'app-care', modelIds: ['m-gpt4o', 'm-embed'], toolIds: ['t-get_customer', 't-create_ticket', 't-search_tickets', 't-issue_refund', 't-send_email', 't-update_customer'], dataSourceIds: ['d-crm', 'd-tickets'],
    humanInLoop: true, autonomy: 'Acts after approval', change: null, suspended: false, sdkConnected: true, runs7d: 48210, blockRate: 2.4, cost30d: 186400, nextReview: inDays(46), tags: ['customer-facing', 'payments'],
  },
  {
    id: 'ag-refund', bu: 'bu-cs', created: 60, source: 'Foundry · prod-hub', name: 'Refund Triage Agent',
    description: 'Classifies refund requests, checks transaction history and issues refunds within policy limits.',
    purpose: 'Automate refund decisions for disputed card transactions.', intendedUsers: 'Support agents and customers', platform: 'Azure AI Foundry', framework: 'OpenAI Agents SDK',
    lifecycle: 'In review', signals: s(3, 3, 2, 3, 3), owner: 'u-rahul', sponsor: 'u-kavya', agentRoleId: 'role-support', managed: true, version: '1.2.0',
    applicationId: 'app-care', modelIds: ['m-gpt4o'], toolIds: ['t-issue_refund', 't-get_transactions', 't-get_customer'], dataSourceIds: ['d-txn', 'd-crm'],
    humanInLoop: true, autonomy: 'Acts after approval', change: 'changed', suspended: false, sdkConnected: true, runs7d: 6120, blockRate: 8.9, cost30d: 42800, nextReview: null, tags: ['payments'],
  },
  {
    id: 'ag-loan', bu: 'bu-retail', created: 130, source: 'manual', name: 'Loan Eligibility Agent',
    description: 'Assesses personal-loan eligibility using bureau score, salary and existing obligations and proposes an offer.',
    purpose: 'Pre-qualify applicants within the LendSmart journey.', intendedUsers: 'Loan applicants', platform: 'Custom', framework: 'LangGraph',
    lifecycle: 'In review', signals: s(2, 3, 2, 3, 3), owner: 'u-arjun', sponsor: 'u-sanjay', agentRoleId: 'role-lending', managed: true, version: '2.0.0-rc2',
    applicationId: 'app-lend', modelIds: ['m-gpt41'], toolIds: ['t-sql_query', 't-calc_emi', 't-kyc_lookup', 't-get_customer'], dataSourceIds: ['d-loans', 'd-crm'],
    humanInLoop: false, autonomy: 'Acts alone', change: null, suspended: false, sdkConnected: true, runs7d: 9210, blockRate: 4.1, cost30d: 71200, nextReview: null, tags: ['customer-facing', 'credit decisions'],
  },
  {
    id: 'ag-kyc', bu: 'bu-retail', created: 210, source: 'Foundry · prod-hub', name: 'KYC Document Checker',
    description: 'Extracts and validates PAN and Aadhaar details from uploaded documents.',
    purpose: 'Speed up digital KYC for new accounts.', intendedUsers: 'Onboarding operations', platform: 'Azure AI Foundry', framework: 'Prompt flow',
    lifecycle: 'Approved', signals: s(1, 3, 2, 3, 3), owner: 'u-arjun', sponsor: 'u-sanjay', agentRoleId: 'role-lending', managed: true, version: '4.1.0',
    applicationId: 'app-lend', modelIds: ['m-gpt4o'], toolIds: ['t-kyc_lookup'], dataSourceIds: ['d-crm'],
    humanInLoop: true, autonomy: 'Acts after approval', change: null, suspended: false, sdkConnected: true, runs7d: 14100, blockRate: 0.6, cost30d: 58300, nextReview: inDays(12), tags: ['identity data'],
  },
  {
    id: 'ag-gmail', bu: 'bu-it', created: 75, source: 'manual', name: 'Gmail Summary Agent',
    description: 'Summarises inbox activity and drafts replies for employees. Never sends mail on its own.',
    purpose: 'Save time triaging email.', intendedUsers: 'All employees (opt-in)', platform: 'Custom', framework: 'LangChain',
    lifecycle: 'Approved', signals: s(1, 2, 2, 2, 1), owner: 'u-karan', sponsor: 'u-gaurav', agentRoleId: 'role-mail', managed: true, version: '1.6.2',
    applicationId: 'app-mail', modelIds: ['m-gpt4omini'], toolIds: ['t-read_mail', 't-list_mail', 't-draft_reply', 't-send_email'], dataSourceIds: [],
    humanInLoop: true, autonomy: 'Suggests only', change: null, suspended: false, sdkConnected: true, runs7d: 22840, blockRate: 1.2, cost30d: 9600, nextReview: inDays(210), tags: ['productivity'],
  },
  {
    id: 'ag-hrhelp', bu: 'bu-hr', created: 300, source: 'Copilot Studio · HR', name: 'HR Policy Assistant',
    description: 'Answers employee questions about leave, benefits and travel policy from SharePoint.',
    purpose: 'Deflect routine HR tickets.', intendedUsers: 'All employees', platform: 'Copilot Studio', framework: 'Copilot Studio',
    lifecycle: 'Approved', signals: s(1, 1, 1, 2, 1), owner: 'u-rohan', sponsor: 'u-lakshmi', agentRoleId: 'role-readonly', managed: true, version: '12',
    applicationId: 'app-people', modelIds: ['m-gpt4omini'], toolIds: ['t-search_docs', 't-read_document'], dataSourceIds: ['d-kb'],
    humanInLoop: false, autonomy: 'Suggests only', change: null, suspended: false, sdkConnected: false, runs7d: 31800, blockRate: 0.1, cost30d: 6400, nextReview: inDays(150), tags: [],
  },
  {
    id: 'ag-payroll', bu: 'bu-hr', created: 330, source: 'Fabric · hr-analytics', name: 'Payroll Query Agent',
    description: 'Answers payroll queries for HR business partners, including salary breakdowns and deductions.',
    purpose: 'Self-service payroll analytics for HRBPs.', intendedUsers: 'HR business partners', platform: 'Microsoft Fabric', framework: 'Fabric data agent',
    lifecycle: 'Review overdue', signals: s(1, 3, 2, 2, 3), owner: 'u-rohan', sponsor: 'u-lakshmi', agentRoleId: 'role-hr', managed: true, version: '2.3.0',
    applicationId: 'app-people', modelIds: ['m-gpt4o'], toolIds: ['t-get_employee', 't-get_salary', 't-sql_query'], dataSourceIds: ['d-hrdb'],
    humanInLoop: false, autonomy: 'Acts alone', change: null, suspended: false, sdkConnected: true, runs7d: 1820, blockRate: 6.8, cost30d: 14300, nextReview: inDays(-9), tags: ['salary data'],
  },
  {
    id: 'ag-leave', bu: 'bu-hr', created: 190, source: 'Copilot Studio · HR', name: 'Leave Management Agent',
    description: 'Applies and cancels leave on behalf of employees, routes approvals to managers.',
    purpose: 'Automate leave requests.', intendedUsers: 'All employees', platform: 'Copilot Studio', framework: 'Copilot Studio',
    lifecycle: 'Approved', signals: s(2, 2, 2, 2, 1), owner: 'u-rohan', sponsor: 'u-lakshmi', agentRoleId: 'role-hr', managed: true, version: '7',
    applicationId: 'app-people', modelIds: ['m-gpt4omini'], toolIds: ['t-update_leave', 't-get_employee'], dataSourceIds: [],
    humanInLoop: true, autonomy: 'Acts after approval', change: null, suspended: false, sdkConnected: true, runs7d: 9900, blockRate: 0.9, cost30d: 5100, nextReview: inDays(95), tags: [],
  },
  {
    id: 'ag-close', bu: 'bu-fin', created: 170, source: 'Foundry · finance', name: 'Month-end Close Agent',
    description: 'Drafts journal entries and reconciliation notes during month-end close.',
    purpose: 'Shorten the close cycle by two days.', intendedUsers: 'Finance controllers', platform: 'Azure AI Foundry', framework: 'Semantic Kernel',
    lifecycle: 'Approved', signals: s(2, 3, 2, 1, 2), owner: 'u-priya', sponsor: 'u-ishaan', agentRoleId: 'role-finance', managed: true, version: '2.8.0',
    applicationId: 'app-fin', modelIds: ['m-gpt4o', 'm-phi4'], toolIds: ['t-sql_query', 't-get_transactions', 't-upload_document'], dataSourceIds: ['d-txn'],
    humanInLoop: true, autonomy: 'Acts after approval', change: null, suspended: false, sdkConnected: true, runs7d: 2400, blockRate: 1.7, cost30d: 33900, nextReview: inDays(64), tags: [],
  },
  {
    id: 'ag-invoice', bu: 'bu-fin', created: 150, source: 'Fabric · finance', name: 'Invoice Matching Agent',
    description: 'Matches supplier invoices to purchase orders and flags mismatches.',
    purpose: 'Reduce manual three-way matching.', intendedUsers: 'Accounts payable', platform: 'Microsoft Fabric', framework: 'Fabric data agent',
    lifecycle: 'Approved', signals: s(1, 2, 2, 1, 1), owner: 'u-priya', sponsor: 'u-ishaan', agentRoleId: 'role-readonly', managed: true, version: '1.9.0',
    applicationId: 'app-fin', modelIds: ['m-phi4'], toolIds: ['t-sql_query'], dataSourceIds: ['d-txn'],
    humanInLoop: false, autonomy: 'Suggests only', change: null, suspended: false, sdkConnected: true, runs7d: 3100, blockRate: 0.2, cost30d: 2100, nextReview: inDays(240), tags: [],
  },
  {
    id: 'ag-transfer', bu: 'bu-fin', created: 9, source: 'manual', name: 'Treasury Transfer Agent',
    description: 'Executes inter-account treasury transfers based on liquidity forecasts.',
    purpose: 'Automate daily liquidity sweeps.', intendedUsers: 'Treasury desk', platform: 'Custom', framework: 'OpenAI Agents SDK',
    lifecycle: 'Draft', signals: s(3, 3, 3, 1, 3), owner: 'u-priya', sponsor: 'u-ishaan', agentRoleId: 'role-finance', managed: true, version: '0.3.0',
    applicationId: 'app-fin', modelIds: ['m-gpt41'], toolIds: ['t-initiate_transfer', 't-get_transactions'], dataSourceIds: ['d-txn'],
    humanInLoop: false, autonomy: 'Acts alone', change: 'new', suspended: false, sdkConnected: false, runs7d: 0, blockRate: 0, cost30d: 0, nextReview: null, tags: ['payments'],
  },
  {
    id: 'ag-advisor', bu: 'bu-wealth', created: 260, source: 'Foundry · wealth', name: 'Portfolio Advisor',
    description: 'Explains portfolio performance and proposes rebalancing for relationship managers to review.',
    purpose: 'Give RMs faster, consistent portfolio reviews.', intendedUsers: 'Relationship managers, HNI clients', platform: 'Azure AI Foundry', framework: 'Semantic Kernel',
    lifecycle: 'Approved', signals: s(1, 3, 2, 3, 3), owner: 'u-amit', sponsor: 'u-sunita', agentRoleId: 'role-readonly', managed: true, version: '5.0.2',
    applicationId: 'app-wealth', modelIds: ['m-gpt41', 'm-embed'], toolIds: ['t-get_customer', 't-get_transactions', 't-search_docs'], dataSourceIds: ['d-crm', 'd-market'],
    humanInLoop: true, autonomy: 'Acts after approval', change: null, suspended: false, sdkConnected: true, runs7d: 4700, blockRate: 1.1, cost30d: 51800, nextReview: inDays(21), tags: ['customer-facing', 'advice'],
  },
  {
    id: 'ag-research', bu: 'bu-wealth', created: 90, source: 'Foundry · wealth', name: 'Market Research Summariser',
    description: 'Summarises broker research and news into a daily brief.',
    purpose: 'Daily market brief for advisors.', intendedUsers: 'Wealth advisors', platform: 'Azure AI Foundry', framework: 'Prompt flow',
    lifecycle: 'Approved', signals: s(1, 1, 1, 2, 1), owner: 'u-amit', sponsor: 'u-sunita', agentRoleId: 'role-readonly', managed: true, version: '1.4.0',
    applicationId: 'app-wealth', modelIds: ['m-gpt4omini'], toolIds: ['t-search_docs', 't-web_scrape'], dataSourceIds: ['d-market'],
    humanInLoop: false, autonomy: 'Suggests only', change: 'changed', suspended: false, sdkConnected: true, runs7d: 700, blockRate: 14.2, cost30d: 3800, nextReview: inDays(120), tags: [],
  },
  {
    id: 'ag-churn', bu: 'bu-wealth', created: 400, source: 'Fabric · wealth-analytics', name: 'Churn Predictor Agent',
    description: 'Flags clients at risk of moving assets and suggests retention actions.',
    purpose: 'Retention campaigns.', intendedUsers: 'Wealth marketing', platform: 'Microsoft Fabric', framework: 'Fabric data agent',
    lifecycle: 'Deprecated', signals: s(1, 2, 2, 2, 2), owner: 'u-deepa', sponsor: 'u-sunita', agentRoleId: 'role-readonly', managed: true, version: '0.9.4',
    applicationId: 'app-wealth', modelIds: ['m-gpt4omini'], toolIds: ['t-sql_query'], dataSourceIds: ['d-crm'],
    humanInLoop: false, autonomy: 'Suggests only', change: null, suspended: false, sdkConnected: false, runs7d: 120, blockRate: 0, cost30d: 900, nextReview: inDays(-30), tags: [],
  },
  {
    id: 'ag-ops', bu: 'bu-ops', created: 110, source: 'manual', name: 'Incident Triage Agent',
    description: 'Correlates alerts, opens tickets and posts summaries to the on-call Teams channel.',
    purpose: 'Cut mean time to acknowledge.', intendedUsers: 'SRE on-call', platform: 'Custom', framework: 'LangGraph',
    lifecycle: 'Approved', signals: s(2, 1, 3, 1, 2), owner: 'u-karan', sponsor: 'u-gaurav', agentRoleId: 'role-ops', managed: true, version: '2.2.0',
    applicationId: 'app-ops', modelIds: ['m-gpt4omini', 'm-gpt4o'], toolIds: ['t-search_tickets', 't-teams_notify', 't-create_ticket', 't-search_docs'], dataSourceIds: ['d-kb'],
    humanInLoop: false, autonomy: 'Acts alone', change: null, suspended: false, sdkConnected: true, runs7d: 5300, blockRate: 0.4, cost30d: 7800, nextReview: inDays(80), tags: [],
  },
  {
    id: 'ag-docqa', bu: 'bu-ops', created: 220, source: 'Copilot Studio · Ops', name: 'Runbook Q&A',
    description: 'Answers questions from SRE runbooks and postmortems.',
    purpose: 'Faster runbook lookup.', intendedUsers: 'SRE and support', platform: 'Copilot Studio', framework: 'Copilot Studio',
    lifecycle: 'Approved', signals: s(1, 1, 1, 1, 1), owner: 'u-karan', sponsor: 'u-gaurav', agentRoleId: 'role-readonly', managed: true, version: '4',
    applicationId: 'app-ops', modelIds: ['m-gpt4omini'], toolIds: ['t-search_docs', 't-read_document'], dataSourceIds: ['d-kb'],
    humanInLoop: false, autonomy: 'Suggests only', change: null, suspended: false, sdkConnected: false, runs7d: 2100, blockRate: 0, cost30d: 1200, nextReview: inDays(300), tags: [],
  },
  {
    id: 'ag-claims', bu: 'bu-wealth', created: 14, source: 'AWS Bedrock · ap-south-1', name: 'Claims Adjudication Agent',
    description: 'Reads health insurance claims and recommends approve or reject.',
    purpose: 'Unknown — discovered by the Bedrock connector.', intendedUsers: 'Unknown', platform: 'AWS Bedrock', framework: 'Bedrock Agents',
    lifecycle: 'Draft', signals: s(2, 3, 3, 3, 3), owner: null, sponsor: null, agentRoleId: null, managed: false, version: '1',
    applicationId: 'app-wealth', modelIds: ['m-llama'], toolIds: [], dataSourceIds: ['d-claims'],
    humanInLoop: false, autonomy: 'Acts alone', change: 'new', suspended: false, sdkConnected: false, runs7d: 860, blockRate: 0, cost30d: 11200, nextReview: null, tags: ['health data'],
  },
  {
    id: 'ag-scraper', bu: 'bu-wealth', created: 4, source: 'Trace discovery', name: 'Lead Scraper Bot',
    description: 'Scrapes public websites for prospect contact details.',
    purpose: 'Unknown — seen in traces calling tools-hub.dev.', intendedUsers: 'Unknown', platform: 'Custom', framework: 'Unknown',
    lifecycle: 'Draft', signals: s(2, 2, 3, 1, 1), owner: null, sponsor: null, agentRoleId: null, managed: false, version: '—',
    applicationId: null, modelIds: ['m-mistral'], toolIds: ['t-web_scrape', 't-run_python'], dataSourceIds: [],
    humanInLoop: false, autonomy: 'Acts alone', change: 'new', suspended: false, sdkConnected: false, runs7d: 340, blockRate: 0, cost30d: 2700, nextReview: null, tags: [],
  },
  {
    id: 'ag-sales', bu: 'bu-retail', created: 2, source: 'Fabric · sales', name: 'Sales Insights Agent',
    description: 'Natural-language questions over the sales pipeline lakehouse.',
    purpose: 'Unknown — owner has not confirmed.', intendedUsers: 'Unknown', platform: 'Microsoft Fabric', framework: 'Fabric data agent',
    lifecycle: 'Draft', signals: s(1, 2, 1, 1, 1), owner: null, sponsor: null, agentRoleId: null, managed: false, version: '1',
    applicationId: null, modelIds: ['m-gpt4omini'], toolIds: ['t-sql_query'], dataSourceIds: ['d-sales'],
    humanInLoop: false, autonomy: 'Suggests only', change: 'new', suspended: false, sdkConnected: false, runs7d: 95, blockRate: 0, cost30d: 400, nextReview: null, tags: [],
  },
  {
    id: 'ag-support-eu', bu: 'bu-cs', created: 3, source: 'Foundry · eu-hub', name: 'Support Resolution Agent (EU copy)',
    description: 'Resolves customer queries end to end: looks up the customer, opens tickets and issues small refunds.',
    purpose: 'Unknown — near-identical to Support Resolution Agent.', intendedUsers: 'Unknown', platform: 'Azure AI Foundry', framework: 'Semantic Kernel',
    lifecycle: 'Draft', signals: s(3, 3, 2, 3, 2), owner: null, sponsor: null, agentRoleId: null, managed: false, version: '3.4.0',
    applicationId: 'app-care', modelIds: ['m-gpt41'], toolIds: ['t-get_customer', 't-create_ticket', 't-issue_refund'], dataSourceIds: ['d-crm'],
    humanInLoop: true, autonomy: 'Acts after approval', change: 'new', suspended: false, sdkConnected: false, runs7d: 210, blockRate: 0, cost30d: 1900, nextReview: null, tags: ['customer-facing'],
  },
  {
    id: 'ag-collections', bu: 'bu-retail', created: 180, source: 'Foundry · prod-hub', name: 'Collections Reminder Agent',
    description: 'Sends personalised EMI reminders and offers payment plans to borrowers.',
    purpose: 'Reduce early-bucket delinquency.', intendedUsers: 'Borrowers', platform: 'Azure AI Foundry', framework: 'Prompt flow',
    lifecycle: 'Approved', signals: s(2, 3, 2, 3, 2), owner: 'u-arjun', sponsor: 'u-sanjay', agentRoleId: 'role-lending', managed: true, version: '3.0.1',
    applicationId: 'app-lend', modelIds: ['m-gpt4omini'], toolIds: ['t-get_customer', 't-send_email', 't-sql_query'], dataSourceIds: ['d-loans', 'd-crm'],
    humanInLoop: false, autonomy: 'Acts alone', change: null, suspended: false, sdkConnected: true, runs7d: 18800, blockRate: 3.3, cost30d: 12400, nextReview: inDays(33), tags: ['customer-facing'],
  },
  {
    id: 'ag-onboard', bu: 'bu-hr', created: 20, source: 'Copilot Studio · HR', name: 'Employee Onboarding Agent',
    description: 'Guides new joiners through day-one tasks and raises IT access requests.',
    purpose: 'Smoother onboarding.', intendedUsers: 'New joiners', platform: 'Copilot Studio', framework: 'Copilot Studio',
    lifecycle: 'In review', signals: s(2, 2, 2, 2, 1), owner: 'u-rohan', sponsor: 'u-lakshmi', agentRoleId: 'role-hr', managed: true, version: '1',
    applicationId: 'app-people', modelIds: ['m-gpt4omini'], toolIds: ['t-get_employee', 't-create_ticket', 't-search_docs'], dataSourceIds: ['d-kb'],
    humanInLoop: true, autonomy: 'Acts after approval', change: null, suspended: false, sdkConnected: false, runs7d: 0, blockRate: 0, cost30d: 0, nextReview: null, tags: [],
  },
  {
    id: 'ag-fraud', bu: 'bu-retail', created: 160, source: 'Foundry · prod-hub', name: 'Fraud Alert Explainer',
    description: 'Explains why a transaction was flagged and guides the customer through verification.',
    purpose: 'Reduce false-positive friction.', intendedUsers: 'Card customers', platform: 'Azure AI Foundry', framework: 'Semantic Kernel',
    lifecycle: 'Suspended', signals: s(1, 3, 2, 3, 2), owner: 'u-arjun', sponsor: 'u-sanjay', agentRoleId: 'role-support', managed: true, version: '2.1.3',
    applicationId: 'app-lend', modelIds: ['m-gpt4o'], toolIds: ['t-get_transactions', 't-get_customer', 't-send_email'], dataSourceIds: ['d-txn', 'd-crm'],
    humanInLoop: false, autonomy: 'Acts alone', change: null, suspended: true, sdkConnected: true, runs7d: 7400, blockRate: 5.6, cost30d: 21900, nextReview: inDays(58), tags: ['customer-facing'],
  },
  {
    id: 'ag-denial', bu: 'bu-retail', created: 5, source: 'manual', name: 'Automated Credit Denial Bot',
    description: 'Automatically rejects loan applications below a model-predicted threshold with no human review.',
    purpose: 'Reduce underwriting workload.', intendedUsers: 'Loan applicants', platform: 'Custom', framework: 'LangGraph',
    lifecycle: 'Draft', signals: s(2, 3, 3, 3, 3), owner: 'u-arjun', sponsor: 'u-sanjay', agentRoleId: null, managed: true, version: '0.1.0',
    applicationId: 'app-lend', modelIds: ['m-o3mini'], toolIds: ['t-sql_query'], dataSourceIds: ['d-loans'],
    humanInLoop: false, autonomy: 'Acts alone', change: 'new', suspended: false, sdkConnected: false, runs7d: 0, blockRate: 0, cost30d: 0, nextReview: null, tags: ['credit decisions'], tierOverride: 'Prohibited',
  },
];

export const agents: Agent[] = agentSeeds.map(({ bu, created, source, tierOverride, ...a }) => {
  const { total, tier } = tierFor(a.signals, a);
  return {
    ...base(a.id, bu, created, source, a.owner ?? 'system'),
    ...a,
    score: total,
    tier: tierOverride ?? tier,
    lastScanned: source === 'manual' ? daysAgo(1) : minsAgo(42),
  };
});

// ---------------------------------------------------------------- lineage
let edgeN = 0;
const edge = (from: string, to: string, relation: LineageEdge['relation'], source: LineageEdge['source'] = 'auto'): LineageEdge => ({ id: `e-${++edgeN}`, from, to, relation, source });

export const lineage: LineageEdge[] = [
  ...applications.flatMap((app) => app.agentIds.map((a) => edge(app.id, a, 'contains', app.id === 'app-lend' || app.id === 'app-mail' ? 'manual' : 'auto'))),
  ...agents.flatMap((a) => [
    ...a.modelIds.map((m) => edge(a.id, m, 'uses')),
    ...a.toolIds.map((t) => edge(a.id, t, 'calls')),
    ...a.dataSourceIds.map((d) => edge(a.id, d, 'reads', a.source === 'manual' ? 'manual' : 'auto')),
  ]),
  ...mcpServers.flatMap((m) => m.toolIds.map((t) => edge(m.id, t, 'hosts'))),
  edge('t-sql_query', 'd-loans', 'reads'),
  edge('t-sql_query', 'd-txn', 'reads'),
  edge('t-get_customer', 'd-crm', 'reads'),
  edge('t-get_salary', 'd-hrdb', 'reads'),
  edge('t-get_transactions', 'd-txn', 'reads'),
  edge('t-search_tickets', 'd-tickets', 'reads'),
  edge('t-search_docs', 'd-kb', 'reads'),
];

export const lastScanAt = hoursAgo(0.7);
