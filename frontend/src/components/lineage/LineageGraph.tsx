import { memo, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Background, Controls, Handle, MarkerType, Position, ReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AlertTriangle, Download, ExternalLink, Maximize2, Minimize2, Waypoints, X } from 'lucide-react';
import { useStore, type State } from '../../data/store';
import { buildCatalog, assetHref, KIND_ORDER, type CatalogAsset } from '../../lib/catalog';
import { useLookup } from '../../lib/lookup';
import { useTheme } from '../../lib/theme';
import { cn, downloadFile, toCsv } from '../../lib/format';
import { Badge, Button, Checkbox, DataTable, FilterSelect, Segmented, Select } from '../ui';
import { AssetIcon, LifecycleBadge, TierBadge, kindMeta } from '../domain';
import type { ObjectKind } from '../../data/types';

// ---------------------------------------------------------------- graph model
interface FlowEdge {
  id: string;
  from: string; // provider (upstream)
  to: string; // consumer (downstream)
  manual: boolean;
}

/**
 * Lineage edges are stored as relationships (agent "calls" tool, app "contains"
 * agent). For display we orient every edge in the direction data and capability
 * flow: data → tool → agent → application, model → agent, MCP server → tool.
 */
export function flowEdges(s: Pick<State, 'lineage'>): FlowEdge[] {
  const seen = new Set<string>();
  const out: FlowEdge[] = [];
  s.lineage.forEach((e) => {
    const [from, to] = e.relation === 'hosts' ? [e.from, e.to] : [e.to, e.from];
    const key = `${from}>${to}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ id: e.id, from, to, manual: e.source === 'manual' });
  });
  return out;
}

/** Breadth-first walk from the focus asset; negative levels are upstream, positive downstream. */
export function walk(edges: FlowEdge[], focus: string, up: number, down: number) {
  const level = new Map<string, number>([[focus, 0]]);
  let frontier = [focus];
  for (let d = 1; d <= up && frontier.length; d++) {
    const next: string[] = [];
    edges.forEach((e) => {
      if (frontier.includes(e.to) && !level.has(e.from)) {
        level.set(e.from, -d);
        next.push(e.from);
      }
    });
    frontier = next;
  }
  frontier = [focus];
  for (let d = 1; d <= down && frontier.length; d++) {
    const next: string[] = [];
    edges.forEach((e) => {
      if (frontier.includes(e.from) && !level.has(e.to)) {
        level.set(e.to, d);
        next.push(e.to);
      }
    });
    frontier = next;
  }
  // Longest-path layering, so chains like data → tool → agent keep every edge
  // pointing left to right instead of collapsing two hops into one column.
  const ids = [...level.keys()];
  for (let i = 0; i < ids.length; i++) {
    let moved = false;
    edges.forEach((e) => {
      const lf = level.get(e.from);
      const lt = level.get(e.to);
      if (lf === undefined || lt === undefined) return;
      if (lf >= 0 && lt > 0 && lt <= lf) {
        level.set(e.to, lf + 1);
        moved = true;
      }
      if (lt <= 0 && lf < 0 && lf >= lt) {
        level.set(e.from, lt - 1);
        moved = true;
      }
    });
    if (!moved) break;
  }
  return level;
}

// ---------------------------------------------------------------- node
interface NodeData extends Record<string, unknown> {
  asset: CatalogAsset;
  focus: boolean;
  selected: boolean;
  dim: boolean;
  hiddenUp: number;
  hiddenDown: number;
  warn?: string;
  onExpand: (dir: 'up' | 'down') => void;
}

const NODE_W = 252;
const NODE_H = 58;
const COL_GAP = 120;
const ROW_GAP = 18;

const AssetNode = memo(function AssetNode({ data }: NodeProps<Node<NodeData>>) {
  const a = data.asset;
  return (
    <div
      className={cn(
        'relative flex items-center gap-2.5 rounded border bg-surface px-2.5 transition-opacity',
        data.focus ? 'border-2 border-primary bg-primary/[0.06]' : data.selected ? 'border-primary shadow-pop' : 'border-border-strong shadow-card',
        data.dim && 'opacity-30',
      )}
      style={{ width: NODE_W, height: NODE_H }}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !min-w-0 !border-0 !bg-transparent" />
      <AssetIcon kind={a.kind} />
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-[13px] font-semibold leading-4 text-fg', a.kind === 'tool' && 'font-mono text-[12.5px]')} title={a.name}>{a.name}</p>
        <p className="mt-0.5 truncate text-xs leading-4 text-muted">{kindMeta[a.kind].label} · {a.sourceType}</p>
      </div>
      {data.warn && (
        <span title={data.warn} className="text-danger">
          <AlertTriangle className="h-4 w-4" />
        </span>
      )}
      {data.hiddenUp > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); data.onExpand('up'); }}
          className="nodrag absolute -left-3 top-1/2 flex h-6 min-w-6 -translate-y-1/2 items-center justify-center rounded-full border border-border-strong bg-surface px-1 text-[11px] font-semibold text-primary shadow-card hover:bg-surface-2"
          title={`Show ${data.hiddenUp} more upstream`}
          aria-label={`Show ${data.hiddenUp} more upstream`}
        >
          +{data.hiddenUp}
        </button>
      )}
      {data.hiddenDown > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); data.onExpand('down'); }}
          className="nodrag absolute -right-3 top-1/2 flex h-6 min-w-6 -translate-y-1/2 items-center justify-center rounded-full border border-border-strong bg-surface px-1 text-[11px] font-semibold text-primary shadow-card hover:bg-surface-2"
          title={`Show ${data.hiddenDown} more downstream`}
          aria-label={`Show ${data.hiddenDown} more downstream`}
        >
          +{data.hiddenDown}
        </button>
      )}
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !min-w-0 !border-0 !bg-transparent" />
    </div>
  );
});
const nodeTypes = { asset: AssetNode };

// ---------------------------------------------------------------- component
export function LineageGraph({ focusId, height = 560 }: { focusId: string; height?: number }) {
  const s = useStore((x) => x);
  const L = useLookup();
  const navigate = useNavigate();
  const { resolved } = useTheme();
  const [up, setUp] = useState(2);
  const [down, setDown] = useState(2);
  const [trace, setTrace] = useState(false);
  const [view, setView] = useState<'graph' | 'list'>('graph');
  const [selected, setSelected] = useState<string | null>(null);
  const [full, setFull] = useState(false);

  const catalog = useMemo(() => new Map(buildCatalog(s).map((a) => [a.id, a])), [s]);
  const edges = useMemo(() => flowEdges(s), [s]);
  const levels = useMemo(() => walk(edges, focusId, up, down), [edges, focusId, up, down]);

  const warnFor = (id: string) => {
    const a = catalog.get(id);
    if (!a) return undefined;
    if (a.status === 'Quarantined') return 'Quarantined: schema changed since approval';
    if (a.status === 'Not approved') return 'Not approved for use';
    if (a.status === 'Unknown') return 'Unknown MCP server';
    if (a.status === 'Unmanaged') return 'No owner';
    return undefined;
  };

  const graph = useMemo(() => {
    // Order each column by the average position of its neighbours nearer the focus.
    const byLevel = new Map<number, string[]>();
    levels.forEach((lv, id) => byLevel.set(lv, [...(byLevel.get(lv) ?? []), id]));
    const pos = new Map<string, number>([[focusId, 0]]);
    const order = (lv: number, toward: number) => {
      const ids = byLevel.get(lv) ?? [];
      const score = (id: string) => {
        const ns = edges.filter((e) => (e.from === id && levels.get(e.to) === toward) || (e.to === id && levels.get(e.from) === toward)).map((e) => pos.get(e.from === id ? e.to : e.from) ?? 0);
        return ns.length ? ns.reduce((x, y) => x + y, 0) / ns.length : 0;
      };
      ids.sort((a, b) => score(a) - score(b) || KIND_ORDER.indexOf(catalog.get(a)!.kind) - KIND_ORDER.indexOf(catalog.get(b)!.kind) || catalog.get(a)!.name.localeCompare(catalog.get(b)!.name));
      ids.forEach((id, i) => pos.set(id, i - (ids.length - 1) / 2));
    };
    for (let lv = -1; byLevel.has(lv); lv--) order(lv, lv + 1);
    for (let lv = 1; byLevel.has(lv); lv++) order(lv, lv - 1);

    const shown = new Set(levels.keys());
    const visibleEdges = edges.filter((e) => shown.has(e.from) && shown.has(e.to) && levels.get(e.from)! < levels.get(e.to)!);

    // Sensitive-data trace: everything downstream of personal, financial or health data.
    const tainted = new Set<string>();
    if (trace) {
      s.dataSources.filter((d) => ['Personal', 'Financial', 'Health'].includes(d.sensitivity) && shown.has(d.id)).forEach((d) => tainted.add(d.id));
      let grew = true;
      while (grew) {
        grew = false;
        visibleEdges.forEach((e) => {
          if (tainted.has(e.from) && !tainted.has(e.to)) {
            tainted.add(e.to);
            grew = true;
          }
        });
      }
    }
    const linked = selected ? new Set(visibleEdges.filter((e) => e.from === selected || e.to === selected).flatMap((e) => [e.from, e.to])) : null;

    const nodes: Node<NodeData>[] = [...levels.entries()].map(([id, lv]) => ({
      id,
      type: 'asset',
      position: { x: lv * (NODE_W + COL_GAP), y: (pos.get(id) ?? 0) * (NODE_H + ROW_GAP) },
      data: {
        asset: catalog.get(id)!,
        focus: id === focusId,
        selected: id === selected,
        dim: !!linked && !linked.has(id),
        // Only the outermost column can have neighbours beyond the chosen depth.
        hiddenUp: lv < 0 || id === focusId ? edges.filter((e) => e.to === id && !shown.has(e.from)).length : 0,
        hiddenDown: lv > 0 || id === focusId ? edges.filter((e) => e.from === id && !shown.has(e.to)).length : 0,
        warn: warnFor(id),
        onExpand: (dir) => (dir === 'up' ? setUp((u) => u + 1) : setDown((d) => d + 1)),
      },
      draggable: true,
    }));

    const rfEdges: Edge[] = visibleEdges.map((e) => {
      const hot = trace && tainted.has(e.from);
      const lit = !!selected && (e.from === selected || e.to === selected);
      const color = hot ? 'rgb(var(--danger))' : lit ? 'rgb(var(--primary))' : 'rgb(var(--border-strong))';
      return {
        id: e.id,
        source: e.from,
        target: e.to,
        style: { stroke: color, strokeWidth: hot || lit ? 2 : 1.5, strokeDasharray: e.manual ? '5 4' : undefined, opacity: linked && !lit ? 0.25 : 1 },
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color },
      };
    });
    const upCount = [...levels.values()].filter((v) => v < 0).length;
    const downCount = [...levels.values()].filter((v) => v > 0).length;
    return { nodes, edges: rfEdges, upCount, downCount, taintedCount: [...tainted].filter((id) => catalog.get(id)?.kind === 'agent' || catalog.get(id)?.kind === 'application').length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levels, edges, catalog, selected, trace, focusId, up, down, s.dataSources]);

  const sel = selected ? catalog.get(selected) : null;
  const fitKey = `${focusId}-${up}-${down}`;
  const depthOpts = [1, 2, 3, 4, 9];
  const focus = catalog.get(focusId);

  if (!focus) return null;

  return (
    <div className={cn('flex flex-col overflow-hidden bg-surface', full ? 'fixed inset-0 z-[60]' : 'rounded-lg shadow-card')}>
      {/* Command bar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-3 py-2">
        <Segmented size="sm" value={view} onChange={setView} options={[{ value: 'graph', label: 'Lineage graph' }, { value: 'list', label: 'Impact analysis' }]} ariaLabel="Lineage view" />
        {view === 'graph' && (
          <>
            <label className="flex items-center gap-2 text-sm">
              Upstream
              <Select value={String(up)} onChange={(e) => setUp(Number(e.target.value))} className="w-24" aria-label="Upstream depth">
                {depthOpts.map((d) => <option key={d} value={d}>{d === 9 ? 'All' : `${d} hop${d > 1 ? 's' : ''}`}</option>)}
              </Select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              Downstream
              <Select value={String(down)} onChange={(e) => setDown(Number(e.target.value))} className="w-24" aria-label="Downstream depth">
                {depthOpts.map((d) => <option key={d} value={d}>{d === 9 ? 'All' : `${d} hop${d > 1 ? 's' : ''}`}</option>)}
              </Select>
            </label>
            <Checkbox checked={trace} onChange={setTrace} label={<span className="text-sm">Trace sensitive data</span>} />
          </>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="ghost" icon={full ? Minimize2 : Maximize2} onClick={() => setFull(!full)}>{full ? 'Exit full screen' : 'Full screen'}</Button>
        </div>
      </div>

      {view === 'graph' ? (
        <div className="relative" style={{ height: full ? undefined : height, flex: full ? 1 : undefined }}>
          <div className="pointer-events-none absolute left-3 top-3 z-10 rounded bg-surface/95 px-2.5 py-1 text-xs text-muted shadow-card">
            <span className="font-semibold text-fg">{graph.upCount}</span> upstream · <span className="font-semibold text-fg">{graph.downCount}</span> downstream · data flows left to right
          </div>
          {trace && (
            <div className={cn('absolute left-3 top-11 z-10 rounded border bg-surface px-2.5 py-1 text-xs shadow-card', graph.taintedCount ? 'border-danger/30 text-danger' : 'border-border text-muted')}>
              {graph.taintedCount
                ? `Personal, financial or health data reaches ${graph.taintedCount} agent${graph.taintedCount === 1 ? '' : 's'} or application${graph.taintedCount === 1 ? '' : 's'} in this view`
                : 'No personal, financial or health data flows through this view'}
            </div>
          )}
          <ReactFlow
            key={fitKey}
            nodes={graph.nodes}
            edges={graph.edges}
            nodeTypes={nodeTypes}
            colorMode={resolved}
            fitView
            fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
            minZoom={0.2}
            maxZoom={1.6}
            nodesConnectable={false}
            onNodeClick={(_, n) => setSelected(n.id === selected ? null : n.id)}
            onNodeDoubleClick={(_, n) => n.id !== focusId && navigate(assetHref(catalog.get(n.id)!.kind, n.id, 'lineage'))}
            onPaneClick={() => setSelected(null)}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={20} size={1} color="rgb(var(--border))" />
            <Controls showInteractive={false} position="bottom-left" />
          </ReactFlow>

          {sel && (
            <aside className="absolute bottom-3 right-3 top-3 z-20 flex w-80 max-w-[calc(100%-1.5rem)] animate-slide-in-right flex-col rounded-lg bg-surface shadow-overlay">
              <div className="flex items-start gap-3 border-b border-border p-4">
                <AssetIcon kind={sel.kind} size="md" />
                <div className="min-w-0 flex-1">
                  <p className={cn('break-words font-semibold', sel.kind === 'tool' && 'font-mono')}>{sel.name}</p>
                  <p className="text-xs text-muted">{kindMeta[sel.kind].label} · {sel.sourceType}</p>
                </div>
                <button onClick={() => setSelected(null)} className="rounded p-1 text-subtle hover:bg-surface-2" aria-label="Close details"><X className="h-4 w-4" /></button>
              </div>
              <dl className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
                <div><dt className="text-xs text-subtle">Qualified name</dt><dd className="break-all font-mono text-xs">{sel.qualifiedName}</dd></div>
                <div><dt className="text-xs text-subtle">Description</dt><dd className="text-sm">{sel.description}</dd></div>
                <div><dt className="text-xs text-subtle">Owner</dt><dd>{sel.owner ? L.userName(sel.owner) : <span className="italic text-subtle">Not assigned</span>}</dd></div>
                <div><dt className="text-xs text-subtle">Collection</dt><dd>{L.buName(sel.collection)}</dd></div>
                {(sel.tier || sel.lifecycle || sel.status) && (
                  <div className="flex flex-wrap gap-1.5">
                    {sel.tier && <TierBadge tier={sel.tier} />}
                    {sel.lifecycle && <LifecycleBadge state={sel.lifecycle} />}
                    {sel.status && <Badge tone={sel.status === 'Approved' ? 'success' : 'danger'}>{sel.status}</Badge>}
                  </div>
                )}
                {sel.classifications.length > 0 && (
                  <div>
                    <dt className="mb-1 text-xs text-subtle">Classifications</dt>
                    <dd className="flex flex-wrap gap-1">{sel.classifications.map((c) => <Badge key={c}>{c}</Badge>)}</dd>
                  </div>
                )}
                <div><dt className="text-xs text-subtle">Relationship to {focus.name}</dt><dd>{(levels.get(sel.id) ?? 0) === 0 ? 'This asset' : `${(levels.get(sel.id) ?? 0) < 0 ? 'Upstream' : 'Downstream'}, ${Math.abs(levels.get(sel.id) ?? 0)} hop${Math.abs(levels.get(sel.id) ?? 0) > 1 ? 's' : ''} away`}</dd></div>
              </dl>
              <div className="flex flex-wrap gap-2 border-t border-border p-3">
                <Button size="sm" variant="primary" icon={ExternalLink} onClick={() => navigate(assetHref(sel.kind, sel.id))}>Open asset</Button>
                {sel.id !== focusId && <Button size="sm" icon={Waypoints} onClick={() => { setSelected(null); navigate(assetHref(sel.kind, sel.id, 'lineage')); }}>Centre lineage here</Button>}
              </div>
            </aside>
          )}

          <div className="pointer-events-none absolute bottom-3 right-3 z-10 hidden items-center gap-4 rounded bg-surface/95 px-3 py-1.5 text-xs text-muted shadow-card md:flex" style={{ right: sel ? 'calc(20rem + 1.5rem)' : undefined }}>
            <span className="flex items-center gap-1.5"><span className="h-px w-5 bg-border-strong" /> Discovered</span>
            <span className="flex items-center gap-1.5"><span className="w-5 border-t border-dashed border-border-strong" /> Added manually</span>
            {trace && <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 bg-danger" /> Sensitive data flow</span>}
            <span>Double-click a node to re-centre</span>
          </div>
        </div>
      ) : (
        <ImpactList focusId={focusId} catalog={catalog} edges={edges} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- impact analysis list
function ImpactList({ focusId, catalog, edges }: { focusId: string; catalog: Map<string, CatalogAsset>; edges: FlowEdge[] }) {
  const L = useLookup();
  const [dir, setDir] = useState('all');
  const [kind, setKind] = useState('all');
  const [hops, setHops] = useState('all');
  const levels = useMemo(() => walk(edges, focusId, 9, 9), [edges, focusId]);
  const rows = [...levels.entries()]
    .filter(([id]) => id !== focusId)
    .map(([id, lv]) => ({ ...catalog.get(id)!, lv }))
    .filter((r) => (dir === 'all' || (dir === 'up' ? r.lv < 0 : r.lv > 0)) && (kind === 'all' || r.kind === kind) && (hops === 'all' || (hops === '3' ? Math.abs(r.lv) >= 3 : Math.abs(r.lv) === Number(hops))));
  const exportCsv = () =>
    downloadFile(`impact-${focusId}.csv`, toCsv(rows.map((r) => ({ asset: r.name, type: kindMeta[r.kind].label, direction: r.lv < 0 ? 'Upstream' : 'Downstream', hops: Math.abs(r.lv), owner: L.userName(r.owner), collection: L.buName(r.collection), qualified_name: r.qualifiedName }))), 'text/csv');

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <FilterSelect label="Direction" value={dir} onChange={setDir} options={[{ value: 'up', label: 'Upstream' }, { value: 'down', label: 'Downstream' }]} />
        <FilterSelect label="Type" value={kind} onChange={setKind} options={KIND_ORDER.map((k) => ({ value: k, label: kindMeta[k as ObjectKind].plural }))} />
        <FilterSelect label="Degree" value={hops} onChange={setHops} options={[{ value: '1', label: '1 hop' }, { value: '2', label: '2 hops' }, { value: '3', label: '3+ hops' }]} />
        <span className="text-sm text-muted">{rows.length} dependent assets</span>
        <Button size="sm" variant="ghost" icon={Download} className="ml-auto" onClick={exportCsv}>Export CSV</Button>
      </div>
      <DataTable
        rows={rows}
        pageSize={15}
        initialSort={{ key: 'hops', dir: 'asc' }}
        columns={[
          { key: 'name', header: 'Asset', sort: (r) => r.name, cell: (r) => <span className="flex items-center gap-2.5"><AssetIcon kind={r.kind} size="sm" /><Link to={assetHref(r.kind, r.id)} className={cn('text-primary hover:underline', r.kind === 'tool' && 'font-mono text-[13px]')}>{r.name}</Link></span> },
          { key: 'type', header: 'Type', sort: (r) => r.kind, cell: (r) => kindMeta[r.kind].label },
          { key: 'dir', header: 'Direction', sort: (r) => Math.sign(r.lv), cell: (r) => (r.lv < 0 ? 'Upstream' : 'Downstream') },
          { key: 'hops', header: 'Degree', sort: (r) => Math.abs(r.lv), align: 'right', cell: (r) => Math.abs(r.lv) },
          { key: 'owner', header: 'Owner', hideBelow: 'md', cell: (r) => (r.owner ? L.userName(r.owner) : <span className="italic text-subtle">Not assigned</span>) },
          { key: 'status', header: 'Status', hideBelow: 'lg', cell: (r) => (r.tier ? <TierBadge tier={r.tier} /> : r.status ? <Badge tone={r.status === 'Approved' ? 'success' : 'danger'}>{r.status}</Badge> : <span className="text-subtle">—</span>) },
          { key: 'col', header: 'Collection', hideBelow: 'xl', cell: (r) => L.buName(r.collection) },
        ]}
      />
    </div>
  );
}
