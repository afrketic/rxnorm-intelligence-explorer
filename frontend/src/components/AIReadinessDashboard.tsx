import { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  Brain,
  CheckCircle2,
  GitBranch,
  Network,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
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
    executive_narrative?: string;
    recommended_action?: string;
  };
  scores?: Record<string, number>;
  reasons?: Array<Record<string, any>>;
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
    recommended_prompt?: string;
  };
  summaries?: {
    executive_summary?: string;
    technical_summary?: string;
    strategic_summary?: string;
  };
  questions?: Array<Record<string, any>>;
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
  if (score >= 90) return 'AI Deployment Ready';
  if (score >= 82) return 'Enterprise AI Candidate';
  if (score >= 72) return 'AI Workflow Candidate';
  if (score >= 60) return 'AI Context Enrichment Needed';
  return 'AI Foundation Needed';
}

function getTierClass(score: number) {
  if (score >= 90) return 'border-cyan-300/70 bg-cyan-500/20 text-cyan-100';
  if (score >= 82) return 'border-blue-300/70 bg-blue-500/20 text-blue-100';
  if (score >= 72) return 'border-emerald-300/70 bg-emerald-500/20 text-emerald-100';
  if (score >= 60) return 'border-amber-300/70 bg-amber-500/20 text-amber-100';
  return 'border-slate-500 bg-slate-900 text-slate-200';
}

