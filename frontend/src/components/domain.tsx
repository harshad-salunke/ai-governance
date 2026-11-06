import { Link } from 'react-router-dom';
import {
  AppWindow,
  Bot,
  Boxes,
  CircleDot,
  Cpu,
  Database,
  Eye,
  Hand,
  Server,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Sparkles,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { ActionType, ChangeFlag, Decision, Lifecycle, ObjectKind, Platform, PolicyMode, RiskTier, Sensitivity, Severity, SignalScores } from '../data/types';
import { SIGNALS } from '../data/risk';
import { Badge, type Tone } from './ui/Badge';
import { cn } from '../lib/format';
import { objectHref } from '../lib/lookup';

// ---------------------------------------------------------------- risk
export const tierTone: Record<RiskTier, Tone> = { Low: 'success', Medium: 'warning', High: 'danger', Prohibited: 'violet', Unscored: 'neutral' };

export function TierBadge({ tier, score }: { tier: RiskTier; score?: number }) {
  return (
    <Badge tone={tierTone[tier]}>
      {tier === 'Prohibited' ? 'Prohibited' : `${tier} risk`}
      {score !== undefined && <span className="tabular font-normal opacity-80">· {score}</span>}
    </Badge>
  );
}

const levelColor = ['bg-success', 'bg-warning', 'bg-danger'];

/**
 * The risk fingerprint: five bars, one per risk signal, height and colour by
 * level (1–3). Reads at a glance in tables and expands with labels on risk pages.
 */
export function RiskFingerprint({ signals, size = 'sm', showLabels }: { signals: SignalScores; size?: 'sm' | 'md' | 'lg'; showLabels?: boolean }) {
  const h = { sm: 14, md: 22, lg: 44 }[size];
  const w = { sm: 3, md: 5, lg: 16 }[size];
  const gap = { sm: 2, md: 3, lg: 10 }[size];
  const title = SIGNALS.map((s) => `${s.label}: ${s.levels[signals[s.key] - 1]} (${signals[s.key]})`).join('\n');
  return (
    <span className={cn('inline-flex items-end', showLabels && 'gap-0')} title={showLabels ? undefined : title} role="img" aria-label={`Risk signals. ${title.replace(/\n/g, '. ')}`}>
      {SIGNALS.map((s) => {
        const lv = signals[s.key];
        return (
          <span key={s.key} className="inline-flex flex-col items-center" style={{ marginRight: gap }}>
            <span className="relative flex flex-col justify-end overflow-hidden rounded-[2px] bg-surface-3" style={{ height: h, width: w }}>
              <span className={cn('w-full rounded-[2px]', levelColor[lv - 1])} style={{ height: `${(lv / 3) * 100}%` }} />
            </span>
            {showLabels && <span className="mt-1.5 w-14 text-center text-[10px] leading-tight text-muted">{s.label}</span>}
          </span>
        );
      })}
    </span>
  );
}

// ---------------------------------------------------------------- lifecycle
const lifecycleTone: Record<Lifecycle, Tone> = {
  Draft: 'neutral',
  'In review': 'info',
  Approved: 'success',
  Deprecated: 'warning',
  Retired: 'outline',
  'Review overdue': 'danger',
  Suspended: 'danger',
};
export function LifecycleBadge({ state }: { state: Lifecycle }) {
  return (
    <Badge tone={lifecycleTone[state]}>{state}</Badge>
  );
}

export const LIFECYCLE_FLOW: Lifecycle[] = ['Draft', 'In review', 'Approved', 'Deprecated', 'Retired'];

// ---------------------------------------------------------------- decisions
export const decisionMeta: Record<Decision, { label: string; tone: Tone; icon: LucideIcon }> = {
  allow: { label: 'Allow', tone: 'success', icon: ShieldCheck },
  block: { label: 'Block', tone: 'danger', icon: ShieldX },
  ask_human: { label: 'Ask human', tone: 'warning', icon: Hand },
  redact: { label: 'Redact', tone: 'violet', icon: Eye },
  audit: { label: 'Audit only', tone: 'info', icon: CircleDot },
};

export function DecisionBadge({ decision }: { decision: Decision }) {
  const m = decisionMeta[decision];
  return (
    <Badge tone={m.tone} icon={m.icon}>
      {m.label}
    </Badge>
  );
}

export function ModeBadge({ mode }: { mode: PolicyMode }) {
  return mode === 'enforce' ? (
    <Badge tone="primary" icon={ShieldCheck}>
      Enforce
    </Badge>
  ) : (
    <Badge tone="outline" icon={Eye}>
      Monitor
    </Badge>
  );
}

// ---------------------------------------------------------------- platform
const platformStyle: Record<Platform, { short: string; cls: string }> = {
  'Azure AI Foundry': { short: 'AF', cls: 'bg-info/15 text-info' },
  'Microsoft Fabric': { short: 'Fb', cls: 'bg-primary/15 text-primary' },
  'Copilot Studio': { short: 'CS', cls: 'bg-violet/15 text-violet' },
  Custom: { short: '{ }', cls: 'bg-surface-3 text-muted' },
  'AWS Bedrock': { short: 'BR', cls: 'bg-warning/15 text-warning' },
};

export function PlatformMark({ platform, size = 'sm' }: { platform: Platform; size?: 'sm' | 'md' }) {
  const p = platformStyle[platform];
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center rounded-md font-mono font-semibold', p.cls, size === 'sm' ? 'h-5 w-5 text-[9px]' : 'h-9 w-9 text-xs')} aria-hidden>
      {p.short}
    </span>
  );
}

