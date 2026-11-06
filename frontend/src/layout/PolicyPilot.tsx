import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp, Bot, CheckCircle2, CircleAlert, Loader2, RotateCcw, Sparkles, TriangleAlert, Wrench } from 'lucide-react';
import { actions, useStore } from '../data/store';
import type { Decision, RuntimePolicy } from '../data/types';
import { Badge, Button, CodeBlock, DescList, Drawer, Segmented } from '../components/ui';
import { DecisionBadge, ModeBadge } from '../components/domain';
import { cn } from '../lib/format';
import { usePermission } from '../lib/rbac';
import { useToast } from '../lib/toast';

// ---------------------------------------------------------------- types
interface Example {
  prompt: string;
  role: string;
  call: string;
  decision: Decision;
  note?: string;
}

type Block =
  | { type: 'question'; options: string[]; answered?: string }
  | { type: 'draft'; policy: RuntimePolicy; examples: Example[]; conflicts: { id: string; text: string }[]; changes?: string[]; submitted?: boolean }
  | { type: 'explain'; agentId: string }
  | { type: 'steps'; steps: string[] };

interface Msg {
  id: number;
  from: 'user' | 'pilot';
  text: string;
  blocks?: Block[];
}

type Target = { kind: 'agent' | 'tool'; id: string } | null;

let mid = 0;

// ---------------------------------------------------------------- drafting logic (scripted stand-in for the Azure OpenAI agent)
function policyToJson(p: RuntimePolicy) {
  return JSON.stringify(
    {
      id: p.id,
      name: p.name,
      type: p.type,
      scope: p.scope,
      tool: p.toolId,
      conditions: p.conditions.map((c) => ({ field: c.field, op: c.op, value: c.value })),
      decision: p.decision,
      reason: p.reason,
      mode: p.mode,
      priority: p.priority,
    },
    null,
    2,
  );
}

function mailPolicy(allowAdmins: boolean, author: string): { policy: RuntimePolicy; examples: Example[] } {
  const roles = allowAdmins ? 'Operator, Admin' : 'Operator';
  const policy: RuntimePolicy = {
    id: 'pol-draft-mail',
    name: allowAdmins ? 'Only Operators and Admins can read mail' : 'Only Operators can read mail',
    description: `Users with the Reader role cannot read mail. Only ${allowAdmins ? 'Operators and Admins' : 'Operators'} can read mail.`,
    type: 'User context',
    scope: { kind: 'agent', id: 'ag-gmail' },
    toolId: 't-read_mail',
    conditions: [
      { field: 'tool.name', op: 'in', value: 'read_mail, list_mail' },
      { field: 'user.role', op: allowAdmins ? 'in' : '≠', value: allowAdmins ? `!${roles}` : 'Operator' },
    ],
    decision: 'block',
    reason: allowAdmins ? 'Only Operators and Admins can read mail' : 'Only Operators can read mail',
    mode: 'monitor',
    version: 0,
    author,
    updatedAt: '',
    status: 'Draft',
    hits7d: 0,
    priority: 12,
    history: [],
  };
  const examples: Example[] = [
    { prompt: 'Summarise today’s mail', role: 'Operator', call: 'read_mail(folder="inbox")', decision: 'allow' },
    { prompt: 'Summarise today’s mail', role: 'Reader', call: 'read_mail(folder="inbox")', decision: 'block', note: `“${policy.reason}”` },
    { prompt: 'Show unread count', role: 'Reader', call: 'list_mail(unread=true)', decision: 'block', note: 'list_mail also reads mail' },
    allowAdmins
      ? { prompt: 'Summarise today’s mail', role: 'Admin', call: 'read_mail(folder="inbox")', decision: 'allow', note: 'Admins allowed after refinement' }
      : { prompt: 'Summarise today’s mail', role: 'Admin', call: 'read_mail(folder="inbox")', decision: 'block', note: 'Default; change if Admins should be allowed' },
  ];
  return { policy, examples };
}

