import { DrugCard } from '../lib/api';
import SafeCardBoundary from './SafeCardBoundary';
import EnterpriseHealthcareImportanceCard from './EnterpriseHealthcareImportanceCard';
import ExecutiveRecommendationCard from './ExecutiveRecommendationCard';
import PortfolioIntelligenceCard from './PortfolioIntelligenceCard';
import EnterpriseOpportunitiesCard from './EnterpriseOpportunitiesCard';

type Props = {
  drug: (DrugCard & Record<string, any>) | null;
};

export default function EnterpriseIntelligenceDashboard({ drug }: Props) {
  return (
    <section className="space-y-4">
      <div className="rounded-3xl border border-blue-900/40 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950/70 p-6 text-white shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
          Enterprise Intelligence Layer
        </p>

        <h2 className="mt-2 text-3xl font-black tracking-tight">
          Executive Decision Dashboard
        </h2>

        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
          Enterprise Healthcare Importance, benchmark position, portfolio intelligence, opportunity intelligence,
          executive impact, validation, and deployment readiness in one
          decision-ready healthcare intelligence layer.
        </p>
      </div>

      <SafeCardBoundary title="Executive Impact Score">
        <EnterpriseHealthcareImportanceCard drug={drug} />
      </SafeCardBoundary>

      <SafeCardBoundary title="Portfolio Intelligence">
        <PortfolioIntelligenceCard />
      </SafeCardBoundary>

      <SafeCardBoundary title="Enterprise Opportunities">
        <EnterpriseOpportunitiesCard />
      </SafeCardBoundary>

      <SafeCardBoundary title="Executive Recommendation Engine">
        <ExecutiveRecommendationCard drug={drug} />
      </SafeCardBoundary>

      <div className="rounded-2xl border border-cyan-500/20 bg-slate-950/70 px-5 py-4 text-sm font-semibold leading-6 text-slate-400">
        <span className="mr-3 text-cyan-300">ⓘ</span>
        Executive Dashboard is intentionally concise. Methodology, validation,
        publication readiness, leaderboards, portfolio optimization, production
        hardening, and deployment evidence are organized under Evidence &
        Validation.
      </div>
    </section>
  );
}
