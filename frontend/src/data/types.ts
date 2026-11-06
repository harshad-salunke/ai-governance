// Domain types mirroring the PRD §4 core objects. The backend's Pydantic
// schemas should match these shapes so the mock layer can be swapped out.

export type ID = string;

export type RoleKey =
  | 'platform_admin'
  | 'governance_lead'
  | 'security_admin'
  | 'risk_reviewer'
  | 'agent_owner'
  | 'business_sponsor'
  | 'finops_manager'
  | 'auditor';

export type Platform = 'Azure AI Foundry' | 'Microsoft Fabric' | 'Copilot Studio' | 'Custom' | 'AWS Bedrock';
export type Source = 'manual' | string;
export type Lifecycle = 'Draft' | 'In review' | 'Approved' | 'Deprecated' | 'Retired' | 'Review overdue' | 'Suspended';
export type RiskTier = 'Low' | 'Medium' | 'High' | 'Prohibited' | 'Unscored';
export type ChangeFlag = 'new' | 'changed' | 'removed' | null;
export type ActionType = 'read' | 'write' | 'delete' | 'send' | 'payment';
export type Sensitivity = 'Public' | 'Internal' | 'Confidential' | 'Personal' | 'Financial' | 'Health';
export type Decision = 'allow' | 'block' | 'ask_human' | 'redact' | 'audit';
export type PolicyMode = 'monitor' | 'enforce';
export type Severity = 'Low' | 'Medium' | 'High' | 'Critical';

export interface BaseObject {
  id: ID;
  businessUnitId: ID;
  createdAt: string;
  updatedAt: string;
  createdBy: ID;
  source: Source;
}

export interface BusinessUnit {
  id: ID;
  name: string;
  head: ID;
  costCentre: string;
}

export interface User {
  id: ID;
  name: string;
  email: string;
  title: string;
  businessUnitId: ID;
  roles: RoleKey[];
  status: 'active' | 'disabled';
  manager?: ID;
  lastActive: string;
}

export interface Application extends BaseObject {
  name: string;
  description: string;
  url: string;
  owner: ID;
  sponsor: ID;
  agentIds: ID[];
  channel: 'Internal' | 'Customer';
  users: number;
}

export type SignalKey = 'actions' | 'data' | 'autonomy' | 'exposure' | 'impact';
export type SignalScores = Record<SignalKey, 1 | 2 | 3>;

export interface Agent extends BaseObject {
  name: string;
  description: string;
  purpose: string;
  intendedUsers: string;
  platform: Platform;
  framework: string;
  lifecycle: Lifecycle;
  tier: RiskTier;
  score: number;
  signals: SignalScores;
  owner: ID | null;
  sponsor: ID | null;
  agentRoleId: ID | null;
  managed: boolean;
  version: string;
  applicationId: ID | null;
  modelIds: ID[];
  toolIds: ID[];
  dataSourceIds: ID[];
  humanInLoop: boolean;
  autonomy: 'Suggests only' | 'Acts after approval' | 'Acts alone';
  change: ChangeFlag;
  suspended: boolean;
  sdkConnected: boolean;
  runs7d: number;
  blockRate: number;
  cost30d: number;
  lastScanned: string;
  nextReview: string | null;
  tags: string[];
}

export interface Model extends BaseObject {
  provider: string;
  name: string;
  version: string;
  deployment: string;
  region: string;
  approved: boolean;
  pricePer1kIn: number;
  pricePer1kOut: number;
  change: ChangeFlag;
}

export interface Tool extends BaseObject {
  name: string;
  description: string;
  actionType: ActionType;
  mcpServerId: ID | null;
  schema: Record<string, { type: string; description?: string; enum?: string[] }>;
  schemaHash: string;
  previousHash?: string;
  approved: boolean;
  quarantined: boolean;
  change: ChangeFlag;
  owner: ID | null;
}

export interface McpServer extends BaseObject {
  name: string;
  url: string;
  transport: 'streamable-http' | 'sse' | 'stdio';
  owner: ID | null;
  toolIds: ID[];
  lastScanned: string;
  known: boolean;
  change: ChangeFlag;
}

export interface DataSource extends BaseObject {
  name: string;
  type: 'Fabric lakehouse' | 'Fabric warehouse' | 'Azure SQL' | 'SharePoint' | 'Blob storage' | 'Cosmos DB' | 'Dataverse';
  sensitivity: Sensitivity;
  columnsOfInterest: string[];
  owner: ID | null;
  label?: string;
  change: ChangeFlag;
}

export type ObjectKind = 'application' | 'agent' | 'model' | 'tool' | 'mcp' | 'data';

