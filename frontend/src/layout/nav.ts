import {
  Activity,
  BadgeCheck,
  Banknote,
  BookLock,
  ClipboardCheck,
  Code2,
  Database,
  FileBarChart,
  FlaskConical,
  Gauge,
  GitBranch,
  Hand,
  Home,
  KeyRound,
  ListChecks,
  Plug,
  Radar,
  RefreshCcw,
  ScrollText,
  Settings,
  ShieldCheck,
  Siren,
  UserCheck,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import type { State } from '../data/store';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Count shown next to the item; alert=true renders it in red. */
  badge?: (s: State) => { n: number; alert?: boolean } | null;
  keywords?: string;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const NAV: NavSection[] = [
  {
    label: '',
    items: [{ label: 'Home', to: '/', icon: Home, keywords: 'overview dashboard executive' }],
  },
  {
    label: 'Catalog',
    items: [
      { label: 'AI catalog', to: '/catalog', icon: Database, keywords: 'inventory assets agents models tools mcp data applications search browse' },
      { label: 'Data sources', to: '/connectors', icon: Plug, badge: (s) => ({ n: s.connectors.filter((c) => c.status === 'failed').length, alert: true }), keywords: 'connectors foundry fabric scan sources' },
      { label: 'Discovery insights', to: '/discovery', icon: Radar, badge: (s) => ({ n: s.shadowHints.length + s.duplicates.filter((d) => d.status === 'Open').length }), keywords: 'shadow ai duplicates changes' },
      { label: 'Ownership', to: '/ownership', icon: UserCheck, badge: (s) => ({ n: s.claims.filter((c) => c.status === 'Pending admin').length + s.orphans.length }), keywords: 'claim unmanaged orphan lifecycle transfer' },
    ],
  },
  {
    label: 'Governance',
    items: [
      { label: 'Governance overview', to: '/governance', icon: Gauge, keywords: 'dashboard posture' },
      { label: 'Risk assessments', to: '/risk', icon: Activity, keywords: 'assessment signals tier score rules weights' },
      { label: 'Controls', to: '/controls', icon: ListChecks, keywords: 'checklist evidence library' },
      { label: 'Approvals', to: '/approvals', icon: BadgeCheck, badge: (s) => ({ n: s.approvals.filter((a) => a.status === 'Pending').length }), keywords: 'workflow queue sla' },
      { label: 'Governance policies', to: '/governance-policies', icon: BookLock, keywords: 'rules violations metadata' },
      { label: 'Reviews & exceptions', to: '/reviews', icon: RefreshCcw, badge: (s) => ({ n: s.reviews.filter((r) => r.status === 'Overdue').length, alert: true }), keywords: 'periodic re-approval waiver' },
      { label: 'Incidents', to: '/incidents', icon: Siren, badge: (s) => ({ n: s.incidents.filter((i) => i.status !== 'Resolved').length, alert: s.incidents.some((i) => i.severity === 'Critical' && i.status !== 'Resolved') }) },
    ],
  },
  {
    label: 'Runtime protection',
    items: [
      { label: 'Runtime policies', to: '/runtime/policies', icon: ShieldCheck, keywords: 'policy editor json quarantine' },
      { label: 'Agent roles', to: '/runtime/roles', icon: UsersRound, keywords: 'allowed tools models data classes' },
      { label: 'Policy simulator', to: '/runtime/simulator', icon: FlaskConical, keywords: 'test check simulate' },
      { label: 'Decision log', to: '/runtime/decisions', icon: ScrollText, keywords: 'violations block allow' },
      { label: 'Human approvals', to: '/runtime/human-approvals', icon: Hand, badge: (s) => ({ n: s.approvalTasks.filter((t) => t.status === 'Pending').length }), keywords: 'ask human tasks' },
      { label: 'SDK & integrations', to: '/runtime/sdk', icon: Code2, keywords: 'python dgcatalyst integration api' },
    ],
  },
  {
    label: 'Monitoring',
    items: [
      { label: 'Traces', to: '/observe/traces', icon: GitBranch, keywords: 'observability runs latency' },
      { label: 'Cost & budgets', to: '/observe/cost', icon: Banknote, keywords: 'tokens finops chargeback' },
      { label: 'Audit log', to: '/observe/audit', icon: ClipboardCheck, keywords: 'hash chain events' },
      { label: 'Reports', to: '/observe/reports', icon: FileBarChart, keywords: 'pdf schedule dossier' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Users & roles', to: '/admin/users', icon: UsersRound, keywords: 'rbac people' },
      { label: 'API keys', to: '/admin/keys', icon: KeyRound },
      { label: 'Settings', to: '/admin/settings', icon: Settings, keywords: 'business units notifications custom fields appearance' },
    ],
  },
];
