import { useStore, type State } from '../data/store';
import type { ObjectKind } from '../data/types';

/** Name lookups and scope filtering shared across pages. */
export function useLookup() {
  const s = useStore((x) => x);
  const by = <T extends { id: string }>(list: T[]) => {
    const m = new Map<string, T>();
    list.forEach((x) => m.set(x.id, x));
    return m;
  };
  const users = by(s.users);
  const agents = by(s.agents);
  const tools = by(s.tools);
  const models = by(s.models);
  const bus = by(s.businessUnits);
  const apps = by(s.applications);
  const mcps = by(s.mcpServers);
  const data = by(s.dataSources);
  const policies = by(s.runtimePolicies);
  const roles = by(s.agentRoles);

  return {
    user: (id: string | null | undefined) => (id ? users.get(id) : undefined),
    userName: (id: string | null | undefined) => (id ? (users.get(id)?.name ?? (id === 'system' ? 'System' : id === 'sdk' ? 'SDK' : id)) : '—'),
    agent: (id: string) => agents.get(id),
    agentName: (id: string) => agents.get(id)?.name ?? id,
    tool: (id: string) => tools.get(id),
    toolName: (id: string | null) => (id ? (tools.get(id)?.name ?? id) : '—'),
    model: (id: string) => models.get(id),
    bu: (id: string) => bus.get(id),
    buName: (id: string) => bus.get(id)?.name ?? id,
    app: (id: string | null) => (id ? apps.get(id) : undefined),
    mcp: (id: string | null) => (id ? mcps.get(id) : undefined),
    data: (id: string) => data.get(id),
    policy: (id: string | null) => (id ? policies.get(id) : undefined),
    role: (id: string | null) => (id ? roles.get(id) : undefined),
    objectName: (id: string) =>
      agents.get(id)?.name ?? apps.get(id)?.name ?? tools.get(id)?.name ?? models.get(id)?.name ?? mcps.get(id)?.name ?? data.get(id)?.name ?? policies.get(id)?.name ?? id,
    objectKind: (id: string): ObjectKind | null =>
      agents.has(id) ? 'agent' : apps.has(id) ? 'application' : tools.has(id) ? 'tool' : models.has(id) ? 'model' : mcps.has(id) ? 'mcp' : data.has(id) ? 'data' : null,
  };
}

export function objectHref(kind: ObjectKind | null, id: string) {
  if (!kind) return '#';
  return `/catalog/${kind}/${id}`;
}

/** Applies the global business-unit scope selector. */
export function inScope<T extends { businessUnitId: string }>(s: Pick<State, 'session'>, list: T[]): T[] {
  return s.session.buScope === 'all' ? list : list.filter((x) => x.businessUnitId === s.session.buScope);
}

export function useScoped<T extends { businessUnitId: string }>(pick: (s: State) => T[]): T[] {
  return useStore((s) => inScope(s, pick(s)));
}

export function useScopedAgentIds(): Set<string> {
  return useStore((s) => new Set(inScope(s, s.agents).map((a) => a.id)));
}
