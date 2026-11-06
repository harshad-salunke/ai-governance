import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronLeft, ChevronRight, Download, FolderTree, Plus, Search, Tag, Upload, X } from 'lucide-react';
import { useStore } from '../../data/store';
import { buildCatalog, KIND_ORDER, assetHref, type CatalogAsset } from '../../lib/catalog';
import { useLookup } from '../../lib/lookup';
import { usePermission } from '../../lib/rbac';
import { useToast } from '../../lib/toast';
import { cn, downloadFile, num, relTime, toCsv } from '../../lib/format';
import { Badge, Button, ButtonLink, Card, Checkbox, EmptyState, Select, Tabs } from '../../components/ui';
import { AssetIcon, ChangeBadge, LifecycleBadge, TierBadge, kindMeta } from '../../components/domain';
import { ImportModal } from './ImportModal';
import type { ObjectKind } from '../../data/types';

type Tab = 'search' | 'source' | 'collection';
type FacetKey = 'type' | 'source' | 'collection' | 'tier' | 'lifecycle' | 'classification' | 'owner' | 'status';

const PAGE = 20;
const RISK_RANK: Record<string, number> = { Prohibited: 4, High: 3, Medium: 2, Low: 1, Unscored: 0 };

export default function Catalog() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('view') as Tab) || 'search';
  const setTab = (t: Tab) => setParams(t === 'search' ? {} : { view: t }, { replace: true });
  const { can, reason } = usePermission();
  const [importOpen, setImportOpen] = useState(false);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">AI catalog</h1>
          <p className="mt-1 text-sm text-muted">Every AI application, agent, model, tool, MCP server and data asset discovered by your sources or registered by hand.</p>
        </div>
        <div className="flex gap-2">
          <Button icon={Upload} onClick={() => setImportOpen(true)} disabledReason={can('inventory.register') ? undefined : reason('inventory.register')}>Import</Button>
          {can('inventory.register') ? (
            <ButtonLink to="/catalog/register" variant="primary" icon={Plus}>Register asset</ButtonLink>
          ) : (
            <Button variant="primary" icon={Plus} disabledReason={reason('inventory.register')}>Register asset</Button>
          )}
        </div>
      </div>
      <Tabs value={tab} onChange={setTab} className="mb-4" items={[{ value: 'search', label: 'Search assets' }, { value: 'source', label: 'Browse by source' }, { value: 'collection', label: 'Browse by collection' }]} ariaLabel="Catalog views" />
      {tab === 'search' && <SearchView />}
      {tab === 'source' && <BrowseBySource />}
      {tab === 'collection' && <BrowseByCollection />}
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}

