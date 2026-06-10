import { useEffect, useMemo, useState } from 'react';
import { Activity, Database, Network, ShieldCheck } from 'lucide-react';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import MedicationIntelligenceSummaryCard from './components/MedicationIntelligenceSummaryCard';

import DrugSearch from './components/DrugSearch';
import IntelligenceCard from './components/IntelligenceCard';
import ClassificationPanel from './components/ClassificationPanel';
import RelationshipPanel from './components/RelationshipPanel';
import GraphPanel from './components/GraphPanel';
import EnterpriseIntelligenceDashboard from './components/EnterpriseIntelligenceDashboard';
import MedicationReadinessScorecard from './components/MedicationReadinessScorecard';
import ConfidenceScorecard from './components/ConfidenceScorecard';
import PCAMethodologyScorecard from './components/PCAMethodologyScorecard';
import MethodologyConsensusCard from './components/MethodologyConsensusCard';
import PredictiveIntelligenceCard from './components/PredictiveIntelligenceCard';
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

import {
  DrugCard,
  getDrug,
  getWebsiteSummary,
  searchDrugs,
} from './lib/api';

export default function App() {
  const [activeDashboardTab, setActiveDashboardTab] = useState<'overview' | 'readiness' | 'executive' | 'strategy' | 'validation'>('overview');

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DrugCard[]>([]);
  const [selected, setSelected] = useState<DrugCard | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [summary, setSummary] = useState<Array<{ metric: string; value: number | string }>>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'classification' | 'relationships' | 'graph'>('classification');

  useEffect(() => {
    getWebsiteSummary().then(setSummary).catch(console.error);
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setLoading(true);

      searchDrugs(query, 30)
        .then((rows) => {
          setResults(rows);

          if (!selected && rows.length) {
            setSelected(rows[0]);
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }, 250);

    return () => window.clearTimeout(handle);
  }, [query, selected]);

  useEffect(() => {
    if (!selected?.rxcui) {
      setDetail(null);
      return;
    }

    getDrug(selected.rxcui)
      .then((response) => {
        console.log('DRUG DETAIL RESPONSE', response);
        setDetail(response);
      })
      .catch((error) => {
        console.error('Failed to load drug detail:', error);
        setDetail(null);
      });
  }, [selected?.rxcui]);

  const activeDrug: DrugCard | null = detail?.drug || selected;

  const drugWithDetails: any = activeDrug
    ? {
        ...activeDrug,
        classifications: detail?.classifications,
        relationships: detail?.relationships,
        graph: detail?.graph,
        scorecard: detail?.scorecard,
        narrative: detail?.narrative,
      }
    : null;

  const summaryMap = useMemo(
    () => Object.fromEntries(summary.map((x) => [x.metric, x.value])),
    [summary]
  );

  const chartData = activeDrug
    ? [
        { name: 'Claims', value: activeDrug.claims_readiness_score || 0 },
        { name: 'AI', value: activeDrug.ai_readiness_score || 0 },
        { name: 'Semantic', value: activeDrug.semantic_richness_score || 0 },
        { name: 'Interop', value: activeDrug.interoperability_score || 0 },
        { name: 'Clinical', value: activeDrug.clinical_semantics_score || 0 },
      ]
    : [];

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-600">
                Alex Knows AI · Live Demo
              </p>

              <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950 md:text-5xl">
                RxNorm Intelligence Explorer
              </h1>

              <p className="mt-3 max-w-3xl text-slate-600">
                Production frontend for drug intelligence, benchmark tiers, AI readiness,
                claims readiness, clinical semantics, and knowledge graph exploration.
              </p>
            </div>

            <div className="rounded-3xl bg-slate-950 p-5 text-white shadow-lg">
              <p className="text-xs uppercase tracking-wide text-slate-300">
                Source RxCUIs
              </p>

              <p className="mt-1 text-3xl font-bold">
                {Number(summaryMap.total_rxcui || 0).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-4">
            <Stat icon={<Database />} label="Unique RxCUIs" value={summaryMap.unique_rxcui || '—'} />
            <Stat icon={<Activity />} label="Avg Intelligence" value={summaryMap.avg_overall_intelligence_score || '—'} />
            <Stat icon={<ShieldCheck />} label="Avg AI Readiness" value={summaryMap.avg_ai_readiness_score || '—'} />
            <Stat icon={<Network />} label="Avg Semantic" value={summaryMap.avg_semantic_richness_score || '—'} />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-8 px-6 py-8">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-600">Horizontal Medication Search</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">Select a Medication</h2>
            </div>
            <p className="text-sm font-semibold text-slate-500">Results scroll horizontally across the page.</p>
          </div>
          <DrugSearch
          query={query}
          onQueryChange={setQuery}
          results={results}
          selected={selected}
          onSelect={(drug) => {
            setSelected(drug);
            setDetail(null);
          }}
          loading={loading}
        />
        </section>

        <div className="space-y-6">
          <EnterpriseIntelligenceDashboard drug={drugWithDetails} />

          <IntelligenceCard drug={activeDrug} />
          {/* Release Candidate UI Integration Pass: Tabbed Sprint 17A–26B Dashboard */}
          {activeDrug && (
            <section className="mt-8 space-y-6">
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-6 text-white">
                  <p className="text-xs font-bold uppercase tracking-[0.28em] text-blue-200">
                    Release Candidate Dashboard
                  </p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight">
                    Enterprise Intelligence Stack
                  </h2>
                  <p className="mt-2 max-w-4xl text-sm leading-6 text-blue-100">
                    Clustered Sprint 17A–26B dashboard view for the selected medication. Use the tabs to move between overview, readiness, executive, strategy, and validation workflows without scrolling through one long report.
                  </p>
                </div>

                <div className="border-b border-slate-200 bg-slate-50 p-3">
                  <div className="grid gap-2 md:grid-cols-5">
                    {[
                      { id: 'overview', label: 'Overview', description: 'Identity + intelligence' },
                      { id: 'readiness', label: 'Readiness', description: 'Scores + confidence' },
                      { id: 'executive', label: 'Executive', description: 'Ranking + recommendations' },
                      { id: 'strategy', label: 'Strategy', description: 'Deployment + launch' },
                      { id: 'validation', label: 'Validation', description: 'Methods + publication' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveDashboardTab(tab.id as typeof activeDashboardTab)}
                        className={`rounded-2xl border px-4 py-3 text-left transition ${
                          activeDashboardTab === tab.id
                            ? 'border-blue-600 bg-white shadow-sm ring-2 ring-blue-100'
                            : 'border-slate-200 bg-white/70 hover:border-blue-200 hover:bg-white'
                        }`}
                      >
                        <span
                          className={`block text-sm font-black ${
                            activeDashboardTab === tab.id ? 'text-blue-700' : 'text-slate-900'
                          }`}
                        >
                          {tab.label}
                        </span>
                        <span className="mt-1 block text-xs font-semibold text-slate-500">
                          {tab.description}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {activeDashboardTab === 'overview' && (
                <div className="space-y-6">
                  <SafeCardBoundary title="Sprint 15A — Enterprise Intelligence Dashboard">
                    <IntelligenceCard drug={activeDrug} />
                  </SafeCardBoundary>

                  <SafeCardBoundary title="Classification Intelligence">
                    <ClassificationPanel drug={activeDrug} />
                  </SafeCardBoundary>

                  <SafeCardBoundary title="Relationship Intelligence">
                    <RelationshipPanel drug={activeDrug} />
                  </SafeCardBoundary>

                  <SafeCardBoundary title="Knowledge Graph Intelligence">
                    <GraphPanel drug={activeDrug} />
                  </SafeCardBoundary>
                </div>
              )}

              {activeDashboardTab === 'readiness' && (
                <div className="space-y-6">
                  <SafeCardBoundary title="Sprint 17A — Medication Readiness Scorecard">
                    <MedicationReadinessScorecard drug={activeDrug} />
                  </SafeCardBoundary>

                  <SafeCardBoundary title="Sprint 17B — Confidence Engine">
                    <ConfidenceScorecard drug={activeDrug} />
                  </SafeCardBoundary>

                  <SafeCardBoundary title="Sprint 18A — PCA Model Framework">
                    <PCAMethodologyScorecard drug={activeDrug} />
                  </SafeCardBoundary>

                  <SafeCardBoundary title="Sprint 18B — Methodology Consensus Engine">
                    <MethodologyConsensusCard drug={activeDrug} />
                  </SafeCardBoundary>
                </div>
              )}

              {activeDashboardTab === 'executive' && (
                <div className="space-y-6">
                  <SafeCardBoundary title="Sprint 19B — Production Candidate Ranking">
                    <ProductionCandidateCard drug={activeDrug} />
                  </SafeCardBoundary>

                  <SafeCardBoundary title="Sprint 20A — Executive Portfolio Ranking">
                    <ExecutivePortfolioCard drug={activeDrug} />
                  </SafeCardBoundary>

                  <SafeCardBoundary title="Sprint 20B — Executive Leaderboards">
                    <ExecutiveLeaderboardsCard drug={activeDrug} />
                  </SafeCardBoundary>

                  <SafeCardBoundary title="Sprint 21A — Explainability Engine">
                    <ExplainabilityEngineCard drug={activeDrug} />
                  </SafeCardBoundary>

                  <SafeCardBoundary title="Sprint 21B — Executive Recommendation Engine">
                    <ExecutiveRecommendationCard drug={activeDrug} />
                  </SafeCardBoundary>
                </div>
              )}

              {activeDashboardTab === 'strategy' && (
                <div className="space-y-6">
                  <SafeCardBoundary title="Sprint 22A — Strategic Opportunity Engine">
                    <StrategicOpportunityCard drug={activeDrug} />
                  </SafeCardBoundary>

                  <SafeCardBoundary title="Sprint 22B — Portfolio Optimization Engine">
                    <PortfolioOptimizationCard drug={activeDrug} />
                  </SafeCardBoundary>

                  <SafeCardBoundary title="Sprint 23A — AI Copilot Layer">
                    <AICopilotCard drug={activeDrug} />
                  </SafeCardBoundary>

                  <SafeCardBoundary title="Sprint 23B — Enterprise Deployment Layer">
                    <EnterpriseDeploymentCard drug={activeDrug} />
                  </SafeCardBoundary>

                  <SafeCardBoundary title="Sprint 24A — Website Deployment Layer">
                    <WebsiteDeploymentCard drug={activeDrug} />
                  </SafeCardBoundary>

                  <SafeCardBoundary title="Sprint 24B — Production Hardening Layer">
                    <ProductionHardeningCard drug={activeDrug} />
                  </SafeCardBoundary>
                </div>
              )}

              {activeDashboardTab === 'validation' && (
                <div className="space-y-6">
                  <SafeCardBoundary title="Validation Track V1–V5">
                    <ValidationTrackCard drug={activeDrug} />
                  </SafeCardBoundary>

                  <SafeCardBoundary title="Sprint 25A — Methodology Selection Engine">
                    <MethodologySelectionCard drug={activeDrug} />
                  </SafeCardBoundary>

                  <SafeCardBoundary title="Sprint 25B–26B — Publication Readiness Release">
                    <PublicationReadinessCard drug={activeDrug} />
                  </SafeCardBoundary>
                </div>
              )}
            </section>
          )}
          {/* End Release Candidate UI Integration Pass */}

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold text-slate-950">Readiness Profile</h3>

            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="flex flex-wrap gap-2 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200">
            {(['classification', 'relationships', 'graph'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold capitalize ${
                  activeTab === tab
                    ? 'bg-slate-950 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === 'classification' && (
            <>
              <DebugBox
                title="Classification Debug"
                data={detail?.classifications?.counts}
              />
              <MedicationIntelligenceSummaryCard drug={drugWithDetails} />

              <ClassificationPanel drug={drugWithDetails} />
            </>
          )}

          {activeTab === 'relationships' && (
            <>
              <DebugBox
                title="Relationship Debug"
                data={detail?.relationships?.counts}
              />

              <RelationshipPanel drug={drugWithDetails} />
            </>
          )}

          {activeTab === 'graph' && (
            <>
              <DebugBox
                title="Graph Debug"
                data={{
                  node_count: detail?.graph?.nodes?.length || 0,
                  edge_count: detail?.graph?.edges?.length || 0,
                }}
              />

              <GraphPanel drug={drugWithDetails} />
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function DebugBox({
  title,
  data,
}: {
  title: string;
  data: unknown;
}) {
  return (
    <div
      style={{
        background: '#f3f4f6',
        border: '1px solid #d1d5db',
        borderRadius: '12px',
        padding: '12px',
        fontSize: '12px',
        color: '#111827',
        overflow: 'auto',
      }}
    >
      <strong>{title}</strong>
      <pre style={{ marginTop: '8px', whiteSpace: 'pre-wrap' }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-blue-50 p-3 text-blue-700">{icon}</div>

        <div>
          <p className="text-sm text-slate-500">{label}</p>

          <p className="text-2xl font-bold text-slate-950">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
        </div>
      </div>
    </div>
  );
}