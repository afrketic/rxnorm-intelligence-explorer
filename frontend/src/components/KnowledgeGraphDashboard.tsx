import { useEffect, useMemo, useState } from 'react';
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

type ConnectionCard = {
  label: string;
  value: string;
  detail: string;
};

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'http://127.0.0.1:8000';

function toNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function cleanText(value: unknown, fallback = 'Not available') {
  const text = String(value || '').trim();
  return text || fallback;
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

function getNodeLabel(node: any, fallback = 'Not available') {
  return cleanText(node?.label || node?.class_name || node?.name || node?.class_id, fallback);
}

function getMedicationSummary(drug: Props['drug']) {
  return drug?.medication_intelligence_summary || drug?.drug?.medication_intelligence_summary || {};
}

function getGraphIntelligence(drug: Props['drug']) {
  return drug?.graph_intelligence || drug?.drug?.graph_intelligence || {};
}

function getPathway(drug: Props['drug']) {
  return drug?.primary_therapeutic_pathway || drug?.drug?.primary_therapeutic_pathway || {};
}

function getGraphPayload(drug: Props['drug']) {
  return drug?.graph || drug?.drug?.graph || {};
}

function hasClassification(drug: Props['drug'], type: string) {
  const graph = getGraphPayload(drug);
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  return nodes.some((node: any) => String(node?.node_type || '').toUpperCase() === type);
}

function hasRxNormRelationship(drug: Props['drug'], metrics: GraphMetrics) {
  const graph = getGraphPayload(drug);
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  return toNumber(metrics.relationship_node_count) > 0 || edges.length > 0;
}

function buildConnectivitySummary(name: string, drug: Props['drug'], metrics: GraphMetrics, score: number) {
  const summary = getMedicationSummary(drug);
  const domainCount = toNumber(metrics.intelligence_domain_count);
  const atcDepth = toNumber(metrics.classification_depth);
  const strength = score >= 80 ? 'strongly' : score >= 60 ? 'meaningfully' : 'foundationally';
  const domainPhrase = domainCount > 0 ? ` across ${domainCount} intelligence domains` : ' across available graph domains';
  const atcPhrase =
    atcDepth >= 4
      ? 'complete ATC hierarchy coverage'
      : atcDepth > 0
        ? 'partial ATC hierarchy coverage'
        : 'available classification evidence';
  const therapeuticDomain = cleanText(summary.primary_therapeutic_domain, 'its therapeutic domain');
  const diseaseFocus = cleanText(summary.primary_disease_focus, 'mapped disease context');

  return `${name} is ${strength} connected${domainPhrase}, linking therapeutic classification, disease context, pharmacologic evidence, and RxNorm semantic relationships. The graph anchors the medication within ${therapeuticDomain}, connects it to ${diseaseFocus}, and provides ${atcPhrase}. This structure supports semantic search, AI retrieval, clinical relationship discovery, and graph-based medication navigation.`;
}

function buildKeyConnections(drug: Props['drug']): ConnectionCard[] {
  const summary = getMedicationSummary(drug);
  const graphIntel = getGraphIntelligence(drug);

  return [
    {
      label: 'Therapeutic Domain',
      value: cleanText(
        summary.primary_therapeutic_domain || getNodeLabel(graphIntel.most_connected_domain, ''),
        'Therapeutic domain not yet populated'
      ),
      detail: 'Primary graph connection into the therapeutic hierarchy.',
    },
    {
      label: 'Disease Context',
      value: cleanText(
        summary.primary_disease_focus || getNodeLabel(graphIntel.most_connected_disease, ''),
        'Disease context not yet populated'
      ),
      detail: 'Clinical condition context connected to the medication graph.',
    },
    {
      label: 'Mechanism',
      value: cleanText(
        summary.primary_mechanism || getNodeLabel(graphIntel.most_connected_mechanism, ''),
        'Mechanism evidence not yet populated'
      ),
      detail: 'Mechanism or pharmacologic evidence supporting explainability.',
    },
    {
      label: 'Pharmacologic Class',
      value: cleanText(
        summary.primary_pharmacologic_class || getNodeLabel(graphIntel.most_connected_therapeutic_class, ''),
        'Pharmacologic class not yet populated'
      ),
      detail: 'Structured class evidence connected to the medication identity.',
    },
  ];
}

function buildCoverageIndicators(drug: Props['drug'], metrics: GraphMetrics) {
  const graph = getGraphPayload(drug);
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const pathway = getPathway(drug);
  const pathwayItems = Array.isArray(pathway.pathway) ? pathway.pathway : [];
  const summary = getMedicationSummary(drug);

  return [
    {
      label: 'Therapeutic hierarchy mapped',
      active: pathwayItems.length >= 3 || hasClassification(drug, 'ATC4'),
    },
    {
      label: 'Disease relationships mapped',
      active: Boolean(summary.primary_disease_focus) || hasClassification(drug, 'DISEASE'),
    },
    {
      label: 'Mechanism relationships mapped',
      active: Boolean(summary.primary_mechanism) || hasClassification(drug, 'MOA'),
    },
    {
      label: 'Pharmacologic class mapped',
      active: Boolean(summary.primary_pharmacologic_class) || hasClassification(drug, 'EPC'),
    },
    {
      label: 'RxNorm relationships present',
      active: hasRxNormRelationship(drug, metrics),
    },
    {
      label: 'Knowledge graph available',
      active: nodes.length > 0 || toNumber(metrics.node_count) > 0,
    },
  ];
}

function buildRelationshipTypes(drug: Props['drug']) {
  const summary = getMedicationSummary(drug);
  const relationshipTypes = [
    {
      label: 'Therapeutic Classification',
      active: Boolean(summary.primary_therapeutic_domain) || ['ATC1', 'ATC2', 'ATC3', 'ATC4'].some((type) => hasClassification(drug, type)),
      detail: 'ATC hierarchy and therapeutic-domain relationships.',
    },
    {
      label: 'Disease Mapping',
      active: Boolean(summary.primary_disease_focus) || hasClassification(drug, 'DISEASE'),
      detail: 'Disease context and clinical condition relationships.',
    },
    {
      label: 'Mechanism Evidence',
      active: Boolean(summary.primary_mechanism) || hasClassification(drug, 'MOA'),
      detail: 'Mechanism-of-action and pharmacologic evidence.',
    },
    {
      label: 'RxNorm Concepts',
      active: true,
      detail: 'RxNorm identity, relationships, and semantic concept links.',
    },
    {
      label: 'Clinical Relationships',
      active: Boolean(summary.primary_pharmacologic_class) || hasClassification(drug, 'EPC') || hasClassification(drug, 'VA'),
      detail: 'Clinical class and medication relationship context.',
    },
  ];

  return relationshipTypes;
}

function getMetricSubscores(metrics: GraphMetrics) {
  const nodeCoverage = Math.min(100, Math.round(toNumber(metrics.node_count) * 2.25));
  const relationshipDepth = Math.min(
    100,
    Math.round((toNumber(metrics.edge_count) + toNumber(metrics.relationship_node_count) * 2) * 1.4)
  );
  const domainConnectivity = Math.min(100, Math.round(toNumber(metrics.intelligence_domain_count) * 10));

  return [
    {
      label: 'Node Coverage',
      value: nodeCoverage,
      detail: 'Connected graph entities',
    },
    {
      label: 'Relationship Depth',
      value: relationshipDepth,
      detail: 'Connection richness',
    },
    {
      label: 'Domain Connectivity',
      value: domainConnectivity,
      detail: 'Breadth of intelligence domains',
    },
  ];
}

function EvidenceCheck({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
      <span
        className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-black ${
          active
            ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300'
            : 'border-slate-600 bg-slate-800/70 text-slate-400'
        }`}
      >
        {active ? '✓' : '–'}
      </span>
      <span className="text-sm font-bold text-white">{label}</span>
    </div>
  );
}

function KeyConnectionCard({ connection }: { connection: ConnectionCard }) {
  return (
    <div className="rounded-3xl border border-cyan-300/15 bg-slate-950/65 p-5 shadow-inner shadow-slate-950/40">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
        {connection.label}
      </p>
      <p className="mt-3 text-xl font-black leading-7 text-white">{connection.value}</p>
      <p className="mt-3 text-sm font-semibold leading-6 text-slate-400">{connection.detail}</p>
    </div>
  );
}

function RelationshipTypeCard({ item }: { item: { label: string; active: boolean; detail: string } }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-black ${
            item.active
              ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-300'
              : 'border-slate-600 bg-slate-800 text-slate-400'
          }`}
        >
          {item.active ? '✓' : '–'}
        </span>
        <div>
          <p className="text-base font-black text-white">{item.label}</p>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-400">{item.detail}</p>
        </div>
      </div>
    </div>
  );
}

