import type { Agent, RiskRuleConfig, RiskTier, SignalKey, SignalScores } from './types';

export const SIGNALS: { key: SignalKey; label: string; source: string; levels: [string, string, string] }[] = [
  { key: 'actions', label: 'Actions', source: 'Tool action types and parameters', levels: ['Read only', 'Create / update', 'Delete, send outside, payment'] },
  { key: 'data', label: 'Data sensitivity', source: 'Sensitivity labels and column names', levels: ['Public', 'Internal', 'Personal, financial, health'] },
  { key: 'autonomy', label: 'Autonomy', source: 'Human-approval step, schedule', levels: ['Suggests only', 'Acts after approval', 'Acts alone'] },
  { key: 'exposure', label: 'Exposure', source: 'Channel and user count', levels: ['Few internal users', 'Whole organisation', 'Customers / public'] },
  { key: 'impact', label: 'Impact', source: 'Use-case impact classifier', levels: ['Convenience', 'Work output', "Decisions on people's money, jobs, health"] },
];

export const defaultRiskConfig: RiskRuleConfig = {
  weights: { actions: 1, data: 1, autonomy: 1, exposure: 1, impact: 1 },
  thresholds: { low: [5, 7], medium: [8, 11], high: [12, 15] },
  overrides: [
    { id: 'ov-1', rule: 'Payment tool with no human-approval step', enabled: true, result: 'High' },
    { id: 'ov-2', rule: 'Reads health or national-ID data (Aadhaar, diagnosis)', enabled: true, result: 'High' },
    { id: 'ov-3', rule: "Makes decisions about customers' loans, jobs or insurance", enabled: true, result: 'High' },
    { id: 'ov-4', rule: 'Fully automated adverse credit decision with no human review', enabled: true, result: 'Prohibited' },
    { id: 'ov-5', rule: 'Uses a model hosted outside India for customer data', enabled: false, result: 'High' },
  ],
};

type OverrideInput = Pick<Agent, 'humanInLoop' | 'toolIds' | 'tags' | 'dataSourceIds'>;

export function overridesFor(a: OverrideInput): string[] {
  const hits: string[] = [];
  const hasPayment = a.toolIds.some((t) => t === 't-issue_refund' || t === 't-initiate_transfer');
  if (hasPayment && !a.humanInLoop) hits.push('Payment tool with no human-approval step');
  if (a.dataSourceIds.includes('d-hrdb') || a.dataSourceIds.includes('d-claims') || a.toolIds.includes('t-kyc_lookup'))
    hits.push('Reads health or national-ID data (Aadhaar, diagnosis)');
  if (a.tags.includes('credit decisions') || a.tags.includes('health data'))
    hits.push("Makes decisions about customers' loans, jobs or insurance");
  return hits;
}

export function tierFor(signals: SignalScores, a?: OverrideInput, cfg: RiskRuleConfig = defaultRiskConfig): { total: number; tier: RiskTier; overrides: string[] } {
  const total = (Object.keys(signals) as SignalKey[]).reduce((sum, k) => sum + signals[k] * cfg.weights[k], 0);
  const rounded = Math.round(total);
  let tier: RiskTier = rounded >= cfg.thresholds.high[0] ? 'High' : rounded >= cfg.thresholds.medium[0] ? 'Medium' : 'Low';
  const overrides = a ? overridesFor(a) : [];
  const enabled = new Set(cfg.overrides.filter((o) => o.enabled).map((o) => o.rule));
  if (overrides.some((o) => enabled.has(o))) tier = 'High';
  return { total: rounded, tier, overrides };
}

const DATA_FACT: Record<string, string> = {
  'd-crm': 'Customer 360 has columns pan, phone, email (label: Confidential – PII)',
  'd-loans': 'Loan book has columns salary, credit_score (label: Highly confidential)',
  'd-hrdb': 'HR core has columns salary, aadhaar, bank_account',
  'd-claims': 'Health claims has column diagnosis (no label — tagged by sensitivity tagger)',
  'd-txn': 'Card transactions has card_number (label: PCI)',
  'd-tickets': 'Support tickets hold customer email and transcripts',
  'd-kb': 'Policy knowledge base is labelled General',
  'd-market': 'Market research is public',
  'd-sales': 'Sales pipeline labelled Confidential',
};

export function factsFor(a: Agent, toolName: (id: string) => string): Record<SignalKey, string> {
  const riskyTools = a.toolIds.filter((t) => /refund|transfer|delete|send|notify/.test(t)).map(toolName);
  const writeTools = a.toolIds.filter((t) => /update|create|upload|leave|draft|python/.test(t)).map(toolName);
  return {
    actions:
      a.signals.actions === 3
        ? `Uses ${riskyTools.join(', ') || 'a payment or send tool'}`
        : a.signals.actions === 2
          ? `Can write via ${writeTools.join(', ') || 'create/update tools'}`
          : 'All tools are read-only',
    data: a.dataSourceIds.length ? DATA_FACT[a.dataSourceIds[0]] ?? 'Reads internal data' : 'No data sources linked; mailbox content only',
    autonomy: a.humanInLoop ? `Human-approval step present (${a.autonomy.toLowerCase()})` : a.autonomy === 'Suggests only' ? 'Only suggests; user acts' : 'No approval step; runs unattended',
    exposure:
      a.signals.exposure === 3 ? 'Customer channel (web, app or WhatsApp)' : a.signals.exposure === 2 ? 'Available to the whole organisation' : 'Fewer than 250 internal users',
    impact:
      a.signals.impact === 3
        ? "Classifier: decides on people's money, credit or health (confidence 0.91)"
        : a.signals.impact === 2
          ? 'Classifier: produces work output reviewed by staff (confidence 0.84)'
          : 'Classifier: convenience use case (confidence 0.88)',
  };
}
