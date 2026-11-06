import { useEffect, useState } from 'react';
import { ArrowRight, KeyRound, Loader2, Moon, ShieldCheck, Sun } from 'lucide-react';
import { actions, useStore } from '../data/store';
import { ROLES } from '../lib/rbac';
import { useTheme } from '../lib/theme';
import { Logo } from '../layout/Sidebar';
import { Avatar } from '../components/ui';
import { DecisionBadge } from '../components/domain';
import { cn } from '../lib/format';
import type { Decision } from '../data/types';

const STREAM: { agent: string; call: string; decision: Decision; ms: number }[] = [
  { agent: 'Support Resolution Agent', call: 'issue_refund(amount=8000)', decision: 'ask_human', ms: 14 },
  { agent: 'Payroll Query Agent', call: 'get_salary(employee_id="E10293")', decision: 'block', ms: 9 },
  { agent: 'Gmail Summary Agent', call: 'read_mail(folder="inbox")', decision: 'allow', ms: 7 },
  { agent: 'Support Resolution Agent', call: 'get_customer(customer_id="C88213")', decision: 'redact', ms: 11 },
  { agent: 'KYC Document Checker', call: 'kyc_lookup(pan="ABCDE****F")', decision: 'audit', ms: 8 },
  { agent: 'Gmail Summary Agent', call: 'send_email(to="vendor@partner.io")', decision: 'block', ms: 6 },
  { agent: 'Incident Triage Agent', call: 'teams_notify(channel="#sre-oncall")', decision: 'allow', ms: 5 },
];

/** A live ledger of runtime decisions: the product's core idea, shown before sign-in. */
function DecisionStream() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setTick((x) => x + 1), 1800);
    return () => clearInterval(t);
  }, []);
  const rows = Array.from({ length: 5 }, (_, i) => STREAM[(tick + i) % STREAM.length]);
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface/90 shadow-pop backdrop-blur">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="text-xs font-medium text-muted">Policy decisions · live</span>
        <span className="flex items-center gap-1.5 text-xs text-success">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> p95 31 ms
        </span>
      </div>
      <ul>
        {rows.map((r, i) => (
          <li key={`${tick}-${i}`} className={cn('flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-0', i === 0 && 'animate-pop-in bg-primary/5')}>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-muted">{r.agent}</p>
              <p className="truncate font-mono text-[12px] text-fg">{r.call}</p>
            </div>
            <span className="tabular text-[11px] text-subtle">{r.ms} ms</span>
            <DecisionBadge decision={r.decision} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LoginPage() {
  const users = useStore((s) => s.users.filter((u) => u.status === 'active'));
  const [picked, setPicked] = useState('u-harshad');
  const [loading, setLoading] = useState(false);
  const { resolved, toggle } = useTheme();
  const personas = ['u-harshad', 'u-ananya', 'u-vikram', 'u-meera', 'u-rahul', 'u-kavya', 'u-neha', 'u-farhan'];

  const signIn = () => {
    setLoading(true);
    setTimeout(() => actions.signIn(picked), 700);
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="bg-grid relative hidden flex-col justify-between overflow-hidden border-r border-border bg-surface-2/40 p-10 lg:flex">
        <Logo />
        <div className="max-w-lg">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">Every agent, every tool call, accounted for.</h1>
          <p className="mt-3 max-w-md text-base text-muted">
            Discover the AI agents running across Foundry, Fabric and MCP, decide which ones are allowed, and check every action before it runs.
          </p>
          <div className="mt-8">
            <DecisionStream />
          </div>
        </div>
        <p className="text-xs text-subtle">Data stays in your Azure tenant · Central India</p>
      </section>

      <section className="flex flex-col px-5 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <div className="lg:hidden">
            <Logo />
          </div>
          <button onClick={toggle} className="ml-auto rounded-md p-2 text-muted hover:bg-surface-2 hover:text-fg" aria-label="Toggle theme">
            {resolved === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-1 text-sm text-muted">Use your work account. Access follows your Entra ID groups.</p>

          <button
            onClick={signIn}
            disabled={loading}
            className="mt-6 flex h-11 w-full items-center justify-center gap-2.5 rounded-md border border-border-strong bg-surface text-sm font-medium text-fg shadow-sm transition-colors hover:bg-surface-2 disabled:opacity-70"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4 text-info" />}
            {loading ? 'Redirecting to Entra ID…' : 'Continue with Microsoft Entra ID'}
          </button>

          <div className="mt-8">
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-medium">Demo persona</p>
              <p className="text-xs text-subtle">Mock SSO</p>
            </div>
            <ul className="mt-2 max-h-[340px] space-y-1 overflow-y-auto rounded-lg border border-border p-1" role="radiogroup" aria-label="Demo persona">
              {personas.map((id) => {
                const u = users.find((x) => x.id === id)!;
                const on = picked === id;
                return (
                  <li key={id}>
                    <button
                      role="radio"
                      aria-checked={on}
                      onClick={() => setPicked(id)}
                      onDoubleClick={signIn}
                      className={cn('flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors', on ? 'bg-primary/10 ring-1 ring-inset ring-primary/30' : 'hover:bg-surface-2')}
                    >
                      <Avatar name={u.name} size="md" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{u.name}</span>
                        <span className="block truncate text-xs text-subtle">{u.roles.map((r) => ROLES[r].label).join(', ')}</span>
                      </span>
                      {on && <ArrowRight className="h-4 w-4 text-primary" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <p className="mt-6 flex items-start gap-2 text-xs text-subtle">
            <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0" />
            Sign-ins and role changes are recorded in the audit log. Unauthorised access is prohibited.
          </p>
        </div>
      </section>
    </div>
  );
}
