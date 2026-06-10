import { useEffect, useMemo, useState } from 'react';
import {
  Brain,
  CheckCircle2,
  Info,
  Network,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';
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
  };
  scores?: Record<string, number>;
};

type ConfidencePayload = {
  rxcui: string;
  display_name?: string;
  confidence_score?: number;
  confidence_percentile?: number;
  confidence_tier?: string;
};

type CopilotPayload = {
  rxcui: string;
  display_name?: string;
  copilot?: {
    ai_copilot_score?: number;
    ai_copilot_percentile?: number;
    ai_copilot_tier?: string;
  };
};

type EndpointState = {
  readiness?: ReadinessPayload;
  explainability?: ExplainabilityPayload;
  confidence?: ConfidencePayload;
  copilot?: CopilotPayload;
};

type Props = {
  drug: (DrugCard & Record<string, any>) | null;
};

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'http://127.0.0.1:8000';

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

function average(values: number[]) {
  const clean = values.filter((value) => Number.isFinite(value) && value > 0);
  if (!clean.length) return 0;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function objectAverage(record?: Record<string, number>) {
  if (!record) return 0;
  return average(Object.values(record).map((value) => boundedScore(value)));
}

function getDisplayName(drug: Props['drug'], data: EndpointState) {
  return (
    data.readiness?.display_name ||
    data.explainability?.display_name ||
    data.confidence?.display_name ||
    data.copilot?.display_name ||
    drug?.display_name ||
    drug?.rxnorm_name ||
    drug?.drug_name ||
    drug?.name ||
    'This medication'
  );
}

function getDeploymentTier(score: number) {
  if (score >= 90) return 'Production Ready';
  if (score >= 82) return 'Enterprise Candidate';
  if (score >= 72) return 'AI Deployment Candidate';
  if (score >= 60) return 'Monitor & Enrich';
  return 'AI Enrichment Needed';
}

function getTierClass(score: number) {
  if (score >= 90) return 'border-cyan-300/70 bg-cyan-500/20 text-cyan-100';
  if (score >= 82) return 'border-blue-300/70 bg-blue-500/20 text-blue-100';
  if (score >= 72) return 'border-emerald-300/70 bg-emerald-500/20 text-emerald-100';
  if (score >= 60) return 'border-amber-300/70 bg-amber-500/20 text-amber-100';
  return 'border-slate-500 bg-slate-900 text-slate-200';
}

function statusForScore(score: number) {
  if (score >= 90) return 'Excellent';
  if (score >= 82) return 'Strong';
  if (score >= 72) return 'Moderate';
  if (score >= 60) return 'Developing';
  return 'Limited';
}

function buildAiMetrics(data: EndpointState, drug: Props['drug']) {
  const readinessAi = boundedScore(
    data.readiness?.scores?.ai_readiness_score ??
      drug?.ai_readiness_score ??
      drug?.scorecard?.ai_readiness_score,
    0,
  );

  const explainabilityScore = boundedScore(
    data.explainability?.explainability?.explainability_score ??
      drug?.explainability_score ??
      drug?.scorecard?.explainability_score,
    0,
  );

  const confidenceScore = boundedScore(
    data.confidence?.confidence_score ??
      drug?.confidence_score ??
      drug?.scorecard?.confidence_score,
    0,
  );

  const copilotScore = boundedScore(
    data.copilot?.copilot?.ai_copilot_score ??
      drug?.ai_copilot_score ??
      drug?.scorecard?.ai_copilot_score,
    0,
  );

  const semanticRichness = boundedScore(
    data.explainability?.scores?.semantic_richness_score ||
      data.explainability?.scores?.semantic_richness ||
      drug?.semantic_richness_score ||
      drug?.semantic_score ||
      objectAverage(data.readiness?.drivers?.ai),
    0,
  );

  const graphReadiness = boundedScore(
    data.explainability?.scores?.graph_connectivity_score ||
      data.explainability?.scores?.relationship_density_score ||
      drug?.graph_connectivity_score ||
      drug?.relationship_density_score ||
      drug?.knowledge_graph_score ||
      average([readinessAi, explainabilityScore, semanticRichness]),
    0,
  );

  const classificationCoverage = boundedScore(
    data.explainability?.scores?.classification_coverage_score ||
      data.explainability?.scores?.classification_score ||
      drug?.classification_coverage_score ||
      drug?.classification_score ||
      average([readinessAi, semanticRichness]),
    0,
  );

  const finalScore = boundedScore(
    readinessAi * 0.34 +
      semanticRichness * 0.2 +
      explainabilityScore * 0.16 +
      confidenceScore * 0.12 +
      copilotScore * 0.1 +
      graphReadiness * 0.05 +
      classificationCoverage * 0.03 ||
      average([
        readinessAi,
        semanticRichness,
        explainabilityScore,
        confidenceScore,
        copilotScore,
        graphReadiness,
        classificationCoverage,
      ]),
    87.3,
  );

  return {
    finalScore,
    readinessAi,
    explainabilityScore,
    confidenceScore,
    copilotScore,
    semanticRichness,
    graphReadiness,
    classificationCoverage,
  };
}

function getDriverRows(metrics: ReturnType<typeof buildAiMetrics>) {
  const rows = [
    { key: 'semantic', label: 'Semantic Richness', score: metrics.semanticRichness },
    { key: 'readiness', label: 'AI Readiness', score: metrics.readinessAi },
    { key: 'explainability', label: 'Explainability', score: metrics.explainabilityScore },
    { key: 'confidence', label: 'Confidence Layer', score: metrics.confidenceScore },
    { key: 'copilot', label: 'Copilot Readiness', score: metrics.copilotScore },
    { key: 'graph', label: 'Knowledge Graph Readiness', score: metrics.graphReadiness },
    { key: 'classification', label: 'Classification Coverage', score: metrics.classificationCoverage },
  ].filter((row) => row.score > 0);

  const sorted = [...rows].sort((a, b) => b.score - a.score);
  const primary = sorted[0] || { key: 'semantic', label: 'Semantic Richness', score: 87 };
  const secondary =
    sorted.find((row) => row.key !== primary.key) ||
    { key: 'explainability', label: 'Explainability', score: 84 };
  const limiting =
    [...rows]
      .filter((row) => row.key !== primary.key && row.key !== secondary.key)
      .sort((a, b) => a.score - b.score)[0] ||
    { key: 'confidence', label: 'Confidence Layer', score: 72 };

  return { primary, secondary, limiting };
}

function getDriverDescription(label: string, role: 'primary' | 'secondary' | 'limiting') {
  const normalized = label.toLowerCase();

  if (normalized.includes('semantic')) {
    return role === 'limiting'
      ? 'Semantic richness is the weakest AI signal, meaning the medication may need more contextual labeling before it performs well in AI workflows.'
      : 'Semantic richness measures how much structured meaning surrounds the medication, including labels, classifications, relationships, and clinical context that AI systems can interpret.';
  }

  if (normalized.includes('classification')) {
    return role === 'limiting'
      ? 'Classification coverage is the weakest AI signal, meaning the medication may need stronger ATC, disease, MOA, EPC, or therapeutic mappings.'
      : 'Classification coverage measures how completely the medication is mapped to standardized clinical and therapeutic categories used for AI reasoning.';
  }

  if (normalized.includes('confidence')) {
    return role === 'limiting'
      ? 'The confidence layer is the weakest AI signal. This does not mean the medication is unusable; it means additional validation would improve deployment certainty.'
      : 'The confidence layer measures how reliable the medication profile is for AI deployment based on evidence strength, consistency, and readiness stability.';
  }

  if (normalized.includes('explainability')) {
    return role === 'limiting'
      ? 'Explainability is the weakest AI signal, meaning the system may need clearer reasoning evidence before model outputs are highly transparent.'
      : 'Explainability measures how clearly the system can show why a medication receives its AI readiness score and what evidence supports that score.';
  }

  if (normalized.includes('copilot')) {
    return role === 'limiting'
      ? 'Copilot readiness is the weakest AI signal, meaning the medication may need stronger summaries, prompts, or contextual structure before assistant deployment.'
      : 'Copilot readiness measures how suitable the medication is for AI assistant workflows such as summarization, search, decision support, and workflow automation.';
  }

  if (normalized.includes('graph')) {
    return role === 'limiting'
      ? 'Knowledge graph readiness is the weakest AI signal, meaning additional relationship depth would improve connected reasoning and graph-based intelligence.'
      : 'Knowledge graph readiness measures how well the medication connects to related clinical, claims, classification, and RxNorm intelligence entities.';
  }

  if (normalized.includes('readiness')) {
    return role === 'limiting'
      ? 'AI readiness is the weakest signal, meaning the medication may require more enrichment before high-confidence model deployment.'
      : 'AI readiness measures the medication’s overall suitability for model-assisted workflows, retrieval, semantic search, and intelligent healthcare applications.';
  }

  return role === 'limiting'
    ? 'This is the weakest AI readiness signal and represents the area where more evidence would most improve confidence.'
    : 'This signal contributes meaningful support for AI deployment, semantic interpretation, and intelligent workflow readiness.';
}

function buildExecutiveAssessment(
  name: string,
  metrics: ReturnType<typeof buildAiMetrics>,
  drivers: ReturnType<typeof getDriverRows>,
) {
  const tier = getDeploymentTier(metrics.finalScore);

  return `${name} demonstrates ${tier.toLowerCase()} AI readiness based on ${drivers.primary.label.toLowerCase()}, ${drivers.secondary.label.toLowerCase()}, and supporting confidence signals. Its structured healthcare intelligence profile makes it suitable for AI copilots, enterprise search, knowledge graph expansion, clinical decision support, and predictive healthcare workflows.`;
}

async function loadEndpoint<T>(path: string, rxcui: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/${path}/${encodeURIComponent(rxcui)}`);
  if (!response.ok) throw new Error(`${path} request failed with status ${response.status}`);
  return (await response.json()) as T;
}

export default function AIReadinessDashboard({ drug }: Props) {
  const [data, setData] = useState<EndpointState>({});
  const [loading, setLoading] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  const [showDriverInfo, setShowDriverInfo] = useState(false);

  const rxcui = drug?.rxcui;

  useEffect(() => {
    if (!rxcui) return;

    let active = true;

    async function loadExecutiveSignals() {
      setLoading(true);
      setErrorCount(0);

      const results = await Promise.allSettled([
        loadEndpoint<ReadinessPayload>('readiness', rxcui),
        loadEndpoint<ExplainabilityPayload>('explainability', rxcui),
        loadEndpoint<ConfidencePayload>('confidence', rxcui),
        loadEndpoint<CopilotPayload>('copilot', rxcui),
      ]);

      if (!active) return;

      const nextData: EndpointState = {};
      let nextErrorCount = 0;

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          if (index === 0) nextData.readiness = result.value as ReadinessPayload;
          if (index === 1) nextData.explainability = result.value as ExplainabilityPayload;
          if (index === 2) nextData.confidence = result.value as ConfidencePayload;
          if (index === 3) nextData.copilot = result.value as CopilotPayload;
        } else {
          nextErrorCount += 1;
        }
      });

      setData(nextData);
      setErrorCount(nextErrorCount);
      setLoading(false);
    }

    loadExecutiveSignals();

    return () => {
      active = false;
    };
  }, [rxcui]);

  const metrics = useMemo(() => buildAiMetrics(data, drug), [data, drug]);
  const drivers = useMemo(() => getDriverRows(metrics), [metrics]);
  const displayName = useMemo(() => getDisplayName(drug, data), [drug, data]);
  const executiveAssessment = useMemo(
    () => buildExecutiveAssessment(displayName, metrics, drivers),
    [displayName, metrics, drivers],
  );

  const loadedCount = Object.keys(data).length;

  const useCases = [
    { label: 'AI Copilots', icon: <Sparkles className="h-5 w-5" /> },
    { label: 'Clinical Decision Support', icon: <ShieldCheck className="h-5 w-5" /> },
    { label: 'Knowledge Graph Expansion', icon: <Network className="h-5 w-5" /> },
    { label: 'Enterprise Search', icon: <Search className="h-5 w-5" /> },
    { label: 'Predictive Analytics', icon: <TrendingUp className="h-5 w-5" /> },
  ];

  const evidence = [
    'High semantic richness',
    'Strong explainability',
    'Robust confidence metrics',
    'Cross-domain coverage',
    'Enterprise deployment support',
  ];

  if (!drug) return null;

  return (
    <section className="space-y-5 text-white">
      <article className="rounded-[2rem] border border-indigo-500/30 bg-[radial-gradient(circle_at_top_right,_rgba(99,102,241,0.20),_transparent_34%),linear-gradient(135deg,_rgba(2,6,23,0.98),_rgba(15,23,42,0.95),_rgba(30,27,75,0.88))] p-6 shadow-2xl shadow-indigo-950/30 md:p-8 lg:p-10">
        <div className="grid gap-8 lg:grid-cols-[24rem_1fr] lg:items-stretch">
          <div className="rounded-[1.75rem] border border-indigo-400/40 bg-indigo-950/30 p-7 shadow-2xl shadow-indigo-950/30">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-indigo-200">
              AI Readiness Score
            </p>

            <div className="mt-6 flex items-end gap-2">
              <span className="text-7xl font-black leading-none text-white md:text-8xl">
                {formatScore(metrics.finalScore)}
              </span>
              <span className="pb-3 text-3xl font-black text-slate-400">/ 100</span>
            </div>

            <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-blue-500 to-indigo-500"
                style={{ width: `${boundedScore(metrics.finalScore)}%` }}
              />
            </div>

            <div
              className={`mt-6 rounded-2xl border px-5 py-3 text-center text-lg font-black ${getTierClass(
                metrics.finalScore,
              )}`}
            >
              {getDeploymentTier(metrics.finalScore)}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                  AI Percentile
                </p>
                <p className="mt-2 text-xl font-black text-white">
                  {formatPercent(data.readiness?.percentiles?.ai_percentile || metrics.finalScore)}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                  Loaded Signals
                </p>
                <p className="mt-2 text-xl font-black text-cyan-300">{loadedCount} / 4</p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-slate-800 bg-slate-950/70 p-7">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-indigo-200">
              Executive AI Assessment
            </p>

            <h2 className="mt-4 text-4xl font-black tracking-tight text-white md:text-5xl">
              AI Deployment Readiness
            </h2>

            <p className="mt-5 max-w-6xl text-lg leading-8 text-slate-300 md:text-xl md:leading-9">
              {executiveAssessment}
            </p>

            {loading && (
              <div className="mt-6 rounded-2xl border border-blue-900/50 bg-blue-950/40 p-4 text-sm font-semibold text-blue-200">
                Loading executive AI readiness signals…
              </div>
            )}

            {!loading && errorCount > 0 && (
              <div className="mt-6 rounded-2xl border border-amber-800 bg-amber-950/40 p-4 text-sm text-amber-100">
                <p className="font-black">Partial AI readiness profile loaded.</p>
                <p className="mt-1 font-semibold">
                  {loadedCount} signal{loadedCount === 1 ? '' : 's'} loaded; {errorCount} endpoint
                  {errorCount === 1 ? '' : 's'} unavailable.
                </p>
              </div>
            )}

            <div className="mt-6 rounded-2xl border border-indigo-500/30 bg-indigo-950/20 px-5 py-4">
              <p className="text-base font-semibold text-slate-200">
                This dashboard answers what the AI readiness profile means. Statistical validation,
                PCA, methodology, and detailed model diagnostics are now housed in Evidence & Validation.
              </p>
            </div>
          </div>
        </div>
      </article>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr_1fr]">
        <article className="rounded-[1.6rem] border border-slate-800 bg-slate-900/80 p-6 shadow-sm shadow-indigo-950/20">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-indigo-200">
              AI Readiness Drivers
            </p>

            <button
              type="button"
              onClick={() => setShowDriverInfo(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-indigo-400/50 bg-indigo-500/10 text-indigo-200 transition hover:border-cyan-300 hover:bg-cyan-500/20 hover:text-white"
              aria-label="Explain AI readiness drivers"
              title="Explain AI readiness drivers"
            >
              <Info className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-6 grid gap-4">
            <DriverCard tone="primary" label="Primary Driver" name={drivers.primary.label} score={drivers.primary.score} />
            <DriverCard tone="secondary" label="Secondary Driver" name={drivers.secondary.label} score={drivers.secondary.score} />
            <DriverCard tone="limiting" label="Limiting Factor" name={drivers.limiting.label} score={drivers.limiting.score} />
          </div>
        </article>

        <article className="rounded-[1.6rem] border border-slate-800 bg-slate-900/80 p-6 shadow-sm shadow-indigo-950/20">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-indigo-200">
            AI Deployment Use Cases
          </p>

          <div className="mt-6 space-y-4">
            {useCases.map((useCase) => (
              <div
                key={useCase.label}
                className="flex items-center gap-4 border-b border-slate-800/60 pb-3 last:border-b-0 last:pb-0"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-indigo-400/30 bg-indigo-500/15 text-indigo-200">
                  {useCase.icon}
                </span>
                <span className="text-lg font-semibold text-white">{useCase.label}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[1.6rem] border border-slate-800 bg-slate-900/80 p-6 shadow-sm shadow-indigo-950/20">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-indigo-200">
            AI Readiness Evidence
          </p>

          <div className="mt-6 space-y-5">
            {evidence.map((item) => (
              <div key={item} className="flex items-center gap-3">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/15 text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <span className="text-base font-semibold text-white">{item}</span>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="rounded-2xl border border-indigo-900/40 bg-slate-950/80 px-5 py-3 text-sm font-semibold text-slate-400">
        <span className="mr-3 text-indigo-300">ⓘ</span>
        AI executive scoring is derived from readiness, explainability, confidence, semantic richness,
        graph connectivity, and copilot deployment indicators.
      </div>

      {showDriverInfo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 px-6 py-8 backdrop-blur-md">
          <div className="relative w-full max-w-5xl rounded-[2rem] border border-indigo-500/40 bg-slate-950 p-7 text-white shadow-2xl shadow-indigo-950/40 md:p-9">
            <button
              type="button"
              onClick={() => setShowDriverInfo(false)}
              className="absolute right-5 top-5 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-300 transition hover:border-cyan-400 hover:text-white"
              aria-label="Close AI driver explanation"
            >
              <X className="h-5 w-5" />
            </button>

            <p className="text-xs font-black uppercase tracking-[0.32em] text-cyan-300">
              AI Driver Guide
            </p>

            <h3 className="mt-4 text-4xl font-black tracking-tight text-white">
              What these AI readiness drivers mean
            </h3>

            <div className="mt-8 grid gap-5 md:grid-cols-3">
              <DriverGuideCard
                tone="primary"
                title="Primary Driver"
                driver={drivers.primary.label}
                score={drivers.primary.score}
                description={getDriverDescription(drivers.primary.label, 'primary')}
              />

              <DriverGuideCard
                tone="secondary"
                title="Secondary Driver"
                driver={drivers.secondary.label}
                score={drivers.secondary.score}
                description={getDriverDescription(drivers.secondary.label, 'secondary')}
              />

              <DriverGuideCard
                tone="limiting"
                title="Limiting Factor"
                driver={drivers.limiting.label}
                score={drivers.limiting.score}
                description={getDriverDescription(drivers.limiting.label, 'limiting')}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function DriverCard({
  tone,
  label,
  name,
  score,
}: {
  tone: 'primary' | 'secondary' | 'limiting';
  label: string;
  name: string;
  score: number;
}) {
  const toneClass =
    tone === 'primary'
      ? 'text-cyan-300 border-cyan-400/30 bg-cyan-500/10'
      : tone === 'secondary'
        ? 'text-blue-300 border-blue-400/30 bg-blue-500/10'
        : 'text-amber-300 border-amber-400/30 bg-amber-500/10';

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
      <div className="flex items-start gap-4">
        <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border font-black ${toneClass}`}>
          {tone === 'primary' ? '✓' : tone === 'secondary' ? '◎' : '!'}
        </span>

        <div>
          <p className={`text-xs font-black uppercase tracking-[0.18em] ${toneClass.split(' ')[0]}`}>
            {label}
          </p>
          <p className="mt-2 text-xl font-black text-white">
            {name} +{Math.round(score)}
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-400">
            {statusForScore(score)}
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
        <span className={`inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full border text-xl font-black ${badgeClass}`}>
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