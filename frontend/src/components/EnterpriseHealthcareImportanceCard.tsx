import { useEffect, useMemo, useState } from 'react';
import {
  DrugCard,
  EnterpriseHealthcareImportance,
  EnterpriseHealthcareImportanceValidation,
  getEnterpriseHealthcareImportance,
  getEnterpriseHealthcareImportanceValidation,
} from '../lib/api';

type Props = {
  drug: DrugCard | null;
};

const DEFAULT_POPULATION_SIZE = 30132;

function toNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function formatScore(value: unknown) {
  return toNumber(value).toFixed(2);
}

function formatDomainScore(value: unknown) {
  return toNumber(value).toFixed(1);
}

function formatRank(value: unknown) {
  const numeric = toNumber(value);
  return numeric > 0 ? `#${Math.round(numeric).toLocaleString()}` : 'Not ranked';
}

function formatCompactNumber(value: unknown) {
  const numeric = toNumber(value);
  if (numeric <= 0) return 'Not available';
  if (numeric >= 1_000_000_000) return `${(numeric / 1_000_000_000).toFixed(1)}B`;
  if (numeric >= 1_000_000) return `${(numeric / 1_000_000).toFixed(1)}M`;
  if (numeric >= 1_000) return `${(numeric / 1_000).toFixed(1)}K`;
  return Math.round(numeric).toLocaleString();
}

function formatR2(value: unknown) {
  const numeric = toNumber(value);
  return numeric > 0 ? `${(numeric * 100).toFixed(1)}%` : 'Not available';
}

function formatPredictiveStrength(value: unknown) {
  const numeric = toNumber(value);
  return numeric > 0 ? `${numeric.toFixed(1)} / 100` : 'Not available';
}

function formatCurrency(value: unknown) {
  const numeric = toNumber(value);
  if (numeric <= 0) return 'Not available';
  if (numeric >= 1_000_000_000) return `$${(numeric / 1_000_000_000).toFixed(1)}B`;
  if (numeric >= 1_000_000) return `$${(numeric / 1_000_000).toFixed(1)}M`;
  if (numeric >= 1_000) return `$${(numeric / 1_000).toFixed(1)}K`;
  return `$${Math.round(numeric).toLocaleString()}`;
}

function formatCurrencyExact(value: unknown) {
  const numeric = toNumber(value);
  return numeric > 0 ? `$${Math.round(numeric).toLocaleString()}` : 'Not available';
}

function formatRankOf(value: unknown, population: unknown) {
  const rank = toNumber(value);
  const total = toNumber(population);

  if (rank <= 0) return 'Not ranked';

  return total > 0
    ? `#${Math.round(rank).toLocaleString()} / ${Math.round(total).toLocaleString()}`
    : formatRank(rank);
}

function formatPercentile(value: unknown) {
  const numeric = toNumber(value);
  return numeric > 0 ? `${numeric.toFixed(2)}th percentile` : 'Percentile unavailable';
}

function formatPopulationPercentile(percentile: unknown, rank: unknown) {
  const percentileValue = toNumber(percentile);
  const rankValue = Math.round(toNumber(rank));

  if (rankValue === 1) return 'Top 0.01%';
  if (percentileValue > 0) return `${percentileValue.toFixed(2)}th percentile`;

  return 'Percentile unavailable';
}

function formatPercent(value: unknown) {
  const numeric = toNumber(value);
  if (numeric <= 0) return 'Not available';
  if (numeric < 1) return `${numeric.toFixed(2)}%`;
  return `${numeric.toFixed(1)}%`;
}

function formatSignedRankChange(value: unknown) {
  const numeric = Math.round(toNumber(value));
  if (numeric > 0) return `+${numeric}`;
  if (numeric < 0) return `${numeric}`;
  return '0';
}

function formatValidationScore(value: unknown) {
  const numeric = toNumber(value);
  return numeric > 0 ? `${numeric.toFixed(1)} / 100` : 'Not available';
}

function calculateBenchmarkConfidence(payload: EnterpriseHealthcareImportance) {
  const ehiPercentile = toNumber(payload.ehi_percentile);
  const cmsSpendPercentile = toNumber(payload.cms_enterprise_impact?.spend_percentile);
  const cmsUtilizationPercentile = toNumber(payload.cms_enterprise_impact?.utilization_percentile);
  const cdcBurdenScore = toNumber(payload.cdc_burden_score);

  const signals = [
    ehiPercentile,
    cmsSpendPercentile,
    cmsUtilizationPercentile,
    cdcBurdenScore,
  ].filter((value) => value > 0);

  if (!signals.length) return 0;

  return signals.reduce((sum, value) => sum + value, 0) / signals.length;
}

