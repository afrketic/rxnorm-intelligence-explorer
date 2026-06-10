import { useMemo, useState } from 'react';
import { DrugCard } from '../lib/api';

type RelationshipItem = {
  source_rxcui?: string;
  related_rxcui?: string;
  related_name?: string;
  related_tty?: string;
  tty?: string;
  relationship_type?: string;
  relationship_source?: string;
  rela?: string;
  rela_source?: string;
  name?: string;
};

type RelationshipBuckets = {
  ingredients?: RelationshipItem[];
  tradenames?: RelationshipItem[];
  dose_forms?: RelationshipItem[];
  related_concepts?: RelationshipItem[];
  counts?: {
    ingredients?: number;
    tradenames?: number;
    dose_forms?: number;
    related_concepts?: number;
    raw_relationship_rows?: number;
  };
};

type KnowledgeGraphDrug = DrugCard & {
  relationships?: RelationshipBuckets;
  graph?: {
    nodes?: unknown[];
    edges?: unknown[];
  };
  classifications?: Record<string, unknown[]>;
  scorecard?: Record<string, any>;
  drug?: Record<string, any>;
};

type ExplorerBucket = 'ingredients' | 'tradenames' | 'dose_forms' | 'related_concepts';

const BUCKET_LABELS: Record<ExplorerBucket, string> = {
  ingredients: 'Ingredients',
  tradenames: 'Trade Names',
  dose_forms: 'Dose Forms',
  related_concepts: 'Related Concepts',
};

function getRelationshipValue(item: RelationshipItem, keys: string[]) {
  for (const key of keys) {
    const value = (item as any)?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value);
    }
  }
  return '-';
}

function getDrugName(drug: KnowledgeGraphDrug | null) {
  return (
    drug?.display_name ||
    drug?.name ||
    drug?.drug?.display_name ||
    drug?.drug?.name ||
    drug?.rxnorm_name ||
    'This medication'
  );
}

function getClassificationCount(drug: KnowledgeGraphDrug | null) {
  const classifications = drug?.classifications || {};
  return Object.values(classifications).reduce((sum, value) => {
    return sum + (Array.isArray(value) ? value.length : 0);
  }, 0);
}

function getClassificationBucketCount(drug: KnowledgeGraphDrug | null, bucket: string) {
  const values = drug?.classifications?.[bucket];
  return Array.isArray(values) ? values.length : 0;
}

function scoreFromCounts(params: {
  nodeCount: number;
  relationshipCount: number;
  classificationCount: number;
  atcConnections: number;
  diseaseConnections: number;
  semanticDomains: number;
}) {
  const nodeScore = Math.min(24, params.nodeCount * 0.12);
  const relationshipScore = Math.min(28, params.relationshipCount * 0.18);
  const classificationScore = Math.min(18, params.classificationCount * 0.3);
  const atcScore = Math.min(12, params.atcConnections * 3);
  const diseaseScore = Math.min(10, params.diseaseConnections * 1.2);
  const domainScore = Math.min(8, params.semanticDomains * 1.4);
  return Math.max(35, Math.min(99, Math.round(nodeScore + relationshipScore + classificationScore + atcScore + diseaseScore + domainScore)));
}

function getScoreTier(score: number) {
  if (score >= 90) return 'Graph Intelligence Ready';
  if (score >= 80) return 'Strong Semantic Graph';
  if (score >= 70) return 'Operational Graph Ready';
  if (score >= 60) return 'Developing Graph Coverage';
  return 'Foundational Graph Coverage';
}

function SectionLabel({ children }: { children: string }) {
  return <p className="text-xs font-black uppercase tracking-[0.38em] text-cyan-300">{children}</p>;
}

