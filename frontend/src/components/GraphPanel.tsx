import { useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Node,
  Edge,
  MarkerType,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { DrugCard } from '../lib/api';

type GraphNodeRecord = {
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
  score_band?: string | null;
  benchmark_tier?: string | null;
  occurrence_count?: number;
  is_high_value_node?: number;
};

type GraphEdgeRecord = {
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
  nodes: GraphNodeRecord[];
  edges: GraphEdgeRecord[];
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

type GraphPanelDrug = DrugCard & {
  graph?: GraphPayload;
  drug?: Record<string, any>;
  scorecard?: Record<string, any>;
};

type ViewMode = 'executive' | 'full' | 'hierarchy' | 'disease' | 'rxnorm';

type VisualDomain = {
  id: string;
  label: string;
  type: string;
  childTypes: string[];
};

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'http://127.0.0.1:8000';

const NODE_TYPES = [
  'DRUG',
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
  'RELATIONSHIP',
];

const ATC_TYPES = ['ATC1', 'ATC2', 'ATC3', 'ATC4', 'ATC5'];
const CHEMICAL_TYPES = ['CHEM', 'VA', 'DISPOS', 'STRUCT'];
const INSIGHT_TYPES = [
  ...ATC_TYPES,
  'DISEASE',
  'PE',
  'MOA',
  'EPC',
  ...CHEMICAL_TYPES,
  'RELATIONSHIP',
];

const NODE_LABELS: Record<string, string> = {
  DRUG: 'Drug',
  ATC1: 'ATC 1',
  ATC2: 'ATC 2',
  ATC3: 'ATC 3',
  ATC4: 'ATC 4',
  ATC5: 'ATC 5',
  MOA: 'MOA',
  EPC: 'EPC',
  DISEASE: 'Disease',
  PE: 'Pharmacologic Effect',
  CHEM: 'Chemical',
  VA: 'VA',
  DISPOS: 'Disposition',
  STRUCT: 'Structure',
  RELATIONSHIP: 'RxNorm Relationship',
  DOMAIN_ATC: 'ATC Domain',
  DOMAIN_DISEASE: 'Disease Domain',
  DOMAIN_MOA: 'MOA Domain',
  DOMAIN_EPC: 'EPC Domain',
  DOMAIN_CHEMICAL: 'Chemical Domain',
  DOMAIN_RXNORM: 'RxNorm Domain',
};

const NODE_COLORS: Record<string, { background: string; border: string; color: string }> = {
  DRUG: { background: '#020617', border: '#2563eb', color: '#ffffff' },
  ATC1: { background: '#172554', border: '#3b82f6', color: '#dbeafe' },
  ATC2: { background: '#172554', border: '#3b82f6', color: '#dbeafe' },
  ATC3: { background: '#172554', border: '#3b82f6', color: '#dbeafe' },
  ATC4: { background: '#172554', border: '#3b82f6', color: '#dbeafe' },
  ATC5: { background: '#172554', border: '#3b82f6', color: '#dbeafe' },
  MOA: { background: '#3b0764', border: '#c084fc', color: '#f3e8ff' },
  EPC: { background: '#312e81', border: '#818cf8', color: '#e0e7ff' },
  DISEASE: { background: '#881337', border: '#fb7185', color: '#ffe4e6' },
  PE: { background: '#78350f', border: '#f59e0b', color: '#fef3c7' },
  CHEM: { background: '#14532d', border: '#4ade80', color: '#dcfce7' },
  VA: { background: '#164e63', border: '#22d3ee', color: '#cffafe' },
  DISPOS: { background: '#7c2d12', border: '#fb923c', color: '#ffedd5' },
  STRUCT: { background: '#134e4a', border: '#2dd4bf', color: '#ccfbf1' },
  RELATIONSHIP: { background: '#1e293b', border: '#94a3b8', color: '#f8fafc' },
  DOMAIN_ATC: { background: '#0f1f4d', border: '#60a5fa', color: '#dbeafe' },
  DOMAIN_DISEASE: { background: '#5f1230', border: '#fb7185', color: '#ffe4e6' },
  DOMAIN_MOA: { background: '#42146b', border: '#c084fc', color: '#f3e8ff' },
  DOMAIN_EPC: { background: '#312e81', border: '#a5b4fc', color: '#e0e7ff' },
  DOMAIN_CHEMICAL: { background: '#064e3b', border: '#34d399', color: '#d1fae5' },
  DOMAIN_RXNORM: { background: '#1e293b', border: '#cbd5e1', color: '#f8fafc' },
};

const VISUAL_DOMAINS: VisualDomain[] = [
  { id: 'domain:ATC', label: 'ATC', type: 'DOMAIN_ATC', childTypes: ['ATC1', 'ATC2', 'ATC3', 'ATC4', 'ATC5'] },
  { id: 'domain:Disease', label: 'Disease', type: 'DOMAIN_DISEASE', childTypes: ['DISEASE', 'PE'] },
  { id: 'domain:MOA', label: 'MOA', type: 'DOMAIN_MOA', childTypes: ['MOA'] },
  { id: 'domain:EPC', label: 'EPC', type: 'DOMAIN_EPC', childTypes: ['EPC'] },
  { id: 'domain:Chemical', label: 'Chemical', type: 'DOMAIN_CHEMICAL', childTypes: ['CHEM', 'VA', 'DISPOS', 'STRUCT'] },
  { id: 'domain:RxNorm', label: 'RxNorm', type: 'DOMAIN_RXNORM', childTypes: ['RELATIONSHIP'] },
];

const DOMAIN_GROUPS = [
  { label: 'ATC', types: ['ATC1', 'ATC2', 'ATC3', 'ATC4', 'ATC5'] },
  { label: 'Disease', types: ['DISEASE', 'PE'] },
  { label: 'MOA', types: ['MOA'] },
  { label: 'EPC', types: ['EPC'] },
  { label: 'Chemical', types: ['CHEM', 'VA', 'DISPOS', 'STRUCT'] },
  { label: 'RxNorm', types: ['RELATIONSHIP'] },
];

const EXECUTIVE_TYPES = [
  'ATC1',
  'ATC2',
  'ATC3',
  'ATC4',
  'ATC5',
  'DISEASE',
  'MOA',
  'EPC',
  'PE',
  'CHEM',
  'VA',
  'DISPOS',
  'STRUCT',
];

const VIEW_MODES: Record<ViewMode, { label: string; types: string[] }> = {
  executive: { label: 'Executive View', types: EXECUTIVE_TYPES },
  full: { label: 'Full + RxNorm', types: NODE_TYPES.filter((type) => type !== 'DRUG') },
  hierarchy: { label: 'Hierarchy', types: ['ATC1', 'ATC2', 'ATC3', 'ATC4', 'ATC5'] },
  disease: { label: 'Disease', types: ['DISEASE', 'PE', 'MOA', 'EPC'] },
  rxnorm: { label: 'RxNorm', types: ['RELATIONSHIP'] },
};

function normalizeType(value?: string | null) {
  return (value || 'UNKNOWN').toUpperCase();
}

function nodeTypeLabel(value?: string | null) {
  const normalized = normalizeType(value);
  return NODE_LABELS[normalized] || normalized;
}

function formatLabel(value?: string | null, fallback = 'Unknown') {
  const text = (value || '').trim();
  if (!text) return fallback;
  return text.length > 42 ? `${text.slice(0, 42)}…` : text;
}

function toNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function scoreLabel(score: number) {
  if (score >= 95) return 'Platinum';
  if (score >= 90) return 'Enterprise Ready';
  if (score >= 75) return 'Strong';
  if (score >= 50) return 'Developing';
  if (score >= 25) return 'Limited';
  return 'Foundational';
}

function getStyleForType(type?: string | null) {
  return NODE_COLORS[normalizeType(type)] || {
    background: '#1e293b',
    border: '#64748b',
    color: '#f8fafc',
  };
}

function getDrugValue(drug: GraphPanelDrug | null, keys: string[], fallback: any = null) {
  if (!drug) return fallback;

  for (const key of keys) {
    if ((drug as any)[key] !== undefined && (drug as any)[key] !== null && (drug as any)[key] !== '') return (drug as any)[key];
    if (drug.drug?.[key] !== undefined && drug.drug?.[key] !== null && drug.drug?.[key] !== '') return drug.drug[key];
    if (drug.scorecard?.[key] !== undefined && drug.scorecard?.[key] !== null && drug.scorecard?.[key] !== '') return drug.scorecard[key];
  }

  return fallback;
}

function countNodeTypes(graph: GraphPayload | null, types: string[]) {
  if (!graph) return 0;
  return graph.nodes.filter((node) => types.includes(normalizeType(node.node_type))).length;
}

function buildFallbackMetrics(graph: GraphPayload | null): GraphMetrics | null {
  if (!graph) return null;

  const nodes = graph.nodes || [];
  const edges = graph.edges || [];

  const classificationNodes = nodes.filter((node) =>
    ['ATC1', 'ATC2', 'ATC3', 'ATC4', 'ATC5', 'MOA', 'EPC', 'DISEASE', 'PE', 'CHEM', 'VA', 'DISPOS', 'STRUCT'].includes(
      normalizeType(node.node_type),
    ),
  );

  const relationshipNodes = nodes.filter((node) => normalizeType(node.node_type) === 'RELATIONSHIP');
  const domains = new Set(nodes.map((node) => node.intelligence_domain || node.node_type).filter(Boolean));

  const depth = ['ATC1', 'ATC2', 'ATC3', 'ATC4'].reduce(
    (max, level, index) =>
      classificationNodes.some((node) => normalizeType(node.node_type) === level) ? index + 1 : max,
    0,
  );

  return {
    rxcui: graph.center_rxcui,
    node_count: nodes.length,
    edge_count: edges.length,
    classification_node_count: classificationNodes.length,
    relationship_node_count: relationshipNodes.length,
    intelligence_domain_count: domains.size,
    classification_depth: depth,
    graph_connectivity_score: 0,
  };
}

function ringPosition(index: number, total: number, radius: number, centerX: number, centerY: number, startAngle = -Math.PI / 2) {
  const angle = startAngle + (index / total) * Math.PI * 2;

  return {
    x: centerX + Math.cos(angle) * radius,
    y: centerY + Math.sin(angle) * radius,
  };
}

function localRingRadius(nodeCount: number) {
  if (nodeCount <= 1) return 210;

  const estimatedNodeSpacing = 190;
  const radiusForNoOverlap = (nodeCount * estimatedNodeSpacing) / (Math.PI * 2);

  return Math.max(230, radiusForNoOverlap);
}

function getDomainForNode(node: GraphNodeRecord) {
  const type = normalizeType(node.node_type);
  return VISUAL_DOMAINS.find((domain) => domain.childTypes.includes(type));
}

function makeDomainNode(domain: VisualDomain, children: GraphNodeRecord[]): GraphNodeRecord {
  return {
    node_id: domain.id,
    label: domain.label,
    node_type: domain.type,
    intelligence_domain: domain.label,
    source_system: 'Synthetic visualization layer',
    occurrence_count: children.length,
    description: `${domain.label} domain containing ${children.length} related medication intelligence nodes.`,
  };
}

function isInsightNode(node: GraphNodeRecord | null) {
  if (!node) return false;
  return INSIGHT_TYPES.includes(normalizeType(node.node_type));
}

function getAtcCode(node: GraphNodeRecord) {
  const raw =
    node.class_id ||
    node.rxcui ||
    node.label ||
    node.class_name ||
    node.node_id ||
    '';

  const cleaned = String(raw).trim();
  const match = cleaned.match(/[A-Z][0-9]{0,2}[A-Z]{0,2}[0-9]{0,2}/i);

  return match ? match[0].toUpperCase() : cleaned;
}

function buildAtcBreakdown(node: GraphNodeRecord | null, graph: GraphPayload | null) {
  if (!node) return [];

  const nodes = graph?.nodes || [];
  const selectedType = normalizeType(node.node_type);

  if (!ATC_TYPES.includes(selectedType)) return [];

  const selectedCode = getAtcCode(node);

  const atcNodes = nodes
    .filter((item) => ATC_TYPES.includes(normalizeType(item.node_type)))
    .map((item) => ({
      node: item,
      type: normalizeType(item.node_type),
      code: getAtcCode(item),
      label: item.class_name || item.label || item.description || item.node_id,
    }));

  const selectedIndex = ATC_TYPES.indexOf(selectedType);

  return ATC_TYPES.slice(0, selectedIndex + 1)
    .map((type, index) => {
      const exact = atcNodes.find((item) => item.type === type);

      if (exact) {
        return {
          level: index + 1,
          type,
          code: exact.code,
          label: exact.label,
        };
      }

      const fallbackCode = selectedCode.slice(
        0,
        Math.min(
          selectedCode.length,
          index === 0 ? 1 : index === 1 ? 3 : index === 2 ? 4 : selectedCode.length,
        ),
      );

      return {
        level: index + 1,
        type,
        code: fallbackCode || type,
        label: `${nodeTypeLabel(type)} classification`,
      };
    })
    .filter((item) => item.code);
}

function buildNodeInsight(node: GraphNodeRecord | null, graph: GraphPayload | null) {
  if (!node) return null;

  const type = normalizeType(node.node_type);
  const style = getStyleForType(type);
  const title = node.label || node.class_name || node.description || node.node_id;
  const source = node.source_system || node.source || 'RxNorm Intelligence Platform';
  const evidence = node.occurrence_count ?? '—';
  const classId = node.class_id || '—';
  const score = node.score ?? '—';
  const tier = node.benchmark_tier || node.score_band || '—';

  if (ATC_TYPES.includes(type)) {
    return {
      eyebrow: 'ATC Hierarchy Breakdown',
      title,
      subtitle:
        'ATC nodes organize medications into a therapeutic hierarchy, moving from broad body system to more specific therapeutic class.',
      style,
      rows: buildAtcBreakdown(node, graph).map((item) => ({
        label: `Level ${item.level} · ${nodeTypeLabel(item.type)}`,
        value: item.code,
        helper: item.label,
      })),
      footer:
        'ATC hierarchy helps translate medication identity into therapeutic positioning and clinical classification context.',
    };
  }

  if (type === 'DISEASE') {
    return {
      eyebrow: 'Clinical Association Context',
      title,
      subtitle:
        'Disease nodes identify semantic links between the medication and clinical condition concepts.',
      style,
      rows: [
        { label: 'Disease Concept', value: title, helper: 'Clinical semantic association' },
        { label: 'Class ID', value: classId, helper: 'Disease classification identifier when available' },
        { label: 'Source', value: source, helper: 'Origin of the disease relationship signal' },
        { label: 'Evidence', value: String(evidence), helper: 'Available relationship or occurrence count' },
      ],
      footer:
        'Important: this does not necessarily mean the drug treats this condition. It means the medication is semantically linked to this disease concept in the intelligence graph.',
    };
  }

  if (type === 'PE') {
    return {
      eyebrow: 'Pharmacologic Effect Context',
      title,
      subtitle:
        'Pharmacologic Effect nodes describe observed or expected biological effects associated with the medication.',
      style,
      rows: [
        { label: 'Effect', value: title, helper: 'Linked pharmacologic effect concept' },
        { label: 'Class ID', value: classId, helper: 'Pharmacologic effect classification identifier' },
        { label: 'Source', value: source, helper: 'Source system for this effect mapping' },
        { label: 'Evidence', value: String(evidence), helper: 'Available graph evidence count' },
      ],
      footer:
        'This signal helps explain what biological or therapeutic effect is associated with the medication profile.',
    };
  }

  if (type === 'MOA') {
    return {
      eyebrow: 'Mechanism Context',
      title,
      subtitle:
        'MOA nodes describe how the medication is believed to work biologically or pharmacologically.',
      style,
      rows: [
        { label: 'Mechanism', value: title, helper: 'Mechanism-of-action concept' },
        { label: 'Class ID', value: classId, helper: 'Mechanism classification identifier' },
        { label: 'Source', value: source, helper: 'Source system for the mechanism mapping' },
        { label: 'Evidence', value: String(evidence), helper: 'Available graph evidence count' },
      ],
      footer:
        'MOA context supports explainability by connecting medication identity to the biological process or target pathway behind its effect.',
    };
  }

  if (type === 'EPC') {
    return {
      eyebrow: 'Established Pharmacologic Class Context',
      title,
      subtitle:
        'EPC nodes represent established pharmacologic class groupings that help standardize drug categorization.',
      style,
      rows: [
        { label: 'EPC', value: title, helper: 'Established Pharmacologic Class' },
        { label: 'Class ID', value: classId, helper: 'EPC classification identifier' },
        { label: 'Source', value: source, helper: 'Source system for EPC mapping' },
        { label: 'Evidence', value: String(evidence), helper: 'Available graph evidence count' },
      ],
      footer:
        'EPC is useful for FDA-style pharmacologic grouping, therapeutic comparison, and enterprise medication classification.',
    };
  }

  if (CHEMICAL_TYPES.includes(type)) {
    return {
      eyebrow: 'Chemical / Structure Context',
      title,
      subtitle:
        'Chemical nodes describe ingredient, structure, disposition, or related chemical classification signals.',
      style,
      rows: [
        { label: nodeTypeLabel(type), value: title, helper: 'Chemical or structural classification signal' },
        { label: 'Class ID', value: classId, helper: 'Chemical classification identifier when available' },
        { label: 'Source', value: source, helper: 'Source system for this chemical mapping' },
        { label: 'Evidence', value: String(evidence), helper: 'Available graph evidence count' },
      ],
      footer:
        'Chemical and structure context helps group drugs by ingredient, molecular profile, disposition, or related classification evidence.',
    };
  }

  if (type === 'RELATIONSHIP') {
    return {
      eyebrow: 'Terminology Relationship Context',
      title,
      subtitle:
        'RxNorm relationship nodes connect the selected medication to normalized terminology concepts and related medication identities.',
      style,
      rows: [
        { label: 'RxNorm Concept', value: title, helper: 'Related normalized concept' },
        { label: 'RxCUI', value: node.rxcui || classId, helper: 'Related concept identifier when available' },
        { label: 'Source', value: source, helper: 'Terminology source system' },
        { label: 'Evidence', value: String(evidence), helper: 'Available relationship evidence count' },
      ],
      footer:
        'RxNorm relationships support interoperability by connecting drug names, ingredients, branded concepts, clinical drug forms, and normalized identifiers.',
    };
  }

  return null;
}

function convertToReactFlow(
  graph: GraphPayload,
  enabledTypes: Set<string>,
  selectedNodeId?: string | null,
): {
  nodes: Node[];
  edges: Edge[];
  visualLookup: Map<string, GraphNodeRecord>;
} {
  const graphNodes = graph.nodes || [];
  const centerNodeId = graph.center_node_id || `drug:${graph.center_rxcui}`;

  const centerNode =
    graphNodes.find((node) => node.node_id === centerNodeId || normalizeType(node.node_type) === 'DRUG') ||
    graphNodes[0];

  const valueNodes = graphNodes.filter((node) => {
    const type = normalizeType(node.node_type);
    return type !== 'DRUG' && enabledTypes.has(type) && Boolean(getDomainForNode(node));
  });

  const childrenByDomain = new Map<string, GraphNodeRecord[]>();

  VISUAL_DOMAINS.forEach((domain) => childrenByDomain.set(domain.id, []));

  valueNodes.forEach((node) => {
    const domain = getDomainForNode(node);
    if (!domain) return;
    childrenByDomain.get(domain.id)?.push(node);
  });

  const activeDomains = VISUAL_DOMAINS.filter((domain) => (childrenByDomain.get(domain.id) || []).length > 0);
  const syntheticDomainNodes = activeDomains.map((domain) => makeDomainNode(domain, childrenByDomain.get(domain.id) || []));

  const visualNodes = centerNode ? [centerNode, ...syntheticDomainNodes, ...valueNodes] : [...syntheticDomainNodes, ...valueNodes];

  const visualLookup = new Map<string, GraphNodeRecord>();
  visualNodes.forEach((node) => visualLookup.set(node.node_id, node));

  const centerX = 1600;
  const centerY = 1600;
  const maxChildRadius = Math.max(...activeDomains.map((domain) => localRingRadius((childrenByDomain.get(domain.id) || []).length)), 230);
  const domainRingRadius = Math.max(720, maxChildRadius * 2.15);

  const positions = new Map<string, { x: number; y: number }>();

  if (centerNode) {
    positions.set(centerNode.node_id, { x: centerX, y: centerY });
  }

  activeDomains.forEach((domain, domainIndex) => {
    const domainPosition = ringPosition(domainIndex, activeDomains.length, domainRingRadius, centerX, centerY);
    positions.set(domain.id, domainPosition);

    const children = childrenByDomain.get(domain.id) || [];
    const childRadius = localRingRadius(children.length);

    children.forEach((child, childIndex) => {
      positions.set(
        child.node_id,
        ringPosition(childIndex, children.length, childRadius, domainPosition.x, domainPosition.y),
      );
    });
  });

  const nodes: Node[] = visualNodes.map((node) => {
    const type = normalizeType(node.node_type);
    const colors = getStyleForType(type);
    const isDrug = type === 'DRUG';
    const isDomain = type.startsWith('DOMAIN_');
    const isSelected = selectedNodeId === node.node_id;

    return {
      id: node.node_id,
      position: positions.get(node.node_id) || { x: centerX, y: centerY },
      className: `kg-node ${isDrug ? 'kg-node-drug' : ''} ${isDomain ? 'kg-node-domain' : ''} ${
        isSelected ? 'kg-node-selected' : ''
      }`,
      data: {
        label: (
          <div>
            <div style={{ fontSize: isDrug ? 18 : isDomain ? 15 : 11, fontWeight: 900 }}>
              {formatLabel(node.label, node.node_id)}
            </div>
            <div style={{ marginTop: 4, fontSize: isDrug ? 10 : isDomain ? 10 : 9, opacity: 0.82, fontWeight: 800 }}>
              {nodeTypeLabel(type)}
            </div>
          </div>
        ),
      },
      style: {
        width: isDrug ? 250 : isDomain ? 190 : 150,
        minHeight: isDrug ? 92 : isDomain ? 76 : 58,
        borderRadius: isDrug ? 26 : isDomain ? 22 : 16,
        border: isSelected ? '3px solid #22d3ee' : `2px solid ${isDrug ? '#60a5fa' : colors.border}`,
        background: colors.background,
        color: colors.color,
        cursor: 'pointer',
        boxShadow: isSelected
          ? '0 0 0 4px rgba(34, 211, 238, 0.18), 0 0 38px rgba(34, 211, 238, 0.55)'
          : isDrug
            ? '0 0 0 3px rgba(37, 99, 235, 0.16), 0 20px 60px rgba(37, 99, 235, 0.38)'
            : isDomain
              ? '0 0 0 3px rgba(148, 163, 184, 0.10), 0 16px 42px rgba(2, 6, 23, 0.52)'
              : '0 10px 28px rgba(2, 6, 23, 0.45)',
        padding: isDrug ? 14 : 10,
        transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
      },
    };
  });

  const edges: Edge[] = [];

  if (centerNode) {
    activeDomains.forEach((domain) => {
      edges.push({
        id: `edge:${centerNode.node_id}->${domain.id}`,
        source: centerNode.node_id,
        target: domain.id,
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: {
          strokeWidth: 2.2,
          stroke: '#38bdf8',
          opacity: 0.72,
        },
      });

      const children = childrenByDomain.get(domain.id) || [];

      children.forEach((child) => {
        edges.push({
          id: `edge:${domain.id}->${child.node_id}`,
          source: domain.id,
          target: child.node_id,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: {
            strokeWidth: 1.2,
            stroke: getStyleForType(domain.type).border,
            opacity: 0.54,
          },
        });
      });
    });
  }

  return { nodes, edges, visualLookup };
}

function AutoFitGraph({
  nodes,
  edges,
  enabledTypes,
  viewMode,
}: {
  nodes: Node[];
  edges: Edge[];
  enabledTypes: Set<string>;
  viewMode: ViewMode;
}) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (!nodes.length) return;

    const timeout = window.setTimeout(() => {
      fitView({
        padding: 0.18,
        duration: 550,
        includeHiddenNodes: false,
      });
    }, 80);

    return () => window.clearTimeout(timeout);
  }, [nodes.length, edges.length, enabledTypes, viewMode, fitView]);

  return null;
}