// ---------------------------------------------------------------- search
function SearchView() {
  const s = useStore((x) => x);
  const L = useLookup();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const sort = params.get('sort') ?? 'relevance';
  const page = Number(params.get('page') ?? '0');
  const [draft, setDraft] = useState(q);

  const all = useMemo(() => buildCatalog(s), [s]);
  const scoped = s.session.buScope === 'all' ? all : all.filter((a) => a.collection === s.session.buScope);

  const selected = (k: FacetKey) => (params.get(k) ?? '').split(',').filter(Boolean);
  const update = (mut: (p: URLSearchParams) => void) => {
    const n = new URLSearchParams(params);
    mut(n);
    n.delete('page');
    setParams(n, { replace: true });
  };
  const toggle = (k: FacetKey, v: string) =>
    update((n) => {
      const cur = selected(k);
      const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
      next.length ? n.set(k, next.join(',')) : n.delete(k);
    });

  const facetValue: Record<FacetKey, (a: CatalogAsset) => string[]> = {
    type: (a) => [a.kind],
    source: (a) => [a.sourceType],
    collection: (a) => [a.collection],
    tier: (a) => (a.tier ? [a.tier] : []),
    lifecycle: (a) => (a.lifecycle ? [a.lifecycle] : []),
    classification: (a) => a.classifications,
    owner: (a) => (a.owner ? [a.owner] : ['__none']),
    status: (a) => [...(a.status ? [a.status] : []), ...(a.change ? [a.change === 'new' ? 'New since last scan' : 'Changed since last scan'] : [])],
  };
  const facetKeys = Object.keys(facetValue) as FacetKey[];

  const textMatch = (a: CatalogAsset) => {
    if (!q.trim()) return 1;
    const t = q.trim().toLowerCase();
    const name = a.name.toLowerCase();
    if (name === t) return 10;
    if (name.startsWith(t)) return 6;
    if (name.includes(t)) return 4;
    const hay = `${a.qualifiedName} ${a.description} ${a.tags.join(' ')} ${a.classifications.join(' ')} ${a.sourceType} ${kindMeta[a.kind].label}`.toLowerCase();
    return hay.includes(t) ? 1 : 0;
  };
  const passes = (a: CatalogAsset, except?: FacetKey) =>
    facetKeys.every((k) => {
      if (k === except) return true;
      const sel = selected(k);
      return !sel.length || facetValue[k](a).some((v) => sel.includes(v));
    });

  const textHits = scoped.filter((a) => textMatch(a) > 0);
  const results = textHits
    .filter((a) => passes(a))
    .sort((a, b) =>
      sort === 'name' ? a.name.localeCompare(b.name) : sort === 'updated' ? b.updatedAt.localeCompare(a.updatedAt) : sort === 'risk' ? (RISK_RANK[b.tier ?? ''] ?? -1) - (RISK_RANK[a.tier ?? ''] ?? -1) : textMatch(b) - textMatch(a) || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.name.localeCompare(b.name),
    );
  const pageRows = results.slice(page * PAGE, page * PAGE + PAGE);
  const pages = Math.max(1, Math.ceil(results.length / PAGE));

  // Facet counts exclude the facet's own selection, so options never vanish when chosen.
  const counts = (k: FacetKey) => {
    const m = new Map<string, number>();
    textHits.filter((a) => passes(a, k)).forEach((a) => facetValue[k](a).forEach((v) => m.set(v, (m.get(v) ?? 0) + 1)));
    return m;
  };

  const label = (k: FacetKey, v: string) =>
    k === 'type' ? kindMeta[v as ObjectKind].plural : k === 'collection' ? L.buName(v) : k === 'owner' ? (v === '__none' ? 'No owner' : L.userName(v)) : k === 'tier' ? (v === 'Prohibited' ? v : `${v} risk`) : v;

  const facets: { key: FacetKey; title: string; order?: string[] }[] = [
    { key: 'type', title: 'Asset type', order: KIND_ORDER },
    { key: 'source', title: 'Source type' },
    { key: 'collection', title: 'Collection' },
    { key: 'tier', title: 'Risk tier', order: ['Prohibited', 'High', 'Medium', 'Low'] },
    { key: 'lifecycle', title: 'Lifecycle', order: ['Draft', 'In review', 'Approved', 'Review overdue', 'Suspended', 'Deprecated', 'Retired'] },
    { key: 'classification', title: 'Classification' },
    { key: 'status', title: 'Status' },
    { key: 'owner', title: 'Owner' },
  ];
  const active = facetKeys.flatMap((k) => selected(k).map((v) => ({ k, v })));

  const exportCsv = () => {
    downloadFile('ai-catalog.csv', toCsv(results.map((a) => ({ name: a.name, type: kindMeta[a.kind].label, qualified_name: a.qualifiedName, source: a.sourceType, collection: L.buName(a.collection), owner: L.userName(a.owner), risk: a.tier ?? '', lifecycle: a.lifecycle ?? '', classifications: a.classifications.join('; ') }))), 'text/csv');
    toast({ tone: 'success', title: `Exported ${results.length} assets`, body: 'ai-catalog.csv' });
  };

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          update((n) => (draft.trim() ? n.set('q', draft.trim()) : n.delete('q')));
        }}
        className="mb-4 flex gap-2"
        role="search"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              update((n) => (e.target.value.trim() ? n.set('q', e.target.value.trim()) : n.delete('q')));
            }}
            placeholder="Search by name, qualified name, description, classification or tag"
            aria-label="Search the AI catalog"
            className="input-base h-10 pl-9 text-base"
          />
          {draft && (
            <button type="button" onClick={() => { setDraft(''); update((n) => n.delete('q')); }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-subtle hover:bg-surface-2" aria-label="Clear search">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button type="submit" variant="primary" className="h-10 px-5">Search</Button>
      </form>

      <div className="grid gap-4 lg:grid-cols-[268px_minmax(0,1fr)]">
        {/* Facets */}
        <aside aria-label="Filters" className="self-start lg:sticky lg:top-16">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <span className="text-sm font-semibold">Filters</span>
              {active.length > 0 && (
                <button onClick={() => update((n) => facetKeys.forEach((k) => n.delete(k)))} className="text-sm text-primary hover:underline">
                  Clear all
                </button>
              )}
            </div>
            <div className="max-h-[calc(100vh-12rem)] divide-y divide-border overflow-y-auto">
              {facets.map((f) => (
                <Facet
                  key={f.key}
                  title={f.title}
                  options={[...counts(f.key).entries()]
                    .sort((a, b) => (f.order ? f.order.indexOf(a[0]) - f.order.indexOf(b[0]) : b[1] - a[1] || label(f.key, a[0]).localeCompare(label(f.key, b[0]))))
                    .map(([v, n]) => ({ value: v, label: label(f.key, v), count: n }))}
                  selected={selected(f.key)}
                  onToggle={(v) => toggle(f.key, v)}
                  defaultOpen={['type', 'source', 'tier', 'collection'].includes(f.key) || selected(f.key).length > 0}
                />
              ))}
            </div>
          </Card>
        </aside>

        {/* Results */}
        <section aria-label="Results" className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <p className="text-sm text-muted">
              {results.length ? (
                <>
                  <span className="font-semibold text-fg">{num(page * PAGE + 1)}–{num(Math.min(results.length, (page + 1) * PAGE))}</span> of {num(results.length)} results{q && <> for “<span className="text-fg">{q}</span>”</>}
                </>
              ) : (
                'No results'
              )}
            </p>
            <div className="ml-auto flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-muted">
                Sort by
                <Select value={sort} onChange={(e) => update((n) => (e.target.value === 'relevance' ? n.delete('sort') : n.set('sort', e.target.value)))} className="w-40" aria-label="Sort results">
                  <option value="relevance">Relevance</option>
                  <option value="name">Name (A–Z)</option>
                  <option value="updated">Last modified</option>
                  <option value="risk">Risk (highest first)</option>
                </Select>
              </label>
              <Button size="md" variant="ghost" icon={Download} onClick={exportCsv}>Export</Button>
            </div>
          </div>

          {active.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {active.map(({ k, v }) => (
                <button key={k + v} onClick={() => toggle(k, v)} className="inline-flex h-6 items-center gap-1 rounded border border-border-strong bg-surface px-2 text-xs hover:bg-surface-2">
                  <span className="text-muted">{facets.find((f) => f.key === k)!.title}:</span> {label(k, v)}
                  <X className="h-3 w-3 text-subtle" />
                </button>
              ))}
            </div>
          )}

          <Card>
            {pageRows.length ? (
              <ul className="divide-y divide-border">
                {pageRows.map((a) => (
                  <ResultRow key={a.id} a={a} />
                ))}
              </ul>
            ) : (
              <EmptyState icon={Search} title="No assets match" description="Try a different keyword, or clear some filters." />
            )}
            {pages > 1 && (
              <div className="flex items-center justify-end gap-1 border-t border-border px-3 py-2 text-sm">
                <button disabled={page === 0} onClick={() => setParams((p) => { const n = new URLSearchParams(p); n.set('page', String(page - 1)); return n; })} className="rounded p-1 hover:bg-surface-2 disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
                <span className="tabular px-2 text-muted">Page {page + 1} of {pages}</span>
                <button disabled={page >= pages - 1} onClick={() => setParams((p) => { const n = new URLSearchParams(p); n.set('page', String(page + 1)); return n; })} className="rounded p-1 hover:bg-surface-2 disabled:opacity-40" aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
              </div>
            )}
          </Card>
        </section>
      </div>
    </div>
  );
}

