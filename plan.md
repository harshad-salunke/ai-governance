# DG Catalyst – Build Plan

Source of truth: [DG Catalyst – Product Requirements Document.md](./DG%20Catalyst%20–%20Product%20Requirements%20Document.md)

DG Catalyst is an AI governance portal that **discovers** every AI agent, model, tool and MCP server, **scores risk**, **governs approval and lifecycle**, and **enforces policies at runtime** through a Python SDK.

---

## 1. Repository layout

```
AI Governance/
├── DG Catalyst – Product Requirements Document.md
├── plan.md            ← this file (what we will build, in what order)
├── session.md         ← running log of each working session
├── frontend/          ← React + TypeScript portal (Vite)
└── backend/           ← FastAPI services, workers, SDK (later)
```

## 2. Build strategy

1. **Frontend first, on dummy metadata.** Build every screen of the portal against a typed mock-data layer (`frontend/src/data/`). The mock layer mirrors the PRD's core objects (section 4) so swapping it for real API calls later is a one-file change per module.
2. **Backend second.** FastAPI + SQLAlchemy + Azure SQL implementing `/api/v1` (PRD section 11). The frontend's `services/api.ts` switches from mock to HTTP.
3. **Runtime + SDK third.** Policy decision service, Redis cache, `dgcatalyst` Python SDK.
4. **Observability, cost, audit, reports last** (PRD Phase 4).

## 3. Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | React 18 + TypeScript, Vite, **Tailwind CSS** (all styling), React Router, React Flow (`@xyflow/react`) for lineage, Recharts for dashboards, lucide-react icons |
| Backend API | Python FastAPI (async), Pydantic, SQLAlchemy |
| Policy decision service | FastAPI, policies compiled in memory, Redis cache |
| Workers | Celery / Azure Functions + Azure Service Bus |
| AI services | Azure OpenAI (PolicyPilot, metadata enricher, impact classifier, sensitivity tagger) |
| Data | Azure SQL (system of record), Blob Storage (evidence/reports), Redis, Key Vault |
| Identity | Microsoft Entra ID SSO |
| SDK | `dgcatalyst` Python package |

---

## 4. Frontend plan (current focus)

### 4.1 Foundations
- [x] Vite + React + TS + Tailwind scaffold in `frontend/`
- [x] App shell: sidebar grouped by phase (Discover / Govern / Enforce / Observe / Admin), top bar with global search, business-unit scope selector, role switcher, notifications
- [x] Mock SSO login screen (Entra ID style)
- [x] Role switcher simulating the 8 portal roles (RBAC hints on screens)
- [x] Shared UI kit: Card, Badge, Table, Tabs, Stat tile, Drawer, Modal, Empty state, filters
- [x] Typed mock data for every core object (PRD §4)

### 4.2 Phase 1 – Connect and discover
- [x] Overview dashboard (inventory counts, platform split, owner coverage, unmanaged, risk tiers, cost trend)
- [x] AI Inventory: tabs for Applications, Agents, Models, Tools, MCP servers, Data sources — search, filters, managed/unmanaged, change flags (new / changed / removed)
- [x] Agent detail page: agent card, lineage, risk, controls, approvals, policies, decisions, incidents, cost, version history
- [x] Generic detail page for other objects (application, model, tool, MCP server, data source)
- [x] Manual registration form (agent card fields)
- [x] Connectors: list + health, setup wizard (type → credentials → test → scope), scan now
- [x] Ownership & lifecycle: unmanaged/claim queue, orphans, transfer history, lifecycle states
- [x] Lineage graph (React Flow): app → agent → model → tools → MCP → data; click node → detail; impact analysis; risky-path highlight; BU filter
- [x] Shadow AI hints and duplicate detection list

