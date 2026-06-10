import { useEffect, useMemo, useState } from 'react';
import { Info, X } from 'lucide-react';
import { DrugCard } from '../lib/api';
import GraphPanel from './GraphPanel';

type Props = {
  drug: (DrugCard & Record<string, any>) | null;
};

type GraphMetrics = {
  rxcui?: string;
  node_count?: number;
  edge_count?: number;
  classification_node_count?: number;
  relationship_node_count?: number;
  intelligence_domain_count?: number;
  classification_depth?: number;
  graph_connectivity_score?: number;
};

type Driver = {
  key: string;
  label: string;
  value: number;
  score: number;
};

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'http://127.0.0.1:8000';

function toNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function getDrugName(drug: Props['drug']) {
  return (
    drug?.display_name ||
    drug?.rxnorm_name ||
    drug?.drug_name ||
    drug?.name ||
    drug?.drug?.rxnorm_name ||
    drug?.drug?.drug_name ||
    'This medication'
  );
}

function getFallbackMetrics(drug: Props['drug']): GraphMetrics {
  const graph = drug?.graph || drug?.drug?.graph || {};
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];

  const classificationTypes = [
    'ATC1',
    'ATC2',
    'ATC3',
    'ATC4',
    'ATC5',
    'MOA',
    'EPC',
    'DISEASE',
    'PE',
    'CHEM',
    'VA',
    'DISPOS',
    'STRUCT',
  ];

  const classificationNodes = nodes.filter((node: any) =>
    classificationTypes.includes(String(node?.node_type || '').toUpperCase())
  );

  const relationshipNodes = nodes.filter(
    (node: any) => String(node?.node_type || '').toUpperCase() === 'RELATIONSHIP'
  );

  const domains = new Set(
    nodes.map((node: any) => node?.intelligence_domain || node?.node_type).filter(Boolean)
  );

  const atcDepth = ['ATC1', 'ATC2', 'ATC3', 'ATC4'].reduce((max, level, index) => {
    return classificationNodes.some(
      (node: any) => String(node?.node_type || '').toUpperCase() === level
    )
      ? index + 1
      : max;
  }, 0);

  return {
    rxcui: drug?.rxcui,
    node_count: nodes.length,
    edge_count: edges.length,
    classification_node_count: classificationNodes.length,
    relationship_node_count: relationshipNodes.length,
    intelligence_domain_count: domains.size,
    classification_depth: atcDepth,
    graph_connectivity_score:
      toNumber(drug?.graph_connectivity_score) ||
      toNumber(drug?.knowledge_graph_score) ||
      toNumber(drug?.graph_intelligence_score) ||
      0,
  };
}

function getGraphScore(metrics: GraphMetrics) {
  const directScore = toNumber(metrics.graph_connectivity_score);

  if (directScore > 0) {
    return Math.max(0, Math.min(100, Math.round(directScore)));
  }

  const nodeScore = Math.min(24, toNumber(metrics.node_count) * 0.12);
  const edgeScore = Math.min(24, toNumber(metrics.edge_count) * 0.12);
  const classificationScore = Math.min(22, toNumber(metrics.classification_node_count) * 0.45);
  const relationshipScore = Math.min(18, toNumber(metrics.relationship_node_count) * 0.75);
  const domainScore = Math.min(12, toNumber(metrics.intelligence_domain_count) * 1.5);

  return Math.max(
    35,
    Math.min(
      100,
      Math.round(nodeScore + edgeScore + classificationScore + relationshipScore + domainScore)
    )
  );
}

function getGraphTier(score: number) {
  if (score >= 90) return 'Graph Intelligence Ready';
  if (score >= 80) return 'Strong Semantic Graph';
  if (score >= 70) return 'Operational Graph Ready';
  if (score >= 60) return 'Developing Graph Coverage';
  return 'Foundational Graph Coverage';
}

function getStatus(score: number) {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Strong';
  if (score >= 55) return 'Moderate';
  if (score > 0) return 'Developing';
  return 'Limited';
}

