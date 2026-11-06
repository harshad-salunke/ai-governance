# DG Catalyst – Product Requirements Document

Nov 1, 2026 · @Harshad

DG Catalyst is an AI governance portal that discovers every AI agent, model and tool in an organisation, scores its risk, governs its approval and lifecycle, and enforces policies on every agent action at runtime.

## 1. Overview

**Problem.** Teams are building AI agents on Azure AI Foundry, Microsoft Fabric, MCP servers and other frameworks faster than anyone can track them. Nobody can answer: how many agents do we have, who owns them, what data and tools they use, how risky they are, and whether they are doing only what they are allowed to do.

**Vision.** One portal where an organisation can see every AI asset, understand how it is connected, decide whether it is allowed, and control what it does at runtime, across any platform.

**Goals**

1. Discover 100% of agents, models, tools and MCP servers in connected sources, plus anything registered manually.
2. Show lineage from application to agent to model to tools to data.
3. Score every agent's risk automatically from scanned metadata, and route it through an approval workflow.
4. Let governance teams define what each agent may do, and enforce it on every tool call through a Python SDK.
5. Track usage, tokens, cost, decisions and violations, and produce audit-ready reports.

**Non-goals for v1**

- External regulatory frameworks (EU AI Act, NIST AI RMF, ISO 42001, DPDP Act packs). Internal governance policies only; frameworks can be added later as templates.
- Building agents for customers. DG Catalyst governs agents; it does not build them.
- Our own red-teaming or model evaluation engine. We store results produced by other tools.
- Replacing identity providers. We integrate with Microsoft Entra ID, we don't replace it.

## 2. Users and portal roles

Eight roles cover everyone who uses DG Catalyst. A user can hold several roles, and every role can be scoped to the whole organisation or to one business unit.

| Role | Who | Can do | Cannot do |
| --- | --- | --- | --- |
| Platform admin | IT / platform team | Manage connectors, credentials, SSO, business units, portal users and roles, API keys, settings | Approve agents they own |
| AI governance lead | AI CoE / Responsible AI office | Define risk rules and weights, control checklists, approval workflows, governance policies; final approval for high-risk agents | Change connectors or credentials |
| Security admin | CISO team | Write runtime policies, agent roles, model access rules, kill switch; review violations | Edit risk rules or checklists |
| Risk reviewer | Risk, legal, privacy | Review risk assessments, approve or reject, request evidence, grant time-limited exceptions | Edit runtime policies |
| Agent owner | Developers, engineering teams | Register and edit their agents, tools and lineage; answer risk questionnaire; request approval; test policies in simulate mode; view their traces and cost | Approve their own agents; change policies |
| Business sponsor | Business head of a use case | Confirm purpose, approve renewal or retirement, act on human-approval requests for their agents | Technical configuration |
| FinOps manager | Finance / platform | Set token budgets, view cost dashboards, export chargeback | Policy or approval actions |
| Auditor / viewer | Internal audit, executives | Read everything, export reports | Any change |

**Rules**

- Separation of duties: nobody can approve an agent they own or sponsor.
- Every role assignment and change is recorded.
- Login only through SSO (Microsoft Entra ID); users and groups sync from Entra.
- Human-approval requests can be actioned from the portal, email or Microsoft Teams.

## 3. Tech stack and architecture

DG Catalyst runs on Azure: a React portal, FastAPI services, Azure SQL Database as the system of record, and Azure OpenAI for the portal's own AI features.

| Layer | Technology | Used for |
| --- | --- | --- |
| Frontend | React + TypeScript, Tailwind CSS for styling, component library (e.g. Fluent UI), React Flow for the lineage graph, Recharts for dashboards | Portal UI |
| Backend API | Python FastAPI (async), Pydantic models, SQLAlchemy ORM | REST API for portal, SDK and connectors |
| Policy decision service | FastAPI service, policies compiled and cached in memory | Fast allow / block / ask decisions for the SDK |
| Background workers | FastAPI-compatible workers (Celery or Azure Functions) with a queue (Azure Service Bus) | Connector scans, risk re-scoring, notifications, reports |
| AI services | FastAPI agent service on Azure OpenAI (GPT-class model + embeddings) | Natural-language policies, use-case classification, metadata enrichment, PolicyPilot chat |
| Database | Azure SQL Database (MS SQL) | Inventory, lineage edges, policies, approvals, decisions, audit |
| File storage | Azure Blob Storage | Evidence files, exported reports |
| Cache | Azure Cache for Redis | Compiled policies, allowed-tool lists, sessions |
| Secrets | Azure Key Vault | Connector credentials, API keys |
| Identity | Microsoft Entra ID (SSO, groups), app registrations for connectors | Portal login and connector auth |
| Hosting | Azure App Service or Azure Container Apps; Static Web Apps for React | Runtime |
| Telemetry ingest (Phase 4) | OpenTelemetry collector → Azure SQL / Azure Data Explorer for high-volume traces | LLM observability, tokens, cost |
| Python SDK | `dgcatalyst` package on PyPI (private feed first) | Policy checks inside customer agents |