### 4.3 Phase 2 – Govern
- [x] Risk: assessments list, per-agent signal breakdown with "why", risk rules config (weights, thresholds, overrides)
- [x] Controls library + checklist templates per tier + evidence status
- [x] Approvals: queue (approve / reject / request changes), workflow definitions per tier, SLA timers
- [x] Governance policies (metadata rules) + violations
- [x] Reviews (periodic re-approval), Exceptions, Incidents
- [x] Governance dashboard widgets

### 4.4 Phase 3 – Enforce at runtime
- [x] Agent roles (allowed tools/models/data classes)
- [x] Runtime policies: list, form editor, JSON view, monitor/enforce toggle, versioning, quarantined tools
- [x] Policy simulator (sample call → matched policy + decision)
- [x] Decision log + violations
- [x] Human approval tasks (ask-human queue)
- [x] Kill switch on agent page
- [x] PolicyPilot chat drawer (global, `@agent` / `#tool` picker, scripted draft → summary + form + JSON + examples)
- [x] SDK & API keys page with code snippets

### 4.5 Phase 4 – Observe, cost and report
- [x] Observability: traces list + trace detail waterfall, per-agent metrics
- [x] Cost & tokens dashboards, budgets with alert thresholds
- [x] Audit log (searchable, hash-chain column)
- [x] Reports: templates, schedules, agent dossier

### 4.6 Administration
- [x] Users & role assignments, business units, API keys, notification settings, custom metadata fields

### 4.7 Frontend next steps (after dummy-data build)
- [ ] Replace mock layer with `services/api.ts` calling FastAPI
- [ ] Real Entra ID login via MSAL
- [ ] Enforce RBAC from token claims
- [ ] Accessibility pass (WCAG 2.1 AA)
- [ ] Unit tests (Vitest + Testing Library)

---

## 5. Backend plan (next)

### 5.1 Foundations
- [ ] `backend/` FastAPI project: `app/api/v1`, `app/models` (SQLAlchemy), `app/schemas` (Pydantic), `app/services`, `app/workers`
- [ ] Settings via env; Azure SQL connection (SQLite for local dev)
- [ ] Alembic migrations for all PRD §4 objects (with `tenant_id`, `business_unit_id`, audit columns)
- [ ] Entra ID token validation + RBAC dependency per endpoint
- [ ] Audit-event middleware (every create/update/delete)
- [ ] Seed script reusing the frontend's dummy data

### 5.2 Phase 1 APIs
- [ ] Inventory CRUD: `/agents`, `/applications`, `/models`, `/tools`, `/mcp-servers`, `/data-sources`
- [ ] Lineage: `/lineage/{id}`, `/lineage/edges`
- [ ] Connectors: CRUD, `/scan`; Foundry, Fabric, MCP adapters behind a connector framework
- [ ] Change detection (schema hash) + duplicate detection
- [ ] Ownership: claim, transfer, orphan job

### 5.3 Phase 2 APIs
- [ ] Risk engine (signals, weights, thresholds, overrides) + `/risk/recompute`
- [ ] Controls, evidence (Blob upload), approvals + workflow engine, exceptions, incidents, governance policies
- [ ] Periodic review scheduler

### 5.4 Phase 3
- [ ] Runtime policy model, compiler, conflict detection, simulator
- [ ] Policy decision service (`/runtime/check`, `/runtime/allowed-tools`, approvals, outcome) with Redis
- [ ] Kill switch, tool quarantine
- [ ] PolicyPilot agent service (Azure OpenAI, structured outputs)
- [ ] `dgcatalyst` Python SDK: `check`, `allowed_tools`, `wrap`, `@protect`, cache, fail-closed

### 5.5 Phase 4
- [ ] OTLP trace ingest, usage records, price table, budgets
- [ ] Audit log API (hash chain), report generation (PDF), scheduled reports

---

## 6. Open questions (from PRD §14)
- Tenancy model for v1 (multi-tenant SaaS vs customer subscription)?
- Azure OpenAI model + region for built-in AI features?
- Python-only SDK for Phase 3?
- Pilot customer and in-scope agents?
- Pricing basis?
