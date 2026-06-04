import { useMemo, useState } from 'react';
import { DrugCard } from '../lib/api';
import SafeCardBoundary from './SafeCardBoundary';
import MedicationIntelligenceSummaryCard from './MedicationIntelligenceSummaryCard';
import ClassificationPanel from './ClassificationPanel';
import RelationshipPanel from './RelationshipPanel';
import GraphPanel from './GraphPanel';
import ExplainabilityEngineCard from './ExplainabilityEngineCard';
import MedicationReadinessScorecard from './MedicationReadinessScorecard';
import ConfidenceScorecard from './ConfidenceScorecard';
import PCAMethodologyScorecard from './PCAMethodologyScorecard';
import MethodologyConsensusCard from './MethodologyConsensusCard';
import ExecutivePortfolioCard from './ExecutivePortfolioCard';
import ExecutiveLeaderboardsCard from './ExecutiveLeaderboardsCard';
import ExecutiveRecommendationCard from './ExecutiveRecommendationCard';
import ProductionCandidateCard from './ProductionCandidateCard';
import EnterpriseDeploymentCard from './EnterpriseDeploymentCard';
import WebsiteDeploymentCard from './WebsiteDeploymentCard';
import ValidationTrackCard from './ValidationTrackCard';
import PublicationReadinessCard from './PublicationReadinessCard';
import StrategicOpportunityCard from './StrategicOpportunityCard';
import PortfolioOptimizationCard from './PortfolioOptimizationCard';
import AICopilotCard from './AICopilotCard';
import ProductionHardeningCard from './ProductionHardeningCard';
import MethodologySelectionCard from './MethodologySelectionCard';

type WorkspaceTab =
  | 'overview'
  | 'clinical'
  | 'knowledge'
  | 'ai'
  | 'executive'
  | 'production';

type Props = {
  drug: (DrugCard & Record<string, any>) | null;
  onSelectSimilarDrug?: (drug: DrugCard) => void;
};

const WORKSPACE_TABS: Array<{
  id: WorkspaceTab;
  label: string;
  description: string;
}> = [
  { id: 'overview', label: 'Overview', description: 'Executive snapshot + medication identity' },
  { id: 'clinical', label: 'Clinical', description: 'ATC, disease, MOA, EPC, and peers' },
  { id: 'knowledge', label: 'Knowledge Graph', description: 'Graph structure + RxNorm relationships' },
  { id: 'ai', label: 'AI Intelligence', description: 'Explainability, readiness, confidence, methods' },
  { id: 'executive', label: 'Executive', description: 'Portfolio, leaderboards, and recommendations' },
  { id: 'production', label: 'Production', description: 'Deployment, validation, and publication readiness' },
];

function EmptyState() {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 text-white shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-300">Workspace</p>
      <h3 className="mt-2 text-2xl font-black">Select a medication</h3>
      <p className="mt-2 text-sm leading-6 text-slate-300">
        Search for a medication to activate the intelligence workspace.
      </p>
    </section>
  );
}

export default function DrugIntelligenceWorkspace({ drug, onSelectSimilarDrug }: Props) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');

  const active = useMemo(
    () => WORKSPACE_TABS.find((tab) => tab.id === activeTab) || WORKSPACE_TABS[0],
    [activeTab]
  );

  if (!drug) return <EmptyState />;

  return (
    <section className="space-y-3">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-3 shadow-sm">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {WORKSPACE_TABS.map((tab) => {
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
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

      <div className="rounded-3xl border border-blue-900/40 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950/70 p-6 text-white shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-blue-300">Drug Intelligence Workspace</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight">{active.label}</h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">{active.description}</p>
      </div>

      {activeTab === 'overview' && (
        <SafeCardBoundary title="Medication Intelligence Profile">
          <MedicationIntelligenceSummaryCard drug={drug} />
        </SafeCardBoundary>
      )}

      {activeTab === 'clinical' && (
        <SafeCardBoundary title="Clinical + Classification Intelligence">
          <ClassificationPanel
            drug={drug}
            onSelectSimilarDrug={(similarDrug) => onSelectSimilarDrug?.(similarDrug as DrugCard)}
          />
        </SafeCardBoundary>
      )}

      {activeTab === 'knowledge' && (
        <>
          <SafeCardBoundary title="Knowledge Graph Intelligence" subtitle="Clinical domains • classifications • relationships">
            <GraphPanel drug={drug} />
          </SafeCardBoundary>
          <SafeCardBoundary title="RxNorm Relationship Intelligence">
            <RelationshipPanel drug={drug} />
          </SafeCardBoundary>
        </>
      )}

      {activeTab === 'ai' && (
        <>
          <SafeCardBoundary title="Explainability Engine">
            <ExplainabilityEngineCard drug={drug} />
          </SafeCardBoundary>
          <SafeCardBoundary title="Medication Readiness Scorecard">
            <MedicationReadinessScorecard drug={drug} />
          </SafeCardBoundary>
          <SafeCardBoundary title="Confidence Engine">
            <ConfidenceScorecard drug={drug} />
          </SafeCardBoundary>
          <SafeCardBoundary title="PCA Model Framework">
            <PCAMethodologyScorecard drug={drug} />
          </SafeCardBoundary>
          <SafeCardBoundary title="Methodology Consensus Engine">
            <MethodologyConsensusCard drug={drug} />
          </SafeCardBoundary>
          <SafeCardBoundary title="Methodology Selection Engine">
            <MethodologySelectionCard drug={drug} />
          </SafeCardBoundary>
        </>
      )}

      {activeTab === 'executive' && (
        <>
          <SafeCardBoundary title="Executive Portfolio Ranking">
            <ExecutivePortfolioCard drug={drug} />
          </SafeCardBoundary>
          <SafeCardBoundary title="Executive Leaderboards">
            <ExecutiveLeaderboardsCard />
          </SafeCardBoundary>
          <SafeCardBoundary title="Executive Recommendation Engine">
            <ExecutiveRecommendationCard drug={drug} />
          </SafeCardBoundary>
          <SafeCardBoundary title="AI Copilot Brief">
            <AICopilotCard drug={drug} />
          </SafeCardBoundary>
        </>
      )}

      {activeTab === 'production' && (
        <>
          <SafeCardBoundary title="Production Candidate Ranking">
            <ProductionCandidateCard drug={drug} />
          </SafeCardBoundary>
          <SafeCardBoundary title="Strategic Opportunity Engine">
            <StrategicOpportunityCard drug={drug} />
          </SafeCardBoundary>
          <SafeCardBoundary title="Portfolio Optimization Engine">
            <PortfolioOptimizationCard drug={drug} />
          </SafeCardBoundary>
          <SafeCardBoundary title="Enterprise Deployment Layer">
            <EnterpriseDeploymentCard drug={drug} />
          </SafeCardBoundary>
          <SafeCardBoundary title="Website Deployment Layer">
            <WebsiteDeploymentCard drug={drug} />
          </SafeCardBoundary>
          <SafeCardBoundary title="Production Hardening Layer">
            <ProductionHardeningCard drug={drug} />
          </SafeCardBoundary>
          <SafeCardBoundary title="Validation Track V1–V5">
            <ValidationTrackCard drug={drug} />
          </SafeCardBoundary>
          <SafeCardBoundary title="Publication Readiness Release">
            <PublicationReadinessCard drug={drug} />
          </SafeCardBoundary>
        </>
      )}
    </section>
  );
}