function buildDrivers(metrics: GraphMetrics) {
  const drivers: Driver[] = [
    {
      key: 'nodes',
      label: 'Node Coverage',
      value: toNumber(metrics.node_count),
      score: Math.min(100, Math.round(toNumber(metrics.node_count) * 2.25)),
    },
    {
      key: 'edges',
      label: 'Edge Density',
      value: toNumber(metrics.edge_count),
      score: Math.min(100, Math.round(toNumber(metrics.edge_count) * 2.25)),
    },
    {
      key: 'classifications',
      label: 'Classification Nodes',
      value: toNumber(metrics.classification_node_count),
      score: Math.min(100, Math.round(toNumber(metrics.classification_node_count) * 3)),
    },
    {
      key: 'relationships',
      label: 'Relationship Nodes',
      value: toNumber(metrics.relationship_node_count),
      score: Math.min(100, Math.round(toNumber(metrics.relationship_node_count) * 6)),
    },
    {
      key: 'domains',
      label: 'Intelligence Domains',
      value: toNumber(metrics.intelligence_domain_count),
      score: Math.min(100, Math.round(toNumber(metrics.intelligence_domain_count) * 10)),
    },
    {
      key: 'connectivity',
      label: 'Graph Connectivity',
      value: toNumber(metrics.graph_connectivity_score),
      score: Math.min(100, Math.round(toNumber(metrics.graph_connectivity_score))),
    },
  ];

  const sorted = [...drivers].sort((a, b) => b.score - a.score);
  const primary = sorted[0] || drivers[0];
  const secondary = sorted.find((driver) => driver.key !== primary.key) || drivers[1];
  const limiting =
    [...drivers]
      .filter((driver) => driver.key !== primary.key && driver.key !== secondary.key)
      .sort((a, b) => a.score - b.score)[0] || drivers[drivers.length - 1];

  return { primary, secondary, limiting };
}

function getGraphDriverDescription(
  label: string,
  role: 'primary' | 'secondary' | 'limiting'
) {
  const normalized = label.toLowerCase();

  if (normalized.includes('node')) {
    return role === 'limiting'
      ? 'Node coverage is the weakest graph signal, meaning the medication has fewer connected graph entities than stronger graph profiles.'
      : 'Node coverage measures how many medication, classification, clinical, and relationship entities are available in the knowledge graph.';
  }

  if (normalized.includes('edge')) {
    return role === 'limiting'
      ? 'Edge density is the weakest graph signal, meaning more connections between graph entities would improve graph usefulness.'
      : 'Edge density measures the strength of connections between medications, classifications, relationships, and clinical intelligence entities.';
  }

  if (normalized.includes('classification')) {
    return role === 'limiting'
      ? 'Classification nodes are the weakest graph signal, meaning the graph may need more ATC, disease, mechanism, or pharmacologic class enrichment.'
      : 'Classification nodes show how well the medication is connected to structured clinical categories such as ATC, disease, mechanism, and pharmacologic class.';
  }

  if (normalized.includes('relationship')) {
    return role === 'limiting'
      ? 'Relationship nodes are the weakest graph signal, meaning RxNorm relationship evidence may need additional enrichment.'
      : 'Relationship nodes represent RxNorm connections such as ingredients, dose forms, trade names, and related medication concepts.';
  }

  if (normalized.includes('domain')) {
    return role === 'limiting'
      ? 'Intelligence domains are the weakest graph signal, meaning the medication is connected across fewer healthcare intelligence areas.'
      : 'Intelligence domains measure how broadly the medication connects across clinical, RxNorm, classification, graph, disease, and analytics domains.';
  }

  if (normalized.includes('connectivity')) {
    return role === 'limiting'
      ? 'Graph connectivity is the weakest signal, meaning the graph structure may be less connected for semantic search and AI retrieval.'
      : 'Graph connectivity measures how strongly the medication’s graph entities connect into a usable semantic intelligence network.';
  }

  return role === 'limiting'
    ? 'This is the weakest graph signal and shows where additional graph evidence would improve confidence.'
    : 'This graph signal supports semantic search, relationship exploration, AI retrieval, and connected medication intelligence.';
}

