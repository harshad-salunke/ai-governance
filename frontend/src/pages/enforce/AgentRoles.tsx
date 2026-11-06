import { useState } from 'react';
import { Save } from 'lucide-react';
import { actions, useStore } from '../../data/store';
import { usePermission } from '../../lib/rbac';
import { useToast } from '../../lib/toast';
import { cn } from '../../lib/format';
import { Badge, Button, Card, CardHeader, ChipSelect, Field, PageHeader, Segmented } from '../../components/ui';
import { ObjectLink } from '../../components/domain';
import type { ActionType, AgentRole, Sensitivity } from '../../data/types';

export default function AgentRoles() {
  const s = useStore((x) => x);
  const { can, reason } = usePermission();
  const toast = useToast();
  const [sel, setSel] = useState(s.agentRoles[0].id);
  const role = s.agentRoles.find((r) => r.id === sel)!;
  const [draft, setDraft] = useState<AgentRole>(role);
  const locked = !can('runtime.roles');
  const dirty = JSON.stringify(draft) !== JSON.stringify(role);
  const pick = (id: string) => { setSel(id); setDraft(s.agentRoles.find((r) => r.id === id)!); };
  const agents = s.agents.filter((a) => a.agentRoleId === role.id);

  // Least privilege (P3-IDN-06): tools allowed but never called by any agent in this role.
  const called = new Set(s.decisions.filter((d) => agents.some((a) => a.id === d.agentId)).map((d) => d.toolId));
  const unused = draft.allowedToolIds.filter((t) => !called.has(t));

  return (
    <div className="space-y-5">
      <PageHeader title="Agent roles" description="Bundles of allowed tools, actions, models and data classes. Anything outside the role is blocked by default." />
      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Card className="self-start p-1.5">
          <ul role="listbox" aria-label="Agent roles">
            {s.agentRoles.map((r) => (
              <li key={r.id} role="option" aria-selected={r.id === sel}>
                <button onClick={() => pick(r.id)} className={cn('flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm', r.id === sel ? 'bg-primary/10 font-medium text-primary' : 'hover:bg-surface-2')}>
                  {r.name}
                  <span className="tabular text-xs text-subtle">{s.agents.filter((a) => a.agentRoleId === r.id).length}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader
            title={role.name}
            description={role.description}
            actions={<Button size="sm" variant="primary" icon={Save} disabled={!dirty} disabledReason={locked ? reason('runtime.roles') : undefined} onClick={() => { actions.saveRole(role.id, draft); toast({ tone: 'success', title: `${role.name} saved`, body: `Applies to ${agents.length} agents within 30 seconds.` }); }}>Save role</Button>}
          />
          <div className="space-y-5 p-4">
            <Field label="Allowed tools">
              <ChipSelect values={draft.allowedToolIds} onChange={(v) => !locked && setDraft({ ...draft, allowedToolIds: v })} options={s.tools.filter((t) => t.approved || draft.allowedToolIds.includes(t.id)).map((t) => ({ value: t.id, label: t.name }))} />
            </Field>
            {unused.length > 0 && agents.length > 0 && (
              <p className="rounded-md bg-info/5 px-3 py-2 text-xs text-info">
                Least privilege: {unused.map((t) => s.tools.find((x) => x.id === t)!.name).join(', ')} {unused.length === 1 ? 'was' : 'were'} not called by any agent in this role in 7 days. Consider removing.
              </p>
            )}
            <Field label="Allowed action types">
              <ChipSelect values={draft.allowedActions} onChange={(v) => !locked && setDraft({ ...draft, allowedActions: v as ActionType[] })} options={(['read', 'write', 'delete', 'send', 'payment'] as ActionType[]).map((a) => ({ value: a, label: a }))} />
            </Field>
            <Field label="Allowed models" hint="Model access control (P3-IDN-04)">
              <ChipSelect values={draft.allowedModelIds} onChange={(v) => !locked && setDraft({ ...draft, allowedModelIds: v })} options={s.models.map((m) => ({ value: m.id, label: `${m.name} · ${m.region}` }))} />
            </Field>
            <Field label="Allowed regions">
              <ChipSelect values={draft.allowedRegions} onChange={(v) => !locked && setDraft({ ...draft, allowedRegions: v })} options={['Central India', 'South India', 'Sweden Central', 'East US 2', 'France Central'].map((r) => ({ value: r, label: r }))} />
            </Field>
            <Field label="Allowed data classes">
              <ChipSelect values={draft.allowedDataClasses} onChange={(v) => !locked && setDraft({ ...draft, allowedDataClasses: v as Sensitivity[] })} options={(['Public', 'Internal', 'Confidential', 'Personal', 'Financial', 'Health'] as Sensitivity[]).map((d) => ({ value: d, label: d }))} />
            </Field>
            <Field label="Default for unmatched calls">
              <Segmented value={draft.defaultDecision} onChange={(v) => !locked && setDraft({ ...draft, defaultDecision: v })} options={[{ value: 'block', label: 'Block' }, { value: 'allow', label: 'Allow' }]} />
            </Field>
            <div>
              <p className="mb-2 text-sm font-medium">Agents with this role</p>
              <div className="flex flex-wrap gap-2">
                {agents.length ? agents.map((a) => (
                  <span key={a.id} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1">
                    <ObjectLink kind="agent" id={a.id} name={a.name} className="text-sm" />
                    {a.toolIds.some((t) => !draft.allowedToolIds.includes(t)) && <Badge tone="warning" title="Has tools outside this role">Over-scoped</Badge>}
                  </span>
                )) : <span className="text-sm text-subtle">None yet</span>}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