function UseCaseItem({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <p className="text-base font-black text-white">{title}</p>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-400">{detail}</p>
    </div>
  );
}

export default function KnowledgeGraphDashboard({ drug }: Props) {
  const [metrics, setMetrics] = useState<GraphMetrics>(() => getFallbackMetrics(drug));
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
  const metricSubscores = useMemo(() => getMetricSubscores(metrics), [metrics]);
  const connectivitySummary = useMemo(
    () => buildConnectivitySummary(name, drug, metrics, score),
    [name, drug, metrics, score]
  );
  const evidence = useMemo(() => buildCoverageIndicators(drug, metrics), [drug, metrics]);
  const keyConnections = useMemo(() => buildKeyConnections(drug), [drug]);
  const relationshipTypes = useMemo(() => buildRelationshipTypes(drug), [drug]);

  if (!drug) return null;

  return (
    <section className="space-y-6 text-white">
      <article className="overflow-hidden rounded-[2rem] border border-cyan-300/25 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.22),_transparent_34%),linear-gradient(135deg,#020617,#07152d_48%,#020617)] p-7 shadow-2xl shadow-slate-950/40">
        <div className="grid gap-8 lg:grid-cols-[24rem_1fr] lg:items-stretch">
          <div className="rounded-[1.75rem] border border-cyan-300/30 bg-cyan-500/10 p-7 text-center shadow-[0_0_24px_rgba(34,211,238,0.14)]">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">
              Knowledge Graph Intelligence
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
          </div>

          <div className="rounded-[1.75rem] border border-slate-800 bg-slate-950/70 p-7">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
              Connectivity Intelligence Briefing
            </p>

            <h2 className="mt-4 text-4xl font-black tracking-tight text-white md:text-5xl">
              How this medication is connected
            </h2>

            <p className="mt-5 max-w-6xl text-lg leading-8 text-slate-300 md:text-xl md:leading-9">
              This workspace explains how {name} connects across therapeutic hierarchy,
              disease context, mechanism evidence, pharmacologic class, RxNorm concepts,
              and AI-ready graph relationships.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {metricSubscores.map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                    {item.label}
                  </p>
                  <p className="mt-2 text-2xl font-black text-cyan-200">{item.value}</p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </article>

      <article className="rounded-[2rem] border border-slate-800 bg-slate-900/80 p-7 shadow-sm shadow-cyan-950/20">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
          Connectivity Summary
        </p>
        <h3 className="mt-3 text-3xl font-black text-white">How connected is this medication?</h3>
        <p className="mt-5 text-lg leading-8 text-slate-300">{connectivitySummary}</p>
      </article>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-[2rem] border border-slate-800 bg-slate-900/80 p-7 shadow-sm shadow-cyan-950/20">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
            Connectivity Evidence
          </p>
          <h3 className="mt-3 text-2xl font-black text-white">What proves the connection exists?</h3>
          <div className="mt-6 grid gap-3">
            {evidence.map((item) => (
              <EvidenceCheck key={item.label} label={item.label} active={item.active} />
            ))}
          </div>
        </article>

        <article className="rounded-[2rem] border border-slate-800 bg-slate-900/80 p-7 shadow-sm shadow-cyan-950/20">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
            Key Connections
          </p>
          <h3 className="mt-3 text-2xl font-black text-white">Connected to what?</h3>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {keyConnections.map((connection) => (
              <KeyConnectionCard key={connection.label} connection={connection} />
            ))}
          </div>
        </article>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-[2rem] border border-slate-800 bg-slate-900/80 p-7 shadow-sm shadow-cyan-950/20">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
            Relationship Intelligence
          </p>
          <h3 className="mt-3 text-2xl font-black text-white">What relationship types exist?</h3>
          <p className="mt-3 text-base font-semibold leading-7 text-slate-300">
            The graph connects {name} through clinical classification, disease associations,
            pharmacologic evidence, RxNorm semantic relationships, and graph-ready clinical context.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {relationshipTypes.map((item) => (
              <RelationshipTypeCard key={item.label} item={item} />
            ))}
          </div>
        </article>

        <article className="rounded-[2rem] border border-slate-800 bg-slate-900/80 p-7 shadow-sm shadow-cyan-950/20">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
            Graph Use Cases
          </p>
          <h3 className="mt-3 text-2xl font-black text-white">Why connectivity matters</h3>
          <div className="mt-6 grid gap-3">
            <UseCaseItem title="Semantic Search" detail="Find medications through connected concepts instead of exact keyword matches." />
            <UseCaseItem title="Knowledge Retrieval" detail="Retrieve graph-grounded context for medication intelligence workflows." />
            <UseCaseItem title="AI Context Expansion" detail="Provide structured connections for RAG, copilots, and agent workflows." />
            <UseCaseItem title="Clinical Relationship Discovery" detail="Explore therapeutic, disease, mechanism, and class relationships." />
            <UseCaseItem title="Graph-Based Navigation" detail="Move from a medication to its connected clinical and semantic context." />
          </div>
        </article>
      </div>

      <section className="rounded-[2rem] border border-cyan-300/20 bg-slate-950/70 p-6 shadow-[0_0_24px_rgba(14,165,233,0.12)]">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
          Supporting Evidence
        </p>
        <h3 className="mt-2 text-2xl font-black text-white">Interactive Knowledge Graph</h3>
        <h4 className="mt-2 text-3xl font-black text-white">{name}</h4>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-300">
          Explore the supporting relationship network after reviewing the connectivity briefing.
          The graph shows classifications, clinical domains, disease mappings, RxNorm relationships,
          and semantic intelligence connections.
        </p>

        <div className="mt-5">
          <GraphPanel drug={drug} />
        </div>
      </section>
    </section>
  );
}
