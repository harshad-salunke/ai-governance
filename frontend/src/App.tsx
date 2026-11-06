import { Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './layout/AppShell';
import { useStore } from './data/store';
import { Skeleton } from './components/ui';
import { LoginPage } from './pages/Login';
import { NotFound } from './pages/NotFound';
import { lazyPage } from './components/ErrorBoundary';

// Route-level code splitting keeps the first load small.
const Overview = lazyPage(() => import('./pages/Overview'));
const Catalog = lazyPage(() => import('./pages/catalog/Catalog'));
const AssetPage = lazyPage(() => import('./pages/catalog/AssetPage'));
const RegisterAgent = lazyPage(() => import('./pages/catalog/RegisterAgent'));
const Connectors = lazyPage(() => import('./pages/Connectors'));
const Discovery = lazyPage(() => import('./pages/Discovery'));
const Ownership = lazyPage(() => import('./pages/Ownership'));
const Governance = lazyPage(() => import('./pages/govern/Governance'));
const Risk = lazyPage(() => import('./pages/govern/Risk'));
const Controls = lazyPage(() => import('./pages/govern/Controls'));
const Approvals = lazyPage(() => import('./pages/govern/Approvals'));
const GovernancePolicies = lazyPage(() => import('./pages/govern/GovernancePolicies'));
const Reviews = lazyPage(() => import('./pages/govern/Reviews'));
const Incidents = lazyPage(() => import('./pages/govern/Incidents'));
const RuntimePolicies = lazyPage(() => import('./pages/enforce/RuntimePolicies'));
const PolicyEditor = lazyPage(() => import('./pages/enforce/PolicyEditor'));
const AgentRoles = lazyPage(() => import('./pages/enforce/AgentRoles'));
const Simulator = lazyPage(() => import('./pages/enforce/Simulator'));
const Decisions = lazyPage(() => import('./pages/enforce/Decisions'));
const HumanApprovals = lazyPage(() => import('./pages/enforce/HumanApprovals'));
const Sdk = lazyPage(() => import('./pages/enforce/Sdk'));
const Traces = lazyPage(() => import('./pages/observe/Traces'));
const TraceDetail = lazyPage(() => import('./pages/observe/TraceDetail'));
const Cost = lazyPage(() => import('./pages/observe/Cost'));
const Audit = lazyPage(() => import('./pages/observe/Audit'));
const Reports = lazyPage(() => import('./pages/observe/Reports'));
const Users = lazyPage(() => import('./pages/admin/Users'));
const ApiKeys = lazyPage(() => import('./pages/admin/ApiKeys'));
const Settings = lazyPage(() => import('./pages/admin/Settings'));

function PageFallback() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}

const S = ({ children }: { children: ReactNode }) => <Suspense fallback={<PageFallback />}>{children}</Suspense>;

export function App() {
  const signedIn = useStore((s) => s.session.signedIn);
  if (!signedIn) return <LoginPage />;

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<S><Overview /></S>} />
        <Route path="catalog" element={<S><Catalog /></S>} />
        <Route path="catalog/register" element={<S><RegisterAgent /></S>} />
        <Route path="catalog/:kind/:id" element={<S><AssetPage /></S>} />
        <Route path="inventory/*" element={<LegacyInventoryRedirect />} />
        <Route path="connectors" element={<S><Connectors /></S>} />
        <Route path="discovery" element={<S><Discovery /></S>} />
        <Route path="ownership" element={<S><Ownership /></S>} />
        <Route path="governance" element={<S><Governance /></S>} />
        <Route path="risk" element={<S><Risk /></S>} />
        <Route path="controls" element={<S><Controls /></S>} />
        <Route path="approvals" element={<S><Approvals /></S>} />
        <Route path="governance-policies" element={<S><GovernancePolicies /></S>} />
        <Route path="reviews" element={<S><Reviews /></S>} />
        <Route path="incidents" element={<S><Incidents /></S>} />
        <Route path="runtime/policies" element={<S><RuntimePolicies /></S>} />
        <Route path="runtime/policies/:id" element={<S><PolicyEditor /></S>} />
        <Route path="runtime/roles" element={<S><AgentRoles /></S>} />
        <Route path="runtime/simulator" element={<S><Simulator /></S>} />
        <Route path="runtime/decisions" element={<S><Decisions /></S>} />
        <Route path="runtime/human-approvals" element={<S><HumanApprovals /></S>} />
        <Route path="runtime/sdk" element={<S><Sdk /></S>} />
        <Route path="observe/traces" element={<S><Traces /></S>} />
        <Route path="observe/traces/:id" element={<S><TraceDetail /></S>} />
        <Route path="observe/cost" element={<S><Cost /></S>} />
        <Route path="observe/audit" element={<S><Audit /></S>} />
        <Route path="observe/reports" element={<S><Reports /></S>} />
        <Route path="admin" element={<Navigate to="/admin/users" replace />} />
        <Route path="admin/users" element={<S><Users /></S>} />
        <Route path="admin/keys" element={<S><ApiKeys /></S>} />
        <Route path="admin/settings" element={<S><Settings /></S>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

/** Keeps old /inventory links working after the move to /catalog. */
function LegacyInventoryRedirect() {
  const { pathname, search } = useLocation();
  const to = pathname.replace(/^\/inventory\/agents\//, '/catalog/agent/').replace(/^\/inventory/, '/catalog');
  return <Navigate to={to + search} replace />;
}
