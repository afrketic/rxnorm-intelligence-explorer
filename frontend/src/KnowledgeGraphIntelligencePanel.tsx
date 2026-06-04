import React, { useEffect, useMemo, useState } from "react";

type GraphNode = {
  node_id: string;
  label?: string;
  node_type?: string;
  node_type_display?: string;
  source?: string;
  source_system?: string;
  rxcui?: string;
  class_id?: string;
  class_name?: string;
  description?: string;
  intelligence_domain?: string;
  score?: string | number | null;
  score_band?: string;
  benchmark_tier?: string;
  is_high_value_node?: number;
  occurrence_count?: number;
};

type GraphEdge = {
  edge_id: string;
  source_node_id: string;
  target_node_id: string;
  edge_type?: string;
  relationship_label?: string;
  source_rxcui?: string;
  source_system?: string;
  edge_weight?: number;
  evidence_count?: number;
  is_primary_edge?: number;
};

type GraphPayload = {
  center_rxcui: string;
  center_node_id?: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
};

type GraphMetrics = {
  rxcui: string;
  node_count: number;
  edge_count: number;
  classification_node_count: number;
  relationship_node_count: number;
  intelligence_domain_count: number;
  classification_depth: number;
  graph_connectivity_score: number;
  graph_builder_version?: string;
  graph_build_timestamp?: string;
};

type Props = {
  rxcui: string;
  apiBaseUrl?: string;
};

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";

const NODE_TYPE_GROUPS = [
  "DRUG",
  "ATC1",
  "ATC2",
  "ATC3",
  "ATC4",
  "MOA",
  "EPC",
  "DISEASE",
  "PE",
  "CHEM",
  "VA",
  "DISPOS",
  "STRUCT",
  "RELATIONSHIP",
];

const NODE_TYPE_LABELS: Record<string, string> = {
  DRUG: "Drug",
  ATC1: "ATC 1",
  ATC2: "ATC 2",
  ATC3: "ATC 3",
  ATC4: "ATC 4",
  ATC5: "ATC 5",
  MOA: "MOA",
  EPC: "EPC",
  DISEASE: "Disease",
  PE: "Pharmacologic Effect",
  CHEM: "Chemical",
  VA: "VA",
  DISPOS: "Disposition",
  STRUCT: "Structure",
  RELATIONSHIP: "RxNorm Relationships",
};

const NODE_TYPE_STYLES: Record<string, string> = {
  DRUG: "bg-slate-950 text-white border-slate-700",
  ATC1: "bg-blue-50 text-blue-900 border-blue-200",
  ATC2: "bg-blue-50 text-blue-900 border-blue-200",
  ATC3: "bg-blue-50 text-blue-900 border-blue-200",
  ATC4: "bg-blue-50 text-blue-900 border-blue-200",
  ATC5: "bg-blue-50 text-blue-900 border-blue-200",
  MOA: "bg-purple-50 text-purple-900 border-purple-200",
  EPC: "bg-indigo-50 text-indigo-900 border-indigo-200",
  DISEASE: "bg-rose-50 text-rose-900 border-rose-200",
  PE: "bg-amber-50 text-amber-900 border-amber-200",
  CHEM: "bg-emerald-50 text-emerald-900 border-emerald-200",
  VA: "bg-cyan-50 text-cyan-900 border-cyan-200",
  DISPOS: "bg-orange-50 text-orange-900 border-orange-200",
  STRUCT: "bg-teal-50 text-teal-900 border-teal-200",
  RELATIONSHIP: "bg-slate-50 text-slate-800 border-slate-200",
};

function normalizeType(value?: string | null): string {
  return (value || "UNKNOWN").toUpperCase();
}

function formatLabel(value?: string | null, fallback = "Unknown"): string {
  if (!value || value.trim() === "") return fallback;
  return value.length > 56 ? `${value.slice(0, 56)}…` : value;
}