**How a request flows:** connectors scan sources on a schedule and write to the inventory; the governance layer scores risk and runs approvals; approved policies are compiled and pushed to the policy decision service; customer agents call it through the SDK before every tool call; every decision is logged and feeds monitoring and reports.

&#91;embedded content: DG Catalyst architecture · 10 components\]

The portal and connectors share the FastAPI API and Azure SQL; customer agents hit only the policy decision service, which reads compiled policies from Redis.

## 4. Core objects

Every module reads and writes the same set of objects in Azure SQL. All objects carry `id`, `tenant_id`, `business_unit_id`, `created_at`, `updated_at`, `created_by`, and `source` (connector name or `manual`).

| Object | Key fields | Notes |
| --- | --- | --- |
| Application | name, description, URL, owner, sponsor, business unit | The product end users see; contains one or more agents |
| Agent | name, description, platform (Foundry, Fabric, custom), framework, status, lifecycle state, risk tier, owner, sponsor, agent role, managed flag, version | Central object |
| Model | provider, model name, version, deployment name, region, approved flag | e.g. Azure OpenAI GPT deployment |
| Tool | name, description, input schema (JSON), action type (read / write / delete / send / payment), MCP server, schema hash, approved flag | Schema hash detects changes |
| MCP server | name, URL, transport, owner, tools list, last scanned | Tools are children |
| Data source | type (Fabric lakehouse, SQL, SharePoint…), sensitivity class, columns of interest | Feeds data-sensitivity scoring |
| Lineage edge | from object, to object, relation (uses, calls, reads, contains), source (auto / manual) | Graph stored as an edge table |
| Connector | type, credentials ref (Key Vault), schedule, last run, status |  |
| Risk assessment | agent, signal scores, override hits, total, tier, questionnaire answers, reviewer, status | Versioned on every re-score |
| Control | name, description, applies to tier, evidence required | From checklist templates |
| Control evidence | control, agent, file / link, submitted by, status | Files in Blob Storage |
| Approval request | object, workflow, steps, approvers, decisions, comments |  |
| Exception | agent, control or policy waived, reason, expiry date, approver |  |
| Incident | agent, severity, description, linked decisions, status, fix |  |
| Agent role | name, allowed tools, allowed models, allowed data classes |  |
| Runtime policy | name, scope, conditions, decision, mode (monitor / enforce), version, author | Stored as JSON + compiled form |
| Decision log | timestamp, agent, user, tool, parameters (redacted), policy matched, decision, latency | High volume; partitioned by date |
| Approval task (runtime) | decision log ref, approver, status, timeout | For "ask human" decisions |
| Usage record (Phase 4) | agent, model, tokens in/out, cost, trace id |  |
| Budget (Phase 4) | scope (agent / team / model), limit, period, action at limit |  |
| Audit event | actor, action, object, before / after, timestamp | Every change in the portal |

## 5. Release plan at a glance

&#91;embedded content: release plan · 4 phases, 3 gates\]

Each phase ships to a pilot customer and must pass its gate before the next starts; LLM observability, cost, budgets, audit log and reports come last. Durations are for the engineering team to estimate.

## 6. Phase 1 – Connect and discover

Phase 1 makes every AI asset visible: what exists, who owns it, and how it is connected. Exit gate: a pilot customer sees all agents from Foundry, Fabric and their MCP servers, with owners and lineage, in one portal.

### 6.1 Portal foundation and administration

| ID | Requirement | Priority |
| --- | --- | --- |
| P1-ADM-01 | SSO login with Microsoft Entra ID; sync users and groups | Must |
| P1-ADM-02 | Eight portal roles (section 2) with role-based access on every API and screen | Must |
| P1-ADM-03 | Business units; scope roles and data to a business unit | Must |
| P1-ADM-04 | Multi-tenant data isolation by `tenant_id` | Must |
| P1-ADM-05 | API key management for SDK and integrations (create, rotate, revoke) | Must |
| P1-ADM-06 | Notification settings (email, Microsoft Teams) | Should |
| P1-ADM-07 | Audit event recorded for every create, update, delete and role change (stored now, UI in Phase 4) | Must |

### 6.2 Source connectors

| ID | Requirement | Priority |
| --- | --- | --- |
| P1-CON-01 | Azure AI Foundry connector: list projects, agents, model deployments, tools/actions, knowledge sources | Must |
| P1-CON-02 | Microsoft Fabric connector: list workspaces, data agents, the lakehouses/warehouses they use, sensitivity labels | Must |
| P1-CON-03 | MCP connector: connect to an MCP server URL, call list\_tools, store each tool with description and input schema | Must |
| P1-CON-04 | Connector setup wizard: choose type, enter credentials (stored in Key Vault), test connection, choose scope | Must |
| P1-CON-05 | Scheduled scans (default every 24 h) plus "scan now" | Must |
| P1-CON-06 | Connector health page: last run, items found, errors | Must |
| P1-CON-07 | Connector framework so new connectors (Copilot Studio, AWS Bedrock, Databricks) can be added without changing core | Should |

