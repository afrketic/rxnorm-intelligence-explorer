import { DrugCard } from '../lib/api';
import SafeCardBoundary from './SafeCardBoundary';
import ExecutivePortfolioCard from './ExecutivePortfolioCard';
import EnterpriseHealthcareImportanceCard from './EnterpriseHealthcareImportanceCard';
import ExecutiveLeaderboardsCard from './ExecutiveLeaderboardsCard';
import ExecutiveRecommendationCard from './ExecutiveRecommendationCard';
import ProductionCandidateCard from './ProductionCandidateCard';
import StrategicOpportunityCard from './StrategicOpportunityCard';
import PortfolioOptimizationCard from './PortfolioOptimizationCard';
import EnterpriseDeploymentCard from './EnterpriseDeploymentCard';
import WebsiteDeploymentCard from './WebsiteDeploymentCard';
import ProductionHardeningCard from './ProductionHardeningCard';
import ValidationTrackCard from './ValidationTrackCard';
import PublicationReadinessCard from './PublicationReadinessCard';

type Props = {
  drug: (DrugCard & Record<string, any>) | null;
};

export default function EnterpriseIntelligenceDashboard({ drug }: Props) {
  return (
    <section className="space-y-4">
      <div className="rounded-3xl border border-blue-900/40 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950/70 p-6 text-white shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">Executive Decision Layer</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight">Executive Decision Dashboard</h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
          Executive Impact, Healthcare Importance, Enterprise Intelligence, validation status, driver logic, recommendation strategy, portfolio ranking, and deployment decision support.
        </p>
      </div>

      <SafeCardBoundary title="Executive Impact Score">
        <EnterpriseHealthcareImportanceCard drug={drug} />
      </SafeCardBoundary>

      <SafeCardBoundary title="Executive Portfolio Ranking">
        <ExecutivePortfolioCard drug={drug} />
      </SafeCardBoundary>

      <SafeCardBoundary title="Executive Leaderboards">
        <ExecutiveLeaderboardsCard />
      </SafeCardBoundary>

      <SafeCardBoundary title="Executive Recommendation Engine">
        <ExecutiveRecommendationCard drug={drug} />
      </SafeCardBoundary>

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
    </section>
  );
}