export default function GraphPanel({ drug }: { drug: GraphPanelDrug | null }) {
  const [graph, setGraph] = useState<GraphPayload | null>(drug?.graph || null);
  const [metrics, setMetrics] = useState<GraphMetrics | null>(buildFallbackMetrics(drug?.graph || null));
  const [selectedNode, setSelectedNode] = useState<GraphNodeRecord | null>(null);
  const [popupNode, setPopupNode] = useState<GraphNodeRecord | null>(null);
  const [enabledTypes, setEnabledTypes] = useState<Set<string>>(new Set(VIEW_MODES.executive.types));
  const [viewMode, setViewMode] = useState<ViewMode>('executive');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rxcui = drug?.rxcui;

  useEffect(() => {
    setGraph(drug?.graph || null);
    setMetrics(buildFallbackMetrics(drug?.graph || null));
    setPopupNode(null);
    setSelectedNode(
      drug?.graph?.nodes?.find((node) => normalizeType(node.node_type) === 'DRUG') ||
        drug?.graph?.nodes?.[0] ||
        null,
    );
  }, [drug?.rxcui]);

  useEffect(() => {
    if (!rxcui) return;

    let active = true;

    async function loadGraph() {
      setLoading(true);
      setError(null);

      try {
        const [graphResponse, metricsResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/graph/subgraph/${encodeURIComponent(rxcui)}?edge_limit=250`),
          fetch(`${API_BASE_URL}/graph/metrics/${encodeURIComponent(rxcui)}`),
        ]);

        if (!graphResponse.ok) throw new Error(`Graph request failed with status ${graphResponse.status}`);
        if (!metricsResponse.ok) throw new Error(`Graph metrics request failed with status ${metricsResponse.status}`);

        const graphPayload = (await graphResponse.json()) as GraphPayload;
        const metricsPayload = (await metricsResponse.json()) as GraphMetrics;

        if (!active) return;

        setGraph(graphPayload);
        setMetrics(metricsPayload);
        setPopupNode(null);
        setSelectedNode(
          graphPayload.nodes?.find((node) => normalizeType(node.node_type) === 'DRUG') ||
            graphPayload.nodes?.[0] ||
            null,
        );
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load knowledge graph.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadGraph();

    return () => {
      active = false;
    };
  }, [rxcui]);

  const flow = useMemo(() => {
    if (!graph) return { nodes: [], edges: [], visualLookup: new Map<string, GraphNodeRecord>() };
    return convertToReactFlow(graph, enabledTypes, selectedNode?.node_id);
  }, [graph, enabledTypes, selectedNode?.node_id]);

  const popupInsight = useMemo(() => buildNodeInsight(popupNode, graph), [popupNode, graph]);

  const intelligenceScore = toNumber(
    getDrugValue(drug, ['overall_intelligence_score', 'intelligence_score', 'graph_intelligence_score'], metrics?.graph_connectivity_score ?? 0),
  );

  const therapeuticClasses = countNodeTypes(graph, ['ATC1', 'ATC2', 'ATC3', 'ATC4']);
  const diseaseMappings = countNodeTypes(graph, ['DISEASE']);
  const mechanisms = countNodeTypes(graph, ['MOA', 'EPC']);
  const relationships = countNodeTypes(graph, ['RELATIONSHIP']);

  const totalEvidence =
    graph?.nodes?.reduce((sum, node) => sum + toNumber(node.occurrence_count, 0), 0) ||
    toNumber(selectedNode?.occurrence_count, 0) ||
    0;

  const drugName = String(
    selectedNode?.label ||
      getDrugValue(drug, ['rxnorm_name', 'drug_name', 'name', 'label'], 'Selected medication'),
  );

  const selectedTier =
    selectedNode?.benchmark_tier ||
    selectedNode?.score_band ||
    String(getDrugValue(drug, ['benchmark_tier', 'tier'], scoreLabel(intelligenceScore)));

  const selectedSource =
    selectedNode?.source_system ||
    selectedNode?.source ||
    String(getDrugValue(drug, ['source_system', 'source'], 'RxNorm Intelligence Platform'));

  const classificationCoverage =
    (metrics?.classification_depth ?? 0) >= 4 ? 'Complete' : `${metrics?.classification_depth ?? 0}/4`;

  function applyViewMode(mode: ViewMode) {
    setViewMode(mode);
    setEnabledTypes(new Set(VIEW_MODES[mode].types));
    setPopupNode(null);
  }

  function toggleDomainGroup(types: string[]) {
    setEnabledTypes((current) => {
      const next = new Set(current);
      const allActive = types.every((type) => next.has(type));

      types.forEach((type) => {
        if (allActive) next.delete(type);
        else next.add(type);
      });

      setViewMode('full');
      setPopupNode(null);
      return next;
    });
  }

  if (!drug) {
    return (
      <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 text-white shadow-sm">
        <h3 className="text-xl font-bold text-white">Medication Intelligence Network</h3>
        <p className="mt-2 text-sm text-slate-400">Select a medication to view its knowledge graph.</p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80 text-white shadow-sm">
      <style>{`
        .kg-node:hover {
          transform: translateY(-5px) scale(1.035);
          z-index: 50;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.18), 0 0 34px rgba(59, 130, 246, 0.46) !important;
        }
        .kg-node-drug:hover {
          transform: translateY(-6px) scale(1.05);
          box-shadow: 0 0 0 5px rgba(34, 211, 238, 0.20), 0 0 48px rgba(34, 211, 238, 0.62) !important;
        }
        .kg-node-domain:hover {
          transform: translateY(-6px) scale(1.055);
          box-shadow: 0 0 0 5px rgba(96, 165, 250, 0.20), 0 0 52px rgba(96, 165, 250, 0.50) !important;
        }
        .kg-node-selected {
          z-index: 60;
        }
        .react-flow__controls {
          border-radius: 14px;
          overflow: hidden;
          opacity: 0.42;
          transition: opacity 160ms ease;
        }
        .react-flow__controls:hover {
          opacity: 1;
        }
        .react-flow__controls-button {
          background: #020617;
          border-bottom: 1px solid #334155;
          color: #e2e8f0;
        }
        .react-flow__controls-button:hover {
          background: #0f172a;
        }
      `}</style>

      <div className="p-6">
        <div className="flex flex-col gap-5">
          <button
            type="button"
            onClick={() => applyViewMode('executive')}
            className="mx-auto min-h-[150px] w-full max-w-4xl rounded-3xl border border-blue-500/50 bg-[radial-gradient(circle_at_top_right,_rgba(37,99,235,0.28),_transparent_38%),linear-gradient(135deg,#020617,#0f172a)] p-6 text-center shadow-xl shadow-blue-950/20 transition hover:-translate-y-1 hover:border-cyan-400/70 hover:shadow-cyan-950/30"
          >
            <p className="text-xs font-black uppercase tracking-[0.26em] text-blue-300">
              Medication Intelligence Score
            </p>

            <p className="mt-3 text-6xl font-black leading-none text-white">
              {intelligenceScore.toFixed(0)}
            </p>

            <p className="mt-3 text-2xl font-black text-blue-100">
              {scoreLabel(intelligenceScore)}
            </p>

            <p className="mx-auto mt-5 max-w-3xl text-sm font-semibold leading-6 text-slate-400">
              Primary summary of the medication intelligence profile across classifications,
              graph evidence, clinical signals, and AI-readiness.
            </p>
          </button>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <ShortcutMetric
              label="Therapeutic Classes"
              value={therapeuticClasses}
              helper="ATC hierarchy"
              onClick={() => applyViewMode('hierarchy')}
            />

            <ShortcutMetric
              label="Disease Mappings"
              value={diseaseMappings}
              helper="Clinical associations"
              onClick={() => applyViewMode('disease')}
            />

            <ShortcutMetric
              label="Mechanisms"
              value={mechanisms}
              helper="MOA + EPC"
              onClick={() => {
                setViewMode('full');
                setEnabledTypes(new Set(['MOA', 'EPC']));
                setPopupNode(null);
              }}
            />

            <ShortcutMetric
              label="Relationships"
              value={relationships}
              helper="RxNorm concepts"
              onClick={() => applyViewMode('rxnorm')}
            />
          </div>
        </div>

        <div className="mt-5 rounded-3xl border border-slate-700 bg-slate-950/70 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-300">Selected Medication</p>

          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h4 className="text-3xl font-black leading-tight text-white">{drugName}</h4>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-blue-500/60 bg-blue-950/70 px-3 py-1 text-xs font-black text-blue-100">
                  Tier: {selectedTier}
                </span>
                <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-black text-slate-300">
                  Source: {selectedSource}
                </span>
                <span className="rounded-full border border-emerald-500/50 bg-emerald-950/50 px-3 py-1 text-xs font-black text-emerald-200">
                  Evidence: {selectedNode?.occurrence_count ?? totalEvidence ?? '—'}
                </span>
                <span className="rounded-full border border-cyan-500/50 bg-cyan-950/50 px-3 py-1 text-xs font-black text-cyan-200">
                  Classification Coverage: {classificationCoverage}
                </span>
              </div>
            </div>

            <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2 lg:text-right">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Node ID</p>
                <p className="font-semibold text-slate-200">{selectedNode?.node_id || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Domain</p>
                <p className="font-semibold text-slate-200">
                  {selectedNode?.intelligence_domain || nodeTypeLabel(selectedNode?.node_type)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-y border-slate-800 bg-slate-950/40 p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h4 className="text-sm font-bold uppercase tracking-[0.18em] text-blue-200">Visible Domains</h4>
            <div className="mt-3 flex flex-wrap gap-2">
              {DOMAIN_GROUPS.map((group) => {
                const active = group.types.some((type) => enabledTypes.has(type));
                const visualDomain = VISUAL_DOMAINS.find((domain) => domain.childTypes.some((type) => group.types.includes(type)));
                const style = getStyleForType(visualDomain?.type || group.types[0]);

                return (
                  <button
                    key={group.label}
                    type="button"
                    onClick={() => toggleDomainGroup(group.types)}
                    className="rounded-full border px-4 py-2 text-xs font-black transition hover:scale-105"
                    style={{
                      background: active ? style.background : '#020617',
                      borderColor: active ? style.border : '#334155',
                      color: active ? style.color : '#94a3b8',
                    }}
                  >
                    {group.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-bold uppercase tracking-[0.18em] text-blue-200">Graph View Mode</h4>
            <div className="mt-3 flex flex-wrap gap-2">
              {(Object.keys(VIEW_MODES) as ViewMode[]).map((mode) => {
                const active = viewMode === mode;

                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => applyViewMode(mode)}
                    className={`rounded-full border px-4 py-2 text-xs font-black transition ${
                      active
                        ? 'border-blue-400 bg-blue-600 text-white shadow-lg shadow-blue-950/30'
                        : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-blue-700 hover:bg-blue-950/40'
                    }`}
                  >
                    {VIEW_MODES[mode].label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-300">Knowledge Graph</p>
            <h4 className="mt-1 text-xl font-black text-white">Interactive Three-Ring Medication Network</h4>
            <p className="mt-2 text-sm font-semibold text-slate-400">
              Ring 1: selected drug. Ring 2: intelligence domains. Ring 3: related values. Click any node for details.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              applyViewMode('executive');
              setPopupNode(null);
            }}
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800"
          >
            Reset graph
          </button>
        </div>

        {loading && (
          <div className="rounded-2xl border border-slate-700 bg-slate-950 p-5 text-sm text-slate-400">
            Loading graph intelligence from `/graph/subgraph/{'{rxcui}'}` and `/graph/metrics/{'{rxcui}'}`…
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-950/40 p-5 text-sm font-semibold text-rose-200">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div
            className="relative h-[680px] overflow-hidden rounded-3xl border border-slate-700 bg-slate-950"
            onMouseLeave={() => setPopupNode(null)}
          >
            <div className="pointer-events-none absolute right-5 top-5 z-20 rounded-full border border-cyan-400/40 bg-cyan-950/50 px-4 py-2 text-xs font-black uppercase tracking-wide text-cyan-100 shadow-lg shadow-cyan-950/30">
              Interactive graph · click a node
            </div>

            {popupInsight && (
              <NodeInsightPopup
                insight={popupInsight}
                onClose={() => setPopupNode(null)}
              />
            )}

            <ReactFlowProvider>
              <AutoFitGraph
                nodes={flow.nodes}
                edges={flow.edges}
                enabledTypes={enabledTypes}
                viewMode={viewMode}
              />

              <ReactFlow
                nodes={flow.nodes}
                edges={flow.edges}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                minZoom={0.015}
                maxZoom={1.35}
                onPaneClick={() => setPopupNode(null)}
                onNodeClick={(_, node) => {
                  const record = flow.visualLookup.get(node.id) || null;
                  setSelectedNode(record);

                  if (isInsightNode(record)) {
                    setPopupNode(record);
                  } else {
                    setPopupNode(null);
                  }
                }}
                onNodeMouseEnter={(_, node) => {
                  const record = flow.visualLookup.get(node.id) || null;

                  if (isInsightNode(record)) {
                    setPopupNode(record);
                  }
                }}
              >
                <Background color="#334155" gap={20} />
                <Controls />
              </ReactFlow>
            </ReactFlowProvider>
          </div>
        )}
      </div>
    </section>
  );
}

function NodeInsightPopup({
  insight,
  onClose,
}: {
  insight: {
    eyebrow: string;
    title: string;
    subtitle: string;
    style: { background: string; border: string; color: string };
    rows: { label: string; value: string; helper: string }[];
    footer: string;
  };
  onClose: () => void;
}) {
  return (
    <div
      className="absolute left-5 top-5 z-30 max-h-[calc(100%-2.5rem)] w-[min(390px,calc(100%-2.5rem))] overflow-y-auto rounded-3xl border p-5 text-white shadow-2xl backdrop-blur"
      style={{
        borderColor: insight.style.border,
        background: 'rgba(2, 6, 23, 0.96)',
        boxShadow: `0 24px 80px ${insight.style.border}33`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className="text-xs font-black uppercase tracking-[0.22em]"
            style={{ color: insight.style.border }}
          >
            {insight.eyebrow}
          </p>

          <h5 className="mt-2 text-lg font-black leading-tight text-white">
            {insight.title}
          </h5>

          <p className="mt-2 text-xs font-semibold leading-5 text-slate-400">
            {insight.subtitle}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-black text-slate-300 hover:bg-slate-800"
        >
          Close
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {insight.rows.map((item) => (
          <div
            key={`${item.label}-${item.value}`}
            className="rounded-2xl border border-slate-700 bg-slate-900/80 p-3"
          >
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              {item.label}
            </p>

            <p className="mt-1 text-sm font-black text-white">
              {item.value}
            </p>

            <p className="mt-1 text-sm leading-5 text-slate-300">
              {item.helper}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-4 rounded-2xl border border-slate-800 bg-slate-950 p-3 text-xs font-semibold leading-5 text-slate-400">
        {insight.footer}
      </p>
    </div>
  );
}

function ShortcutMetric({
  label,
  value,
  helper,
  onClick,
}: {
  label: string;
  value: string | number;
  helper: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-slate-700 bg-slate-950 p-4 text-center shadow-sm transition hover:-translate-y-1 hover:border-blue-500/70 hover:bg-blue-950/30"
    >
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-3 text-4xl font-black leading-none text-white">
        {value}
      </p>

      <p className="mt-2 text-xs font-semibold text-blue-200">
        {helper}
      </p>
    </button>
  );
}