export interface LineageEdge {
  id: ID;
  from: ID;
  to: ID;
  relation: 'contains' | 'uses' | 'calls' | 'reads' | 'hosts';
  source: 'auto' | 'manual';
}

export interface Connector {
  id: ID;
  name: string;
  type: 'Azure AI Foundry' | 'Microsoft Fabric' | 'MCP server' | 'Copilot Studio' | 'AWS Bedrock';
  scope: string;
  credentialsRef: string;
  schedule: string;
  lastRun: string;
  nextRun: string;
  status: 'healthy' | 'warning' | 'failed' | 'paused';
  itemsFound: number;
  newItems: number;
  errors: string[];
  durationSec: number;
  history: { at: string; status: 'healthy' | 'warning' | 'failed'; items: number; durationSec: number }[];
}

export interface RiskAssessment {
  id: ID;
  agentId: ID;
  version: number;
  signals: SignalScores;
  facts: Record<SignalKey, string>;
  overrides: string[];
  total: number;
  tier: RiskTier;
  reviewer: ID | null;
  status: 'Auto-scored' | 'Owner confirmed' | 'Under review' | 'Accepted' | 'Adjusted';
  adjustedReason?: string;
  createdAt: string;
}

export interface RiskRuleConfig {
  weights: Record<SignalKey, number>;
  thresholds: { low: [number, number]; medium: [number, number]; high: [number, number] };
  overrides: { id: ID; rule: string; enabled: boolean; result: RiskTier }[];
}

export interface Control {
  id: ID;
  code: string;
  name: string;
  description: string;
  tiers: RiskTier[];
  evidence: string;
  category: 'Data protection' | 'Human oversight' | 'Security' | 'Accountability' | 'Quality';
  linkedPolicyType?: string;
  addedBySignal?: SignalKey;
}

export interface ControlEvidence {
  id: ID;
  controlId: ID;
  agentId: ID;
  kind: 'file' | 'link' | 'auto';
  ref: string;
  submittedBy: ID;
  submittedAt: string;
  status: 'Accepted' | 'Submitted' | 'Rejected' | 'Missing';
  reviewer?: ID;
}

export interface WorkflowStep {
  name: string;
  approverRole: RoleKey | 'owner' | 'auto';
  mode: 'sequential' | 'parallel';
  slaHours: number;
}

export interface Workflow {
  id: ID;
  name: string;
  tier: RiskTier;
  steps: WorkflowStep[];
}

export interface ApprovalRequest {
  id: ID;
  objectId: ID;
  objectKind: ObjectKind;
  title: string;
  workflowId: ID;
  requestedBy: ID;
  requestedAt: string;
  dueAt: string;
  currentStep: number;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Changes requested';
  steps: { name: string; approver: ID | null; role: string; decision: 'approved' | 'rejected' | 'pending' | 'waiting' | 'changes'; at?: string; comment?: string }[];
  reason: string;
  controlsReady: number;
  controlsTotal: number;
}

export interface GovernancePolicy {
  id: ID;
  name: string;
  description: string;
  rule: string;
  severity: Severity;
  enabled: boolean;
  violations: number;
  category: string;
}

export interface GovernanceViolation {
  id: ID;
  policyId: ID;
  agentId: ID;
  detail: string;
  detectedAt: string;
  status: 'Open' | 'Waived' | 'Resolved';
}

export interface Review {
  id: ID;
  agentId: ID;
  dueAt: string;
  cadence: '6 months' | '12 months';
  status: 'Upcoming' | 'Due' | 'Overdue' | 'Completed';
  reviewer: ID;
}

export interface ExceptionGrant {
  id: ID;
  agentId: ID;
  waived: string;
  reason: string;
  approver: ID;
  grantedAt: string;
  expiresAt: string;
  status: 'Active' | 'Expiring' | 'Expired' | 'Revoked';
}

export interface Incident {
  id: ID;
  key: string;
  agentId: ID;
  title: string;
  severity: Severity;
  description: string;
  linkedDecisionIds: ID[];
  owner: ID;
  status: 'Open' | 'Investigating' | 'Mitigated' | 'Resolved';
  fix?: string;
  openedAt: string;
  agentSuspended: boolean;
}

export interface AgentRole {
  id: ID;
  name: string;
  description: string;
  allowedToolIds: ID[];
  allowedActions: ActionType[];
  allowedModelIds: ID[];
  allowedRegions: string[];
  allowedDataClasses: Sensitivity[];
  defaultDecision: 'allow' | 'block';
}

export type Operator = '=' | '≠' | '>' | '<' | 'in' | 'contains' | 'regex';

export interface PolicyCondition {
  field: string;
  op: Operator;
  value: string;
}

