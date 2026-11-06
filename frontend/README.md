# DG Catalyst — portal (frontend)

React 18 + TypeScript + Vite + Tailwind. Every screen from the PRD runs against a typed, deterministic mock dataset, so the portal is fully clickable before the FastAPI backend exists.

## Run

```bash
npm install
npm run dev          # http://localhost:5173 (use --port to change)
npm run build        # typecheck + production build to dist/
```

Sign in with any demo persona on the login screen (mock Entra ID SSO). Switch the active role from the avatar menu to see RBAC change what each persona can do.

## Structure

```
src/
  data/
    types.ts          PRD §4 core objects — mirror these in the Pydantic schemas
    mock/             deterministic seed data (org, inventory, governance, runtime, observe)
    risk.ts           risk signals, tiers, override rules, "why" facts
    policyEngine.ts   runtime check evaluation (kill switch → quarantine → role → policies)
    store.ts          client store + actions; every mutation writes a hash-chained audit event
  lib/                formatting, theme (light/dark/system), RBAC matrix, toasts, lookups
  components/
    ui/               design-system primitives (Button, Card, DataTable, Tabs, Modal, Drawer…)
    domain.tsx        TierBadge, RiskFingerprint, DecisionBadge, PlatformMark…
    charts.tsx        shared chart tooltip, legend, segment bar
  layout/             AppShell, Sidebar, Topbar, CommandPalette (Ctrl+K), PolicyPilot (Ctrl+.)
  pages/              one file per screen: catalog (search, asset page, lineage), govern, enforce, observe, admin
  components/lineage/ per-asset lineage graph and impact analysis (Purview-style, left-to-right data flow)
```

## Design system

- Tokens are CSS variables in `src/index.css` (RGB channels, so Tailwind alpha works: `bg-danger/10`). Light is the default; `[data-theme="dark"]` overrides. Theme preference is applied before first paint.
- Visual language follows Fluent 2 (as used by Microsoft Purview and Azure): Segoe UI, neutral greys, brand blue, 4px control radius, dark suite header, command bars under page titles. Monospace (Cascadia Mono / Consolas) only for code-like content.
- Chart series use a CVD-validated categorical order (`useChartColors().series`); never reorder or cycle it.
- The AI catalog (`lib/catalog.ts`) flattens every asset type into one searchable record with qualified name, source, collection, classifications and tags. Every asset opens the same asset page (`pages/catalog/AssetPage.tsx`) with type-specific tabs and a per-asset Lineage tab.

## Connecting the backend

Pages read through `useStore` and write through `actions` in `src/data/store.ts`. To move to the real API, replace each action body with a call to `/api/v1/...` (PRD §11) and hydrate state from the matching GET endpoints — page components don't need to change.
