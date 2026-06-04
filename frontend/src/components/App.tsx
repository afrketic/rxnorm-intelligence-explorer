import { useEffect, useMemo, useState } from 'react';
import { Activity, Database, Network, ShieldCheck } from 'lucide-react';

import DrugSearch from './components/DrugSearch';
import EnterpriseIntelligenceDashboard from './components/EnterpriseIntelligenceDashboard';
import ClassificationPanel from './components/ClassificationPanel';
import RelationshipPanel from './components/RelationshipPanel';
import GraphPanel from './components/GraphPanel';
import MedicationReadinessScorecard from './components/MedicationReadinessScorecard';
import ConfidenceScorecard from './components/ConfidenceScorecard';
import PCAMethodologyScorecard from './components/PCAMethodologyScorecard';
import MethodologyConsensusCard from './components/MethodologyConsensusCard';

import ProductionCandidateCard from './components/ProductionCandidateCard';
import ExecutivePortfolioCard from './components/ExecutivePortfolioCard';
import ExecutiveLeaderboardsCard from './components/ExecutiveLeaderboardsCard';
import ExplainabilityEngineCard from './components/ExplainabilityEngineCard';
import ExecutiveRecommendationCard from './components/ExecutiveRecommendationCard';

import StrategicOpportunityCard from './components/StrategicOpportunityCard';
import PortfolioOptimizationCard from './components/PortfolioOptimizationCard';
import AICopilotCard from './components/AICopilotCard';
import EnterpriseDeploymentCard from './components/EnterpriseDeploymentCard';
import WebsiteDeploymentCard from './components/WebsiteDeploymentCard';
import ProductionHardeningCard from './components/ProductionHardeningCard';

import ValidationTrackCard from './components/ValidationTrackCard';
import MethodologySelectionCard from './components/MethodologySelectionCard';
import PublicationReadinessCard from './components/PublicationReadinessCard';
import SafeCardBoundary from './components/SafeCardBoundary';

import { DrugCard, getDrug, getWebsiteSummary, searchDrugs } from './lib/api';

type DashboardPage =
  | 'overview'
  | 'knowledge'
  | 'atc'
  | 'ndc'
  | 'briefing'
  | 'readiness'
  | 'executive'
  | 'deployment'
  | 'validation';

type StatProps = {
  icon: React.ReactNode;
  label: string;
  value: string | number;
};

const DASHBOARD_TABS: Array<{
  id: DashboardPage;
  label: string;
  description: string;
}> = [
  { id: 'overview', label: 'Overview', description: 'Identity + intelligence' },
  { id: 'knowledge', label: 'Knowledge Graph', description: 'Relationships + graph' },
  { id: 'atc', label: 'ATC Hierarchy', description: 'Therapeutic classes' },
  { id: 'ndc', label: 'NDC Intelligence', description: 'Claims + packages' },
  { id: 'briefing', label: 'AI Intelligence Briefing', description: 'Copilot narrative' },
  { id: 'readiness', label: 'Readiness & Confidence', description: 'Readiness + methods' },
  { id: 'executive', label: 'Executive Portfolio', description: 'Rankings + actions' },
  { id: 'deployment', label: 'Deployment Readiness', description: 'Strategy + hardening' },
  { id: 'validation', label: 'Validation & Publication', description: 'Research defense' },
];

const POPULAR_SEARCHES = [
  'Atorvastatin Calcium',
  'Levothyroxine Sodium',
  'Amlodipine Besylate',
  'Gabapentin',
  'Metformin HCl',
  'Semaglutide',
];

function formatMetric(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';

  const numeric = Number(value);

  if (Number.isFinite(numeric)) {
    return numeric.toLocaleString(undefined, {
      maximumFractionDigits: numeric % 1 === 0 ? 0 : 2,
    });
  }

  return String(value);
}

function Stat({ icon, label, value }: StatProps) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="rounded-2xl bg-blue-500/10 p-3 text-blue-300">{icon}</div>
        <div>
          <p className="text-sm font-semibold text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-black text-white">{formatMetric(value)}</p>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-black text-white">{value}</p>
    </div>
  );
}

function PageShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-blue-900/40 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 text-white shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-blue-300">{eyebrow}</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight">{title}</h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">{description}</p>
      </div>
      {children}
    </section>
  );
}

function PlaceholderPanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 text-white shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-300">Workspace</p>
      <h3 className="mt-2 text-2xl font-black">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
    </div>
  );
}



export default function App() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DrugCard[]>([]);
  const [selected, setSelected] = useState<DrugCard | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [summary, setSummary] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeDashboardPage, setActiveDashboardPage] = useState<DashboardPage>('overview');

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      try {
        const data = await getWebsiteSummary();
        if (!cancelled) setSummary(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Unable to load website summary', error);
      }
    }

    loadSummary();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function runSearch() {
      setLoading(true);

      try {
        const term = query.trim();

        if (!term) {
          setResults([]);
          setLoading(false);
          return;
        }

        const data = await searchDrugs(term, 30);

        if (!cancelled) {
          const nextResults = Array.isArray(data) ? data : [];
          setResults(nextResults);
        }
      } catch (error) {
        console.error('Search failed', error);
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    const handle = window.setTimeout(runSearch, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query]);

  useEffect(() => {
    if (!selected?.rxcui) {
      setDetail(null);
      return;
    }

    let cancelled = false;

    async function loadDetail() {
      setDetail(null);

      try {
        const data = await getDrug(String(selected.rxcui));
        if (!cancelled) setDetail(data);
      } catch (error) {
        console.error('Drug detail failed', error);
        if (!cancelled) setDetail(null);
      }
    }

    loadDetail();

    return () => {
      cancelled = true;
    };
  }, [selected?.rxcui]);

  const activeDrug: DrugCard | null = detail?.drug || selected;

  const drugWithDetails: any = activeDrug
    ? {
        ...(selected || {}),
        ...(activeDrug || {}),
        ...(detail?.scorecard || {}),
        ...(detail || {}),
        rxcui: detail?.rxcui || detail?.drug?.rxcui || selected?.rxcui || activeDrug.rxcui,
        rxnorm_name:
          detail?.drug?.rxnorm_name ||
          detail?.drug?.drug_name ||
          detail?.rxnorm_name ||
          detail?.drug_name ||
          (selected as any)?.rxnorm_name ||
          (selected as any)?.drug_name ||
          (activeDrug as any)?.rxnorm_name ||
          (activeDrug as any)?.drug_name,
        drug_name:
          detail?.drug?.drug_name ||
          detail?.drug?.rxnorm_name ||
          detail?.drug_name ||
          detail?.rxnorm_name ||
          (selected as any)?.drug_name ||
          (selected as any)?.rxnorm_name ||
          (activeDrug as any)?.drug_name ||
          (activeDrug as any)?.rxnorm_name,
        classifications: detail?.classifications || detail?.drug?.classifications || {},
        relationships: detail?.relationships || detail?.drug?.relationships || {},
        graph: detail?.graph || detail?.drug?.graph || { nodes: [], edges: [] },
        graph_metrics: detail?.graph_metrics || detail?.graph?.metrics || {},
        drug: {
          ...(selected || {}),
          ...(activeDrug || {}),
          classifications: detail?.classifications || detail?.drug?.classifications || {},
          relationships: detail?.relationships || detail?.drug?.relationships || {},
          graph: detail?.graph || detail?.drug?.graph || { nodes: [], edges: [] },
        },
      }
    : null;

  const summaryMap = useMemo(() => {
    const map: Record<string, string | number> = {};

    summary.forEach((item: any) => {
      if (item.metric_name) map[item.metric_name] = item.metric_value;
      if (item.metric) map[item.metric] = item.value;
    });

    return map;
  }, [summary]);


  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="border-b border-blue-950/60 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.20),_transparent_35%),linear-gradient(135deg,#020617,#0f172a_50%,#020617)]">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <div className="rounded-[2rem] border border-blue-900/50 bg-slate-950/70 p-8 shadow-2xl shadow-blue-950/30 backdrop-blur">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="mb-16 flex items-center gap-3">
                  <div className="text-4xl font-black text-blue-500">AK</div>
                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.28em] text-blue-200">
                      Alex Knows AI
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">
                      Data · Intelligence · Impact
                    </p>
                  </div>
                </div>

                <p className="text-xs font-black uppercase tracking-[0.36em] text-blue-300">
                  RxNorm Intelligence Explorer
                </p>
                <h1 className="mt-4 max-w-5xl text-5xl font-black tracking-tight text-white md:text-7xl">
                  RxNorm Intelligence Explorer
                </h1>
                <p className="mt-5 max-w-5xl text-xl leading-8 text-slate-300">
                  A medication interoperability workspace for RxNorm identity, ATC hierarchy, NDC claims mapping, AI-ready analytics, executive intelligence, and research-grade validation.
                </p>
              </div>

              <div className="rounded-3xl border border-blue-900/50 bg-slate-900/80 p-6 text-right shadow-xl">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Source RxCUIs</p>
                <p className="mt-2 text-4xl font-black text-white">
                  {formatMetric(summaryMap.unique_rxcui || 30132)}
                </p>
              </div>
            </div>

            <div className="mt-10 rounded-3xl border border-blue-900/50 bg-slate-900/70 p-6">
              <h2 className="text-xl font-black text-white">Search Medication</h2>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
                Explore standardized medication intelligence across RxCUI, RxNorm concepts, ATC classes, NDC identifiers, claims-readiness, and publication validation layers.
              </p>

              <div className="mt-5">
                <DrugSearch
                  query={query}
                  onQueryChange={(value) => {
                    setQuery(value);
                    setSelected(null);
                    setDetail(null);
                  }}
                  results={results}
                  selected={selected}
                  onSelect={(drug) => {
                    setSelected(drug);
                    setDetail(null);
                    setActiveDashboardPage('overview');
                  }}
                  loading={loading}
                />
              </div>

              <div className="mt-6">
                <p className="text-center text-xs font-black uppercase tracking-[0.24em] text-slate-300">
                  Popular Medication Searches
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-3">
                  {POPULAR_SEARCHES.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setQuery(item);
                        setSelected(null);
                        setDetail(null);
                        setActiveDashboardPage('overview');
                      }}
                      className="rounded-2xl border border-blue-800/70 bg-blue-950/40 px-5 py-3 text-sm font-black text-blue-100 transition hover:border-blue-400 hover:bg-blue-900/60"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-4">
            <Stat icon={<Database />} label="Unique RxCUIs" value={summaryMap.unique_rxcui || '30,132'} />
            <Stat icon={<Activity />} label="Avg Intelligence" value={summaryMap.avg_overall_intelligence_score || '25.71'} />
            <Stat icon={<ShieldCheck />} label="Avg AI Readiness" value={summaryMap.avg_ai_readiness_score || '33.79'} />
            <Stat icon={<Network />} label="Avg Semantic" value={summaryMap.avg_semantic_richness_score || '20.94'} />
          </div>
        </div>
      </section>

      {activeDrug && (
        <section className="mx-auto max-w-7xl space-y-8 px-6 py-8">


          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-3 shadow-sm">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {DASHBOARD_TABS.map((tab) => {
                const isActive = activeDashboardPage === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveDashboardPage(tab.id)}
                    className={`min-w-fit rounded-2xl border px-4 py-3 text-left transition ${
                      isActive
                        ? 'border-blue-500 bg-blue-500 text-white shadow-lg shadow-blue-950/40'
                        : 'border-slate-700 bg-slate-950/70 text-slate-300 hover:border-blue-700 hover:bg-blue-950/40'
                    }`}
                  >
                    <span className="block text-sm font-black">{tab.label}</span>
                    <span className={`mt-1 block text-xs font-semibold ${isActive ? 'text-blue-100' : 'text-slate-500'}`}>
                      {tab.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {activeDashboardPage === 'overview' && (
            <PageShell
              eyebrow="Overview"
              title="Medication Identity + Enterprise Intelligence"
              description="Identity, benchmark, classification preview, and top-line medication intelligence summary."
            >
              <SafeCardBoundary title="Enterprise Intelligence Dashboard">
                <EnterpriseIntelligenceDashboard drug={drugWithDetails} />
              </SafeCardBoundary>
              <SafeCardBoundary title="Classification Preview">
                <ClassificationPanel drug={drugWithDetails} />
              </SafeCardBoundary>

            </PageShell>
          )}

          {activeDashboardPage === 'knowledge' && (
            <PageShell
              eyebrow="Knowledge Graph"
              title="Relationship + Graph Intelligence"
              description="RxNorm relationship structure, knowledge graph footprint, classification nodes, and concept connectivity."
            >
              <SafeCardBoundary title="Relationship Intelligence">
                <RelationshipPanel drug={drugWithDetails} />
              </SafeCardBoundary>

              <SafeCardBoundary title="Knowledge Graph Intelligence">
                <GraphPanel drug={drugWithDetails} />
              </SafeCardBoundary>

              <SafeCardBoundary title="Explainability Engine">
                <ExplainabilityEngineCard drug={drugWithDetails} />
              </SafeCardBoundary>
            </PageShell>
          )}

          {activeDashboardPage === 'atc' && (
            <PageShell
              eyebrow="ATC Hierarchy"
              title="Therapeutic Classification Workspace"
              description="Therapeutic ATC hierarchy, mechanism evidence, pharmacologic evidence, and clinical classification context."
            >
              <SafeCardBoundary title="ATC + Classification Intelligence">
                <ClassificationPanel drug={drugWithDetails} />
              </SafeCardBoundary>

              <div className="grid gap-4 md:grid-cols-4">
                <MiniStat label="ATC Depth" value={(drugWithDetails as any).atc_depth || (drugWithDetails as any).atc_hierarchy_depth || '—'} />
                <MiniStat label="Classifications" value={(drugWithDetails as any).classification_count || (drugWithDetails as any).total_classifications || '—'} />
                <MiniStat label="Class Types" value={(drugWithDetails as any).class_type_count || '—'} />
                <MiniStat label="Clinical Signals" value={(drugWithDetails as any).disease_count || '—'} />
              </div>
            </PageShell>
          )}

          {activeDashboardPage === 'ndc' && (
            <PageShell
              eyebrow="NDC Intelligence"
              title="Claims + Package Intelligence"
              description="Claims readiness, NDC/package context, terminology normalization, and payer/PBM analytics readiness."
            >
              <SafeCardBoundary title="Readiness Scorecard">
                <MedicationReadinessScorecard drug={drugWithDetails} />
              </SafeCardBoundary>

              <SafeCardBoundary title="Production Candidate Ranking">
                <ProductionCandidateCard drug={drugWithDetails} />
              </SafeCardBoundary>

              <PlaceholderPanel
                title="NDC Package Intelligence"
                description="This page is reserved for the package-level NDC crosswalk and claims mapping views. The current release surfaces the NDC signal through readiness, production candidacy, and deployment scoring."
              />
            </PageShell>
          )}

          {activeDashboardPage === 'briefing' && (
            <PageShell
              eyebrow="AI Intelligence Briefing"
              title="Copilot + Narrative Intelligence"
              description="Executive, technical, strategic, risk, explainability, and Q&A-ready generated intelligence."
            >
              <SafeCardBoundary title="AI Copilot Brief">
                <AICopilotCard drug={drugWithDetails} />
              </SafeCardBoundary>

              <SafeCardBoundary title="Executive Recommendation Engine">
                <ExecutiveRecommendationCard drug={drugWithDetails} />
              </SafeCardBoundary>

              <SafeCardBoundary title="Explainability Engine">
                <ExplainabilityEngineCard drug={drugWithDetails} />
              </SafeCardBoundary>
            </PageShell>
          )}

          {activeDashboardPage === 'readiness' && (
            <PageShell
              eyebrow="Readiness & Confidence"
              title="Readiness, Confidence, PCA + Consensus"
              description="Expert readiness, confidence scoring, empirical PCA, and methodology consensus in one focused workspace."
            >
              <SafeCardBoundary title="Sprint 17A — Medication Readiness Scorecard">
                <MedicationReadinessScorecard drug={drugWithDetails} />
              </SafeCardBoundary>

              <SafeCardBoundary title="Sprint 17B — Confidence Engine">
                <ConfidenceScorecard drug={drugWithDetails} />
              </SafeCardBoundary>

              <SafeCardBoundary title="Sprint 18A — PCA Model Framework">
                <PCAMethodologyScorecard drug={drugWithDetails} />
              </SafeCardBoundary>

              <SafeCardBoundary title="Sprint 18B — Methodology Consensus Engine">
                <MethodologyConsensusCard drug={drugWithDetails} />
              </SafeCardBoundary>
            </PageShell>
          )}

          {activeDashboardPage === 'executive' && (
            <PageShell
              eyebrow="Executive Portfolio"
              title="Production, Portfolio, Leaderboards + Recommendations"
              description="Executive ranking, production candidacy, leaderboards, explainability, and recommended action plans."
            >
              <SafeCardBoundary title="Sprint 19B — Production Candidate Ranking">
                <ProductionCandidateCard drug={drugWithDetails} />
              </SafeCardBoundary>

              <SafeCardBoundary title="Sprint 20A — Executive Portfolio Ranking">
                <ExecutivePortfolioCard drug={drugWithDetails} />
              </SafeCardBoundary>

              <SafeCardBoundary title="Sprint 20B — Executive Leaderboards">
                <ExecutiveLeaderboardsCard drug={drugWithDetails} />
              </SafeCardBoundary>

              <SafeCardBoundary title="Sprint 21A — Explainability Engine">
                <ExplainabilityEngineCard drug={drugWithDetails} />
              </SafeCardBoundary>

              <SafeCardBoundary title="Sprint 21B — Executive Recommendation Engine">
                <ExecutiveRecommendationCard drug={drugWithDetails} />
              </SafeCardBoundary>
            </PageShell>
          )}

          {activeDashboardPage === 'deployment' && (
            <PageShell
              eyebrow="Deployment Readiness"
              title="Strategy, Opportunity, Launch + Hardening"
              description="Strategic opportunity, portfolio optimization, AI copilot, enterprise deployment, website packaging, and production hardening."
            >
              <SafeCardBoundary title="Sprint 22A — Strategic Opportunity Engine">
                <StrategicOpportunityCard drug={drugWithDetails} />
              </SafeCardBoundary>

              <SafeCardBoundary title="Sprint 22B — Portfolio Optimization Engine">
                <PortfolioOptimizationCard drug={drugWithDetails} />
              </SafeCardBoundary>

              <SafeCardBoundary title="Sprint 23A — AI Copilot Layer">
                <AICopilotCard drug={drugWithDetails} />
              </SafeCardBoundary>

              <SafeCardBoundary title="Sprint 23B — Enterprise Deployment Layer">
                <EnterpriseDeploymentCard drug={drugWithDetails} />
              </SafeCardBoundary>

              <SafeCardBoundary title="Sprint 24A — Website Deployment Layer">
                <WebsiteDeploymentCard drug={drugWithDetails} />
              </SafeCardBoundary>

              <SafeCardBoundary title="Sprint 24B — Production Hardening Layer">
                <ProductionHardeningCard drug={drugWithDetails} />
              </SafeCardBoundary>
            </PageShell>
          )}

          {activeDashboardPage === 'validation' && (
            <PageShell
              eyebrow="Validation & Publication"
              title="Regression, EFA, Bootstrap, Method Selection + Publication"
              description="Research-grade validation workspace including methodology selection, publication validation, scientific benchmarking, and white paper metrics."
            >
              <SafeCardBoundary title="Validation Track V1–V5">
                <ValidationTrackCard drug={drugWithDetails} />
              </SafeCardBoundary>

              <SafeCardBoundary title="Sprint 25A — Methodology Selection Engine">
                <MethodologySelectionCard drug={drugWithDetails} />
              </SafeCardBoundary>

              <SafeCardBoundary title="Sprint 25B–26B — Publication Readiness Release">
                <PublicationReadinessCard drug={drugWithDetails} />
              </SafeCardBoundary>
            </PageShell>
          )}
        </section>
      )}
    </main>
  );
}
