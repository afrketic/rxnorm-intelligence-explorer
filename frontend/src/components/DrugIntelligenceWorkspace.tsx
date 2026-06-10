import { DrugCard } from '../lib/api';
import SafeCardBoundary from './SafeCardBoundary';
import ClaimsReadinessDashboard from './ClaimsReadinessDashboard';
import AIReadinessDashboard from './AIReadinessDashboard';
import ClinicalIntelligenceDashboard from './ClinicalIntelligenceDashboard';
import EnterpriseIntelligenceDashboard from './EnterpriseIntelligenceDashboard';
import EnterpriseHealthcareImportanceCard from './EnterpriseHealthcareImportanceCard';
import EvidenceValidationDashboard from './EvidenceValidationDashboard';
import KnowledgeGraphDashboard from './KnowledgeGraphDashboard';

type WorkspaceTab =
  | 'overview'
  | 'claims'
  | 'ai'
  | 'clinical'
  | 'knowledge'
  | 'enterprise'
  | 'validation';

type Props = {
  drug: (DrugCard & Record<string, any>) | null;
  activeTab: WorkspaceTab;
  onSelectSimilarDrug?: (drug: DrugCard) => void;
};

function EmptyState() {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 text-white shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-300">
        Workspace
      </p>
      <h3 className="mt-2 text-2xl font-black">Select a medication</h3>
      <p className="mt-2 text-sm leading-6 text-slate-300">
        Search for a medication to activate the intelligence workspace.
      </p>
    </section>
  );
}

export default function DrugIntelligenceWorkspace({
  drug,
  activeTab,
  onSelectSimilarDrug,
}: Props) {
  if (!drug) return <EmptyState />;

  return (
    <section className="space-y-6">
      {activeTab === 'overview' && (
        <EnterpriseHealthcareImportanceCard drug={drug} />
      )}

      {activeTab === 'claims' && (
        <SafeCardBoundary title="Claims Readiness Dashboard">
          <ClaimsReadinessDashboard drug={drug} />
        </SafeCardBoundary>
      )}

      {activeTab === 'ai' && (
        <SafeCardBoundary title="AI Readiness Dashboard">
          <AIReadinessDashboard drug={drug} />
        </SafeCardBoundary>
      )}

      {activeTab === 'clinical' && (
        <SafeCardBoundary title="Clinical Intelligence Dashboard">
          <ClinicalIntelligenceDashboard
            drug={drug}
            onSelectSimilarDrug={(similarDrug) =>
              onSelectSimilarDrug?.(similarDrug as DrugCard)
            }
          />
        </SafeCardBoundary>
      )}

      {activeTab === 'knowledge' && (
        <SafeCardBoundary title="Knowledge Graph Intelligence">
          <KnowledgeGraphDashboard drug={drug} />
        </SafeCardBoundary>
      )}

      {activeTab === 'enterprise' && (
        <EnterpriseIntelligenceDashboard drug={drug} />
      )}

      {activeTab === 'validation' && (
        <SafeCardBoundary
          title="Evidence & Validation"
          subtitle="Methodology • explainability • statistical validation"
        >
          <EvidenceValidationDashboard drug={drug} />
        </SafeCardBoundary>
      )}
    </section>
  );
}