function safeNumber(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function getNodeStyle(nodeType?: string): string {
  return NODE_TYPE_STYLES[normalizeType(nodeType)] || "bg-white text-slate-800 border-slate-200";
}

function getNodeTypeLabel(nodeType?: string): string {
  const normalized = normalizeType(nodeType);
  return NODE_TYPE_LABELS[normalized] || normalized;
}

function buildDomainSummary(nodes: GraphNode[]) {
  const counts = new Map<string, number>();

  nodes.forEach((node) => {
    const type = normalizeType(node.node_type);
    counts.set(type, (counts.get(type) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([type, count]) => ({ type, count, label: getNodeTypeLabel(type) }))
    .sort((a, b) => b.count - a.count);
}

export default function KnowledgeGraphIntelligencePanel({
  rxcui,
  apiBaseUrl = DEFAULT_API_BASE_URL,
}: Props) {
  const [graph, setGraph] = useState<GraphPayload | null>(null);
  const [metrics, setMetrics] = useState<GraphMetrics | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [enabledTypes, setEnabledTypes] = useState<Set<string>>(new Set(NODE_TYPE_GROUPS));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiBase = apiBaseUrl.replace(/\/$/, "");

  useEffect(() => {
    if (!rxcui) return;

    let active = true;

    async function fetchGraph() {
      setLoading(true);
      setError(null);

      try {
        const [graphResponse, metricsResponse] = await Promise.all([
          fetch(`${apiBase}/graph/subgraph/${encodeURIComponent(rxcui)}?edge_limit=250`),
          fetch(`${apiBase}/graph/metrics/${encodeURIComponent(rxcui)}`),
        ]);

        if (!graphResponse.ok) {
          throw new Error(`Graph request failed: ${graphResponse.status}`);
        }

        if (!metricsResponse.ok) {
          throw new Error(`Graph metrics request failed: ${metricsResponse.status}`);
        }

        const graphJson = (await graphResponse.json()) as GraphPayload;
        const metricsJson = (await metricsResponse.json()) as GraphMetrics;

        if (!active) return;

        setGraph(graphJson);
        setMetrics(metricsJson);
        setSelectedNode(graphJson.nodes?.find((node) => normalizeType(node.node_type) === "DRUG") || graphJson.nodes?.[0] || null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load graph intelligence.");
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchGraph();

    return () => {
      active = false;
    };
  }, [apiBase, rxcui]);

  const filteredGraph = useMemo(() => {
    const nodes = graph?.nodes || [];
    const edges = graph?.edges || [];

    const filteredNodes = nodes.filter((node) => {
      const type = normalizeType(node.node_type);
      return type === "DRUG" || enabledTypes.has(type);
    });

    const nodeIds = new Set(filteredNodes.map((node) => node.node_id));
    const filteredEdges = edges.filter(
      (edge) => nodeIds.has(edge.source_node_id) && nodeIds.has(edge.target_node_id)
    );

    return {
      nodes: filteredNodes,
      edges: filteredEdges,
    };
  }, [graph, enabledTypes]);

  const domainSummary = useMemo(() => buildDomainSummary(filteredGraph.nodes), [filteredGraph.nodes]);

  const groupedNodes = useMemo(() => {
    const centerNode = filteredGraph.nodes.find((node) => normalizeType(node.node_type) === "DRUG");
    const otherNodes = filteredGraph.nodes.filter((node) => normalizeType(node.node_type) !== "DRUG");

    const classificationNodes = otherNodes.filter((node) =>
      ["ATC1", "ATC2", "ATC3", "ATC4", "ATC5", "MOA", "EPC", "DISEASE", "PE", "CHEM", "VA", "DISPOS", "STRUCT"].includes(
        normalizeType(node.node_type)
      )
    );

    const relationshipNodes = otherNodes.filter((node) => normalizeType(node.node_type) === "RELATIONSHIP");

    return {
      centerNode,
      classificationNodes,
      relationshipNodes,
    };
  }, [filteredGraph.nodes]);

  function toggleType(type: string) {
    setEnabledTypes((current) => {
      const next = new Set(current);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  if (!rxcui) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">
            Sprint 14B Knowledge Graph
          </p>
          <h2 className="mt-1 text-2xl font-bold text-slate-950">
            Medication Intelligence Network
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Graph-powered view of therapeutic hierarchy, clinical semantics, pharmacologic evidence,
            RxNorm relationships, and explainability signals.
          </p>
        </div>

        {metrics && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Connectivity
            </p>
            <p className="text-3xl font-bold text-slate-950">
              {safeNumber(metrics.graph_connectivity_score).toFixed(0)}%
            </p>
          </div>
        )}
      </div>

      {loading && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
          Loading medication graph intelligence…
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          {error}
        </div>
      )}

      {!loading && !error && graph && (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
            <MetricCard label="Nodes" value={metrics?.node_count ?? filteredGraph.nodes.length} />
            <MetricCard label="Edges" value={metrics?.edge_count ?? filteredGraph.edges.length} />
            <MetricCard label="Class Nodes" value={metrics?.classification_node_count ?? groupedNodes.classificationNodes.length} />
            <MetricCard label="RxNorm Nodes" value={metrics?.relationship_node_count ?? groupedNodes.relationshipNodes.length} />
            <MetricCard label="Domains" value={metrics?.intelligence_domain_count ?? domainSummary.length} />
            <MetricCard label="ATC Depth" value={`${metrics?.classification_depth ?? 0}/4`} />
            <MetricCard label="Builder" value={metrics?.graph_builder_version || "14A-v3"} small />
          </div>

          <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-slate-900">Graph Filters</h3>
              <button
                type="button"
                onClick={() => setEnabledTypes(new Set(NODE_TYPE_GROUPS))}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Reset filters
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {NODE_TYPE_GROUPS.filter((type) => type !== "DRUG").map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleType(type)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    enabledTypes.has(type)
                      ? getNodeStyle(type)
                      : "border-slate-200 bg-white text-slate-400"
                  }`}
                >
                  {getNodeTypeLabel(type)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Network Map</h3>
                <p className="text-xs text-slate-500">
                  Showing {filteredGraph.nodes.length} nodes / {filteredGraph.edges.length} edges
                </p>
              </div>

              <div className="relative min-h-[520px] overflow-hidden rounded-xl border border-slate-200 bg-white p-5">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.07),transparent_55%)]" />

                <div className="relative z-10 flex min-h-[470px] items-center justify-center">
                  {groupedNodes.centerNode && (
                    <button
                      type="button"
                      onClick={() => setSelectedNode(groupedNodes.centerNode || null)}
                      className={`absolute left-1/2 top-1/2 z-20 min-w-[170px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border px-5 py-4 text-center shadow-lg transition hover:scale-105 ${getNodeStyle(
                        groupedNodes.centerNode.node_type
                      )}`}
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
                        {getNodeTypeLabel(groupedNodes.centerNode.node_type)}
                      </p>
                      <p className="mt-1 text-lg font-bold">
                        {formatLabel(groupedNodes.centerNode.label, `RxCUI ${rxcui}`)}
                      </p>
                      <p className="mt-1 text-xs opacity-80">
                        {groupedNodes.centerNode.benchmark_tier || groupedNodes.centerNode.score_band || "Medication"}
                      </p>
                    </button>
                  )}

                  <NodeRing
                    nodes={groupedNodes.classificationNodes.slice(0, 24)}
                    radius={190}
                    centerClassName="left-1/2 top-1/2"
                    onSelect={setSelectedNode}
                  />

                  <NodeRing
                    nodes={groupedNodes.relationshipNodes.slice(0, 32)}
                    radius={245}
                    centerClassName="left-1/2 top-1/2"
                    onSelect={setSelectedNode}
                    compact
                  />
                </div>
              </div>
            </div>

            <aside className="space-y-5">
              <NodeDetailPanel node={selectedNode} />

              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="text-sm font-bold text-slate-900">Domain Summary</h3>
                <div className="mt-4 space-y-2">
                  {domainSummary.map((item) => (
                    <div key={item.type} className="flex items-center justify-between gap-3">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getNodeStyle(item.type)}`}>
                        {item.label}
                      </span>
                      <span className="text-sm font-bold text-slate-900">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white">
                <h3 className="text-sm font-bold">Graph Interpretation</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  This medication network connects identity, ATC hierarchy, clinical mappings,
                  pharmacologic evidence, and RxNorm relationship concepts. A high connectivity score
                  indicates that the medication has enough semantic structure to support explainability,
                  claims analytics, and downstream AI-readiness workflows.
                </p>
              </div>
            </aside>
          </div>
        </>
      )}
    </section>
  );
}

function MetricCard({
  label,
  value,
  small = false,
}: {
  label: string;
  value: string | number;
  small?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 font-bold text-slate-950 ${small ? "text-sm" : "text-2xl"}`}>{value}</p>
    </div>
  );
}

function NodeRing({
  nodes,
  radius,
  centerClassName,
  onSelect,
  compact = false,
}: {
  nodes: GraphNode[];
  radius: number;
  centerClassName: string;
  onSelect: (node: GraphNode) => void;
  compact?: boolean;
}) {
  if (!nodes.length) return null;

  return (
    <>
      {nodes.map((node, index) => {
        const angle = (index / nodes.length) * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;

        return (
          <button
            key={node.node_id}
            type="button"
            onClick={() => onSelect(node)}
            className={`absolute ${centerClassName} z-10 -translate-x-1/2 -translate-y-1/2 rounded-xl border shadow-sm transition hover:z-30 hover:scale-105 ${getNodeStyle(
              node.node_type
            )} ${compact ? "max-w-[105px] px-2 py-2 text-[10px]" : "max-w-[145px] px-3 py-2 text-xs"}`}
            style={{
              transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
            }}
            title={node.label || node.node_id}
          >
            <p className="font-bold">{formatLabel(node.label, node.node_id)}</p>
            <p className="mt-0.5 opacity-70">{getNodeTypeLabel(node.node_type)}</p>
          </button>
        );
      })}
    </>
  );
}

function NodeDetailPanel({ node }: { node: GraphNode | null }) {
  if (!node) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-bold text-slate-900">Node Detail</h3>
        <p className="mt-3 text-sm text-slate-500">Select a node to inspect its metadata.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {getNodeTypeLabel(node.node_type)}
          </p>
          <h3 className="mt-1 text-lg font-bold text-slate-950">{node.label || node.node_id}</h3>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getNodeStyle(node.node_type)}`}>
          {normalizeType(node.node_type)}
        </span>
      </div>

      <div className="mt-4 space-y-3 text-sm">
        <DetailRow label="Node ID" value={node.node_id} />
        <DetailRow label="Domain" value={node.intelligence_domain} />
        <DetailRow label="Class ID" value={node.class_id} />
        <DetailRow label="Class Name" value={node.class_name} />
        <DetailRow label="Source System" value={node.source_system} />
        <DetailRow label="Evidence Count" value={node.occurrence_count?.toString()} />
        <DetailRow label="Benchmark Tier" value={node.benchmark_tier || node.score_band} />
        <DetailRow label="Score" value={node.score?.toString()} />
      </div>

      {node.description && (
        <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">
          {node.description}
        </p>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;

  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 border-b border-slate-100 pb-2 last:border-b-0">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      <span className="break-words text-slate-700">{value}</span>
    </div>
  );
}
