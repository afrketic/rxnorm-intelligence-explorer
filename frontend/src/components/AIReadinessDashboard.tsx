import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DrugCard } from '../lib/api';

type ReadinessPayload = {
  rxcui: string;
  display_name?: string;
  scores?: {
    interoperability_readiness_score?: number;
    claims_readiness_score?: number;
    ai_readiness_score?: number;
    overall_readiness_score?: number;
  };
  percentiles?: {
    interoperability_percentile?: number;
    claims_percentile?: number;
    ai_percentile?: number;
    overall_readiness_percentile?: number;
  };
  tier?: string;
  drivers?: {
    interoperability?: Record<string, number>;
    claims?: Record<string, number>;
    ai?: Record<string, number>;
  };
  methodology?: Record<string, any>;
};

type ExplainabilityPayload = {
  rxcui: string;
  display_name?: string;
  explainability?: {
    explainability_score?: number;
    explainability_tier?: string;
    positive_driver_count?: number;
    limiting_factor_count?: number;
    executive_narrative?: string;
    recommended_action?: string;
  };
  scores?: Record<string, number>;
  reasons?: Array<Record<string, any>>;
  methodology?: Record<string, any>;
};

type ConfidencePayload = {
  rxcui: string;
  display_name?: string;
  confidence_score?: number;
  confidence_percentile?: number;
  confidence_tier?: string;
  components?: {
    evidence_strength_score?: number;
    explainability_confidence_score?: number;
    benchmark_reliability_score?: number;
    readiness_stability_score?: number;
  };
  methodology?: Record<string, any>;
};

type PcaPayload = {
  rxcui: string;
  display_name?: string;
  pca?: {
    pca_component_1_score?: number;
    pca_component_2_score?: number;
    pca_component_3_score?: number;
    pca_overall_score?: number;
    pca_percentile?: number;
    pca_tier?: string;
  };
  comparison?: {
    expert_overall_readiness_score?: number;
    overall_intelligence_score?: number;
    confidence_score?: number;
    pca_vs_expert_delta?: number;
  };
  model_summary?: Array<Record<string, any>>;
  methodology?: Record<string, any>;
};

type MethodologyPayload = {
  rxcui: string;
  display_name?: string;
  methodology_scores?: {
    intelligence_score?: number;
    readiness_score?: number;
    confidence_score?: number;
    pca_score?: number;
  };
  consensus?: {
    consensus_score?: number;
    consensus_percentile?: number;
    consensus_tier?: string;
    methodology_agreement_score?: number;
    methodology_spread?: number;
    methodology_min_score?: number;
    methodology_max_score?: number;
  };
  methodology?: Record<string, any>;
};

type MethodologySelectionPayload = {
  rxcui: string;
  display_name?: string;
  selection?: {
    methodology_selection_rank?: number;
    winning_methodology?: string;
    methodology_selection_score?: number;
    methodology_selection_percentile?: number;
    methodology_selection_tier?: string;
    selection_confidence?: number;
    winner_margin?: number;
    selection_reason?: string;
  };
  method_scores?: Record<string, number>;
  selection_scores?: Record<string, number>;
  validation_signals?: Record<string, number>;
  reason_codes?: Array<Record<string, any>>;
  methodology?: Record<string, any>;
};

type CopilotPayload = {
  rxcui: string;
  display_name?: string;
  copilot?: {
    ai_copilot_rank?: number;
    ai_copilot_score?: number;
    ai_copilot_percentile?: number;
    ai_copilot_tier?: string;
    recommended_prompt?: string;
  };
  summaries?: {
    executive_summary?: string;
    technical_summary?: string;
    strategic_summary?: string;
  };
  scores?: Record<string, number>;
  questions?: Array<Record<string, any>>;
  methodology?: Record<string, any>;
};

type EndpointKey =
  | 'readiness'
  | 'explainability'
  | 'confidence'
  | 'pca'
  | 'methodology'
  | 'methodologySelection'
  | 'copilot';