function getTierStyle(tier?: string) {
  const normalized = (tier || '').toLowerCase();

  if (normalized.includes('strategic')) return 'border-cyan-300/60 bg-cyan-300/15 text-cyan-100';
  if (normalized.includes('enterprise')) return 'border-blue-300/60 bg-blue-300/15 text-blue-100';
  if (normalized.includes('high')) return 'border-emerald-300/60 bg-emerald-300/15 text-emerald-100';
  if (normalized.includes('moderate')) return 'border-yellow-300/60 bg-yellow-300/15 text-yellow-100';

  return 'border-slate-500/60 bg-slate-800 text-slate-200';
}

function getTopShare(payload: EnterpriseHealthcareImportance | null) {
  if (!payload) return 0;

  const explicit = Number(payload.top_population_share_pct);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;

  const rank = Number(payload.ehi_rank);
  const population = Number(payload.population_size || DEFAULT_POPULATION_SIZE);

  if (Number.isFinite(rank) && rank > 0 && population > 0) {
    return (rank / population) * 100;
  }

  return 0;
}

function getMethodologyBadge(payload: EnterpriseHealthcareImportance | null) {
  return (
    payload?.dashboard_ehi_version ||
    payload?.ehi_version ||
    payload?.methodology?.version ||
    'EHI V6 Calibrated'
  );
}

function buildPlainEnglishExplanation(payload: EnterpriseHealthcareImportance) {
  const drugName = payload.drug_name || payload.display_name || 'This medication';
  const primary = payload.primary_driver || 'the strongest enterprise signal';
  const limiting = payload.limiting_factor || 'the main evidence gap';
  const tier = payload.ehi_tier_label || 'its current enterprise tier';

  return `${drugName} is classified as ${tier}. The score is primarily driven by ${primary}, while ${limiting} is the main limiting factor. This means the medication has strong measured healthcare importance, but the profile can become even stronger as the limiting evidence layer improves.`;
}

function buildValidationNarrative(validation: EnterpriseHealthcareImportanceValidation | null) {
  return (
    validation?.validation_interpretation ||
    'The EHI score is evaluated using statistical stability, sensitivity testing, methodology agreement, and confidence interval analysis. These validation layers help determine whether the current Healthcare Importance estimate is stable, defensible, and suitable for executive interpretation.'
  );
}

function buildBenchmarkAlignmentNarrative(payload: EnterpriseHealthcareImportance) {
  const drugName = payload.drug_name || payload.display_name || 'This medication';
  const ehiRank = payload.ehi_rank
    ? `#${Math.round(toNumber(payload.ehi_rank)).toLocaleString()}`
    : 'not ranked';
  const cmsSpendRank = payload.cms_enterprise_impact?.spend_rank
    ? `#${Math.round(toNumber(payload.cms_enterprise_impact.spend_rank)).toLocaleString()}`
    : 'not available';
  const cmsUtilizationRank = payload.cms_enterprise_impact?.utilization_rank
    ? `#${Math.round(toNumber(payload.cms_enterprise_impact.utilization_rank)).toLocaleString()}`
    : 'not available';
  const cdcSignal = payload.cdc_burden_score
    ? `${formatDomainScore(payload.cdc_burden_score)} / 100`
    : 'not available';
  const benchmarkConfidence = calculateBenchmarkConfidence(payload);

  return `${drugName} shows strong external benchmark alignment. Its EHI rank of ${ehiRank} is supported by CMS spend rank ${cmsSpendRank}, CMS utilization rank ${cmsUtilizationRank}, and a CDC burden signal of ${cdcSignal}. The combined benchmark confidence is ${formatDomainScore(benchmarkConfidence)} / 100, indicating the EHI framework is directionally consistent with real-world public healthcare burden and utilization signals.`;
}