export function PlatformLabel({ platform }: { platform: Platform }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-muted">
      <PlatformMark platform={platform} />
      {platform}
    </span>
  );
}

// ---------------------------------------------------------------- misc badges
export function ChangeBadge({ change }: { change: ChangeFlag }) {
  if (!change) return null;
  const m = { new: ['info', 'New'], changed: ['warning', 'Changed'], removed: ['neutral', 'Removed'] } as const;
  return (
    <Badge tone={m[change][0]} className="h-[18px] px-1.5">
      {m[change][1]}
    </Badge>
  );
}

const actionTone: Record<ActionType, Tone> = { read: 'neutral', write: 'info', delete: 'danger', send: 'warning', payment: 'violet' };
export function ActionBadge({ action }: { action: ActionType }) {
  return <Badge tone={actionTone[action]}>{action}</Badge>;
}

const sensTone: Record<Sensitivity, Tone> = { Public: 'neutral', Internal: 'info', Confidential: 'warning', Personal: 'danger', Financial: 'danger', Health: 'violet' };
export function SensitivityBadge({ value }: { value: Sensitivity }) {
  return <Badge tone={sensTone[value]}>{value}</Badge>;
}

const sevTone: Record<Severity, Tone> = { Low: 'neutral', Medium: 'warning', High: 'danger', Critical: 'danger' };
export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <Badge tone={sevTone[severity]} icon={severity === 'Critical' ? ShieldAlert : undefined} className={severity === 'Critical' ? 'font-semibold' : undefined}>
      {severity}
    </Badge>
  );
}

export function ManagedBadge({ managed }: { managed: boolean }) {
  return managed ? null : (
    <Badge tone="warning" dot>
      Unmanaged
    </Badge>
  );
}

export function AiSuggestedBadge() {
  return (
    <Badge tone="violet" icon={Sparkles}>
      AI suggested
    </Badge>
  );
}

// ---------------------------------------------------------------- objects
export const kindMeta: Record<ObjectKind, { label: string; plural: string; icon: LucideIcon; tile: string }> = {
  application: { label: 'AI application', plural: 'AI applications', icon: AppWindow, tile: 'bg-[#5C2E91]/10 text-[#5C2E91] dark:bg-[#B191E6]/15 dark:text-[#C9B3EF]' },
  agent: { label: 'AI agent', plural: 'AI agents', icon: Bot, tile: 'bg-[#0F6CBD]/10 text-[#0F6CBD] dark:bg-[#479EF5]/15 dark:text-[#80BBF7]' },
  model: { label: 'AI model', plural: 'AI models', icon: Cpu, tile: 'bg-[#00666D]/10 text-[#00666D] dark:bg-[#4BB4BC]/15 dark:text-[#7BCDD3]' },
  tool: { label: 'Tool', plural: 'Tools', icon: Wrench, tile: 'bg-[#8E562E]/10 text-[#8E562E] dark:bg-[#D69B6C]/15 dark:text-[#E3B48F]' },
  mcp: { label: 'MCP server', plural: 'MCP servers', icon: Server, tile: 'bg-[#4F52B2]/10 text-[#4F52B2] dark:bg-[#8B8DE0]/15 dark:text-[#A9ABEA]' },
  data: { label: 'Data asset', plural: 'Data assets', icon: Database, tile: 'bg-[#0B6A0B]/10 text-[#0B6A0B] dark:bg-[#54B054]/15 dark:text-[#86C986]' },
};

/** Asset-type glyph in a tinted square, used in catalog rows, asset headers and lineage nodes. */
export function AssetIcon({ kind, size = 'md' }: { kind: ObjectKind; size?: 'sm' | 'md' | 'lg' }) {
  const m = kindMeta[kind];
  const box = { sm: 'h-6 w-6', md: 'h-8 w-8', lg: 'h-11 w-11' }[size];
  const icon = { sm: 'h-3.5 w-3.5', md: 'h-4 w-4', lg: 'h-6 w-6' }[size];
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center rounded', box, m.tile)} aria-hidden>
      <m.icon className={icon} strokeWidth={1.75} />
    </span>
  );
}

export function ObjectLink({ kind, id, name, className, mono }: { kind: ObjectKind | null; id: string; name: string; className?: string; mono?: boolean }) {
  const Icon = kind ? kindMeta[kind].icon : Boxes;
  return (
    <Link to={objectHref(kind, id)} onClick={(e) => e.stopPropagation()} className={cn('inline-flex min-w-0 items-center gap-1.5 text-fg hover:text-primary hover:underline', className)}>
      <Icon className="h-3.5 w-3.5 shrink-0 text-subtle" />
      <span className={cn('truncate', mono && 'font-mono text-[12.5px]')}>{name}</span>
    </Link>
  );
}
