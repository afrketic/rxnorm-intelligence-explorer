import { useEffect, useMemo, useState } from 'react';
import {
  EnterpriseOpportunityItem,
  getEnterpriseOpportunitiesByUseCase,
  getEnterpriseOpportunitiesTop,
  getEnterpriseOpportunityPortfolio,
} from '../lib/api';

function formatNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  const resolved = Number.isFinite(numeric) ? numeric : fallback;
  return resolved.toLocaleString();
}

function formatScore(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return numeric.toFixed(2);
}

function formatRank(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? `#${Math.round(numeric).toLocaleString()}` : '—';
}

function getOpportunityName(item: EnterpriseOpportunityItem | null | undefined) {
  return item?.portfolio_name || item?.portfolio_code || 'Portfolio opportunity';
}

function getTierStyle(tier: string | undefined) {
  const text = String(tier || '').toLowerCase();

  if (text.includes('high')) {
    return 'border-emerald-300/40 bg-emerald-400/15 text-emerald-100';
  }

  if (text.includes('strategic')) {
    return 'border-cyan-300/40 bg-cyan-400/15 text-cyan-100';
  }

  if (text.includes('selective')) {
    return 'border-blue-300/40 bg-blue-400/15 text-blue-100';
  }

  return 'border-slate-500/50 bg-slate-700/35 text-slate-100';
}

