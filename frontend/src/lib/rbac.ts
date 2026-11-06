import type { RoleKey } from '../data/types';
import { useStore } from '../data/store';

export const ROLES: Record<RoleKey, { label: string; short: string; description: string }> = {
  platform_admin: { label: 'Platform admin', short: 'Admin', description: 'Connectors, credentials, SSO, business units, users, API keys' },
  governance_lead: { label: 'AI governance lead', short: 'Gov lead', description: 'Risk rules, checklists, workflows, governance policies; final approval' },
  security_admin: { label: 'Security admin', short: 'Security', description: 'Runtime policies, agent roles, model access, kill switch' },
  risk_reviewer: { label: 'Risk reviewer', short: 'Risk', description: 'Review assessments, approve or reject, grant exceptions' },
  agent_owner: { label: 'Agent owner', short: 'Owner', description: 'Register and edit own agents, request approval, simulate policies' },
  business_sponsor: { label: 'Business sponsor', short: 'Sponsor', description: 'Confirm purpose, approve renewal, act on human-approval requests' },
  finops_manager: { label: 'FinOps manager', short: 'FinOps', description: 'Budgets, cost dashboards, chargeback export' },
  auditor: { label: 'Auditor / viewer', short: 'Auditor', description: 'Read everything and export reports' },
};

export type Permission =
  | 'connectors.manage'
  | 'admin.manage'
  | 'apikeys.manage'
  | 'risk.configure'
  | 'risk.adjust'
  | 'controls.configure'
  | 'evidence.review'
  | 'evidence.submit'
  | 'workflows.configure'
  | 'approvals.decide'
  | 'govpolicy.manage'
  | 'exceptions.grant'
  | 'incidents.manage'
  | 'runtime.policies'
  | 'runtime.killswitch'
  | 'runtime.roles'
  | 'runtime.tasks'
  | 'runtime.simulate'
  | 'inventory.register'
  | 'ownership.claim'
  | 'ownership.confirm'
  | 'budgets.manage'
  | 'reports.export'
  | 'policypilot.draft';

const MATRIX: Record<Permission, RoleKey[]> = {
  'connectors.manage': ['platform_admin'],
  'admin.manage': ['platform_admin'],
  'apikeys.manage': ['platform_admin'],
  'risk.configure': ['governance_lead'],
  'risk.adjust': ['risk_reviewer', 'governance_lead'],
  'controls.configure': ['governance_lead'],
  'evidence.review': ['risk_reviewer', 'governance_lead'],
  'evidence.submit': ['agent_owner'],
  'workflows.configure': ['governance_lead'],
  'approvals.decide': ['risk_reviewer', 'governance_lead', 'business_sponsor', 'security_admin'],
  'govpolicy.manage': ['governance_lead'],
  'exceptions.grant': ['risk_reviewer', 'governance_lead'],
  'incidents.manage': ['security_admin', 'governance_lead', 'agent_owner', 'risk_reviewer'],
  'runtime.policies': ['security_admin'],
  'runtime.killswitch': ['security_admin'],
  'runtime.roles': ['security_admin'],
  'runtime.tasks': ['business_sponsor', 'security_admin'],
  'runtime.simulate': ['security_admin', 'agent_owner', 'governance_lead'],
  'inventory.register': ['agent_owner', 'platform_admin'],
  'ownership.claim': ['agent_owner'],
  'ownership.confirm': ['platform_admin'],
  'budgets.manage': ['finops_manager'],
  'reports.export': ['auditor', 'governance_lead', 'finops_manager', 'security_admin', 'risk_reviewer', 'platform_admin'],
  'policypilot.draft': ['agent_owner', 'security_admin', 'governance_lead'],
};

export function roleCan(role: RoleKey, p: Permission) {
  return MATRIX[p].includes(role);
}

/** Returns a checker bound to the active role plus a human-readable denial reason. */
export function usePermission() {
  const role = useStore((s) => s.session.activeRole);
  const can = (p: Permission) => roleCan(role, p);
  const reason = (p: Permission) =>
    can(p) ? undefined : `Your active role (${ROLES[role].label}) can't do this. Needs: ${MATRIX[p].map((r) => ROLES[r].label).join(', ')}.`;
  return { role, can, reason };
}