### 6.3 Discovery and AI inventory

| ID | Requirement | Priority |
| --- | --- | --- |
| P1-INV-01 | Inventory list of applications, agents, models, tools, MCP servers, data sources with search, filters (platform, owner, risk, state) and saved views | Must |
| P1-INV-02 | Detail page per object: metadata, owner, lineage, history, related objects | Must |
| P1-INV-03 | Managed vs unmanaged flag: anything discovered but not yet claimed by an owner is "unmanaged" | Must |
| P1-INV-04 | Change detection between scans: new, changed, removed objects; tool schema hash changes highlighted | Must |
| P1-INV-05 | Duplicate detection (same agent from two sources, or near-identical agents) | Should |
| P1-INV-06 | Shadow AI hints: agents found with no owner, unapproved models, unknown MCP servers | Should |
| P1-INV-07 | Inventory dashboard: counts by platform, state, owner coverage, unmanaged count | Must |

### 6.4 Manual registration and metadata

| ID | Requirement | Priority |
| --- | --- | --- |
| P1-REG-01 | Create application, agent, model, tool, MCP server, data source by form | Must |
| P1-REG-02 | Register by API (same fields) for CI/CD pipelines | Must |
| P1-REG-03 | Agent card: purpose, intended users, tools, data, model, human-in-the-loop step, autonomy | Must |
| P1-REG-04 | Auto-fill from an MCP server URL or an agent card endpoint | Should |
| P1-REG-05 | Custom metadata fields defined by platform admin (text, list, date) | Should |
| P1-REG-06 | Bulk import from CSV | Should |
| P1-REG-07 | Version history of every object's metadata | Must |

### 6.5 Ownership and lifecycle

| ID | Requirement | Priority |
| --- | --- | --- |
| P1-OWN-01 | Every agent and application has one owner (technical) and one sponsor (business) | Must |
| P1-OWN-02 | Claim flow: owner claims an unmanaged agent; admin confirms | Must |
| P1-OWN-03 | Orphan detection: owner or sponsor disabled in Entra → reassign to manager and alert | Must |
| P1-OWN-04 | Lifecycle states: Draft → In review → Approved → Deprecated → Retired (approval logic in Phase 2) | Must |
| P1-OWN-05 | Transfer ownership with history | Must |

### 6.6 Lineage and relationship map

| ID | Requirement | Priority |
| --- | --- | --- |
| P1-LIN-01 | Interactive graph: application → agent → model → tools → MCP server → data sources | Must |
| P1-LIN-02 | Auto-build edges from connector data | Must |
| P1-LIN-03 | Manual add/remove of nodes and edges, marked "manual" | Must |
| P1-LIN-04 | Click a node to open its detail page; filter by business unit | Must |
| P1-LIN-05 | Impact analysis: select a model, tool or data source and list every agent and application that depends on it | Should |
| P1-LIN-06 | Highlight risky paths (e.g. external-facing agent reaching sensitive data) once risk exists in Phase 2 | Should |

**Phase 1 acceptance criteria**

- A Foundry project with 10 agents, a Fabric workspace with data agents and one MCP server appear in the inventory within one scan.
- A user can manually add an application and link it to discovered agents in the lineage graph.
- Every agent shows an owner or is flagged unmanaged.
- A new tool on an MCP server appears as "changed" after the next scan.

## 7. Phase 2 – Govern

Phase 2 decides whether each agent is allowed: it scores risk automatically, attaches the right controls, and routes the agent through approval. Exit gate: a pilot customer approves or rejects every agent through DG Catalyst instead of email and spreadsheets.

### 7.1 Automatic risk scoring and classification

Risk is computed from what the scan already found; the owner only answers what the scan cannot know.

| Signal | Detected from | 1 = Low | 2 = Medium | 3 = High |
| --- | --- | --- | --- | --- |
| Actions | Tool action types and parameters (amount, recipient) | Read only | Create / update | Delete, send outside, payment |
| Data sensitivity | Fabric sensitivity labels, column names (salary, PAN, Aadhaar, diagnosis), data source class | Public | Internal | Personal, financial, health |
| Autonomy | Human-approval step present? scheduled with no user? | Suggests only | Acts after approval | Acts alone |
| Exposure | Internal or customer channel, user count | Few internal users | Whole organisation | Customers / public |
| Impact | Azure OpenAI classifies the agent description (section 10) | Convenience | Work output | Decisions on people's money, jobs, health |