type EndpointState = {
  readiness?: ReadinessPayload;
  explainability?: ExplainabilityPayload;
  confidence?: ConfidencePayload;
  pca?: PcaPayload;
  methodology?: MethodologyPayload;
  methodologySelection?: MethodologySelectionPayload;
  copilot?: CopilotPayload;
};

type EndpointErrorState = Partial<Record<EndpointKey, string>>;

type Props = {
  drug: (DrugCard & Record<string, any>) | null;
};

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'http://127.0.0.1:8000';

const ENDPOINTS: Array<{ key: EndpointKey; path: string; label: string }> = [
  { key: 'readiness', path: 'readiness', label: 'Readiness' },
  { key: 'explainability', path: 'explainability', label: 'Explainability' },
  { key: 'confidence', path: 'confidence', label: 'Confidence' },
  { key: 'pca', path: 'pca', label: 'PCA' },
  { key: 'methodology', path: 'methodology', label: 'Methodology consensus' },
  { key: 'methodologySelection', path: 'methodology-selection', label: 'Methodology selection' },
  { key: 'copilot', path: 'copilot', label: 'AI copilot' },
];

function toNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function boundedScore(value: unknown, fallback = 0) {
  return Math.max(0, Math.min(100, toNumber(value, fallback)));
}

function formatScore(value: unknown) {
  return boundedScore(value).toFixed(1);
}

function formatPercent(value: unknown) {
  return `${boundedScore(value).toFixed(1)}%`;
}

function getDisplayName(drug: Props['drug'], data: EndpointState) {
  return (
    data.readiness?.display_name ||
    data.explainability?.display_name ||
    data.confidence?.display_name ||
    data.pca?.display_name ||
    data.methodology?.display_name ||
    data.methodologySelection?.display_name ||
    data.copilot?.display_name ||
    drug?.display_name ||
    drug?.rxnorm_name ||
    drug?.drug_name ||
    drug?.name ||
    'This medication'
  );
}

function getTier(score: number) {
  if (score >= 92) return 'Enterprise AI Ready';
  if (score >= 85) return 'Advanced AI Ready';
  if (score >= 75) return 'Operationally AI Ready';
  if (score >= 60) return 'Developing AI Readiness';
  return 'Foundational AI Readiness';
}

function getTierClass(score: number) {
  if (score >= 92) return 'border-cyan-300 bg-cyan-950 text-cyan-100';
  if (score >= 85) return 'border-blue-300 bg-blue-950 text-blue-100';
  if (score >= 75) return 'border-emerald-300 bg-emerald-950 text-emerald-100';
  if (score >= 60) return 'border-amber-300 bg-amber-950 text-amber-100';
  return 'border-slate-500 bg-slate-900 text-slate-200';
}

function statusForScore(score: number) {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Strong';
  if (score >= 70) return 'Moderate';
  if (score >= 55) return 'Developing';
  return 'Limited';
}