function buildExecutiveSummary(name: string, metrics: GraphMetrics, score: number) {
  return `${name} demonstrates ${
    score >= 80 ? 'strong' : score >= 60 ? 'developing' : 'foundational'
  } knowledge graph intelligence through RxNorm relationships, classification nodes, disease connections, ATC hierarchy, and semantic graph structure. The graph contains ${toNumber(
    metrics.node_count
  )} nodes, ${toNumber(metrics.edge_count)} edges, ${toNumber(
    metrics.classification_node_count
  )} classification nodes, ${toNumber(
    metrics.relationship_node_count
  )} relationship nodes, and ${toNumber(
    metrics.intelligence_domain_count
  )} intelligence domains, supporting semantic search, relationship exploration, clinical graph expansion, AI retrieval context, and RxNorm intelligence workflows.`;
}

function DriverCard({
  tone,
  label,
  driver,
}: {
  tone: 'primary' | 'secondary' | 'limiting';
  label: string;
  driver: Driver;
}) {
  const toneClass =
    tone === 'primary'
      ? 'border-cyan-400/30 bg-cyan-500/10 text-cyan-300'
      : tone === 'secondary'
        ? 'border-blue-400/30 bg-blue-500/10 text-blue-300'
        : 'border-amber-400/30 bg-amber-500/10 text-amber-300';

  const labelClass =
    tone === 'primary'
      ? 'text-cyan-300'
      : tone === 'secondary'
        ? 'text-blue-300'
        : 'text-amber-300';

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
      <div className="flex items-start gap-4">
        <span
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border font-black ${toneClass}`}
        >
          {tone === 'primary' ? '✓' : tone === 'secondary' ? '◎' : '!'}
        </span>

        <div>
          <p className={`text-xs font-black uppercase tracking-[0.18em] ${labelClass}`}>
            {label}
          </p>
          <p className="mt-2 text-xl font-black text-white">
            {driver.label} +{Math.round(driver.score)}
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-400">
            {getStatus(driver.score)}
          </p>
        </div>
      </div>
    </div>
  );
}

function DriverGuideCard({
  tone,
  title,
  driver,
  score,
  description,
}: {
  tone: 'primary' | 'secondary' | 'limiting';
  title: string;
  driver: string;
  score: number;
  description: string;
}) {
  const colorClass =
    tone === 'primary'
      ? 'text-cyan-300'
      : tone === 'secondary'
        ? 'text-blue-300'
        : 'text-amber-300';

  const badgeClass =
    tone === 'primary'
      ? 'border-cyan-400/30 bg-cyan-500/15 text-cyan-300'
      : tone === 'secondary'
        ? 'border-blue-400/30 bg-blue-500/15 text-blue-300'
        : 'border-amber-400/30 bg-amber-500/15 text-amber-300';

  return (
    <div className="min-h-[280px] rounded-3xl border border-slate-700/60 bg-gradient-to-br from-slate-900/90 to-slate-950 p-6">
      <div className="flex items-start gap-4">
        <span
          className={`inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full border text-xl font-black ${badgeClass}`}
        >
          {tone === 'primary' ? '✓' : tone === 'secondary' ? '◎' : '!'}
        </span>

        <div>
          <p className={`text-xs font-black uppercase tracking-[0.22em] ${colorClass}`}>
            {title}
          </p>
          <h4 className="mt-2 text-2xl font-black text-white">
            {driver} +{Math.round(score)}
          </h4>
        </div>
      </div>

      <div className="my-6 h-px bg-slate-700/70" />

      <p className="text-sm leading-6 text-slate-300">{description}</p>
    </div>
  );
}

function EvidenceCheck({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/15 text-sm font-black text-emerald-300">
        ✓
      </span>
      <span className="text-base font-semibold text-white">{children}</span>
    </div>
  );
}

function UseCaseItem({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-4 border-b border-slate-800/60 pb-3 last:border-b-0 last:pb-0">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-400/35 bg-cyan-500/15 text-sm font-black text-cyan-200">
        ✓
      </span>
      <span className="text-lg font-semibold text-white">{children}</span>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-3xl border border-cyan-300/15 bg-slate-950/60 p-5 shadow-inner shadow-slate-950/40">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">{label}</p>
      <p className="mt-3 text-3xl font-black text-white">{value}</p>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-400">{detail}</p>
    </div>
  );
}

export default function KnowledgeGraphDashboard({ drug }: Props) {
  const [metrics, setMetrics] = useState<GraphMetrics>(() => getFallbackMetrics(drug));
  const [showDriverInfo, setShowDriverInfo] = useState(false);

  const rxcui = drug?.rxcui;

  useEffect(() => {
    setMetrics(getFallbackMetrics(drug));

    if (!rxcui) return;

    let active = true;

    async function loadMetrics() {
      try {
        const response = await fetch(
          `${API_BASE_URL}/graph/metrics/${encodeURIComponent(String(rxcui))}`
        );

        if (!response.ok) return;

        const payload = (await response.json()) as GraphMetrics;
        if (active) setMetrics(payload);
      } catch {
        if (active) setMetrics(getFallbackMetrics(drug));
      }
    }

    loadMetrics();

    return () => {
      active = false;
    };
  }, [drug, rxcui]);

  const name = getDrugName(drug);
  const score = getGraphScore(metrics);
  const tier = getGraphTier(score);
  const drivers = useMemo(() => buildDrivers(metrics), [metrics]);
  const executiveSummary = buildExecutiveSummary(name, metrics, score);

  if (!drug) return null;

  return (
    <section className="space-y-6 text-white">
      <article className="overflow-hidden rounded-[2rem] border border-cyan-300/25 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.22),_transparent_34%),linear-gradient(135deg,#020617,#07152d_48%,#020617)] p-7 shadow-2xl shadow-slate-950/40">
        <div className="grid gap-8 lg:grid-cols-[24rem_1fr] lg:items-stretch">
          <div className="rounded-[1.75rem] border border-cyan-300/30 bg-cyan-500/10 p-7 text-center shadow-[0_0_24px_rgba(34,211,238,0.14)]">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">
              Knowledge Graph Intelligence Score
            </p>

            <div className="mt-6 flex items-end justify-center gap-2">
              <span className="text-7xl font-black leading-none text-white md:text-8xl">
                {score}
              </span>
              <span className="pb-3 text-3xl font-black text-slate-400">/ 100</span>
            </div>

            <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-blue-500 to-emerald-400"
                style={{ width: `${score}%` }}
              />
            </div>

            <p className="mt-6 rounded-2xl border border-emerald-300/25 bg-emerald-500/10 px-5 py-3 text-lg font-black text-emerald-100">
              {tier}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                  Nodes
                </p>
                <p className="mt-2 text-xl font-black text-white">
                  {toNumber(metrics.node_count)}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                  Edges
                </p>
                <p className="mt-2 text-xl font-black text-cyan-300">
                  {toNumber(metrics.edge_count)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-slate-800 bg-slate-950/70 p-7">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
              Executive Knowledge Graph Summary
            </p>

            <h2 className="mt-4 text-4xl font-black tracking-tight text-white md:text-5xl">
              Knowledge Graph Intelligence
            </h2>

            <p className="mt-5 max-w-6xl text-lg leading-8 text-slate-300 md:text-xl md:leading-9">
              {executiveSummary}
            </p>

            <div className="mt-6 rounded-2xl border border-cyan-500/30 bg-cyan-950/10 px-5 py-4">
              <p className="text-base font-semibold text-slate-200">
                This dashboard explains how the medication connects across RxNorm concepts,
                classifications, relationship categories, clinical domains, and interactive graph
                evidence.
              </p>
            </div>
          </div>
        </div>
      </article>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr_1fr]">
        <article className="rounded-[1.6rem] border border-slate-800 bg-slate-900/80 p-6 shadow-sm shadow-cyan-950/20">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
              Knowledge Graph Drivers
            </p>

            <button
              type="button"
              onClick={() => setShowDriverInfo(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-cyan-400/50 bg-cyan-500/10 text-cyan-300 transition hover:border-cyan-300 hover:bg-cyan-500/20 hover:text-white"
              aria-label="Explain knowledge graph drivers"
              title="Explain knowledge graph drivers"
            >
              <Info className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-6 grid gap-4">
            <DriverCard tone="primary" label="Primary Driver" driver={drivers.primary} />
            <DriverCard tone="secondary" label="Secondary Driver" driver={drivers.secondary} />
            <DriverCard tone="limiting" label="Limiting Factor" driver={drivers.limiting} />
          </div>
        </article>

        <article className="rounded-[1.6rem] border border-slate-800 bg-slate-900/80 p-6 shadow-sm shadow-cyan-950/20">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
            Knowledge Graph Use Cases
          </p>

          <div className="mt-6 space-y-4">
            <UseCaseItem>Semantic search</UseCaseItem>
            <UseCaseItem>Relationship exploration</UseCaseItem>
            <UseCaseItem>Clinical graph expansion</UseCaseItem>
            <UseCaseItem>AI retrieval context</UseCaseItem>
            <UseCaseItem>RxNorm intelligence</UseCaseItem>
          </div>
        </article>

        <article className="rounded-[1.6rem] border border-slate-800 bg-slate-900/80 p-6 shadow-sm shadow-cyan-950/20">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
            Knowledge Graph Evidence
          </p>

          <div className="mt-6 space-y-5">
            <EvidenceCheck>RxNorm relationships present</EvidenceCheck>
            <EvidenceCheck>Classification nodes populated</EvidenceCheck>
            <EvidenceCheck>Disease connections available</EvidenceCheck>
            <EvidenceCheck>ATC connections available</EvidenceCheck>
            <EvidenceCheck>Interactive graph available</EvidenceCheck>
          </div>
        </article>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Nodes" value={toNumber(metrics.node_count)} detail="Graph node coverage" />
        <MetricCard label="Edges" value={toNumber(metrics.edge_count)} detail="Graph relationship density" />
        <MetricCard
          label="Classifications"
          value={toNumber(metrics.classification_node_count)}
          detail="Clinical classification nodes"
        />
        <MetricCard
          label="Relationships"
          value={toNumber(metrics.relationship_node_count)}
          detail="RxNorm relationship nodes"
        />
        <MetricCard
          label="Domains"
          value={toNumber(metrics.intelligence_domain_count)}
          detail="Connected intelligence domains"
        />
      </div>

      <section className="rounded-[2rem] border border-cyan-300/20 bg-slate-950/70 p-6 shadow-[0_0_24px_rgba(14,165,233,0.12)]">
        <h3 className="mt-2 text-2xl font-black text-white">
          Interactive Knowledge Graph:
        </h3>

        <h4 className="mt-2 text-3xl font-black text-white">
          {name}
        </h4>

        <p className="mt-3 text-sm font-semibold leading-6 text-slate-300">
          Interactive relationship network showing classifications,
          clinical domains, disease mappings, RxNorm relationships,
          and semantic intelligence connections.
        </p>

        <div className="mt-5">
          <GraphPanel drug={drug} />
        </div>
      </section>

      {showDriverInfo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 px-6 py-8 backdrop-blur-md">
          <div className="relative w-full max-w-5xl rounded-[2rem] border border-cyan-500/40 bg-slate-950 p-7 text-white shadow-2xl shadow-cyan-950/40 md:p-9">
            <button
              type="button"
              onClick={() => setShowDriverInfo(false)}
              className="absolute right-5 top-5 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-300 transition hover:border-cyan-400 hover:text-white"
              aria-label="Close knowledge graph driver explanation"
            >
              <X className="h-5 w-5" />
            </button>

            <p className="text-xs font-black uppercase tracking-[0.32em] text-cyan-300">
              Knowledge Graph Driver Guide
            </p>

            <h3 className="mt-4 text-4xl font-black tracking-tight text-white">
              What these knowledge graph drivers mean
            </h3>

            <div className="mt-8 grid gap-5 md:grid-cols-3">
              <DriverGuideCard
                tone="primary"
                title="Primary Driver"
                driver={drivers.primary.label}
                score={drivers.primary.score}
                description={getGraphDriverDescription(drivers.primary.label, 'primary')}
              />

              <DriverGuideCard
                tone="secondary"
                title="Secondary Driver"
                driver={drivers.secondary.label}
                score={drivers.secondary.score}
                description={getGraphDriverDescription(drivers.secondary.label, 'secondary')}
              />

              <DriverGuideCard
                tone="limiting"
                title="Limiting Factor"
                driver={drivers.limiting.label}
                score={drivers.limiting.score}
                description={getGraphDriverDescription(drivers.limiting.label, 'limiting')}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}