function MiniStat({ label, value, subtext }: { label: string; value: string | number; subtext?: string }) {
  return (
    <div className="rounded-2xl border border-blue-900/40 bg-slate-950/60 p-4 shadow-inner shadow-blue-950/20">
      <div className="text-2xl font-black text-white">{value}</div>
      <div className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{label}</div>
      {subtext && <div className="mt-2 text-xs leading-5 text-slate-500">{subtext}</div>}
    </div>
  );
}

function CategoryRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.max(8, Math.min(100, Math.round((value / max) * 100))) : 8;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-bold text-white">{label}</span>
        <span className="font-black text-cyan-200">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function GraphVisual({ score }: { score: number }) {
  const nodes = [
    { x: 50, y: 50, r: 18, label: 'RxCUI', fill: '#2563eb' },
    { x: 22, y: 24, r: 10, label: 'ATC', fill: '#06b6d4' },
    { x: 78, y: 22, r: 10, label: 'NDC', fill: '#22c55e' },
    { x: 20, y: 76, r: 10, label: 'MOA', fill: '#a855f7' },
    { x: 80, y: 76, r: 10, label: 'EPC', fill: '#f59e0b' },
    { x: 50, y: 88, r: 9, label: 'DS', fill: '#fb7185' },
  ];

  return (
    <div className="rounded-3xl border border-cyan-900/50 bg-gradient-to-br from-slate-950 via-blue-950/30 to-slate-950 p-5 shadow-xl shadow-blue-950/30">
      <div className="flex items-start justify-between gap-4">
        <div>
          <SectionLabel>Interactive Graph</SectionLabel>
          <h4 className="mt-2 text-xl font-black text-white">Semantic Connectivity Map</h4>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Executive graph view of the selected medication and its highest-value semantic domains.
          </p>
        </div>
        <div className="rounded-2xl border border-cyan-700/40 bg-cyan-950/30 px-4 py-3 text-right">
          <div className="text-2xl font-black text-white">{score}</div>
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Graph Score</div>
        </div>
      </div>

      <div className="mt-5 h-72 rounded-3xl border border-slate-800 bg-slate-950/80 p-4">
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <defs>
            <linearGradient id="kgEdge" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.75" />
              <stop offset="55%" stopColor="#3b82f6" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.65" />
            </linearGradient>
            <filter id="kgGlow">
              <feGaussianBlur stdDeviation="1.2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {nodes.slice(1).map((node) => (
            <line
              key={`edge-${node.label}`}
              x1="50"
              y1="50"
              x2={node.x}
              y2={node.y}
              stroke="url(#kgEdge)"
              strokeWidth="1.4"
              strokeLinecap="round"
              opacity="0.8"
            />
          ))}
          <circle cx="50" cy="50" r="30" fill="none" stroke="#1e40af" strokeDasharray="2 4" opacity="0.55" />
          <circle cx="50" cy="50" r="42" fill="none" stroke="#0e7490" strokeDasharray="1 6" opacity="0.35" />
          {nodes.map((node) => (
            <g key={node.label} filter="url(#kgGlow)">
              <circle cx={node.x} cy={node.y} r={node.r} fill={node.fill} opacity="0.88" />
              <circle cx={node.x} cy={node.y} r={node.r} fill="none" stroke="#e0f2fe" strokeOpacity="0.4" strokeWidth="0.8" />
              <text x={node.x} y={node.y + 1.3} textAnchor="middle" fontSize={node.r > 12 ? 5 : 4} fontWeight="800" fill="white">
                {node.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

function ExplorerCard({ title, item }: { title: string; item: RelationshipItem }) {
  const relatedName = getRelationshipValue(item, ['related_name', 'name']);
  const relatedRxcui = getRelationshipValue(item, ['related_rxcui']);
  const sourceRxcui = getRelationshipValue(item, ['source_rxcui']);
  const tty = getRelationshipValue(item, ['related_tty', 'tty']);
  const relationshipType = getRelationshipValue(item, ['relationship_type', 'rela']);
  const relationshipSource = getRelationshipValue(item, ['relationship_source', 'rela_source']);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="text-sm font-black text-white">{relatedName}</div>
      <div className="mt-3 grid gap-2 text-xs text-slate-400 md:grid-cols-2">
        <div><span className="font-bold text-slate-300">Source RxCUI:</span> {sourceRxcui}</div>
        <div><span className="font-bold text-slate-300">Related RxCUI:</span> {relatedRxcui}</div>
        <div><span className="font-bold text-slate-300">TTY:</span> {tty}</div>
        <div><span className="font-bold text-slate-300">Relationship:</span> {relationshipType}</div>
        <div className="md:col-span-2"><span className="font-bold text-slate-300">Source:</span> {relationshipSource}</div>
      </div>
    </div>
  );
}

export default function RelationshipPanel({
  drug,
}: {
  drug: KnowledgeGraphDrug | null;
}) {
  const [activeExplorer, setActiveExplorer] = useState<ExplorerBucket | null>(null);

  const relationships: RelationshipBuckets = drug?.relationships || {};
  const ingredients = relationships.ingredients || [];
  const tradenames = relationships.tradenames || [];
  const doseForms = relationships.dose_forms || [];
  const relatedConcepts = relationships.related_concepts || [];

  const relationshipCount = relationships.counts?.raw_relationship_rows ??
    ingredients.length + tradenames.length + doseForms.length + relatedConcepts.length;

  const nodeCount = drug?.graph?.nodes?.length ||
    ingredients.length + tradenames.length + doseForms.length + relatedConcepts.length + 1;
  const edgeCount = drug?.graph?.edges?.length || relationshipCount;
  const classificationCount = getClassificationCount(drug);
  const atcConnections = ['ATC1', 'ATC2', 'ATC3', 'ATC4', 'ATC5'].reduce(
    (sum, key) => sum + getClassificationBucketCount(drug, key),
    0
  );
  const diseaseConnections = getClassificationBucketCount(drug, 'DISEASE');
  const semanticDomains = [
    ingredients.length,
    tradenames.length,
    doseForms.length,
    relatedConcepts.length,
    classificationCount,
    diseaseConnections,
  ].filter((count) => count > 0).length;

  const graphScore = scoreFromCounts({
    nodeCount,
    relationshipCount,
    classificationCount,
    atcConnections,
    diseaseConnections,
    semanticDomains,
  });
  const tier = getScoreTier(graphScore);
  const drugName = getDrugName(drug);

  const categoryCounts: Array<{ id: ExplorerBucket; label: string; value: number; items: RelationshipItem[] }> = [
    { id: 'ingredients', label: 'Ingredients', value: ingredients.length, items: ingredients },
    { id: 'tradenames', label: 'Trade Names', value: tradenames.length, items: tradenames },
    { id: 'dose_forms', label: 'Dose Forms', value: doseForms.length, items: doseForms },
    { id: 'related_concepts', label: 'Related Concepts', value: relatedConcepts.length, items: relatedConcepts },
  ];
  const maxCategory = Math.max(...categoryCounts.map((item) => item.value), 1);
  const activeItems = activeExplorer ? categoryCounts.find((item) => item.id === activeExplorer)?.items || [] : [];
  const shownItems = activeItems.slice(0, 12);

  const assessment = `${drugName} demonstrates strong semantic connectivity across RxNorm concepts, therapeutic classifications, relationship categories, and related medication entities. The medication is suitable for semantic search, knowledge graph expansion, clinical AI systems, and interoperability workflows.`;

  return (
    <section className="space-y-5 text-white">
      <div className="rounded-3xl border border-blue-900/50 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950/70 p-6 shadow-2xl shadow-blue-950/30 md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-center">
          <div>
            <SectionLabel>Knowledge Graph Intelligence</SectionLabel>
            <h3 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
              Knowledge Graph Intelligence
            </h3>
            <p className="mt-5 max-w-4xl text-lg leading-8 text-slate-300">
              {drugName} demonstrates strong semantic connectivity across RxNorm concepts, therapeutic classifications,
              disease mappings, and related medication entities.
            </p>
          </div>

          <div className="rounded-3xl border border-cyan-700/40 bg-cyan-950/20 p-6 shadow-xl shadow-cyan-950/30">
            <p className="text-xs font-black uppercase tracking-[0.34em] text-cyan-200">Knowledge Graph Readiness</p>
            <div className="mt-4 flex items-end gap-2">
              <span className="text-6xl font-black tracking-tight text-white">{graphScore}</span>
              <span className="pb-2 text-2xl font-black text-slate-400">/ 100</span>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500"
                style={{ width: `${graphScore}%` }}
              />
            </div>
            <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center text-sm font-black text-emerald-200">
              {tier}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-6">
        <MiniStat label="Nodes" value={nodeCount} subtext="Graph concepts" />
        <MiniStat label="Relationships" value={relationshipCount} subtext="Semantic links" />
        <MiniStat label="Classifications" value={classificationCount} subtext="Mapped domains" />
        <MiniStat label="ATC Connections" value={atcConnections} subtext="Hierarchy depth" />
        <MiniStat label="Disease Connections" value={diseaseConnections} subtext="Clinical mappings" />
        <MiniStat label="Semantic Domains" value={semanticDomains} subtext="Connected areas" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1.15fr]">
        <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 shadow-xl shadow-blue-950/20">
          <SectionLabel>Top Relationship Categories</SectionLabel>
          <div className="mt-5 space-y-5">
            {categoryCounts.map((item) => (
              <CategoryRow key={item.id} label={item.label} value={item.value} max={maxCategory} />
            ))}
          </div>
        </div>

        <GraphVisual score={graphScore} />
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl shadow-blue-950/20">
        <SectionLabel>Graph Intelligence Assessment</SectionLabel>
        <h4 className="mt-3 text-2xl font-black text-white">Semantic Connectivity Assessment</h4>
        <p className="mt-4 max-w-6xl text-base leading-8 text-slate-300">{assessment}</p>
      </div>

      <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950/40 p-6 shadow-xl shadow-blue-950/20">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <SectionLabel>Relationship Explorer</SectionLabel>
            <h4 className="mt-3 text-2xl font-black text-white">Open details only when needed</h4>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              The dashboard stays executive by default. Expand a category only when you want row-level relationship evidence.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {categoryCounts.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveExplorer(activeExplorer === item.id ? null : item.id)}
                className={`rounded-2xl border px-4 py-3 text-sm font-black transition ${
                  activeExplorer === item.id
                    ? 'border-cyan-400 bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-950/40'
                    : 'border-slate-700 bg-slate-950/70 text-slate-300 hover:border-cyan-500 hover:text-cyan-200'
                }`}
              >
                View {item.label}
              </button>
            ))}
          </div>
        </div>

        {activeExplorer && (
          <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
            <div className="mb-4 flex flex-col justify-between gap-2 md:flex-row md:items-center">
              <div>
                <h5 className="text-xl font-black text-white">{BUCKET_LABELS[activeExplorer]}</h5>
                <p className="mt-1 text-sm text-slate-400">
                  Showing {shownItems.length} of {activeItems.length} relationships to keep the dashboard concise.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveExplorer(null)}
                className="rounded-full border border-slate-700 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-slate-300 hover:border-cyan-500 hover:text-cyan-200"
              >
                Collapse
              </button>
            </div>

            {shownItems.length === 0 ? (
              <p className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-400">
                No relationships found for this category.
              </p>
            ) : (
              <div className="grid gap-3 xl:grid-cols-2">
                {shownItems.map((item, index) => (
                  <ExplorerCard key={`${activeExplorer}-${index}-${getRelationshipValue(item, ['related_rxcui', 'related_name', 'name'])}`} title={BUCKET_LABELS[activeExplorer]} item={item} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