function average(values: number[]) {
  const clean = values.filter((value) => Number.isFinite(value) && value > 0);
  if (!clean.length) return 0;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function objectAverage(record?: Record<string, number>) {
  if (!record) return 0;
  return average(Object.values(record).map((value) => boundedScore(value)));
}

function buildAiScore(data: EndpointState, drug: Props['drug']) {
  const readinessAi = boundedScore(data.readiness?.scores?.ai_readiness_score);
  const explainabilityScore = boundedScore(data.explainability?.explainability?.explainability_score);
  const confidenceScore = boundedScore(data.confidence?.confidence_score);
  const pcaScore = boundedScore(data.pca?.pca?.pca_overall_score);
  const consensusScore = boundedScore(data.methodology?.consensus?.consensus_score);
  const selectionScore = boundedScore(data.methodologySelection?.selection?.methodology_selection_score);
  const copilotScore = boundedScore(data.copilot?.copilot?.ai_copilot_score);
  const semanticRichness = boundedScore(
    data.explainability?.scores?.semantic_richness_score ||
      data.explainability?.scores?.semantic_richness ||
      drug?.semantic_richness_score ||
      drug?.semantic_score ||
      objectAverage(data.readiness?.drivers?.ai),
  );
  const knowledgeDensity = boundedScore(
    data.explainability?.scores?.graph_connectivity_score ||
      data.explainability?.scores?.relationship_density_score ||
      drug?.relationship_density_score ||
      drug?.knowledge_graph_score ||
      average([readinessAi, pcaScore, consensusScore]),
  );
  const classificationCoverage = boundedScore(
    data.explainability?.scores?.classification_coverage_score ||
      data.explainability?.scores?.classification_score ||
      drug?.classification_coverage_score ||
      drug?.classification_score ||
      average([readinessAi, semanticRichness]),
  );

  const weighted =
    readinessAi * 0.28 +
    explainabilityScore * 0.18 +
    confidenceScore * 0.14 +
    pcaScore * 0.1 +
    consensusScore * 0.1 +
    selectionScore * 0.08 +
    copilotScore * 0.07 +
    semanticRichness * 0.03 +
    knowledgeDensity * 0.01 +
    classificationCoverage * 0.01;

  return {
    finalScore: boundedScore(weighted || average([readinessAi, explainabilityScore, confidenceScore, pcaScore, consensusScore, selectionScore, copilotScore])),
    readinessAi,
    explainabilityScore,
    confidenceScore,
    pcaScore,
    consensusScore,
    selectionScore,
    copilotScore,
    semanticRichness,
    knowledgeDensity,
    classificationCoverage,
  };
}

function buildNarrative(name: string, metrics: ReturnType<typeof buildAiScore>, data: EndpointState) {
  const tier = getTier(metrics.finalScore);
  const winningMethodology = data.methodologySelection?.selection?.winning_methodology || 'the selected methodology';
  const copilotTier = data.copilot?.copilot?.ai_copilot_tier || 'copilot-ready';

  return `${name} receives a ${tier} profile with an AI Readiness Score of ${formatScore(
    metrics.finalScore,
  )}/100. The score is computed from the live readiness, explainability, confidence, PCA, methodology consensus, methodology selection, and AI copilot engines. The strongest production signals are ${statusForScore(
    metrics.readinessAi,
  ).toLowerCase()} AI readiness, ${statusForScore(metrics.explainabilityScore).toLowerCase()} explainability, ${statusForScore(
    metrics.confidenceScore,
  ).toLowerCase()} confidence, and ${statusForScore(metrics.copilotScore).toLowerCase()} copilot readiness. ${winningMethodology.toUpperCase()} is currently the recommended scoring methodology, while the copilot layer classifies the medication as ${copilotTier}.`;
}

async function loadEndpoint<T>(path: string, rxcui: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/${path}/${encodeURIComponent(rxcui)}`);
  if (!response.ok) throw new Error(`${path} request failed with status ${response.status}`);
  return (await response.json()) as T;
}

export default function AIReadinessDashboard({ drug }: Props) {
  const [data, setData] = useState<EndpointState>({});
  const [errors, setErrors] = useState<EndpointErrorState>({});
  const [loading, setLoading] = useState(false);

  const rxcui = drug?.rxcui;

  useEffect(() => {
    if (!rxcui) return;

    let active = true;

    async function loadProductionSignals() {
      setLoading(true);
      setErrors({});

      const results = await Promise.allSettled([
        loadEndpoint<ReadinessPayload>('readiness', rxcui),
        loadEndpoint<ExplainabilityPayload>('explainability', rxcui),
        loadEndpoint<ConfidencePayload>('confidence', rxcui),
        loadEndpoint<PcaPayload>('pca', rxcui),
        loadEndpoint<MethodologyPayload>('methodology', rxcui),
        loadEndpoint<MethodologySelectionPayload>('methodology-selection', rxcui),
        loadEndpoint<CopilotPayload>('copilot', rxcui),
      ]);

      if (!active) return;

      const nextData: EndpointState = {};
      const nextErrors: EndpointErrorState = {};

      results.forEach((result, index) => {
        const endpoint = ENDPOINTS[index];
        if (result.status === 'fulfilled') {
          (nextData as Record<EndpointKey, unknown>)[endpoint.key] = result.value;
        } else {
          nextErrors[endpoint.key] = result.reason instanceof Error ? result.reason.message : `${endpoint.label} unavailable`;
        }
      });

      setData(nextData);
      setErrors(nextErrors);
      setLoading(false);
    }

    loadProductionSignals();

    return () => {
      active = false;
    };
  }, [rxcui]);

  const metrics = useMemo(() => buildAiScore(data, drug), [data, drug]);
  const displayName = useMemo(() => getDisplayName(drug, data), [drug, data]);
  const narrative = useMemo(() => buildNarrative(displayName, metrics, data), [displayName, metrics, data]);

  const componentRows = useMemo(
    () => [
      { component: 'AI Readiness', score: metrics.readinessAi },
      { component: 'Explainability', score: metrics.explainabilityScore },
      { component: 'Confidence', score: metrics.confidenceScore },
      { component: 'PCA', score: metrics.pcaScore },
      { component: 'Consensus', score: metrics.consensusScore },
      { component: 'Method Selection', score: metrics.selectionScore },
      { component: 'Copilot', score: metrics.copilotScore },
    ],
    [metrics],
  );

  const modelRows = useMemo(
    () => [
      { label: 'Semantic Richness', value: metrics.semanticRichness, note: 'Language-model context depth' },
      { label: 'Knowledge Density', value: metrics.knowledgeDensity, note: 'Graph and relationship strength' },
      { label: 'Classification Coverage', value: metrics.classificationCoverage, note: 'ATC, disease, MOA, EPC structure' },
      { label: 'LLM Compatibility', value: average([metrics.explainabilityScore, metrics.semanticRichness, metrics.copilotScore]), note: 'Copilot and retrieval suitability' },
      { label: 'Methodology Stability', value: average([metrics.pcaScore, metrics.consensusScore, metrics.selectionScore]), note: 'Agreement across scoring methods' },
      { label: 'Trust Layer', value: average([metrics.confidenceScore, metrics.explainabilityScore]), note: 'Interpretability and evidence strength' },
    ],
    [metrics],
  );

  const loadedCount = Object.keys(data).length;
  const errorCount = Object.keys(errors).length;

  if (!drug) return null;

  return (
    <section className="overflow-hidden rounded-3xl border border-blue-900/40 bg-slate-950/85 shadow-sm shadow-blue-950/30">
      <div className="bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-950 p-7 text-white">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-indigo-200">
              Sprint 4B · AI Readiness Dashboard
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight">AI Readiness Dashboard</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Production assessment of medication suitability for LLM retrieval, semantic search,
              explainable AI, copilot workflows, and model governance.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-950/80/10 px-6 py-5 text-right backdrop-blur">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-300">AI Readiness Score</p>
            <p className="mt-1 text-5xl font-black text-white">{formatScore(metrics.finalScore)}</p>
            <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-black ${getTierClass(metrics.finalScore)}`}>
              {getTier(metrics.finalScore)}
            </span>
          </div>
        </div>
      </div>

      <div className="p-7">
        {loading && (
          <div className="mb-5 rounded-2xl border border-blue-900/50 bg-blue-950/50 p-4 text-sm font-semibold text-blue-200">
            Loading production AI readiness signals…
          </div>
        )}

        {!loading && errorCount > 0 && (
          <div className="mb-5 rounded-2xl border border-amber-800 bg-amber-950/40 p-4 text-sm text-amber-100">
            <p className="font-black">Partial AI readiness profile loaded.</p>
            <p className="mt-1 font-semibold">
              {loadedCount} production signal{loadedCount === 1 ? '' : 's'} loaded; {errorCount} endpoint{errorCount === 1 ? '' : 's'} unavailable.
            </p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile label="AI Readiness" value={metrics.readinessAi} source="/readiness" />
          <MetricTile label="Explainability" value={metrics.explainabilityScore} source="/explainability" />
          <MetricTile label="Confidence" value={metrics.confidenceScore} source="/confidence" />
          <MetricTile label="AI Copilot" value={metrics.copilotScore} source="/copilot" />
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_0.85fr]">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm shadow-blue-950/30">
            <h3 className="text-base font-black text-white">Production Signal Comparison</h3>
            <p className="mt-1 text-sm text-slate-400">
              Scores are loaded from the live platform engines and combined into the final AI Readiness Score.
            </p>
            <div className="mt-5 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={componentRows}>
                  <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                  <XAxis dataKey="component" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis domain={[0, 100]}  tick={{ fill: "#94a3b8" }} />
                  <Tooltip formatter={(value) => formatScore(value)} contentStyle={{ backgroundColor: "#020617", border: "1px solid #1e3a8a", borderRadius: "16px", color: "#e2e8f0" }} labelStyle={{ color: "#bfdbfe" }} />
                  <Bar dataKey="score" name="Score" radius={[10, 10, 0, 0]}  fill="#38bdf8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-sm shadow-blue-950/30">
            <h3 className="text-base font-black text-white">AI Intelligence Assessment</h3>
            <p className="mt-3 text-sm leading-6 text-slate-300">{narrative}</p>
            <div className="mt-5 grid gap-3">
              <MetaRow label="Loaded engines" value={`${loadedCount} / ${ENDPOINTS.length}`} />
              <MetaRow label="Readiness percentile" value={formatPercent(data.readiness?.percentiles?.ai_percentile)} />
              <MetaRow label="Consensus tier" value={data.methodology?.consensus?.consensus_tier || '—'} />
              <MetaRow label="Winning method" value={data.methodologySelection?.selection?.winning_methodology || '—'} />
              <MetaRow label="Copilot tier" value={data.copilot?.copilot?.ai_copilot_tier || '—'} />
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {modelRows.map((row) => (
            <SignalTile key={row.label} label={row.label} value={row.value} note={row.note} />
          ))}
        </div>

        <div className="mt-5 rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm shadow-blue-950/30">
          <h3 className="text-base font-black text-white">Why This Matters</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            AI-ready medication records need strong semantic richness, transparent scoring, stable methodology,
            confidence support, graph connectivity, and copilot-ready summaries. This dashboard consolidates the
            platform’s actual production engines into one executive AI readiness lens.
          </p>
        </div>
      </div>
    </section>
  );
}

function MetricTile({ label, value, source }: { label: string; value: number; source: string }) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-sm shadow-blue-950/30">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-4xl font-black text-white">{formatScore(value)}</p>
      <p className="mt-2 text-xs font-semibold text-slate-400">Source: {source}</p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full bg-slate-950" style={{ width: `${boundedScore(value)}%` }} />
      </div>
    </div>
  );
}

function SignalTile({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm shadow-blue-950/30">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-white">{label}</p>
          <p className="mt-1 text-xs font-semibold text-slate-400">{note}</p>
        </div>
        <span className="rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1 text-xs font-black text-slate-300">
          {statusForScore(value)}
        </span>
      </div>
      <p className="mt-4 text-3xl font-black text-white">{formatScore(value)}</p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full bg-blue-600" style={{ width: `${boundedScore(value)}%` }} />
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3">
      <span className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</span>
      <span className="text-right text-sm font-black text-white">{value}</span>
    </div>
  );
}
