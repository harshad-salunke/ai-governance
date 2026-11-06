import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { actions, useStore } from '../../data/store';
import { useLookup } from '../../lib/lookup';
import { ROLES, roleCan, usePermission, type Permission } from '../../lib/rbac';
import { useToast } from '../../lib/toast';
import { relTime } from '../../lib/format';
import { Badge, Button, Card, CardHeader, Checkbox, DataTable, Drawer, FilterSelect, PageHeader, Person, SearchInput, Tabs, Toolbar } from '../../components/ui';
import type { RoleKey, User } from '../../data/types';
import { Check, Minus } from 'lucide-react';

const MATRIX_ROWS: { p: Permission; label: string }[] = [
  { p: 'connectors.manage', label: 'Manage connectors and credentials' },
  { p: 'inventory.register', label: 'Register and edit agents' },
  { p: 'risk.configure', label: 'Edit risk rules and weights' },
  { p: 'risk.adjust', label: 'Adjust an agent’s tier' },
  { p: 'workflows.configure', label: 'Edit approval workflows' },
  { p: 'approvals.decide', label: 'Approve or reject' },
  { p: 'exceptions.grant', label: 'Grant exceptions' },
  { p: 'runtime.policies', label: 'Write runtime policies' },
  { p: 'runtime.killswitch', label: 'Use the kill switch' },
  { p: 'runtime.tasks', label: 'Act on human-approval requests' },
  { p: 'budgets.manage', label: 'Set budgets' },
  { p: 'reports.export', label: 'Export reports' },
  { p: 'admin.manage', label: 'Manage users and settings' },
];

export default function Users() {
  const s = useStore((x) => x);
  const L = useLookup();
  const { can, reason } = usePermission();
  const toast = useToast();
  const [tab, setTab] = useState<'users' | 'matrix'>('users');
  const [q, setQ] = useState('');
  const [role, setRole] = useState('all');
  const [bu, setBu] = useState('all');
  const [edit, setEdit] = useState<User | null>(null);
  const rows = s.users.filter((u) => (!q || `${u.name} ${u.email} ${u.title}`.toLowerCase().includes(q.toLowerCase())) && (role === 'all' || u.roles.includes(role as RoleKey)) && (bu === 'all' || u.businessUnitId === bu));
  const roles = Object.keys(ROLES) as RoleKey[];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Users and roles"
        description="People and groups sync from Microsoft Entra ID. A user can hold several roles, each scoped to the organisation or one business unit."
        actions={<Button icon={RefreshCw} onClick={() => toast({ tone: 'success', title: 'Entra ID sync finished', body: `${s.users.length} users, 1 disabled since last sync.` })} disabledReason={can('admin.manage') ? undefined : reason('admin.manage')}>Sync from Entra ID</Button>}
      />
      <Tabs value={tab} onChange={setTab} items={[{ value: 'users', label: 'Users', count: s.users.length }, { value: 'matrix', label: 'Role permissions' }]} />

      {tab === 'users' ? (
        <Card>
          <Toolbar>
            <SearchInput value={q} onChange={setQ} placeholder="Search people" className="w-full sm:w-64" />
            <FilterSelect label="Role" value={role} onChange={setRole} options={roles.map((r) => ({ value: r, label: ROLES[r].label }))} />
            <FilterSelect label="Business unit" value={bu} onChange={setBu} options={s.businessUnits.map((b) => ({ value: b.id, label: b.name }))} />
          </Toolbar>
          <DataTable
            rows={rows}
            onRowClick={setEdit}
            columns={[
              { key: 'n', header: 'Name', sort: (u) => u.name, cell: (u) => <Person name={u.name} sub={u.email} muted={u.status === 'disabled'} size="md" /> },
              { key: 't', header: 'Title', hideBelow: 'lg', cell: (u) => <span className="text-muted">{u.title}</span> },
              { key: 'b', header: 'Business unit', hideBelow: 'md', cell: (u) => L.buName(u.businessUnitId) },
              { key: 'r', header: 'Roles', cell: (u) => <span className="flex flex-wrap gap-1">{u.roles.map((r) => <Badge key={r} tone="primary">{ROLES[r].label}</Badge>)}</span> },
              { key: 's', header: 'Status', cell: (u) => (u.status === 'active' ? <Badge tone="success" dot>Active</Badge> : <Badge tone="danger" dot>Disabled in Entra</Badge>) },
              { key: 'l', header: 'Last active', hideBelow: 'xl', sort: (u) => u.lastActive, cell: (u) => <span className="text-muted">{relTime(u.lastActive)}</span> },
            ]}
          />
        </Card>
      ) : (
        <Card>
          <CardHeader title="What each role can do" description="Enforced on every API endpoint and screen. Nobody approves an agent they own or sponsor." />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2/60">
                  <th className="sticky left-0 bg-surface-2 px-4 py-2 text-left text-xs font-medium text-muted">Permission</th>
                  {roles.map((r) => <th key={r} className="px-2 py-2 text-center text-xs font-medium text-muted">{ROLES[r].short}</th>)}
                </tr>
              </thead>
              <tbody>
                {MATRIX_ROWS.map((row) => (
                  <tr key={row.p} className="border-b border-border last:border-0">
                    <td className="sticky left-0 bg-surface px-4 py-2">{row.label}</td>
                    {roles.map((r) => <td key={r} className="text-center">{roleCan(r, row.p) ? <Check className="mx-auto h-4 w-4 text-primary" aria-label="Allowed" /> : <Minus className="mx-auto h-4 w-4 text-border-strong" aria-label="Not allowed" />}</td>)}
                  </tr>
                ))}
                <tr>
                  <td className="sticky left-0 bg-surface px-4 py-2">Read everything</td>
                  {roles.map((r) => <td key={r} className="text-center"><Check className="mx-auto h-4 w-4 text-primary" aria-label="Allowed" /></td>)}
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {edit && <RoleDrawer key={edit.id} user={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function RoleDrawer({ user, onClose }: { user: User; onClose: () => void }) {
  const { can, reason } = usePermission();
  const toast = useToast();
  const [roles, setRoles] = useState<RoleKey[]>(user.roles);
  const locked = !can('admin.manage');
  return (
    <Drawer
      open
      onClose={onClose}
      title={user.name}
      subtitle={`${user.title} · ${user.email}`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={roles.length === 0 || JSON.stringify(roles) === JSON.stringify(user.roles)} disabledReason={locked ? reason('admin.manage') : undefined} onClick={() => { actions.setUserRoles(user.id, roles); toast({ tone: 'success', title: 'Roles updated', body: 'Recorded in the audit log.' }); onClose(); }}>
            Save roles
          </Button>
        </>
      }
    >
      <div className="space-y-3 p-5">
        <p className="text-sm font-medium">Portal roles</p>
        {(Object.keys(ROLES) as RoleKey[]).map((r) => (
          <div key={r} className="rounded-md border border-border p-3">
            <Checkbox checked={roles.includes(r)} disabled={locked} onChange={(v) => setRoles(v ? [...roles, r] : roles.filter((x) => x !== r))} label={ROLES[r].label} description={ROLES[r].description} />
          </div>
        ))}
      </div>
    </Drawer>
  );
}