export interface RuntimePolicy {
  id: ID;
  name: string;
  description: string;
  type: 'Tool access' | 'Parameter rule' | 'Data rule' | 'User context' | 'Model access' | 'Environment' | 'Content';
  scope: { kind: 'agent' | 'role' | 'tool' | 'all'; id?: ID };
  toolId: ID | null;
  conditions: PolicyCondition[];
  decision: Decision;
  reason: string;
  mode: PolicyMode;
  version: number;
  author: ID;
  updatedAt: string;
  status: 'Active' | 'Draft' | 'Pending approval';
  hits7d: number;
  priority: number;
  history: { version: number; at: string; by: ID; note: string }[];
}

export interface DecisionRecord {
  id: ID;
  at: string;
  agentId: ID;
  user: string;
  toolId: ID;
  params: Record<string, string | number | boolean>;
  policyId: ID | null;
  decision: Decision;
  mode: PolicyMode;
  latencyMs: number;
  reason: string;
  environment: 'prod' | 'staging' | 'dev';
}

export interface ApprovalTask {
  id: ID;
  decisionId: ID;
  agentId: ID;
  user: string;
  toolId: ID;
  params: Record<string, string | number | boolean>;
  reason: string;
  approver: ID;
  createdAt: string;
  timeoutAt: string;
  status: 'Pending' | 'Approved' | 'Denied' | 'Timed out';
  channel: 'Portal' | 'Teams' | 'Email';
}

export interface TraceSpan {
  id: ID;
  name: string;
  kind: 'agent' | 'llm' | 'tool' | 'policy' | 'retrieval';
  start: number;
  duration: number;
  status: 'ok' | 'error' | 'blocked';
  detail?: string;
  tokensIn?: number;
  tokensOut?: number;
  decision?: Decision;
  depth: number;
}

export interface Trace {
  id: ID;
  agentId: ID;
  user: string;
  startedAt: string;
  durationMs: number;
  status: 'ok' | 'error' | 'blocked';
  userMessage: string;
  finalAnswer: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  spans: TraceSpan[];
}

export interface Budget {
  id: ID;
  name: string;
  scope: 'agent' | 'team' | 'model';
  scopeId: ID;
  limit: number;
  spent: number;
  period: 'Monthly' | 'Quarterly';
  unit: 'INR' | 'tokens';
  action: 'Alert only' | 'Require approval' | 'Block';
  alerts: number[];
}

export interface AuditEvent {
  id: ID;
  at: string;
  actor: ID | 'system' | 'sdk';
  action: string;
  objectKind: string;
  objectId: ID;
  objectName: string;
  before?: string;
  after?: string;
  hash: string;
  prevHash: string;
}

export interface ReportTemplate {
  id: ID;
  name: string;
  description: string;
  sections: string[];
  lastGenerated: string;
}

export interface ReportSchedule {
  id: ID;
  templateId: ID;
  cadence: 'Weekly' | 'Monthly';
  recipients: string[];
  nextRun: string;
  format: 'PDF' | 'CSV';
  enabled: boolean;
}

export interface ApiKey {
  id: ID;
  name: string;
  prefix: string;
  scope: 'runtime' | 'registration' | 'read-only';
  agentId?: ID;
  createdBy: ID;
  createdAt: string;
  lastUsed: string | null;
  expiresAt: string;
  status: 'Active' | 'Revoked' | 'Expiring';
}

export interface CustomField {
  id: ID;
  label: string;
  type: 'text' | 'list' | 'date';
  appliesTo: ObjectKind[];
  options?: string[];
  required: boolean;
}

export interface Notification {
  id: ID;
  at: string;
  title: string;
  body: string;
  kind: 'approval' | 'violation' | 'incident' | 'scan' | 'budget' | 'review';
  href: string;
  read: boolean;
}

export interface Duplicate {
  id: ID;
  agentIds: [ID, ID];
  similarity: number;
  reason: string;
  status: 'Open' | 'Merged' | 'Dismissed';
}

export interface ShadowHint {
  id: ID;
  kind: 'No owner' | 'Unapproved model' | 'Unknown MCP server' | 'Traces without SDK';
  objectId: ID;
  objectKind: ObjectKind;
  detail: string;
  detectedAt: string;
}

export interface OwnershipTransfer {
  id: ID;
  objectId: ID;
  from: ID | null;
  to: ID;
  reason: string;
  at: string;
  by: ID;
}

export interface Claim {
  id: ID;
  agentId: ID;
  claimant: ID;
  at: string;
  status: 'Pending admin' | 'Confirmed' | 'Rejected';
}

export interface Orphan {
  id: ID;
  agentId: ID;
  missing: 'owner' | 'sponsor';
  formerUser: ID;
  suggested: ID;
  detectedAt: string;
}