function Facet({ title, options, selected, onToggle, defaultOpen }: { title: string; options: { value: string; label: string; count: number }[]; selected: string[]; onToggle: (v: string) => void; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [more, setMore] = useState(false);
  const shown = more ? options : options.slice(0, 6);
  return (
    <div className="px-4 py-2.5">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between py-0.5 text-left text-sm font-semibold" aria-expanded={open}>
        {title}
        <span className="flex items-center gap-2">
          {selected.length > 0 && <span className="rounded bg-primary/10 px-1.5 text-xs font-semibold text-primary">{selected.length}</span>}
          <ChevronDown className={cn('h-4 w-4 text-subtle transition-transform', !open && '-rotate-90')} />
        </span>
      </button>
      {open && (
        <ul className="mt-1.5 space-y-1">
          {options.length === 0 && <li className="text-xs text-subtle">No values in these results</li>}
          {shown.map((o) => (
            <li key={o.value} className="flex items-center justify-between gap-2">
              <Checkbox checked={selected.includes(o.value)} onChange={() => onToggle(o.value)} label={<span className="text-sm">{o.label}</span>} />
              <span className="tabular shrink-0 text-xs text-subtle">{o.count}</span>
            </li>
          ))}
          {options.length > 6 && (
            <li>
              <button onClick={() => setMore(!more)} className="text-xs text-primary hover:underline">
                {more ? 'Show less' : `Show ${options.length - 6} more`}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function ResultRow({ a }: { a: CatalogAsset }) {
  const L = useLookup();
  return (
    <li className="flex gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2/60">
      <AssetIcon kind={a.kind} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link to={assetHref(a.kind, a.id)} className={cn('text-base font-semibold text-primary hover:underline', a.kind === 'tool' && 'font-mono text-[14px]')}>
            {a.name}
          </Link>
          <ChangeBadge change={a.change} />
        </div>
        <p className="mt-0.5 text-sm text-muted">
          {kindMeta[a.kind].label} <span className="text-border-strong">|</span> {a.sourceType} <span className="text-border-strong">|</span> {L.buName(a.collection)}
        </p>
        <p className="mt-0.5 truncate font-mono text-xs text-subtle" title={a.qualifiedName}>{a.qualifiedName}</p>
        <p className="mt-1.5 line-clamp-2 max-w-4xl text-sm text-fg">{a.description}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {a.tier && <TierBadge tier={a.tier} />}
          {a.lifecycle && <LifecycleBadge state={a.lifecycle} />}
          {a.status && <Badge tone={a.status === 'Approved' ? 'success' : a.status === 'Unmanaged' ? 'warning' : 'danger'}>{a.status}</Badge>}
          {a.classifications.slice(0, 4).map((c) => (
            <Badge key={c} tone="neutral" icon={Tag}>{c}</Badge>
          ))}
          {a.classifications.length > 4 && <span className="text-xs text-subtle">+{a.classifications.length - 4} more</span>}
        </div>
      </div>
      <div className="hidden w-48 shrink-0 text-right text-sm md:block">
        <p className="text-xs text-subtle">Owner</p>
        <p className={a.owner ? 'truncate text-fg' : 'italic text-subtle'}>{a.owner ? L.userName(a.owner) : 'Not assigned'}</p>
        <p className="mt-1.5 text-xs text-subtle">Updated {relTime(a.updatedAt)}</p>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------- browse by source
function BrowseBySource() {
  const s = useStore((x) => x);
  const navigate = useNavigate();
  const all = useMemo(() => buildCatalog(s), [s]);
  const groups = Array.from(new Set(all.map((a) => a.sourceType)))
    .map((src) => ({ src, items: all.filter((a) => a.sourceType === src) }))
    .sort((a, b) => b.items.length - a.items.length);
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {groups.map((g) => (
        <button key={g.src} onClick={() => navigate(`/catalog?source=${encodeURIComponent(g.src)}`)} className="rounded-lg bg-surface p-4 text-left shadow-card transition-shadow hover:shadow-pop">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold">{g.src}</p>
            <span className="tabular text-2xl font-semibold">{g.items.length}</span>
          </div>
          <ul className="mt-3 space-y-1.5">
            {KIND_ORDER.filter((k) => g.items.some((a) => a.kind === k)).map((k) => (
              <li key={k} className="flex items-center gap-2 text-sm">
                <AssetIcon kind={k} size="sm" />
                <span className="flex-1 text-muted">{kindMeta[k].plural}</span>
                <span className="tabular">{g.items.filter((a) => a.kind === k).length}</span>
              </li>
            ))}
          </ul>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- browse by collection
function BrowseByCollection() {
  const s = useStore((x) => x);
  const [open, setOpen] = useState<Set<string>>(new Set(['bu-cs', 'app-care']));
  const all = useMemo(() => buildCatalog(s), [s]);
  const flip = (id: string) => setOpen((o) => { const n = new Set(o); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const Row = ({ depth, id, kind, name, count, hasChildren }: { depth: number; id: string; kind?: ObjectKind; name: string; count?: number; hasChildren?: boolean }) => (
    <div className="flex h-9 items-center gap-2 rounded px-2 hover:bg-surface-2" style={{ paddingLeft: 8 + depth * 22 }}>
      {hasChildren ? (
        <button onClick={() => flip(id)} className="rounded p-0.5 text-subtle hover:bg-surface-3" aria-label={open.has(id) ? 'Collapse' : 'Expand'} aria-expanded={open.has(id)}>
          <ChevronRight className={cn('h-4 w-4 transition-transform', open.has(id) && 'rotate-90')} />
        </button>
      ) : (
        <span className="w-5" />
      )}
      {kind ? <AssetIcon kind={kind} size="sm" /> : <FolderTree className="h-4 w-4 text-warning" />}
      {kind ? (
        <Link to={assetHref(kind, id)} className="truncate text-sm text-primary hover:underline">{name}</Link>
      ) : (
        <Link to={`/catalog?collection=${id}`} className="truncate text-sm font-semibold hover:underline">{name}</Link>
      )}
      {count !== undefined && <span className="tabular ml-auto text-xs text-subtle">{count} assets</span>}
    </div>
  );

  return (
    <Card className="p-2">
      <p className="px-2 pb-2 pt-1 text-sm text-muted">Collections follow your business units. Applications group the agents they contain.</p>
      <div role="tree">
        {s.businessUnits.map((bu) => {
          const apps = s.applications.filter((a) => a.businessUnitId === bu.id);
          const loose = s.agents.filter((a) => a.businessUnitId === bu.id && !a.applicationId);
          const other = all.filter((a) => a.collection === bu.id && a.kind !== 'agent' && a.kind !== 'application');
          return (
            <div key={bu.id} role="treeitem" aria-expanded={open.has(bu.id)}>
              <Row depth={0} id={bu.id} name={bu.name} count={all.filter((a) => a.collection === bu.id).length} hasChildren />
              {open.has(bu.id) && (
                <>
                  {apps.map((app) => (
                    <div key={app.id}>
                      <Row depth={1} id={app.id} kind="application" name={app.name} hasChildren={app.agentIds.length > 0} />
                      {open.has(app.id) && app.agentIds.map((ag) => <Row key={ag} depth={2} id={ag} kind="agent" name={s.agents.find((x) => x.id === ag)!.name} />)}
                    </div>
                  ))}
                  {loose.map((ag) => <Row key={ag.id} depth={1} id={ag.id} kind="agent" name={ag.name} />)}
                  {other.map((o) => <Row key={o.id} depth={1} id={o.id} kind={o.kind} name={o.name} />)}
                </>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
