import type { State } from '../data/store';
import type { ChangeFlag, Lifecycle, ObjectKind, RiskTier } from '../data/types';

/** One searchable record per asset, whatever its type (Purview / DataHub style). */
export interface CatalogAsset {
  id: string;
  kind: ObjectKind;
  name: string;
  description: string;
  qualifiedName: string;
  source: string; // connector or "Manual registration"
  sourceType: string; // platform the asset lives on
  collection: string; // business unit id
  owner: string | null;
  classifications: string[];
  tags: string[];
  tier?: RiskTier;
  lifecycle?: Lifecycle;
  status: 'Approved' | 'Not approved' | 'Quarantined' | 'Unknown' | 'Unmanaged' | null;
  managed: boolean;
  change: ChangeFlag;
  updatedAt: string;
}

export const KIND_ORDER: ObjectKind[] = ['application', 'agent', 'model', 'tool', 'mcp', 'data'];

const COLUMN_CLASSIFICATION: Record<string, string> = {
  pan: 'PAN number',
  aadhaar: 'Aadhaar number',
  phone: 'Phone number',
  email: 'Email address',
  customer_email: 'Email address',
  customer_name: 'Person name',
  salary: 'Salary',
  credit_score: 'Credit score',
  bank_account: 'Bank account number',
  card_number: 'Credit card number',
  dob: 'Date of birth',
  diagnosis: 'Health condition',
  transcript: 'Free text with PII',
  claim_amount: 'Financial amount',
  loan_amount: 'Financial amount',
};

export function classificationsFor(columns: string[]): string[] {
  return Array.from(new Set(columns.map((c) => COLUMN_CLASSIFICATION[c]).filter(Boolean)));
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const DATA_PLATFORM: Record<string, string> = {
  'Fabric lakehouse': 'Microsoft Fabric',
  'Fabric warehouse': 'Microsoft Fabric',
  'Azure SQL': 'Azure SQL Database',
  SharePoint: 'SharePoint Online',
  'Blob storage': 'Azure Blob Storage',
  'Cosmos DB': 'Azure Cosmos DB',
  Dataverse: 'Microsoft Dataverse',
};

function sourceLabel(src: string) {
  return src === 'manual' ? 'Manual registration' : src;
}

export function buildCatalog(s: State): CatalogAsset[] {
  const dataClass = new Map(s.dataSources.map((d) => [d.id, classificationsFor(d.columnsOfInterest)]));
  const out: CatalogAsset[] = [];

  s.applications.forEach((a) => {
    const cls = new Set<string>();
    a.agentIds.forEach((ag) => s.agents.find((x) => x.id === ag)?.dataSourceIds.forEach((d) => dataClass.get(d)?.forEach((c) => cls.add(c))));
    out.push({
      id: a.id, kind: 'application', name: a.name, description: a.description,
      qualifiedName: a.url, source: sourceLabel(a.source), sourceType: a.channel === 'Customer' ? 'Customer application' : 'Internal application',
      collection: a.businessUnitId, owner: a.owner, classifications: [...cls], tags: [a.channel === 'Customer' ? 'customer-facing' : 'internal'],
      status: null, managed: true, change: null, updatedAt: a.updatedAt,
    });
  });

  s.agents.forEach((a) => {
    const scheme = a.platform === 'Azure AI Foundry' ? `foundry://${a.source.split('·')[1]?.trim() ?? 'hub'}` : a.platform === 'Microsoft Fabric' ? `fabric://${a.source.split('·')[1]?.trim() ?? 'workspace'}` : a.platform === 'Copilot Studio' ? `copilotstudio://${a.source.split('·')[1]?.trim() ?? 'default'}` : a.platform === 'AWS Bedrock' ? 'bedrock://ap-south-1' : `dgc://${a.businessUnitId.replace('bu-', '')}`;
    const cls = new Set<string>();
    a.dataSourceIds.forEach((d) => dataClass.get(d)?.forEach((c) => cls.add(c)));
    out.push({
      id: a.id, kind: 'agent', name: a.name, description: a.description,
      qualifiedName: `${scheme}/agents/${slug(a.name)}`, source: sourceLabel(a.source), sourceType: a.platform,
      collection: a.businessUnitId, owner: a.owner, classifications: [...cls], tags: a.tags,
      tier: a.tier, lifecycle: a.lifecycle, status: a.managed ? null : 'Unmanaged', managed: a.managed, change: a.change, updatedAt: a.updatedAt,
    });
  });

  s.models.forEach((m) => {
    out.push({
      id: m.id, kind: 'model', name: m.name, description: `${m.provider} ${m.name} (${m.version}) deployed as ${m.deployment} in ${m.region}.`,
      qualifiedName: `${m.provider === 'Meta (Bedrock)' ? 'bedrock' : 'azureopenai'}://${slug(m.region)}/deployments/${m.deployment}`, source: sourceLabel(m.source), sourceType: m.provider,
      collection: m.businessUnitId, owner: null, classifications: [], tags: [m.region],
      status: m.approved ? 'Approved' : 'Not approved', managed: true, change: m.change, updatedAt: m.updatedAt,
    });
  });

  s.tools.forEach((t) => {
    const mcp = s.mcpServers.find((m) => m.id === t.mcpServerId);
    const reads = s.lineage.filter((e) => e.from === t.id && e.relation === 'reads').flatMap((e) => dataClass.get(e.to) ?? []);
    out.push({
      id: t.id, kind: 'tool', name: t.name, description: t.description,
      qualifiedName: mcp ? `${mcp.url}/tools/${t.name}` : `foundry://prod-hub/tools/${t.name}`, source: mcp ? `MCP server ${mcp.name}` : sourceLabel(t.source), sourceType: mcp ? 'MCP' : 'Azure AI Foundry',
      collection: t.businessUnitId, owner: t.owner, classifications: Array.from(new Set(reads)), tags: [`action:${t.actionType}`],
      status: t.quarantined ? 'Quarantined' : t.approved ? 'Approved' : 'Not approved', managed: !!t.owner, change: t.change, updatedAt: t.updatedAt,
    });
  });

  s.mcpServers.forEach((m) => {
    out.push({
      id: m.id, kind: 'mcp', name: m.name, description: `MCP server over ${m.transport} exposing ${m.toolIds.length} tools.`,
      qualifiedName: m.url, source: sourceLabel(m.source), sourceType: 'MCP',
      collection: m.businessUnitId, owner: m.owner, classifications: [], tags: [m.transport],
      status: m.known ? null : 'Unknown', managed: !!m.owner, change: m.change, updatedAt: m.lastScanned,
    });
  });

  s.dataSources.forEach((d) => {
    const platform = DATA_PLATFORM[d.type] ?? d.type;
    out.push({
      id: d.id, kind: 'data', name: d.name, description: `${d.type}${d.label ? ` labelled “${d.label}”` : ''}. Sensitivity: ${d.sensitivity}.`,
      qualifiedName: `${slug(platform)}://${d.source.split('·')[1]?.trim() ?? 'store'}/${slug(d.name)}`, source: sourceLabel(d.source), sourceType: platform,
      collection: d.businessUnitId, owner: d.owner, classifications: classificationsFor(d.columnsOfInterest), tags: [d.sensitivity.toLowerCase()],
      status: d.owner ? null : 'Unmanaged', managed: !!d.owner, change: d.change, updatedAt: d.updatedAt,
    });
  });

  return out;
}

export function assetHref(kind: ObjectKind, id: string, tab?: string) {
  return `/catalog/${kind}/${id}${tab ? `?tab=${tab}` : ''}`;
}