function refundPolicy(limit: number, decision: Decision, author: string): { policy: RuntimePolicy; examples: Example[] } {
  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  return {
    policy: {
      id: 'pol-draft-refund',
      name: `Refunds above ${fmt(limit)} ${decision === 'block' ? 'are blocked' : 'need approval'}`,
      description: `Support agents may refund only up to ${fmt(limit)}.`,
      type: 'Parameter rule',
      scope: { kind: 'role', id: 'role-support' },
      toolId: 't-issue_refund',
      conditions: [{ field: 'params.amount', op: '>', value: String(limit) }],
      decision,
      reason: `Refund above ${limit.toLocaleString('en-IN')} ${decision === 'block' ? 'is not allowed' : 'needs approval'}`,
      mode: 'monitor',
      version: 0,
      author,
      updatedAt: '',
      status: 'Draft',
      hits7d: 0,
      priority: 20,
      history: [],
    },
    examples: [
      { prompt: 'Refund my ₹1,200 order', role: 'Customer', call: `issue_refund(order_id="ORD-311", amount=1200)`, decision: 'allow' },
      { prompt: 'Refund ₹8,000 for a damaged TV', role: 'Customer', call: `issue_refund(order_id="ORD-123", amount=8000)`, decision: limit < 8000 ? decision : 'allow' },
      { prompt: `Refund exactly ${fmt(limit)}`, role: 'Customer', call: `issue_refund(order_id="ORD-990", amount=${limit})`, decision: 'allow', note: 'Edge case: equal to the limit is allowed (> not ≥)' },
    ],
  };
}

function emailPolicy(author: string): { policy: RuntimePolicy; examples: Example[] } {
  return {
    policy: {
      id: 'pol-draft-email',
      name: 'Never send email outside corp.com',
      description: 'Applies to every agent that uses send_email.',
      type: 'Parameter rule',
      scope: { kind: 'tool', id: 't-send_email' },
      toolId: 't-send_email',
      conditions: [{ field: 'params.to', op: 'regex', value: '!@corp\\.com$' }],
      decision: 'block',
      reason: 'Email can only be sent to corp.com addresses',
      mode: 'monitor',
      version: 0,
      author,
      updatedAt: '',
      status: 'Draft',
      hits7d: 0,
      priority: 12,
      history: [],
    },
    examples: [
      { prompt: 'Email the refund confirmation to the team', role: 'Support agent', call: 'send_email(to="cs-team@corp.com")', decision: 'allow' },
      { prompt: 'Send the statement to my Gmail', role: 'Support agent', call: 'send_email(to="someone@gmail.com")', decision: 'block' },
      { prompt: 'Reply to the vendor', role: 'Mail assistant', call: 'send_email(to="ap@corp.com.evil.io")', decision: 'block', note: 'Look-alike domain is caught by the $ anchor' },
    ],
  };
}

