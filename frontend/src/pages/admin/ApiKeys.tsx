import { useState } from 'react';
import { KeyRound, Plus, RotateCw, TriangleAlert } from 'lucide-react';
import { actions, useStore } from '../../data/store';
import { useLookup } from '../../lib/lookup';
import { usePermission } from '../../lib/rbac';
import { useToast } from '../../lib/toast';
import { dateOnly, relTime } from '../../lib/format';
import { NOW } from '../../data/seed';
import { Badge, Button, Callout, Card, CopyButton, DataTable, Field, Input, Modal, Mono, PageHeader, Segmented, Select } from '../../components/ui';
import type { ApiKey } from '../../data/types';

export default function ApiKeys() {
  const s = useStore((x) => x);
  const L = useLookup();
  const { can, reason } = usePermission();
  const toast = useToast();
  const [create, setCreate] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const deny = can('apikeys.manage') ? undefined : reason('apikeys.manage');

  const rotate = (k: ApiKey) => {
    setSecret(`${k.prefix}_${Math.random().toString(36).slice(2, 14)}${Math.random().toString(36).slice(2, 14)}`);
    toast({ tone: 'success', title: `${k.name} rotated`, body: 'The old secret keeps working for 24 hours.' });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="API keys and agent credentials"
        description="For the runtime SDK, CI/CD registration and SIEM export. Secrets are stored in Key Vault and shown once."
        actions={<Button variant="primary" icon={Plus} onClick={() => setCreate(true)} disabledReason={deny}>Create key</Button>}
      />
      {s.apiKeys.some((k) => k.status === 'Expiring') && <Callout tone="warning" icon={TriangleAlert} title="A key expires within 14 days">Rotate it before it expires, or agents using it will fail closed.</Callout>}
      <Card>
        <DataTable
          rows={s.apiKeys}
          columns={[
            { key: 'n', header: 'Name', sort: (k) => k.name, cell: (k) => <div><p className="font-medium">{k.name}</p><Mono>{k.prefix}••••••••</Mono></div> },
            { key: 's', header: 'Scope', cell: (k) => <Badge tone={k.scope === 'runtime' ? 'primary' : k.scope === 'registration' ? 'info' : 'neutral'}>{k.scope}</Badge> },
            { key: 'a', header: 'Agent', hideBelow: 'md', cell: (k) => <span className="text-muted">{k.agentId ? L.agentName(k.agentId) : '—'}</span> },
            { key: 'u', header: 'Last used', hideBelow: 'sm', sort: (k) => k.lastUsed ?? '', cell: (k) => <span className="text-muted">{relTime(k.lastUsed)}</span> },
            { key: 'e', header: 'Expires', sort: (k) => k.expiresAt, hideBelow: 'lg', cell: (k) => <span className={k.status === 'Expiring' ? 'text-warning' : 'text-muted'}>{dateOnly(k.expiresAt)}</span> },
            { key: 'st', header: 'Status', cell: (k) => <Badge tone={k.status === 'Active' ? 'success' : k.status === 'Expiring' ? 'warning' : 'neutral'} dot>{k.status}</Badge> },
            {
              key: 'x',
              header: '',
              align: 'right',
              cell: (k) =>
                k.status !== 'Revoked' && (
                  <span className="inline-flex gap-1.5">
                    <Button size="xs" variant="ghost" icon={RotateCw} onClick={() => rotate(k)} disabledReason={deny}>Rotate</Button>
                    <Button size="xs" variant="ghost" className="text-danger" onClick={() => { actions.revokeApiKey(k.id); toast({ tone: 'info', title: `${k.name} revoked`, body: 'Requests with this key now return 401.' }); }} disabledReason={deny}>Revoke</Button>
                  </span>
                ),
            },
          ]}
        />
      </Card>

      {create && <CreateKey onClose={() => setCreate(false)} onCreated={setSecret} />}
      <Modal open={!!secret} onClose={() => setSecret(null)} title="Copy this secret now" description="It won’t be shown again. Store it in your agent’s Key Vault or pipeline secrets." footer={<Button variant="primary" onClick={() => setSecret(null)}>I’ve stored it</Button>}>
        <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2 p-3">
          <KeyRound className="h-4 w-4 shrink-0 text-subtle" />
          <code className="flex-1 break-all font-mono text-[13px]">{secret}</code>
          <CopyButton text={secret ?? ''} />
        </div>
      </Modal>
    </div>
  );
}

function CreateKey({ onClose, onCreated }: { onClose: () => void; onCreated: (secret: string) => void }) {
  const s = useStore((x) => x);
  const toast = useToast();
  const [name, setName] = useState('');
  const [scope, setScope] = useState<ApiKey['scope']>('runtime');
  const [agentId, setAgentId] = useState('ag-loan');
  const [days, setDays] = useState('90');
  const create = () => {
    const prefix = `dgc_${scope === 'runtime' ? 'rt' : scope === 'registration' ? 'reg' : 'ro'}_${Math.random().toString(36).slice(2, 6)}`;
    actions.createApiKey({ id: `key-${s.apiKeys.length + 1}`, name, prefix, scope, agentId: scope === 'runtime' ? agentId : undefined, createdBy: s.session.userId, createdAt: new Date(NOW).toISOString(), lastUsed: null, expiresAt: new Date(NOW + Number(days) * 86_400_000).toISOString(), status: 'Active' });
    toast({ tone: 'success', title: 'Key created' });
    onClose();
    onCreated(`${prefix}_${Math.random().toString(36).slice(2, 14)}${Math.random().toString(36).slice(2, 14)}`);
  };
  return (
    <Modal open onClose={onClose} title="Create an API key" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!name.trim()} onClick={create}>Create key</Button></>}>
      <div className="space-y-4">
        <Field label="Name" htmlFor="kn"><Input id="kn" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. loan-agent prod" /></Field>
        <Field label="Scope" hint={scope === 'runtime' ? 'Agent credential for check and allowed_tools' : scope === 'registration' ? 'Register objects from CI/CD' : 'Read and export only'}>
          <Segmented value={scope} onChange={setScope} options={[{ value: 'runtime', label: 'Runtime' }, { value: 'registration', label: 'Registration' }, { value: 'read-only', label: 'Read-only' }]} />
        </Field>
        {scope === 'runtime' && (
          <Field label="Agent" hint="Only approved agents can receive runtime credentials" htmlFor="ka">
            <Select id="ka" value={agentId} onChange={(e) => setAgentId(e.target.value)}>{s.agents.filter((a) => a.lifecycle === 'Approved' || a.lifecycle === 'In review').map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
          </Field>
        )}
        <Field label="Expires after" htmlFor="kd"><Select id="kd" value={days} onChange={(e) => setDays(e.target.value)}><option value="30">30 days</option><option value="90">90 days</option><option value="180">180 days</option><option value="365">1 year</option></Select></Field>
      </div>
    </Modal>
  );
}