function OpportunityRow({ item }: { item: EnterpriseOpportunityItem }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-purple-300">
            {item.portfolio_type || 'Portfolio'}
          </p>
          <p className="mt-2 text-sm font-black leading-5 text-white">
            {getOpportunityName(item)}
          </p>
        </div>
        <span className="rounded-full border border-purple-300/25 bg-purple-300/10 px-3 py-1 text-xs font-black text-purple-100">
          {formatRank(item.enterprise_opportunity_rank)}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="font-bold uppercase tracking-wide text-slate-500">EOS</p>
          <p className="mt-1 font-black text-slate-100">{formatScore(item.enterprise_opportunity_score)}</p>
        </div>
        <div>
          <p className="font-bold uppercase tracking-wide text-slate-500">Maturity</p>
          <p className="mt-1 font-black text-slate-100">{formatScore(item.portfolio_maturity_score)}</p>
        </div>
        <div>
          <p className="font-bold uppercase tracking-wide text-slate-500">Critical</p>
          <p className="mt-1 font-black text-slate-100">{formatNumber(item.enterprise_critical_count)}</p>
        </div>
      </div>

      <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-black ${getTierStyle(item.opportunity_tier)}`}>
        {item.opportunity_tier || 'Opportunity Profile'}
      </span>
    </div>
  );
}

function HeroMetric({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-2xl border border-purple-300/20 bg-purple-400/10 p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-purple-200">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs font-semibold leading-5 text-purple-50/80">{helper}</p>
    </div>
  );
}

export default function EnterpriseOpportunitiesCard() {
  const [topOpportunities, setTopOpportunities] = useState<EnterpriseOpportunityItem[]>([]);
  const [aiTargets, setAiTargets] = useState<EnterpriseOpportunityItem[]>([]);
  const [glp1, setGlp1] = useState<EnterpriseOpportunityItem | null>(null);
  const [useCaseSummary, setUseCaseSummary] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadEnterpriseOpportunities() {
      setLoading(true);
      setError(null);

      try {
        const [topRows, useCases, aiRows, glp1Row] = await Promise.all([
          getEnterpriseOpportunitiesTop(20),
          getEnterpriseOpportunitiesByUseCase(undefined, 10),
          getEnterpriseOpportunitiesByUseCase('Best AI Deployment Target', 10),
          getEnterpriseOpportunityPortfolio('ATC4', 'A10BJ').catch(() => null),
        ]);

        if (!active) return;
        setTopOpportunities(topRows);
        setUseCaseSummary(useCases.use_cases || []);
        setAiTargets(aiRows.opportunities || []);
        setGlp1(glp1Row);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load Enterprise Opportunities.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadEnterpriseOpportunities();

    return () => {
      active = false;
    };
  }, []);

  const highestGrowth = useMemo(() => topOpportunities.slice(0, 3), [topOpportunities]);

  const underservedTherapeutic = useMemo(
    () =>
      topOpportunities
        .filter((item) => item.portfolio_type === 'Therapeutic Domain' || item.portfolio_type === 'Disease Area')
        .slice(0, 3),
    [topOpportunities],
  );

  const bestClaimsTargets = useMemo(
    () =>
      topOpportunities
        .filter((item) =>
          String(item.portfolio_name || '').toLowerCase().includes('diabetes') ||
          String(item.portfolio_name || '').toLowerCase().includes('cardio') ||
          String(item.portfolio_name || '').toLowerCase().includes('arthritis') ||
          String(item.portfolio_name || '').toLowerCase().includes('pain') ||
          Number(item.medication_count || 0) >= 25,
        )
        .slice(0, 3),
    [topOpportunities],
  );

  const totalUseCases = useCaseSummary.reduce((sum, item) => sum + Number(item.opportunity_count || 0), 0);
  const bestUseCase = useCaseSummary[0]?.opportunity_use_case || 'Opportunity Intelligence';

  return (
    <section className="overflow-hidden rounded-3xl border border-purple-400/25 bg-[radial-gradient(circle_at_top_left,_rgba(168,85,247,0.18),_transparent_34%),linear-gradient(135deg,#020617,#111827_50%,#312e81)] text-white shadow-2xl shadow-purple-950/20">
      <div className="p-6 md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-purple-300">
              Enterprise Opportunities
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">
              Opportunity Intelligence Engine
            </h2>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">
              Portfolio Intelligence now advances from what matters to where enterprise leaders should focus investment, AI deployment, claims analytics, and strategic review.
            </p>
          </div>

          <span className="rounded-full border border-purple-300/30 bg-purple-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-purple-100">
            H3B.4 EOS Layer
          </span>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <HeroMetric
            label="Highest Growth Opportunities"
            value={formatNumber(topOpportunities.length)}
            helper={`${totalUseCases.toLocaleString()} calibrated opportunity profiles available`}
          />
          <HeroMetric
            label="Best AI Deployment Targets"
            value={formatNumber(aiTargets.length)}
            helper={bestUseCase}
          />
          <HeroMetric
            label="GLP-1 Opportunity Profile"
            value={formatScore(glp1?.enterprise_opportunity_score)}
            helper={`${glp1?.opportunity_tier || 'Selective Opportunity'} · ${formatRank(glp1?.enterprise_opportunity_rank)}`}
          />
        </div>

        {glp1 && (
          <div className="mt-5 rounded-3xl border border-cyan-300/20 bg-cyan-400/10 p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
              GLP-1 Opportunity Profile
            </p>
            <p className="mt-2 text-base font-semibold leading-7 text-cyan-50">
              {glp1.portfolio_name} has an Enterprise Opportunity Score of {formatScore(glp1.enterprise_opportunity_score)}. The portfolio is highly important but already partially mature, making it a selective opportunity for AI deployment, claims analytics, and portfolio strategy rather than an underserved growth area.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <HeroMetric label="Importance" value={formatScore(glp1.portfolio_importance_score)} helper="Portfolio importance signal" />
              <HeroMetric label="Maturity" value={formatScore(glp1.portfolio_maturity_score)} helper="Development and critical-mass signal" />
              <HeroMetric label="EOS Rank" value={formatRank(glp1.enterprise_opportunity_rank)} helper="Enterprise opportunity rank" />
              <HeroMetric label="Use Case" value="AI" helper={glp1.opportunity_use_case || 'Best AI Deployment Target'} />
            </div>
          </div>
        )}

        <div className="mt-5 grid gap-4 xl:grid-cols-3">
          <div className="rounded-3xl border border-purple-300/15 bg-slate-950/45 p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-300">
              Highest Growth Opportunities
            </p>
            <div className="mt-4 space-y-3">
              {highestGrowth.map((item) => (
                <OpportunityRow key={`growth-${item.portfolio_type}-${item.portfolio_code || item.portfolio_name}`} item={item} />
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-cyan-300/15 bg-slate-950/45 p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
              Most Underserved Therapeutic Areas
            </p>
            <div className="mt-4 space-y-3">
              {underservedTherapeutic.map((item) => (
                <OpportunityRow key={`underserved-${item.portfolio_type}-${item.portfolio_code || item.portfolio_name}`} item={item} />
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-300/15 bg-slate-950/45 p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
              Best AI / Claims Targets
            </p>
            <div className="mt-4 space-y-3">
              {(aiTargets.length ? aiTargets : bestClaimsTargets).slice(0, 3).map((item) => (
                <OpportunityRow key={`target-${item.portfolio_type}-${item.portfolio_code || item.portfolio_name}`} item={item} />
              ))}
            </div>
          </div>
        </div>

        {loading && (
          <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm font-semibold text-slate-300">
            Loading enterprise opportunities…
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-2xl border border-rose-400/40 bg-rose-500/10 p-4 text-sm font-semibold text-rose-100">
            {error}
          </div>
        )}
      </div>
    </section>
  );
}