// ---------------------------------------------------------------- component
export function PolicyPilot({ open, onClose, initialTarget }: { open: boolean; onClose: () => void; initialTarget: Target }) {
  const s = useStore((x) => x);
  const { can, reason } = usePermission();
  const toast = useToast();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState<Target>(null);
  const [pending, setPending] = useState<null | 'mail-admins'>(null);
  const [lastDraft, setLastDraft] = useState<null | 'mail' | 'mail-admins'>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open && initialTarget) {
      setTarget(initialTarget);
      const name = initialTarget.kind === 'agent' ? s.agents.find((a) => a.id === initialTarget.id)?.name : s.tools.find((t) => t.id === initialTarget.id)?.name;
      if (name) setInput((initialTarget.kind === 'agent' ? '@' : '#') + name + ' ');
    }
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialTarget]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, busy]);

  // ------------------------------------------------ mention picker
  const approvedAgents = s.agents.filter((a) => a.lifecycle === 'Approved' || a.lifecycle === 'In review' || a.lifecycle === 'Suspended');
  const mention = useMemo(() => {
    const m = /([@#])([\w \-()]*)$/.exec(input);
    if (!m) return null;
    const term = m[2].toLowerCase();
    if (m[1] === '@')
      return { sym: '@' as const, start: m.index, items: approvedAgents.filter((a) => a.name.toLowerCase().includes(term)).slice(0, 6).map((a) => ({ id: a.id, name: a.name, sub: a.platform })) };
    return { sym: '#' as const, start: m.index, items: s.tools.filter((t) => t.approved && t.name.includes(term)).slice(0, 6).map((t) => ({ id: t.id, name: t.name, sub: t.actionType })) };
  }, [input, approvedAgents, s.tools]);
  const [pickIdx, setPickIdx] = useState(0);
  useEffect(() => {
    setPickIdx(0);
  }, [mention?.items.length, mention?.sym]);

  const pick = (it: { id: string; name: string }) => {
    if (!mention) return;
    setInput(input.slice(0, mention.start) + mention.sym + it.name + ' ');
    setTarget({ kind: mention.sym === '@' ? 'agent' : 'tool', id: it.id });
    inputRef.current?.focus();
  };

  // ------------------------------------------------ conversation
  const push = (m: Omit<Msg, 'id'>) => setMsgs((xs) => [...xs, { ...m, id: ++mid }]);

  const reply = (m: Omit<Msg, 'id'>, steps: string[] = ['Loading tools, parameter schemas and user roles', 'Checking existing policies for conflicts', 'Running examples through the simulator']) => {
    setBusy(true);
    const id = ++mid;
    setMsgs((xs) => [...xs, { id, from: 'pilot', text: '', blocks: [{ type: 'steps', steps }] }]);
    setTimeout(() => {
      setMsgs((xs) => xs.map((x) => (x.id === id ? { ...m, id } : x)));
      setBusy(false);
    }, 900 + steps.length * 250);
  };

  const conflictsFor = (p: RuntimePolicy) =>
    s.runtimePolicies
      .filter((x) => x.toolId === p.toolId && x.status !== 'Draft' && x.id !== 'pol-152')
      .map((x) => ({
        id: x.id,
        text:
          x.decision === p.decision && JSON.stringify(x.conditions) === JSON.stringify(p.conditions)
            ? `Duplicates ${x.id} “${x.name}” (${x.mode}). Submitting would create a second identical rule.`
            : `Overlaps ${x.id} “${x.name}” (${x.decision}, ${x.mode}). ${x.decision === 'block' || p.decision === 'block' ? 'Block wins over allow; the more specific scope applies first.' : 'Both may match the same call.'}`,
      }));

  const respond = (text: string) => {
    const t = text.toLowerCase();
    const mentionedAgent = s.agents.find((a) => text.includes('@' + a.name));
    const mentionedTool = s.tools.find((x) => text.includes('#' + x.name));
    const badAt = /@([A-Z][\w ]+)/.exec(text);
    const tgt = mentionedAgent ? { kind: 'agent' as const, id: mentionedAgent.id } : mentionedTool ? { kind: 'tool' as const, id: mentionedTool.id } : target;

    // Refinement of the last draft
    if (lastDraft && /allow admins|admins too|also allow admin/.test(t)) {
      const { policy, examples } = mailPolicy(true, s.session.userId);
      setLastDraft('mail-admins');
      return reply({
        from: 'pilot',
        text: 'Updated the draft so Admins can also read mail. Readers and anyone else are still blocked.',
        blocks: [{ type: 'draft', policy, examples, conflicts: [], changes: ['Condition user.role: ≠ Operator → not in [Operator, Admin]', 'Name and reason updated', 'Example 4 (Admin) now Allow'] }],
      });
    }

    // Answer to the clarifying question
    if (pending === 'mail-admins') {
      setPending(null);
      const allow = /allow/.test(t) && !/block/.test(t);
      const { policy, examples } = mailPolicy(allow, s.session.userId);
      setLastDraft(allow ? 'mail-admins' : 'mail');
      return reply({
        from: 'pilot',
        text: `Here is the draft. It covers read_mail and list_mail, because both return message content. ${allow ? 'Admins are allowed.' : 'Admins and any other role are blocked by default.'}`,
        blocks: [{ type: 'draft', policy, examples, conflicts: [] }],
      });
    }

    // Unknown agent or role → ask, never draft (acceptance criterion)
    if (badAt && !mentionedAgent) {
      return reply({ from: 'pilot', text: `I can't find an approved agent called “${badAt[1].trim()}” that you can manage. Type @ to pick one from the inventory.` }, ['Searching the inventory']);
    }
    if (/\b(auditor|superuser|vip)\b/.test(t) && /role/.test(t)) {
      return reply({ from: 'pilot', text: 'That role does not exist in your Entra groups. Known roles for this agent: Reader, Operator, Admin. Which one did you mean?', blocks: [{ type: 'question', options: ['Reader', 'Operator', 'Admin'] }] }, ['Loading user roles from Entra ID']);
    }

    // Explain mode
    if (/what can|explain|allowed to/.test(t) && tgt?.kind === 'agent') {
      return reply({ from: 'pilot', text: `Here is what ${s.agents.find((a) => a.id === tgt.id)!.name} can do today.`, blocks: [{ type: 'explain', agentId: tgt.id }] }, ['Loading agent role and policies']);
    }

    if (!tgt) {
      return reply({ from: 'pilot', text: 'Which agent or tool should this rule apply to? Type @ to pick an agent or # to pick a tool.' }, ['Reading your request']);
    }

    // Mail access scenario
    if ((tgt.id === 'ag-gmail' || tgt.id === 't-read_mail') && /read(er)?/.test(t) && /operator/.test(t)) {
      setPending('mail-admins');
      return reply(
        { from: 'pilot', text: 'Before I draft this: what about users who are neither Reader nor Operator, such as Admins?', blocks: [{ type: 'question', options: ['Block them (default)', 'Allow Admins too'] }] },
        ['Loading tools for Gmail Summary Agent', 'Loading user roles from Entra ID'],
      );
    }

    // Refund limit scenario
    const amt = /(\d[\d,]*)\s*(k|lakh)?/.exec(t);
    if ((tgt.id === 't-issue_refund' || tgt.id === 'ag-support' || tgt.id === 'ag-refund' || /refund/.test(t)) && amt) {
      let limit = Number(amt[1].replace(/,/g, ''));
      if (amt[2] === 'k') limit *= 1000;
      if (amt[2] === 'lakh') limit *= 100000;
      const decision: Decision = /block|never|not allowed|only below|only under/.test(t) ? 'block' : 'ask_human';
      const { policy, examples } = refundPolicy(limit, decision, s.session.userId);
      return reply({
        from: 'pilot',
        text: `Drafted a parameter rule on issue_refund for the Support agent role. Calls above ₹${limit.toLocaleString('en-IN')} will ${decision === 'block' ? 'be blocked' : 'go to the agent sponsor for approval'}.`,
        blocks: [{ type: 'draft', policy, examples, conflicts: conflictsFor(policy) }],
      });
    }

    // Email domain scenario
    if (tgt.id === 't-send_email' || /outside (our|the) domain|external email/.test(t)) {
      const { policy, examples } = emailPolicy(s.session.userId);
      return reply({
        from: 'pilot',
        text: 'Drafted a tool policy on #send_email. It applies to every agent that uses this tool (4 agents today).',
        blocks: [{ type: 'draft', policy, examples, conflicts: conflictsFor(policy) }],
      });
    }

    return reply(
      {
        from: 'pilot',
        text: 'I need a little more detail to draft this. Should matching calls be blocked, sent to a human for approval, or only logged?',
        blocks: [{ type: 'question', options: ['Block', 'Ask a human', 'Audit only'] }],
      },
      ['Reading your request'],
    );
  };

  const send = (text = input) => {
    const v = text.trim();
    if (!v || busy) return;
    push({ from: 'user', text: v });
    setInput('');
    respond(v);
  };

  const answerQuestion = (msgId: number, opt: string) => {
    setMsgs((xs) => xs.map((m) => (m.id === msgId ? { ...m, blocks: m.blocks?.map((b) => (b.type === 'question' ? { ...b, answered: opt } : b)) } : m)));
    send(opt);
  };

  const submit = (msgId: number, p: RuntimePolicy) => {
    const id = `pol-${180 + Math.floor(Math.random() * 800)}`;
    const conversation = msgs.filter((m) => m.from === 'user').map((m) => `“${m.text}”`).join(' → ');
    actions.submitPolicyForApproval({ ...p, id, status: 'Pending approval' }, `Drafted with PolicyPilot: ${conversation}`);
    setMsgs((xs) => xs.map((m) => (m.id === msgId ? { ...m, blocks: m.blocks?.map((b) => (b.type === 'draft' ? { ...b, submitted: true, policy: { ...b.policy, id } } : b)) } : m)));
    toast({ tone: 'success', title: 'Submitted for approval', body: `${p.name} goes to Vikram Rao (Security admin). After approval it starts in monitor mode.` });
  };

  const reset = () => {
    setMsgs([]);
    setPending(null);
    setLastDraft(null);
    setTarget(null);
    setInput('');
  };

  const suggestions = [
    { label: 'Mail access by role', text: '@Gmail Summary Agent Users with the Reader role cannot read mail. Only Operators can read mail.' },
    { label: 'Refund limit', text: '@Support Resolution Agent Refunds above 5,000 need human approval' },
    { label: 'Email domain', text: '#send_email never send outside our domain' },
    { label: 'Explain an agent', text: 'What can @Gmail Summary Agent do?' },
  ];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="max-w-2xl"
      title={
        <span className="inline-flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> PolicyPilot
        </span>
      }
      subtitle="Describe a rule in plain language. Nothing is enforced until an approver signs off."
      headerExtra={msgs.length > 0 && <Button size="xs" variant="ghost" icon={RotateCcw} onClick={reset}>New chat</Button>}
    >
      <div className="flex h-full flex-col">
        <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {msgs.length === 0 && (
            <div className="space-y-5">
              <div className="rounded-lg border border-border bg-surface-2/50 p-4">
                <p className="text-sm text-fg">PolicyPilot turns a sentence into a runtime policy for the agents and tools in your inventory.</p>
                <ul className="mt-2 space-y-1 text-sm text-muted">
                  <li>
                    Type <span className="font-mono text-primary">@</span> to pick an agent, or <span className="font-mono text-primary">#</span> to pick a tool.
                  </li>
                  <li>It asks before guessing, and runs examples through the simulator.</li>
                  <li>Only metadata is sent to the model: tools, schemas, roles and existing policies.</li>
                </ul>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted">Try one of these</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {suggestions.map((x) => (
                    <button key={x.label} onClick={() => send(x.text)} className="rounded-lg border border-border bg-surface p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5">
                      <span className="block text-sm font-medium">{x.label}</span>
                      <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{x.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {msgs.map((m) =>
            m.from === 'user' ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-fg">
                  <MentionText text={m.text} />
                </div>
              </div>
            ) : (
              <div key={m.id} className="flex gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1 space-y-3">
                  {m.text && <p className="text-sm leading-relaxed text-fg">{m.text}</p>}
                  {m.blocks?.map((b, i) => (
                    <PilotBlock key={i} block={b} onAnswer={(o) => answerQuestion(m.id, o)} onSubmit={(p) => submit(m.id, p)} canSubmit={can('policypilot.draft')} denyReason={reason('policypilot.draft')} />
                  ))}
                </div>
              </div>
            ),
          )}
        </div>

        <div className="relative border-t border-border bg-surface p-3">
          {mention && mention.items.length > 0 && (
            <ul className="absolute bottom-full left-3 right-3 mb-2 animate-pop-in overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-pop" role="listbox">
              <li className="px-3 pb-1 pt-1.5 text-[11px] text-subtle">{mention.sym === '@' ? 'Agents you can manage' : 'Approved tools'}</li>
              {mention.items.map((it, i) => (
                <li key={it.id}>
                  <button
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(it);
                    }}
                    className={cn('flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm', i === pickIdx && 'bg-primary/10')}
                  >
                    {mention.sym === '@' ? <Bot className="h-4 w-4 text-subtle" /> : <Wrench className="h-4 w-4 text-subtle" />}
                    <span className={mention.sym === '#' ? 'font-mono text-[13px]' : ''}>{it.name}</span>
                    <span className="ml-auto text-xs text-subtle">{it.sub}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-end gap-2 rounded-lg border border-border bg-surface-2/40 p-1.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
            <textarea
              ref={inputRef}
              value={input}
              rows={2}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (mention && mention.items.length) {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setPickIdx((i) => (i + 1) % mention.items.length); return; }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setPickIdx((i) => (i - 1 + mention.items.length) % mention.items.length); return; }
                  if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(mention.items[pickIdx]); return; }
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="e.g. @Support Resolution Agent may refund only below 5,000"
              aria-label="Message PolicyPilot"
              className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-fg placeholder:text-subtle focus:outline-none"
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || busy}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-fg transition-opacity disabled:opacity-40"
              aria-label="Send"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-1.5 px-1 text-[11px] text-subtle">Enter to send · Shift+Enter for a new line · Drafts and conversations are kept for audit.</p>
        </div>
      </div>
    </Drawer>
  );
}

/** Human-readable condition; a leading "!" on the value negates the operator. */
function conditionText(c: RuntimePolicy['conditions'][number]) {
  const neg = c.value.startsWith('!');
  const op = neg ? (c.op === 'in' ? 'not in' : c.op === 'contains' ? 'does not contain' : c.op === 'regex' ? 'does not match' : `not ${c.op}`) : c.op;
  return `${c.field} ${op} ${c.value.replace(/^!/, '')}`;
}

function MentionText({ text }: { text: string }) {
  const parts = text.split(/((?:@|#)[A-Za-z_][\w()]*(?: [A-Z][\w()]*)*)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^[@#]/.test(p) ? (
          <span key={i} className="rounded bg-white/20 px-1 font-medium">
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function PilotBlock({ block, onAnswer, onSubmit, canSubmit, denyReason }: { block: Block; onAnswer: (o: string) => void; onSubmit: (p: RuntimePolicy) => void; canSubmit: boolean; denyReason?: string }) {
  if (block.type === 'steps') {
    return (
      <ul className="space-y-1.5">
        {block.steps.map((st, i) => (
          <li key={i} className="flex items-center gap-2 text-sm text-muted" style={{ animation: `fade-in 200ms ${i * 250}ms both` }}>
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            {st}
          </li>
        ))}
      </ul>
    );
  }
  if (block.type === 'question') {
    return (
      <div className="flex flex-wrap gap-2">
        {block.options.map((o) => (
          <button
            key={o}
            disabled={!!block.answered}
            onClick={() => onAnswer(o)}
            className={cn(
              'rounded-full border px-3 py-1 text-sm transition-colors',
              block.answered === o ? 'border-primary bg-primary/10 text-primary' : 'border-border text-fg hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50',
            )}
          >
            {o}
          </button>
        ))}
      </div>
    );
  }
  if (block.type === 'explain') return <ExplainAgent agentId={block.agentId} />;
  return <DraftCard block={block} onSubmit={onSubmit} canSubmit={canSubmit} denyReason={denyReason} />;
}

function DraftCard({ block, onSubmit, canSubmit, denyReason }: { block: Extract<Block, { type: 'draft' }>; onSubmit: (p: RuntimePolicy) => void; canSubmit: boolean; denyReason?: string }) {
  const [view, setView] = useState<'summary' | 'form' | 'json'>('summary');
  const tools = useStore((s) => s.tools);
  const roles = useStore((s) => s.agentRoles);
  const agents = useStore((s) => s.agents);
  const p = block.policy;
  const scopeLabel =
    p.scope.kind === 'all' ? 'All agents' : p.scope.kind === 'role' ? `Agent role: ${roles.find((r) => r.id === p.scope.id)?.name}` : p.scope.kind === 'agent' ? `Agent: ${agents.find((a) => a.id === p.scope.id)?.name}` : `Tool: ${tools.find((t) => t.id === p.scope.id)?.name} (every agent)`;
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-2/50 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Badge tone="violet" icon={Sparkles}>Draft</Badge>
          <span className="truncate text-sm font-medium">{p.name}</span>
        </div>
        <Segmented size="xs" value={view} onChange={setView} options={[{ value: 'summary', label: 'Summary' }, { value: 'form', label: 'Form' }, { value: 'json', label: 'JSON' }]} />
      </div>

      <div className="space-y-4 p-3">
        {block.changes && (
          <div className="rounded-md border border-info/30 bg-info/5 px-3 py-2">
            <p className="text-xs font-medium text-info">What changed</p>
            <ul className="mt-1 list-inside list-disc text-xs text-muted">
              {block.changes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        {view === 'summary' && (
          <p className="text-sm leading-relaxed text-fg">
            When <b>{scopeLabel.replace(/^.*?: /, '')}</b> calls <span className="font-mono text-[13px]">{tools.find((t) => t.id === p.toolId)?.name ?? 'any tool'}</span>
            {p.conditions.length > 0 && <> and {p.conditions.map(conditionText).join(' and ')}</>}, the decision is <DecisionBadge decision={p.decision} />. Reason shown to the agent: “{p.reason}”.
          </p>
        )}
        {view === 'form' && (
          <DescList
            cols={2}
            items={[
              ['Type', p.type],
              ['Scope', scopeLabel],
              ['Tool', <span className="font-mono text-[13px]">{tools.find((t) => t.id === p.toolId)?.name ?? 'Any'}</span>],
              ['Decision', <DecisionBadge decision={p.decision} />],
              ['Conditions', p.conditions.map((c) => <span key={c.field} className="block font-mono text-[12px]">{conditionText(c)}</span>)],
              ['Starts in', <ModeBadge mode="monitor" />],
            ]}
          />
        )}
        {view === 'json' && <CodeBlock code={policyToJson(p)} lang="json" maxHeight="260px" />}

        <div>
          <p className="mb-1.5 text-xs font-medium text-muted">Examples run through the simulator</p>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-xs">
              <thead className="bg-surface-2/60 text-muted">
                <tr>
                  <th className="px-2.5 py-1.5 text-left font-medium">Example</th>
                  <th className="px-2.5 py-1.5 text-left font-medium">User role</th>
                  <th className="px-2.5 py-1.5 text-left font-medium">Tool call</th>
                  <th className="px-2.5 py-1.5 text-left font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {block.examples.map((e, i) => (
                  <tr key={i} className="border-t border-border align-top">
                    <td className="px-2.5 py-2 text-fg">“{e.prompt}”</td>
                    <td className="px-2.5 py-2 text-muted">{e.role}</td>
                    <td className="px-2.5 py-2 font-mono text-[11.5px] text-muted">{e.call}</td>
                    <td className="px-2.5 py-2">
                      <DecisionBadge decision={e.decision} />
                      {e.note && <span className="mt-1 block text-[11px] text-subtle">{e.note}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {block.conflicts.length > 0 ? (
          <div className="space-y-1.5">
            {block.conflicts.map((c) => (
              <div key={c.id} className="flex gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-fg">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                <span>
                  {c.text}{' '}
                  <Link to={`/runtime/policies/${c.id}`} className="link">
                    Open {c.id}
                  </Link>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="flex items-center gap-1.5 text-xs text-success">
            <CheckCircle2 className="h-3.5 w-3.5" /> Validated against tool schemas · no conflicts with existing policies
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface-2/40 px-3 py-2">
        {block.submitted ? (
          <p className="flex items-center gap-1.5 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" /> Submitted as {p.id}. Waiting for Security admin approval.
          </p>
        ) : (
          <>
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <CircleAlert className="h-3.5 w-3.5" /> Refine in chat, e.g. “also allow Admins”
            </p>
            <Button size="sm" variant="primary" onClick={() => onSubmit(p)} disabledReason={canSubmit ? undefined : denyReason}>
              Submit for approval
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function ExplainAgent({ agentId }: { agentId: string }) {
  const s = useStore((x) => x);
  const agent = s.agents.find((a) => a.id === agentId)!;
  const role = s.agentRoles.find((r) => r.id === agent.agentRoleId);
  const pols = s.runtimePolicies.filter(
    (p) => p.status === 'Active' && (p.scope.kind === 'all' || (p.scope.kind === 'agent' && p.scope.id === agentId) || (p.scope.kind === 'role' && p.scope.id === agent.agentRoleId) || (p.scope.kind === 'tool' && agent.toolIds.includes(p.scope.id!))),
  );
  const row = (label: string, v: ReactNode) => (
    <div className="grid grid-cols-[110px_1fr] gap-2 py-1.5 text-sm">
      <span className="text-muted">{label}</span>
      <span>{v}</span>
    </div>
  );
  return (
    <div className="divide-y divide-border rounded-lg border border-border bg-surface px-3">
      {row('Agent role', role?.name ?? 'None assigned')}
      {row('Allowed tools', <span className="flex flex-wrap gap-1">{agent.toolIds.map((t) => <Badge key={t} tone={role?.allowedToolIds.includes(t) ? 'success' : 'danger'}>{s.tools.find((x) => x.id === t)?.name}</Badge>)}</span>)}
      {row('Models', agent.modelIds.map((m) => s.models.find((x) => x.id === m)?.name).join(', '))}
      {row('Default', role ? <DecisionBadge decision={role.defaultDecision} /> : '—')}
      {row(
        'Rules',
        <ul className="space-y-1">
          {pols.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-1.5">
              <DecisionBadge decision={p.decision} />
              <Link to={`/runtime/policies/${p.id}`} className="link text-sm">{p.name}</Link>
              <ModeBadge mode={p.mode} />
            </li>
          ))}
        </ul>,
      )}
    </div>
  );
}