function availabilityLabel(value: number) {
  if (value >= 82) return 'Available';
  if (value >= 60) return 'Developing';
  return 'Needs Enrichment';
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

  const relationshipCoverage = boundedScore(
    data.explainability?.scores?.relationship_coverage_score ||
      data.explainability?.scores?.relationship_density_score ||
      drug?.relationship_density_score ||
      average([graphReadiness, semanticRichness]),
    0,
  );

  const finalScore = boundedScore(
    readinessAi * 0.4 +
      semanticRichness * 0.22 +
      explainabilityScore * 0.16 +
      graphReadiness * 0.1 +
      classificationCoverage * 0.07 +
      relationshipCoverage * 0.05 ||
      average([
        readinessAi,
        semanticRichness,
        explainabilityScore,
        graphReadiness,
        classificationCoverage,
        relationshipCoverage,
        confidenceScore,
        copilotScore,
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
    relationshipCoverage,
  };
}

function buildExecutiveAssessment(name: string, metrics: ReturnType<typeof buildAiMetrics>) {
  const tier = getDeploymentTier(metrics.finalScore);

  return `${name} demonstrates ${tier.toLowerCase()} based on structured therapeutic classification, disease intelligence, mechanism evidence, explainability coverage, and knowledge graph context. These signals provide the semantic foundation needed for retrieval, reasoning, AI copilots, clinical question answering, and graph-based healthcare intelligence.`;
}

function buildDeploymentPath(name: string, metrics: ReturnType<typeof buildAiMetrics>) {
  if (metrics.finalScore >= 90) {
    return `${name} is ready for high-value AI deployment. Recommended pathways include retrieval-augmented generation, clinical copilots, semantic medication search, and graph-based intelligence workflows.`;
  }

  if (metrics.finalScore >= 72) {
    return `${name} is a strong AI workflow candidate. Recommended next steps are targeted context enrichment, retrieval validation, and controlled deployment in semantic search or clinical summarization workflows before broader copilot use.`;
  }

  return `${name} should be enriched before broad AI deployment. Prioritize therapeutic classification, disease mapping, relationship coverage, and explainability evidence before using it in advanced RAG, copilot, or agentic workflows.`;
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
  const displayName = useMemo(() => getDisplayName(drug, data), [drug, data]);
  const executiveAssessment = useMemo(
    () => buildExecutiveAssessment(displayName, metrics),
    [displayName, metrics],
  );
  const deploymentPath = useMemo(
    () => buildDeploymentPath(displayName, metrics),
    [displayName, metrics],
  );

  const contextSignals = [
    { label: 'Therapeutic Classification', value: metrics.classificationCoverage || metrics.semanticRichness },
    { label: 'Disease Intelligence', value: metrics.semanticRichness },
    { label: 'Mechanism Evidence', value: metrics.explainabilityScore || metrics.semanticRichness },
    { label: 'Pharmacologic Class', value: metrics.classificationCoverage },
    { label: 'RxNorm Relationships', value: metrics.relationshipCoverage },
    { label: 'Knowledge Graph Context', value: metrics.graphReadiness },
  ];

  const ragSignals = [
    {
      label: 'Classification Coverage',
      status: availabilityLabel(metrics.classificationCoverage || metrics.semanticRichness),
      description: 'Structured therapeutic and pharmacologic labels are available for retrieval context.',
    },
    {
      label: 'Relationship Coverage',
      status: availabilityLabel(metrics.relationshipCoverage),
      description: 'RxNorm and semantic relationships support connected retrieval and entity linking.',
    },
    {
      label: 'Graph Coverage',
      status: availabilityLabel(metrics.graphReadiness),
      description: 'Knowledge graph context supports multi-hop clinical and semantic reasoning.',
    },
    {
      label: 'Explainability Coverage',
      status: availabilityLabel(metrics.explainabilityScore),
      description: 'Evidence signals support transparent AI-generated answers and auditability.',
    },
  ];

  const explainabilityEvidence = [
    { label: 'Therapeutic Pathway Available', available: metrics.classificationCoverage > 0 || metrics.semanticRichness > 0 },
    { label: 'Disease Mapping Available', available: metrics.semanticRichness > 0 },
    { label: 'Mechanism Evidence Available', available: metrics.explainabilityScore > 0 || metrics.semanticRichness > 0 },
    { label: 'Graph Relationships Available', available: metrics.graphReadiness > 0 },
    { label: 'External Evidence Available', available: metrics.confidenceScore > 0 || metrics.explainabilityScore > 0 },
  ];

  const workflowFit = [
    { label: 'AI Copilots', icon: <Sparkles className="h-5 w-5" /> },
    { label: 'Clinical Question Answering', icon: <Brain className="h-5 w-5" /> },
    { label: 'Semantic Search', icon: <Search className="h-5 w-5" /> },
    { label: 'Knowledge Retrieval', icon: <Network className="h-5 w-5" /> },
    { label: 'Agentic Workflows', icon: <Bot className="h-5 w-5" /> },
  ];

  const aiUseCases = [
    'Medication Intelligence',
    'Clinical Summarization',
    'Relationship Discovery',
    'Graph Exploration',
    'Healthcare Search',
  ];

  if (!drug) return null;

  return (
    <section className="space-y-5 text-white">
      <article className="rounded-[2rem] border border-indigo-500/30 bg-[radial-gradient(circle_at_top_right,_rgba(99,102,241,0.20),_transparent_34%),linear-gradient(135deg,_rgba(2,6,23,0.98),_rgba(15,23,42,0.95),_rgba(30,27,75,0.88))] p-6 shadow-2xl shadow-indigo-950/30 md:p-8 lg:p-10">
        <div className="grid gap-8 lg:grid-cols-[24rem_1fr] lg:items-stretch">
          <div className="rounded-[1.75rem] border border-indigo-400/40 bg-indigo-950/30 p-7 shadow-2xl shadow-indigo-950/30">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-indigo-200">
              AI Readiness
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
          </div>

          <div className="rounded-[1.75rem] border border-slate-800 bg-slate-950/70 p-7">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-indigo-200">
              Intelligence Engineering Briefing
            </p>

            <h2 className="mt-4 text-4xl font-black tracking-tight text-white md:text-5xl">
              How machines understand {displayName}
            </h2>

            <p className="mt-5 max-w-6xl text-lg leading-8 text-slate-300 md:text-xl md:leading-9">
              {executiveAssessment}
            </p>

            {loading && (
              <div className="mt-6 rounded-2xl border border-blue-900/50 bg-blue-950/40 p-4 text-sm font-semibold text-blue-200">
                Loading AI engineering signals…
              </div>
            )}

            {!loading && errorCount > 0 && (
              <div className="mt-6 rounded-2xl border border-amber-800 bg-amber-950/40 p-4 text-sm text-amber-100">
                <p className="font-black">Partial AI readiness profile loaded.</p>
                <p className="mt-1 font-semibold">
                  Some supporting endpoints were unavailable, but the dashboard can still render from available AI context.
                </p>
              </div>
            )}
          </div>
        </div>
      </article>

      <article className="rounded-[1.6rem] border border-slate-800 bg-slate-900/80 p-6 shadow-sm shadow-indigo-950/20">
        <div className="flex items-start gap-4">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-cyan-400/40 bg-cyan-500/15 text-cyan-300">
            <Brain className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-indigo-200">
              AI Context Quality
            </p>
            <h3 className="mt-2 text-3xl font-black text-white">What information does AI have available?</h3>
            <p className="mt-3 max-w-5xl text-base leading-7 text-slate-300">
              This medication possesses structured context across therapeutic, disease, mechanism, relationship, and graph domains, providing foundational context for AI systems.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {contextSignals.map((signal) => (
            <EvidencePill key={signal.label} label={signal.label} available={signal.value > 0} />
          ))}
        </div>
      </article>

      <div className="grid gap-5 xl:grid-cols-2">
        <article className="rounded-[1.6rem] border border-slate-800 bg-slate-900/80 p-6 shadow-sm shadow-indigo-950/20">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-indigo-200">
            RAG Readiness
          </p>
          <h3 className="mt-3 text-2xl font-black text-white">
            Can this medication support retrieval-augmented generation?
          </h3>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            RAG readiness depends on whether retrieval systems can find structured context, relationship evidence, graph connections, and explainable source signals.
          </p>

          <div className="mt-6 space-y-4">
            {ragSignals.map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-lg font-black text-white">{item.label}</p>
                  <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-cyan-200">
                    {item.status}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[1.6rem] border border-slate-800 bg-slate-900/80 p-6 shadow-sm shadow-indigo-950/20">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-indigo-200">
            Explainability Evidence
          </p>
          <h3 className="mt-3 text-2xl font-black text-white">
            Why would an AI model understand this medication?
          </h3>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Explainable AI depends on structured reasons the model can retrieve, cite, summarize, and connect.
          </p>

          <div className="mt-6 space-y-4">
            {explainabilityEvidence.map((item) => (
              <EvidencePill key={item.label} label={item.label} available={item.available} />
            ))}
          </div>
        </article>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <article className="rounded-[1.6rem] border border-slate-800 bg-slate-900/80 p-6 shadow-sm shadow-indigo-950/20">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-indigo-200">
            Agentic Workflow Fit
          </p>
          <h3 className="mt-3 text-2xl font-black text-white">
            What AI workflows can use this medication?
          </h3>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {workflowFit.map((workflow) => (
              <div
                key={workflow.label}
                className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-indigo-400/30 bg-indigo-500/15 text-indigo-200">
                  {workflow.icon}
                </span>
                <span className="text-base font-black text-white">{workflow.label}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[1.6rem] border border-slate-800 bg-slate-900/80 p-6 shadow-sm shadow-indigo-950/20">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-indigo-200">
            AI Use Cases
          </p>
          <h3 className="mt-3 text-2xl font-black text-white">
            What can AI do with this medication?
          </h3>

          <div className="mt-6 space-y-3">
            {aiUseCases.map((useCase) => (
              <div key={useCase} className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/15 text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <span className="text-base font-semibold text-white">{useCase}</span>
              </div>
            ))}
          </div>
        </article>
      </div>

      <article className="rounded-[1.6rem] border border-cyan-500/30 bg-gradient-to-br from-cyan-950/30 via-slate-950 to-indigo-950/30 p-6 shadow-sm shadow-indigo-950/20">
        <div className="flex items-start gap-4">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-cyan-400/40 bg-cyan-500/15 text-cyan-300">
            <Route className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-200">
              Recommended AI Deployment Path
            </p>
            <h3 className="mt-2 text-3xl font-black text-white">What should be built next?</h3>
            <p className="mt-4 max-w-6xl text-lg leading-8 text-slate-300">
              {deploymentPath}
            </p>
          </div>
        </div>
      </article>

      <div className="rounded-2xl border border-indigo-900/40 bg-slate-950/80 px-5 py-3 text-sm font-semibold text-slate-400">
        <span className="mr-3 text-indigo-300">ⓘ</span>
        H3B.10 reframes AI Readiness as an intelligence engineering workspace. Supporting confidence, explainability, and copilot signals remain available in the payload but are no longer presented as competing score cards.
      </div>
    </section>
  );
}

function EvidencePill({ label, available }: { label: string; available: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <span
        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
          available
            ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300'
            : 'border-amber-400/40 bg-amber-500/15 text-amber-300'
        }`}
      >
        {available ? <CheckCircle2 className="h-4 w-4" /> : <GitBranch className="h-4 w-4" />}
      </span>
      <span className="text-base font-semibold text-white">{label}</span>
    </div>
  );
}