Default tiers: 5–7 = Low, 8–11 = Medium, 12–15 = High. Override rules jump straight to High (e.g. payment tool with no human approval, health or ID data, decisions about customers' loans, jobs or insurance). A "Prohibited" tier blocks approval entirely for uses the organisation bans.

| ID | Requirement | Priority |
| --- | --- | --- |
| P2-RSK-01 | Compute signal scores, total and tier automatically after every scan | Must |
| P2-RSK-02 | Governance lead can edit signals, weights, thresholds and override rules | Must |
| P2-RSK-03 | Pre-filled questionnaire: show detected facts, owner confirms or corrects, answers gaps | Must |
| P2-RSK-04 | Show why: each signal's score and the fact that produced it | Must |
| P2-RSK-05 | Re-score automatically when tools, data, model or autonomy change; tier increase sends the agent back to review | Must |
| P2-RSK-06 | Reviewer can adjust the tier with a mandatory reason | Must |
| P2-RSK-07 | Risk history per agent (every version of the assessment) | Must |
| P2-RSK-08 | Attach external test results (red-team reports, evaluation results from Foundry) as files or links | Should |

### 7.2 Controls and checklists

| ID | Requirement | Priority |
| --- | --- | --- |
| P2-CTL-01 | Control library: name, description, evidence required (e.g. "PII masked", "human approval for payments", "owner trained") | Must |
| P2-CTL-02 | Checklist templates per tier: Low, Medium, High each require a set of controls | Must |
| P2-CTL-03 | Risk-to-control mapping: a signal at High adds specific controls (e.g. personal data → masking control) | Must |
| P2-CTL-04 | Evidence upload per control (file to Blob Storage or link); reviewer marks accepted / rejected | Must |
| P2-CTL-05 | Controls that link to runtime policies (Phase 3) are checked automatically once the policy exists | Should |

### 7.3 Approval workflows

| ID | Requirement | Priority |
| --- | --- | --- |
| P2-APR-01 | Workflow builder: steps, approver role or person, parallel or sequential, by tier | Must |
| P2-APR-02 | Default workflows: Low = owner + auto; Medium = sponsor + risk reviewer; High = sponsor + risk reviewer + governance lead | Must |
| P2-APR-03 | Approve, reject, request changes with comments; owner notified | Must |
| P2-APR-04 | Agent cannot move to Approved until all required controls have accepted evidence | Must |
| P2-APR-05 | Approval-before-visibility: only Approved agents and tools are returned to SDK clients and shown in the shared catalog | Must |
| P2-APR-06 | Approval from email and Microsoft Teams | Should |
| P2-APR-07 | SLA timers and reminders on pending approvals | Should |

### 7.4 Governance policies (internal)

| ID | Requirement | Priority |
| --- | --- | --- |
| P2-POL-01 | Write organisation policies as rules over metadata, e.g. "only approved models", "customer-facing agents need a sponsor at director level", "no agent may use a model hosted outside India" | Must |
| P2-POL-02 | Policy violations listed per agent and on a dashboard | Must |
| P2-POL-03 | Policy templates library to start from | Should |

### 7.5 Reviews, exceptions and incidents

| ID | Requirement | Priority |
| --- | --- | --- |
| P2-REV-01 | Periodic re-approval: High every 6 months, Medium every 12 (configurable); reminders and auto-expiry to "Review overdue" | Must |
| P2-REV-02 | Retire flow: sponsor retires an agent; SDK stops returning it | Must |
| P2-EXC-01 | Exceptions: waive a control or policy for one agent with reason, approver and expiry date | Must |
| P2-INC-01 | Incident log: record a problem, link it to the agent and runtime decisions, severity, owner, fix, status | Must |
| P2-INC-02 | Open High-severity incident can suspend the agent (kill switch from Phase 3) | Should |

### 7.6 Governance dashboard

- Agents by tier and state, pending approvals, overdue reviews, open exceptions, open incidents, policy violations, unmanaged agents.

**Phase 2 acceptance criteria**

- A loan-decision agent reading salary data scores High automatically and cannot be approved until required controls have evidence.
- Adding a payment tool to a Low agent re-scores it and sends it back to review within one scan.
- No user can approve an agent they own.

## 8. Phase 3 – Enforce at runtime

Phase 3 makes governance real: approved agents can only use the tools, models and data their role allows, and every tool call is checked before it runs. Exit gate: a pilot agent built with the SDK is blocked from a disallowed tool and from a refund above its limit, and an "ask human" call is approved from Teams.

### 8.1 Agent identity and access

| ID | Requirement | Priority |
| --- | --- | --- |
| P3-IDN-01 | Each approved agent gets a DG Catalyst agent ID and credential (client secret or certificate) used by the SDK | Must |
| P3-IDN-02 | Optional link to the agent's Microsoft Entra Agent ID when it exists | Should |
| P3-IDN-03 | Agent roles: bundles of allowed tools, actions, models and data classes (e.g. Read-only assistant, Support agent, Finance agent) | Must |
| P3-IDN-04 | Model access control: which agent role may use which model deployment and region | Must |
| P3-IDN-05 | Kill switch: suspend an agent instantly; all its checks return block | Must |
| P3-IDN-06 | Least-privilege suggestion: compare tools an agent has with tools it actually calls; suggest removing unused ones | Should |

### 8.2 Runtime policy engine

Every policy = scope + conditions + decision. Decisions: **allow, block, ask human, redact, audit only**.

| Policy type | Example | Decision |
| --- | --- | --- |
| Tool access | Support agent may not call delete\_customer | Block |
| Parameter rule | issue\_refund amount > 5000 | Ask human |
| Data rule | No agent reads the salary table | Block |
| User context | Only HR group members may trigger HR agent tools | Block |
| Model access | Finance agent only on India-region models | Block |
| Time / environment | No production writes from dev agents | Block |
| Content | PII in tool output | Redact |

| ID | Requirement | Priority |
| --- | --- | --- |
| P3-POL-01 | Policy editor (form): pick scope (agent, agent role, all), tool, parameter conditions (=, ≠, >, <, in, contains, regex), decision | Must |
| P3-POL-02 | Policy-as-code: JSON/YAML view and edit, stored in Azure SQL, versioned | Must |
| P3-POL-03 | Natural-language authoring: describe the rule, done through PolicyPilot (section 8.6) | Must |
| P3-POL-04 | Validation: check tool and parameter names against the tool's schema in the inventory | Must |
| P3-POL-05 | Conflict detection and order: explicit block beats allow; most specific scope wins; default for unmatched calls configurable (default block for High-risk agents) | Must |
| P3-POL-06 | Simulate mode: test a sample call and see which policy matches and why | Must |
| P3-POL-07 | Rollout modes per policy: monitor (log only) → enforce | Must |
| P3-POL-08 | Tool quarantine: when a tool's schema hash changes, it is blocked until the owner re-approves | Must |
| P3-POL-09 | High-risk agents must have certain policy types before approval (links to controls, P2-CTL-05) | Should |
| P3-POL-10 | Policy compile and push to the decision service within 30 seconds of saving | Must |

### 8.3 Python SDK and integrations

| ID | Requirement | Priority |
| --- | --- | --- |
| P3-SDK-01 | `allowed_tools(agent, user)` returns approved tools for that agent role | Must |
| P3-SDK-02 | `check(agent, user, tool, params)` returns decision, reason, policy id, decision id | Must |
| P3-SDK-03 | `wrap(mcp_session)` checks every `call_tool` automatically | Must |
| P3-SDK-04 | `@protect` decorator for Python tool functions and MCP server tools | Must |
| P3-SDK-05 | Hooks for LangChain, LangGraph, OpenAI Agents SDK, Semantic Kernel / Microsoft Agent Framework | Should |
| P3-SDK-06 | Local policy cache with short TTL; fail-closed by default, fail-open configurable per agent | Must |
| P3-SDK-07 | Async and sync clients; retries; circuit breaker | Must |
| P3-SDK-08 | Sends decision outcome and timing back for the decision log | Must |

### 8.4 Human approval at runtime

| ID | Requirement | Priority |
| --- | --- | --- |
| P3-HIL-01 | "Ask human" creates an approval task with agent, user, tool, parameters and reason | Must |
| P3-HIL-02 | Approver = agent's sponsor or a named group; act from portal, email or Teams | Must |
| P3-HIL-03 | SDK waits (configurable timeout) or returns pending so the agent can tell the user | Must |
| P3-HIL-04 | Timeout action configurable (block by default) | Must |

### 8.5 Decision log and violations (basic)

| ID | Requirement | Priority |
| --- | --- | --- |
| P3-LOG-01 | Every check stored: time, agent, user, tool, redacted parameters, matched policy, decision, latency | Must |
| P3-LOG-02 | Violations list per agent and per policy; filter and search | Must |
| P3-LOG-03 | Repeated violations raise an alert to the owner and security admin | Should |

### 8.6 PolicyPilot – policy chat assistant

PolicyPilot is a chat panel in the portal where a user picks an agent or tool with `@`, describes a rule in plain language, and gets a ready policy with worked examples to approve. Nothing is saved until an authorised person approves it. (Name is a working title; alternatives: Rulesmith, Catalyst Assist, Warden.)

**How it works**

1. User opens PolicyPilot and types `@` plus a few letters; a list of matching agents (and with `#`, tools) from the inventory appears; they pick one, e.g. `@Gmail Summary Agent`.
2. They describe the rule: *"Users with the Reader role cannot read mail. Only Operators can read mail."*
3. PolicyPilot loads the agent's tools, their parameters and the organisation's user roles (from Entra groups), and drafts the policy with Azure OpenAI.
4. If anything is unclear, it asks before drafting, e.g. *"What about users who are neither Reader nor Operator, such as Admins: block or allow?"*
5. It shows the draft in three forms: a plain-language summary, the policy form fields, and the policy JSON.
6. It shows worked examples, i.e. test calls run through the simulator (P3-POL-06):

| Example | User role | Tool call | Result |
| --- | --- | --- | --- |
| "Summarise today's mail" | Operator | read\_mail(folder="inbox") | Allow |
| "Summarise today's mail" | Reader | read\_mail(folder="inbox") | Block – "Only Operators can read mail" |
| "Show unread count" | Reader | list\_mail(unread=true) | Block (list\_mail also reads mail) |
| "Summarise today's mail" | Admin | read\_mail(folder="inbox") | Block (default; change if Admins should be allowed) |

7. User can refine in chat ("also allow Admins"); the draft and examples update.
8. User submits; it goes to approval (security admin, or the agent's sponsor for low-risk agents). After approval it is saved as a new policy version in **monitor** mode, with a one-click switch to **enforce**.

| ID | Requirement | Priority |
| --- | --- | --- |
| P3-PPL-01 | Chat panel available on every page and on agent and tool detail pages (agent pre-selected) | Must |
| P3-PPL-02 | `@` picker for agents and `#` picker for tools, searching the inventory by name and keywords; only Approved objects the user may manage | Must |
| P3-PPL-03 | Grounding: send the selected agent's tools, parameter schemas, agent role, user roles/groups and existing policies to the model; never business data | Must |
| P3-PPL-04 | Ask clarifying questions when roles, tools or the default case are ambiguous | Must |
| P3-PPL-05 | Draft shown as summary + form + JSON; validated against tool schemas (P3-POL-04) and checked for conflicts with existing policies (P3-POL-05) | Must |
| P3-PPL-06 | At least 3 auto-generated examples (allow, block, edge case) run through the simulator, shown with results | Must |
| P3-PPL-07 | Refine by chat; each turn shows what changed in the draft | Must |
| P3-PPL-08 | Submit for approval; approver sees the conversation, draft, examples and conflicts; approve / reject / edit | Must |
| P3-PPL-09 | Approved policy saved as a new version in monitor mode; switch to enforce from the chat or policy page | Must |
| P3-PPL-10 | Policies for tools: `#send_email` "never send outside our domain" applies to every agent that uses that tool | Must |
| P3-PPL-11 | Explain existing policy: "what can @Gmail Summary Agent do?" returns allowed tools, rules and examples | Should |
| P3-PPL-12 | Edit existing policy through chat ("also allow Admins") creating a new version | Should |
| P3-PPL-13 | Every chat, draft and approval stored with model and prompt version for audit | Must |
| P3-PPL-14 | PolicyPilot's own access follows portal roles: owners can draft, only security admin / approvers can approve | Must |

**Acceptance criteria**

- The Gmail Summary Agent example produces the policy and the four examples above, and nothing is enforced before approval.
- A request naming a tool or role that does not exist is answered with a question, not a policy.
- A draft that conflicts with an existing policy shows the conflict before submission.

**Phase 3 acceptance criteria**

- A blocked tool is not returned by `allowed_tools` and `check` returns block for it.
- `check` p95 latency under 50 ms from the same Azure region.
- Kill switch takes effect for all SDK clients within 30 seconds.
- A changed MCP tool schema is quarantined until re-approved.

## 9. Phase 4 – Observe, cost and report

Phase 4 adds the operating view: what agents actually do, what they cost, and audit-ready reporting, plus the gateway and advanced runtime controls. Exit gate: a pilot customer runs monthly governance and cost reviews entirely from DG Catalyst.

### 9.1 LLM observability

| ID | Requirement | Priority |
| --- | --- | --- |
| P4-OBS-01 | Ingest traces via OpenTelemetry (SDK auto-instrumentation and OTLP endpoint) | Must |
| P4-OBS-02 | Trace view per run: user message, LLM calls, tool calls, policy decisions, final answer, timings | Must |
| P4-OBS-03 | Metrics per agent: runs, errors, latency (p50/p95), tool-call counts, block rate | Must |
| P4-OBS-04 | Prompt and response capture with PII redaction; capture on/off per agent | Must |
| P4-OBS-05 | Import Azure AI Foundry evaluation scores (groundedness, relevance) onto the agent page | Should |
| P4-OBS-06 | Behaviour drift alerts: sudden change in tools used, error rate, or block rate | Should |

### 9.2 Token and cost monitoring

| ID | Requirement | Priority |
| --- | --- | --- |
| P4-CST-01 | Tokens in/out per call from traces and from Azure OpenAI usage | Must |
| P4-CST-02 | Price table per model deployment; cost calculated per call | Must |
| P4-CST-03 | Cost and token dashboards by agent, application, business unit, model, day/month | Must |
| P4-CST-04 | Chargeback export by business unit | Should |
| P4-CST-05 | Cost per successful outcome (e.g. per resolved ticket) when the owner defines the outcome event | Could |

### 9.3 Budgets

| ID | Requirement | Priority |
| --- | --- | --- |
| P4-BGT-01 | Budgets per agent, team or model: monthly token or currency limit | Must |
| P4-BGT-02 | Alerts at 50%, 80%, 100% to owner and FinOps manager | Must |
| P4-BGT-03 | Action at limit: alert only, require approval, or block (enforced by SDK / gateway) | Must |
| P4-BGT-04 | Spike detection: day's spend far above the agent's normal | Should |

### 9.4 Audit log

| ID | Requirement | Priority |
| --- | --- | --- |
| P4-AUD-01 | Audit log UI: every portal change (from P1-ADM-07) and every runtime decision, searchable by actor, object, date | Must |
| P4-AUD-02 | Tamper-evident storage (append-only table, hash chain); retention configurable (default 7 years) | Must |
| P4-AUD-03 | Export to CSV / JSON; SIEM export to Microsoft Sentinel or Splunk | Should |

### 9.5 Regular reports

| ID | Requirement | Priority |
| --- | --- | --- |
| P4-RPT-01 | Report templates: AI inventory, risk posture, approvals and overdue reviews, policy violations, incidents, cost and usage | Must |
| P4-RPT-02 | Scheduled reports (weekly / monthly) emailed as PDF to chosen roles | Must |
| P4-RPT-03 | Executive dashboard: one page with inventory, risk, violations, cost trends | Must |
| P4-RPT-04 | Agent dossier: one-click PDF with everything about one agent (metadata, lineage, risk history, approvals, evidence, policies, incidents, cost) | Must |
| P4-RPT-05 | PolicyPilot answers questions over the portal data (section 10) | Should |

### 9.6 Gateway and advanced runtime controls

| ID | Requirement | Priority |
| --- | --- | --- |
| P4-GW-01 | MCP gateway: agents connect to DG Catalyst, which checks policy and forwards to the real MCP server | Should |
| P4-GW-02 | LLM gateway in front of Azure OpenAI: model access, token limits and budgets enforced without the SDK | Should |
| P4-GW-03 | Input/output guardrails: PII detection and redaction, prompt-injection detection, secrets detection (integrate Azure AI Content Safety) | Should |
| P4-GW-04 | Sequence rules: block a step based on earlier steps in the same run (e.g. read sensitive data then email outside) | Could |
| P4-GW-05 | Extra connectors: Copilot Studio, AWS Bedrock, Google Vertex, Databricks | Could |

**Phase 4 acceptance criteria**

- Cost per agent per month matches Azure OpenAI billing within 5%.
- An agent over its budget with action "block" receives block on its next check.
- A monthly governance report is delivered automatically to the governance lead.
- An auditor can export every decision for one agent over a date range.

## 10. AI features inside DG Catalyst (Azure OpenAI)

Five built-in AI agents, all running in the FastAPI agent service on Azure OpenAI. Each one suggests; a human always confirms before anything is saved, and DG Catalyst governs its own agents with its own policies.

| Feature | Phase | What it does | Input → output |
| --- | --- | --- | --- |
| Metadata enricher | 1 | Writes a plain-language description and purpose for discovered agents and tools that have none; suggests action type (read / write / delete / send / payment) for each tool | Tool name, schema, agent instructions → description, action type |
| Use-case impact classifier | 2 | Classifies what the agent decides about (convenience, work output, people's money / jobs / health) for the Impact risk signal, with reasoning | Agent card + description → impact level + explanation |
| Data sensitivity tagger | 2 | Flags columns and fields likely to hold personal, financial or health data when no sensitivity label exists | Column names, sample metadata (no row data) → sensitivity class |
| PolicyPilot – policy chat (section 8.6) | 3 | Turns a sentence into a runtime policy, validated against the tool's schema | "Support agent may refund only below 5,000" → policy JSON for review |
| PolicyPilot – Q&A mode | 4 | Answers questions over portal data, e.g. "which high-risk agents use customer data and have no review in 6 months?" | Question → answer with links to objects |

**Rules for these features**

- Use an Azure OpenAI deployment in the customer's chosen region; no customer data leaves their Azure tenant boundary beyond that deployment.
- Never send raw business data rows to the model, only metadata.
- Every AI suggestion stores the prompt version, model version and the reviewer who accepted it.
- Structured outputs (JSON schema) for anything saved to the database.

## 11. SDK and API specification

The portal, connectors and SDK all use one versioned REST API (`/api/v1`), documented automatically by FastAPI (OpenAPI). The SDK talks only to the policy decision endpoints.

### 11.1 SDK usage

```python
from dgcatalyst import Catalyst

cat = Catalyst(agent_id="support-agent", client_secret="...", region="centralindia")

# Check 1: only give the LLM the tools this agent may use
tools = cat.allowed_tools(user="user@corp.com")

# Check 2: before running a tool the LLM picked
d = cat.check(user="user@corp.com", tool="issue_refund",
              params={"order_id": "ORD-123", "amount": 8000})

if d.decision == "allow":
    result = issue_refund(order_id="ORD-123", amount=8000)
elif d.decision == "ask_human":
    result = cat.wait_for_approval(d.decision_id, timeout=300)
else:
    result = f"Not allowed: {d.reason}"

# MCP: every call_tool is checked automatically
session = cat.wrap(mcp_session, user="user@corp.com")

# Python / MCP server tools
@cat.protect()
def issue_refund(order_id: str, amount: int): ...
```

### 11.2 Main API endpoints

| Area | Method and path | Purpose |
| --- | --- | --- |
| Runtime | POST /api/v1/runtime/allowed-tools | Allowed tools for agent + user |
| Runtime | POST /api/v1/runtime/check | Policy decision for one tool call |
| Runtime | GET /api/v1/runtime/approvals/{decision\_id} | Status of an "ask human" decision |
| Runtime | POST /api/v1/runtime/outcome | Report result and timing of a call |
| Inventory | GET/POST/PATCH /api/v1/agents, /applications, /models, /tools, /mcp-servers, /data-sources | CRUD and search |
| Lineage | GET /api/v1/lineage/{object\_id}; POST/DELETE /api/v1/lineage/edges | Graph and manual edges |
| Connectors | GET/POST /api/v1/connectors; POST /api/v1/connectors/{id}/scan | Setup and scans |
| Risk | GET /api/v1/agents/{id}/risk; POST /api/v1/agents/{id}/risk/recompute | Scores and history |
| Governance | /api/v1/controls, /evidence, /approvals, /exceptions, /incidents, /governance-policies | Phase 2 objects |
| Policies | GET/POST/PUT /api/v1/policies; POST /api/v1/policies/simulate; POST /api/v1/policies/from-text | Runtime policies |
| Agents | POST /api/v1/agents/{id}/suspend | Kill switch |
| Telemetry | POST /api/v1/otel/v1/traces | OTLP trace ingest (Phase 4) |
| Cost | /api/v1/usage, /budgets | Phase 4 |
| Audit | GET /api/v1/audit; GET /api/v1/reports/{type} | Phase 4 |

### 11.3 Check request and response

```json
// POST /api/v1/runtime/check
{"agent_id": "support-agent", "user": "user@corp.com",
 "tool": "issue_refund", "params": {"order_id": "ORD-123", "amount": 8000},
 "run_id": "a1b2", "environment": "prod"}

// response
{"decision": "ask_human", "reason": "Refund above 5,000 needs approval",
 "policy_id": "pol_118", "decision_id": "dec_9f31", "mode": "enforce"}
```

Authentication: agents use client credentials (agent ID + secret or certificate) exchanged for a short-lived token; portal users use Entra ID tokens.

## 12. Non-functional requirements

The runtime check is on the critical path of every customer agent, so it gets the strictest targets; the portal follows normal enterprise SaaS targets.

| Area | Requirement |
| --- | --- |
| Runtime latency | `check` and `allowed_tools` p95 < 50 ms, p99 < 150 ms within the same Azure region |
| Runtime availability | 99.9% for the policy decision service; SDK fail-closed by default with a local cache of last-known policies |
| Portal availability | 99.5% |
| Policy propagation | Saved policy or kill switch live in all SDK clients within 30 s |
| Scale (v1) | 10,000 agents, 100,000 tools, 1,000 checks per second per tenant, 50 million decision records per month |
| Data storage | Azure SQL with decision log partitioned by month; traces older than 90 days moved to cheaper storage |
| Security | Entra ID SSO; RBAC on every endpoint; secrets in Key Vault; TLS 1.2+; encryption at rest; OWASP top-10 testing before each release |
| Privacy | Tool parameters and prompts redacted for PII before storage by default; raw capture opt-in per agent |
| Data residency | Deployable in a chosen Azure region (e.g. Central India); Azure OpenAI deployment in the same region |
| Multi-tenancy | Tenant isolation enforced in every query; option for a dedicated deployment for large customers |
| Audit | Every portal change and runtime decision recorded; append-only |
| Accessibility | WCAG 2.1 AA for the React portal |
| Observability of DG Catalyst itself | Application Insights for API, workers and decision service |

## 13. Success metrics

| Metric | Target | Phase |
| --- | --- | --- |
| Share of agents in connected sources found by discovery | 100% | 1 |
| Agents with an owner and sponsor | > 95% within 30 days of connecting | 1 |
| Agents with a risk tier | 100% | 2 |
| Median time from registration to approval decision | < 5 working days | 2 |
| High-risk agents overdue for review | 0 | 2 |
| Production agents calling the SDK on every tool call | > 80% of Medium and High agents | 3 |
| Policy check p95 latency | < 50 ms | 3 |
| Unreviewed tool schema changes reaching production | 0 | 3 |
| Cost reported vs Azure billing | within 5% | 4 |
| Governance reports produced without manual work | 100% of monthly reports | 4 |

## 14. Risks and open questions

**Risks**

| Risk | Mitigation |
| --- | --- |
| Developers skip the SDK, so runtime policies are not enforced | Make SDK use a control for Medium/High agents; flag agents with traces but no checks; gateway in Phase 4 |
| Policy check slows agents down | In-memory compiled policies, Redis cache, SDK local cache, same-region deployment |
| Connector APIs for Foundry and Fabric change | Connector framework with versioned adapters; contract tests run daily |
| Automatic risk scores wrong | Show the reason for every score; owner confirms; reviewer can adjust with reason |
| Decision log grows very large in Azure SQL | Monthly partitions, retention rules, move old traces to cheaper storage |
| Microsoft Agent 365 adds overlapping features | Stay platform-neutral; read Entra Agent IDs instead of competing on identity |

**Open questions**

- Single-tenant SaaS, multi-tenant SaaS, or deployable inside the customer's Azure subscription for v1?
- Which Azure OpenAI model and region for the built-in AI features?
- Should Phase 3 support TypeScript/.NET SDKs, or Python only?
- Who is the pilot customer, and which of their agents are in scope for Phase 1?
- Pricing basis: per agent, per check volume, or per seat?