function getNestedValue(source: any, paths: string[], fallback: unknown = null) {
  for (const path of paths) {
    const value = path.split('.').reduce((current, key) => current?.[key], source);
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return fallback;
}

function formatExecutiveScore(value: unknown, fallback: unknown = 0) {
  const numeric = toNumber(value, toNumber(fallback));
  return numeric > 0 ? numeric.toFixed(1) : 'Not available';
}

function formatExecutiveRank(value: unknown) {
  const numeric = toNumber(value);
  return numeric > 0 ? `#${Math.round(numeric).toLocaleString()}` : 'Not ranked';
}

function getExecutiveTierStyle(tier?: string) {
  const normalized = (tier || '').toLowerCase();
  if (normalized.includes('critical')) return 'border-cyan-300/50 bg-cyan-300/15 text-cyan-100';
  if (normalized.includes('strategic')) return 'border-violet-300/50 bg-violet-300/15 text-violet-100';
  if (normalized.includes('high')) return 'border-blue-300/50 bg-blue-300/15 text-blue-100';
  if (normalized.includes('relevant')) return 'border-emerald-300/50 bg-emerald-300/15 text-emerald-100';
  return 'border-slate-300/40 bg-slate-300/10 text-slate-100';
}

function buildExecutiveDrivers(drug: any, payload: EnterpriseHealthcareImportance | null) {
  const ehiScore = toNumber(
    getNestedValue(drug, ['executive_impact.healthcare_importance_score', 'ehi_v6.score', 'scorecard.ehi_v6_score']),
    toNumber(payload?.ehi_score),
  );
  const eiiScore = toNumber(
    getNestedValue(drug, ['executive_impact.enterprise_intelligence_score', 'eii.score', 'scorecard.eii_score']),
  );
  const validationScore = toNumber(
    getNestedValue(drug, ['executive_impact.validation_score', 'ehi_v6.validation_score', 'scorecard.ehi_v6_validation_score']),
  );
  const aiScore = toNumber(getNestedValue(drug, ['scorecard.ai_readiness_score', 'ai_readiness_score']));
  const claimsScore = toNumber(getNestedValue(drug, ['scorecard.claims_readiness_score', 'claims_readiness_score']));
  const graphScore = toNumber(getNestedValue(drug, ['eii.raw.knowledge_graph_score', 'knowledge_graph_score']));

  const driverCandidates = [
    {
      label: 'Healthcare Importance',
      value: ehiScore,
      detail: 'Core EHI V6 signal measuring utilization, spend, population impact, disease burden, and risk.',
    },
    {
      label: 'Enterprise Intelligence',
      value: eiiScore,
      detail: 'Enterprise usability signal combining EHI, AI readiness, claims readiness, clinical semantics, graph maturity, and explainability.',
    },
    {
      label: 'Validation Strength',
      value: validationScore,
      detail: 'Production validation score from the EHI V6 statistical framework.',
    },
    {
      label: 'AI Readiness',
      value: aiScore,
      detail: 'Indicates how well the medication can support AI workflows and intelligence automation.',
    },
    {
      label: 'Claims Readiness',
      value: claimsScore,
      detail: 'Indicates operational usefulness for claims, benefit, payer, and PBM analytics.',
    },
    {
      label: 'Knowledge Graph',
      value: graphScore,
      detail: 'Measures graph connectivity and relationship coverage for semantic intelligence.',
    },
  ].filter((item) => item.value > 0);

  const sorted = [...driverCandidates].sort((a, b) => b.value - a.value);
  const limiting = [...driverCandidates].sort((a, b) => a.value - b.value)[0];

  return {
    primary: sorted[0] || {
      label: payload?.primary_driver || 'Executive Impact',
      value: toNumber(getNestedValue(drug, ['executive_impact.executive_impact_score'])),
      detail: payload?.driver_explanation || 'Strongest contributor to executive-level value.',
    },
    secondary: sorted[1] || {
      label: 'Enterprise Intelligence',
      value: eiiScore,
      detail: 'Secondary enterprise signal supporting executive decision-making.',
    },
    limiting: limiting || {
      label: payload?.limiting_factor || 'Additional Evidence Depth',
      value: 0,
      detail: payload?.limiting_factor_explanation || 'Main opportunity for additional score strength.',
    },
  };
}

function buildRecommendedExecutiveAction(drug: any, payload: EnterpriseHealthcareImportance | null) {
  const tier = String(getNestedValue(drug, ['executive_impact.executive_impact_tier', 'eis.tier'], ''));
  const score = toNumber(getNestedValue(drug, ['executive_impact.executive_impact_score', 'eis.score']));

  if (tier.toLowerCase().includes('critical') || score >= 95) {
    return 'Prioritize for executive portfolio monitoring, payer/PBM strategy, AI-enabled intelligence workflows, and validation-backed healthcare decision support.';
  }

  if (tier.toLowerCase().includes('strategic') || score >= 90) {
    return 'Advance as a strategic medication intelligence candidate with targeted monitoring across clinical, claims, AI, and portfolio use cases.';
  }

  if (score >= 80) {
    return 'Maintain as an enterprise-relevant medication with focused review for deployment readiness and evidence expansion.';
  }

  return (payload as any)?.recommended_action || 'Monitor as a foundational medication intelligence profile and expand evidence coverage before executive prioritization.';
}

export default function EnterpriseHealthcareImportanceCard({ drug }: Props) {
  const [payload, setPayload] = useState<EnterpriseHealthcareImportance | null>(null);
  const [validationPayload, setValidationPayload] =
    useState<EnterpriseHealthcareImportanceValidation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rxcui = drug?.rxcui;

  useEffect(() => {
    if (!rxcui) return;

    let active = true;

    async function loadEhi() {
      setLoading(true);
      setError(null);
      setValidationPayload(null);

      try {
        const json = await getEnterpriseHealthcareImportance(rxcui);
        if (!active) return;

        setPayload(json);

        try {
          const validationJson = await getEnterpriseHealthcareImportanceValidation(rxcui);
          if (active) setValidationPayload(validationJson);
        } catch {
          if (active) setValidationPayload(null);
        }
      } catch (err) {
        if (!active) return;
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load Enterprise Healthcare Importance.'
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    loadEhi();

    return () => {
      active = false;
    };
  }, [rxcui]);

  const domainScores = useMemo(() => {
    if (!payload) return [];

    return [
      { label: 'Disease Burden', value: payload.disease_burden_score, detail: 'Clinical and CDC burden signal' },
      { label: 'Utilization', value: payload.utilization_score, detail: 'Observed use intensity' },
      { label: 'Population Impact', value: payload.population_impact_score, detail: 'Breadth of healthcare relevance' },
      { label: 'Spend', value: payload.spend_score, detail: 'Economic importance signal' },
      { label: 'Risk', value: payload.risk_score, detail: 'FDA and safety-informed signal' },
      { label: 'CDC Mortality Burden', value: payload.cdc_burden_score, detail: 'CDC WONDER burden layer' },
    ].filter((item) => item.value !== undefined && item.value !== null);
  }, [payload]);

  if (!drug) return null;

  const drugName =
    payload?.drug_name ||
    payload?.display_name ||
    drug.drug_name ||
    drug.display_name ||
    drug.rxnorm_name ||
    'Selected medication';

  const methodologyBadge = getMethodologyBadge(payload);
  const topShare = getTopShare(payload);
  const productionStatus = payload?.dashboard_status || payload?.methodology?.status || 'PRODUCTION';

  const executiveImpact = (drug as any)?.executive_impact || {};
  const eii = (drug as any)?.eii || {};
  const ehiV6 = (drug as any)?.ehi_v6 || {};
  const eis = (drug as any)?.eis || {};

  const executiveImpactScore =
    executiveImpact.executive_impact_score ??
    eis.score ??
    (drug as any)?.scorecard?.eis_score ??
    payload?.ehi_score;

  const executiveImpactTier =
    executiveImpact.executive_impact_tier ||
    eis.tier ||
    (drug as any)?.scorecard?.eis_tier ||
    payload?.ehi_tier_label ||
    'Not tiered';

  const executiveImpactRank =
    executiveImpact.executive_impact_rank ||
    eis.rank ||
    (drug as any)?.scorecard?.eis_rank ||
    payload?.ehi_rank;

  const executiveImpactPercentile =
    executiveImpact.executive_impact_percentile ||
    eis.percentile ||
    (drug as any)?.scorecard?.eis_percentile ||
    payload?.ehi_percentile;

  const healthcareImportanceScore =
    executiveImpact.healthcare_importance_score ||
    ehiV6.score ||
    (drug as any)?.scorecard?.ehi_v6_score ||
    payload?.ehi_score;

  const healthcareImportanceTier =
    executiveImpact.healthcare_importance_tier ||
    ehiV6.tier_label ||
    (drug as any)?.scorecard?.ehi_v6_tier_label ||
    payload?.ehi_tier_label ||
    'Not tiered';

  const enterpriseIntelligenceScore =
    executiveImpact.enterprise_intelligence_score ||
    eii.score ||
    (drug as any)?.scorecard?.eii_score;

  const enterpriseIntelligenceTier =
    executiveImpact.enterprise_intelligence_tier ||
    eii.tier ||
    (drug as any)?.scorecard?.eii_tier ||
    'Not tiered';

  const validationScore =
    executiveImpact.validation_score ||
    ehiV6.validation_score ||
    (drug as any)?.scorecard?.ehi_v6_validation_score;

  const validationStatus =
    executiveImpact.validation_status ||
    ehiV6.validation_status ||
    (drug as any)?.scorecard?.ehi_v6_validation_status ||
    'Validation pending';

  const executiveDrivers = buildExecutiveDrivers(drug as any, payload);
  const recommendedExecutiveAction = buildRecommendedExecutiveAction(drug as any, payload);

  return (
    <section className="overflow-hidden rounded-3xl border border-cyan-400/30 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white shadow-sm">
      <div className="p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-4xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full border border-cyan-300/40 bg-cyan-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.22em] text-cyan-100">
                {methodologyBadge}
              </span>

              <span className="inline-flex rounded-full border border-emerald-300/40 bg-emerald-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.22em] text-emerald-100">
                {productionStatus}
              </span>

              {validationPayload && (
                <span className="inline-flex rounded-full border border-violet-300/40 bg-violet-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.22em] text-violet-100">
                  Statistically Validated
                </span>
              )}
            </div>

            <h2 className="mt-4 text-3xl font-black tracking-tight">
              Executive Impact Score
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-300">
              A decision-ready executive score that combines Healthcare Importance, Enterprise Intelligence,
              validation strength, portfolio value, strategic opportunity, and deployment readiness into one
              medication-level business impact signal.
            </p>
          </div>

          {payload && (
            <div className="min-w-[320px] rounded-3xl border border-cyan-300/30 bg-cyan-300/10 px-6 py-5 text-right shadow-2xl shadow-cyan-950/30 backdrop-blur">
              <p className="text-xs font-bold uppercase tracking-wide text-cyan-200">Executive Impact Score</p>
              <p className="mt-1 text-6xl font-black text-white">{formatExecutiveScore(executiveImpactScore, payload.ehi_score)}</p>
              <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-black ${getExecutiveTierStyle(String(executiveImpactTier))}`}>
                {executiveImpactTier}
              </span>
              <p className="mt-2 text-sm font-bold text-cyan-100">
                {formatExecutiveRank(executiveImpactRank)} · {formatPopulationPercentile(executiveImpactPercentile, executiveImpactRank)}
              </p>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="border-t border-white/10 p-7 text-sm font-semibold text-slate-300">
          Loading Healthcare Importance Score…
        </div>
      )}

      {error && (
        <div className="m-7 rounded-2xl border border-rose-400/40 bg-rose-500/10 p-5 text-sm font-semibold text-rose-100">
          {error}
        </div>
      )}

      {!loading && !error && payload && (
        <div className="border-t border-white/10 p-7">
          <div className="grid gap-4 md:grid-cols-3">
            <ExecutiveSupportTile
              label="Healthcare Importance"
              value={formatExecutiveScore(healthcareImportanceScore, payload.ehi_score)}
              helper={String(healthcareImportanceTier)}
              tone="cyan"
            />
            <ExecutiveSupportTile
              label="Enterprise Intelligence"
              value={formatExecutiveScore(enterpriseIntelligenceScore, payload.ehi_score)}
              helper={String(enterpriseIntelligenceTier)}
              tone="blue"
            />
            <ExecutiveSupportTile
              label="Validation Status"
              value={formatExecutiveScore(validationScore, 0)}
              helper={String(validationStatus)}
              tone="emerald"
            />
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">
                Why this medication matters
              </p>
              <h3 className="mt-2 text-2xl font-black text-white">{drugName}</h3>
              <p className="mt-3 text-base leading-7 text-slate-300">
                {buildPlainEnglishExplanation(payload)}
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <DriverTile
                  label="Primary Driver"
                  value={executiveDrivers.primary.label}
                  detail={executiveDrivers.primary.detail}
                  tone="positive"
                />
                <DriverTile
                  label="Secondary Driver"
                  value={executiveDrivers.secondary.label}
                  detail={executiveDrivers.secondary.detail}
                  tone="positive"
                />
                <DriverTile
                  label="Limiting Factor"
                  value={executiveDrivers.limiting.label}
                  detail={executiveDrivers.limiting.detail}
                  tone="caution"
                />
              </div>

              <div className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-200">
                  Recommended Action
                </p>
                <p className="mt-2 text-base font-semibold leading-7 text-emerald-50">
                  {recommendedExecutiveAction}
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-cyan-300/20 bg-cyan-300/10 p-5">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">
                Enterprise Benchmark
              </p>
              <div className="mt-4 space-y-3">
                <BenchmarkRow
                  label="Population Rank"
                  value={`${formatRank(payload.ehi_rank)} of ${toNumber(payload.population_size, DEFAULT_POPULATION_SIZE).toLocaleString()}`}
                />
                <BenchmarkRow
                  label="Population Percentile"
                  value={formatPopulationPercentile(payload.ehi_percentile, payload.ehi_rank)}
                />
                <BenchmarkRow
                  label="Enterprise Tier"
                  value={payload.ehi_tier_label || 'Not tiered'}
                />
                {payload.rank_change_current_v5_to_v6 !== undefined && payload.rank_change_current_v5_to_v6 !== null && (
                  <BenchmarkRow
                    label="V5 → V6 Rank Movement"
                    value={formatSignedRankChange(payload.rank_change_current_v5_to_v6)}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            {domainScores.map((score) => (
              <DomainScoreTile
                key={score.label}
                label={score.label}
                value={score.value}
                detail={score.detail}
              />
            ))}
          </div>

          <div className="mt-5 rounded-3xl border border-violet-300/20 bg-violet-300/10 p-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-200">
              Enterprise Significance
            </p>

            <h3 className="mt-2 text-xl font-black text-white">
              Healthcare Intelligence Interpretation
            </h3>

            <p className="mt-3 text-base leading-7 text-slate-300">
              {payload.enterprise_significance_narrative ||
                `${drugName} demonstrates exceptional enterprise importance due to its combination of disease burden, national spending impact, beneficiary reach, and population-health relevance. The medication ranks among the highest-impact medications evaluated within the Healthcare Intelligence Engine.`}
            </p>
          </div>

          {payload.cms_enterprise_impact?.available && (
            <div className="mt-5 rounded-3xl border border-blue-300/20 bg-blue-300/10 p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="max-w-4xl">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-200">
                    National Healthcare Impact
                  </p>
                  <h3 className="mt-2 text-xl font-black text-white">
                    Source: CMS Part D Public Data
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {payload.cms_enterprise_impact_narrative ||
                      'CMS Part D public aggregate data is available for this medication and supports public, reproducible enterprise impact interpretation.'}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-5 py-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">CMS Year</p>
                  <p className="mt-1 text-2xl font-black text-white">
                    {payload.cms_enterprise_impact.calendar_year || 'N/A'}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-blue-100">
                    {payload.cms_enterprise_impact.mapping_method || 'CMS crosswalk'}
                    {payload.cms_enterprise_impact.mapping_confidence
                      ? ` · ${formatDomainScore(payload.cms_enterprise_impact.mapping_confidence)}% confidence`
                      : ''}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <CmsMetricTile
                  label="Total Spend"
                  value={formatCurrency(payload.cms_enterprise_impact.total_spend)}
                  detail="CMS Part D public aggregate spend"
                />
                <CmsMetricTile
                  label="Spend Rank"
                  value={formatRankOf(payload.cms_enterprise_impact.spend_rank, payload.cms_enterprise_impact.cms_population_size)}
                  detail={
                    payload.cms_enterprise_impact.spend_percentile
                      ? `Spend Percentile: ${formatDomainScore(payload.cms_enterprise_impact.spend_percentile)}th`
                      : 'National spend rank'
                  }
                />
                <CmsMetricTile
                  label="Claims"
                  value={formatCompactNumber(payload.cms_enterprise_impact.claim_count)}
                  detail={
                    payload.cms_enterprise_impact.utilization_percentile
                      ? `Utilization Percentile: ${formatDomainScore(payload.cms_enterprise_impact.utilization_percentile)}th`
                      : 'CMS Part D claim volume'
                  }
                />
                <CmsMetricTile
                  label="Beneficiaries"
                  value={formatCompactNumber(payload.cms_enterprise_impact.beneficiary_count)}
                  detail="CMS beneficiary reach"
                />
                <CmsMetricTile
                  label="Spend / Beneficiary"
                  value={formatCurrencyExact(payload.cms_enterprise_impact.spend_per_beneficiary)}
                  detail={
                    payload.cms_enterprise_impact.claims_per_beneficiary
                      ? `${formatDomainScore(payload.cms_enterprise_impact.claims_per_beneficiary)} claims per beneficiary`
                      : 'Cost intensity signal'
                  }
                />
              </div>

              <p className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-xs font-semibold leading-5 text-slate-400">
                {payload.cms_enterprise_impact.limitation ||
                  'CMS metrics are public, reproducible, drug-level aggregate indicators and are not member-level claims concentration analytics.'}
              </p>
            </div>
          )}

          <div className="mt-5 rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-200">
                  Methodology
                </p>
                <h3 className="mt-2 text-xl font-black text-white">
                  {methodologyBadge}
                </h3>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
                  {payload.methodology?.description ||
                    'EHI V6 Calibrated preserves production dashboard stability while incorporating CDC WONDER burden, CMS Part D public impact, statistical normalization, and a conservative predictive refinement from validated CMS outcome modeling.'}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Production Source</p>
                <p className="mt-1 text-sm font-black text-white">
                  {payload.dashboard_source_table || 'dashboard current'}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-400">
                  {payload.calculation_date ? `Calculated ${payload.calculation_date}` : payload.methodology_version || 'Production methodology'}
                </p>
              </div>
            </div>
          </div>

          {validationPayload && (
            <div className="mt-5 rounded-3xl border border-violet-300/20 bg-violet-300/10 p-5">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-200">
                Statistical Validation
              </p>

              <h3 className="mt-2 text-xl font-black text-white">
                Validation Interpretation
              </h3>

              <p className="mt-3 text-base leading-7 text-slate-300">
                {buildValidationNarrative(validationPayload)}
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <ValidationMetricTile
                  label="Model Stability"
                  value={formatValidationScore(
                    validationPayload.confidence_interval?.bootstrap_stability_score ||
                      validationPayload.bootstrap?.stability_score
                  )}
                  detail="Bootstrap Stability"
                />

                <ValidationMetricTile
                  label="Sensitivity"
                  value={formatValidationScore(
                    validationPayload.confidence_interval?.sensitivity_score ||
                      validationPayload.sensitivity?.sensitivity_score
                  )}
                  detail="Sensitivity Score"
                />

                <ValidationMetricTile
                  label="Methodology Agreement"
                  value={formatValidationScore(
                    validationPayload.confidence_interval?.methodology_agreement_score ||
                      validationPayload.methodology_agreement?.agreement_score
                  )}
                  detail="Agreement Score"
                />

                <ValidationMetricTile
                  label="Confidence Interval"
                  value={
                    validationPayload.confidence_interval?.ehi_score
                      ? formatScore(validationPayload.confidence_interval.ehi_score)
                      : formatScore(payload.ehi_score)
                  }
                  detail={
                    validationPayload.confidence_interval?.ehi_ci_lower &&
                    validationPayload.confidence_interval?.ehi_ci_upper
                      ? `95% CI: ${formatScore(validationPayload.confidence_interval.ehi_ci_lower)} – ${formatScore(validationPayload.confidence_interval.ehi_ci_upper)}`
                      : '95% confidence interval'
                  }
                />
              </div>
            </div>
          )}

          <div className="mt-5 rounded-3xl border border-sky-300/20 bg-sky-300/10 p-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-sky-200">
              External Benchmarking
            </p>

            <h3 className="mt-2 text-xl font-black text-white">
              CMS + CDC Benchmark Alignment
            </h3>

            <p className="mt-3 text-base leading-7 text-slate-300">
              {buildBenchmarkAlignmentNarrative(payload)}
            </p>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <BenchmarkAlignmentTile
                label="EHI Rank"
                value={formatRankOf(payload.ehi_rank, payload.population_size || DEFAULT_POPULATION_SIZE)}
                detail={formatPopulationPercentile(payload.ehi_percentile, payload.ehi_rank)}
              />

              <BenchmarkAlignmentTile
                label="CMS Spend Rank"
                value={
                  payload.cms_enterprise_impact?.spend_rank
                    ? formatRankOf(payload.cms_enterprise_impact.spend_rank, payload.cms_enterprise_impact.cms_population_size)
                    : 'Not available'
                }
                detail={
                  payload.cms_enterprise_impact?.spend_percentile
                    ? `${formatDomainScore(payload.cms_enterprise_impact.spend_percentile)}th percentile`
                    : 'CMS Part D spend alignment'
                }
              />

              <BenchmarkAlignmentTile
                label="CMS Utilization Rank"
                value={
                  payload.cms_enterprise_impact?.utilization_rank
                    ? formatRankOf(payload.cms_enterprise_impact.utilization_rank, payload.cms_enterprise_impact.cms_population_size)
                    : 'Not available'
                }
                detail={
                  payload.cms_enterprise_impact?.utilization_percentile
                    ? `${formatDomainScore(payload.cms_enterprise_impact.utilization_percentile)}th percentile`
                    : 'CMS Part D utilization alignment'
                }
              />

              <BenchmarkAlignmentTile
                label="CDC Burden Signal"
                value={
                  payload.cdc_burden_score
                    ? `${formatDomainScore(payload.cdc_burden_score)} / 100`
                    : 'Not available'
                }
                detail={
                  payload.cdc_canonical_disease_name
                    ? `${payload.cdc_canonical_disease_name} · ${payload.cdc_source_priority || 'CDC WONDER'}`
                    : 'CDC WONDER burden layer'
                }
              />

              <BenchmarkAlignmentTile
                label="Benchmark Confidence"
                value={`${formatDomainScore(calculateBenchmarkConfidence(payload))} / 100`}
                detail="EHI + CMS + CDC alignment"
              />

              <BenchmarkAlignmentTile
                label="NIH / WHO"
                value="Planned"
                detail="Future benchmark expansion"
              />
            </div>

            <p className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-xs font-semibold leading-5 text-slate-400">
              Benchmarking compares EHI against public external signals. CMS and CDC layers are currently integrated; NIH and WHO indicators are reserved for future external validation expansion.
            </p>
          </div>

          {payload.predictive_intelligence?.available && (
            <div className="mt-5 rounded-3xl border border-fuchsia-300/20 bg-fuchsia-300/10 p-5">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-fuchsia-200">
                Predictive Intelligence
              </p>

              <h3 className="mt-2 text-xl font-black text-white">
                Predictive Interpretation
              </h3>

              <p className="mt-3 text-base leading-7 text-slate-300">
                {payload.predictive_intelligence.interpretation ||
                  'The Healthcare Intelligence Engine demonstrates predictive signal against external CMS outcomes, supporting EHI as more than a descriptive score.'}
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <PredictiveMetricTile
                  label="CMS Spend Prediction"
                  value={formatR2(payload.predictive_intelligence.cms_spend_r2)}
                  detail="Test R²"
                />

                <PredictiveMetricTile
                  label="CMS Utilization Prediction"
                  value={formatR2(payload.predictive_intelligence.cms_utilization_r2)}
                  detail="Test R²"
                />

                <PredictiveMetricTile
                  label="CMS Beneficiary Prediction"
                  value={formatR2(payload.predictive_intelligence.cms_beneficiary_r2)}
                  detail="Test R²"
                />

                <PredictiveMetricTile
                  label="Predictive Strength"
                  value={formatPredictiveStrength(payload.predictive_intelligence.predictive_strength)}
                  detail={payload.predictive_intelligence.model_label || 'Domains + CDC + EHI'}
                />
              </div>

              <p className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-xs font-semibold leading-5 text-slate-400">
                Model source: {payload.predictive_intelligence.model_version || 'H4A2 multivariable predictive modeling'}.
                Predictive metrics reflect external CMS outcome explanation, not a self-prediction of EHI.
              </p>
            </div>
          )}


          <details className="mt-5 rounded-3xl border border-white/10 bg-slate-950/50 p-5 open:bg-white/5">
            <summary className="cursor-pointer select-none text-base font-black text-white">
              Technical details
            </summary>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <TechnicalTile label="Methodology Version" value={payload.methodology_version || 'Not available'} />
              <TechnicalTile label="Dashboard Version" value={payload.dashboard_ehi_version || payload.ehi_version || 'EHI V6 Calibrated'} />
              <TechnicalTile label="Current Status" value={payload.dashboard_status || 'PRODUCTION'} />
              <TechnicalTile label="Public Impact Layer" value={payload.cms_enterprise_impact?.available ? 'CMS Part D Integrated' : 'CMS impact unavailable'} />
              <TechnicalTile label="Benchmark Label" value={payload.benchmark_label || `Top ${formatPercent(topShare)}`} />
            </div>
          </details>
        </div>
      )}
    </section>
  );
}


function ExecutiveSupportTile({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: string;
  helper: string;
  tone: 'cyan' | 'blue' | 'emerald';
}) {
  const classes = {
    cyan: 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100',
    blue: 'border-blue-300/25 bg-blue-300/10 text-blue-100',
    emerald: 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100',
  }[tone];

  return (
    <div className={`rounded-3xl border p-5 ${classes}`}>
      <p className="text-xs font-black uppercase tracking-[0.18em] opacity-80">{label}</p>
      <p className="mt-2 text-4xl font-black text-white">{value}</p>
      <p className="mt-2 text-sm font-black">{helper}</p>
    </div>
  );
}

function DriverTile({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: 'positive' | 'caution';
}) {
  const classes =
    tone === 'positive'
      ? 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100'
      : 'border-orange-300/20 bg-orange-300/10 text-orange-100';

  return (
    <div className={`rounded-2xl border p-5 ${classes}`}>
      <p className="text-xs font-bold uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-2 text-xl font-black">{value}</p>
      <p className="mt-2 text-xs font-semibold leading-5 opacity-80">{detail}</p>
    </div>
  );
}

function DomainScoreTile({ label, value, detail }: { label: string; value: unknown; detail: string }) {
  const numeric = Math.max(0, Math.min(100, toNumber(value)));

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{formatDomainScore(value)}</p>
      <div className="mt-3 h-2 rounded-full bg-slate-800">
        <div className="h-2 rounded-full bg-cyan-300" style={{ width: `${numeric}%` }} />
      </div>
      <p className="mt-2 text-[11px] font-semibold leading-4 text-slate-500">{detail}</p>
    </div>
  );
}

function BenchmarkRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-cyan-200/20 bg-slate-950/40 px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-wide text-cyan-200">{label}</p>
      <p className="text-sm font-black text-white">{value}</p>
    </div>
  );
}

function CmsMetricTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-blue-200/20 bg-slate-950/40 p-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-blue-200">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      <p className="mt-2 text-[11px] font-semibold leading-4 text-slate-400">{detail}</p>
    </div>
  );
}

function ValidationMetricTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-violet-200/20 bg-slate-950/40 p-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-violet-200">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      <p className="mt-2 text-[11px] font-semibold leading-4 text-slate-400">
        {detail}
      </p>
    </div>
  );
}

function BenchmarkAlignmentTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-sky-200/20 bg-slate-950/40 p-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-sky-200">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      <p className="mt-2 text-[11px] font-semibold leading-4 text-slate-400">
        {detail}
      </p>
    </div>
  );
}


function PredictiveMetricTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-fuchsia-200/20 bg-slate-950/40 p-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-fuchsia-200">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      <p className="mt-2 text-[11px] font-semibold leading-4 text-slate-400">
        {detail}
      </p>
    </div>
  );
}


function TechnicalTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 break-words text-sm font-black text-white">{value}</p>
    </div>
  );
}