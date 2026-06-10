import { useEffect, useMemo, useState } from 'react';
import {
  DrugCard,
  EnterpriseHealthcareImportance,
  getEnterpriseHealthcareImportance,
} from '../lib/api';

type Props = {
  drug: DrugCard | null;
};

const DEFAULT_POPULATION_SIZE = 30132;

function valueFrom(source: any, keys: string[], fallback: unknown = null) {
  for (const key of keys) {
    const value =
      source?.[key] ??
      source?.drug?.[key] ??
      source?.scorecard?.[key] ??
      source?.scores?.[key] ??
      source?.ehi_v6?.[key] ??
      source?.eii?.[key] ??
      source?.eis?.[key] ??
      source?.executive_impact?.[key];

    if (value !== null && value !== undefined && value !== '') return value;
  }

  return fallback;
}

function toNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function formatScore(value: unknown, fallback = 0) {
  const numeric = toNumber(value, fallback);
  return numeric.toLocaleString(undefined, {
    maximumFractionDigits: numeric % 1 === 0 ? 0 : 1,
  });
}

function formatRank(value: unknown) {
  const numeric = toNumber(value);
  return numeric > 0 ? `#${Math.round(numeric).toLocaleString()}` : 'Not ranked';
}

function formatPercentile(value: unknown) {
  const numeric = toNumber(value);
  return numeric > 0 ? `${numeric.toFixed(1)} percentile` : 'Percentile pending';
}

function getDrugName(drug: any, payload: EnterpriseHealthcareImportance | null) {
  return (
    payload?.drug_name ||
    payload?.display_name ||
    drug?.display_name ||
    drug?.rxnorm_name ||
    drug?.drug_name ||
    drug?.name ||
    drug?.drug?.display_name ||
    drug?.drug?.rxnorm_name ||
    'Selected medication'
  );
}

function getTierStyle(tier: string) {
  const text = tier.toLowerCase();

  if (text.includes('critical')) {
    return 'border-emerald-300/50 bg-emerald-400/15 text-emerald-100';
  }

  if (text.includes('strategic')) {
    return 'border-cyan-300/50 bg-cyan-400/15 text-cyan-100';
  }

  if (text.includes('high')) {
    return 'border-blue-300/50 bg-blue-400/15 text-blue-100';
  }

  return 'border-slate-500/60 bg-slate-700/40 text-slate-100';
}

function getDomainValue(source: any, payload: EnterpriseHealthcareImportance | null, keys: string[], fallback = 0) {
  const value = valueFrom(source, keys, null);
  if (value !== null && value !== undefined && value !== '') return toNumber(value, fallback);

  for (const key of keys) {
    const payloadValue = (payload as any)?.[key];
    if (payloadValue !== null && payloadValue !== undefined && payloadValue !== '') {
      return toNumber(payloadValue, fallback);
    }
  }

  return fallback;
}

function buildDriverSet(drug: any, payload: EnterpriseHealthcareImportance | null) {
  const candidates = [
    {
      label: 'Healthcare Importance',
      value: getDomainValue(drug, payload, ['healthcare_importance_score', 'ehi_v6_score', 'ehi_score']),
      detail: 'Medication has strong enterprise healthcare importance.',
    },
    {
      label: 'Enterprise Intelligence',
      value: getDomainValue(drug, payload, ['enterprise_intelligence_score', 'eii_score', 'overall_intelligence_score']),
      detail: 'Medication is highly usable across analytics, AI, claims, and clinical intelligence.',
    },
    {
      label: 'Validation Strength',
      value: getDomainValue(drug, payload, ['validation_score', 'ehi_v6_validation_score']),
      detail: 'Production score is supported by validation and calibration evidence.',
    },
    {
      label: 'AI Readiness',
      value: getDomainValue(drug, payload, ['ai_readiness_score', 'ai_score']),
      detail: 'Profile is ready for AI, copilots, search, and generated intelligence.',
    },
    {
      label: 'Claims Readiness',
      value: getDomainValue(drug, payload, ['claims_readiness_score', 'claims_score']),
      detail: 'Profile has payer, PBM, and claims analytics value.',
    },
    {
      label: 'Knowledge Graph',
      value: getDomainValue(drug, payload, ['knowledge_graph_score', 'graph_connectivity_score']),
      detail: 'Relationship graph supports semantic exploration and retrieval context.',
    },
  ].filter((item) => Number.isFinite(item.value));

  const sorted = [...candidates].sort((a, b) => b.value - a.value);
  const limiting = [...candidates].sort((a, b) => a.value - b.value)[0] || {
    label: 'Evidence Completeness',
    value: 0,
    detail: 'Additional evidence can further improve confidence.',
  };

  return {
    primary: sorted[0] || {
      label: 'Healthcare Importance',
      value: 0,
      detail: 'Medication importance is the primary executive signal.',
    },
    secondary: sorted[1] || {
      label: 'Enterprise Intelligence',
      value: 0,
      detail: 'Enterprise usability supports decision value.',
    },
    limiting,
  };
}

function buildRecommendedAction(tier: string, validationStatus: string) {
  const normalizedTier = tier.toLowerCase();
  const normalizedValidation = validationStatus.toLowerCase();

  if (normalizedTier.includes('critical') && normalizedValidation.includes('validated')) {
    return 'Treat as an executive-priority medication for portfolio strategy, AI enablement, claims intelligence, and stakeholder-facing healthcare intelligence.';
  }

  if (normalizedTier.includes('strategic')) {
    return 'Use as a strategic priority candidate with strong executive relevance and supporting validation review.';
  }

  if (normalizedTier.includes('high')) {
    return 'Monitor as a high-value enterprise medication and prioritize additional validation or deployment evidence.';
  }

  return 'Keep in the enterprise intelligence universe while using validation and methodology evidence to determine whether it should be promoted.';
}

function SupportCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-cyan-300/15 bg-slate-950/60 p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
      <p className="mt-2 text-xs font-semibold leading-5 text-slate-400">
        {helper}
      </p>
    </div>
  );
}

function DriverCard({
  label,
  value,
  detail,
  caution = false,
}: {
  label: string;
  value: string;
  detail: string;
  caution?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        caution
          ? 'border-amber-300/25 bg-amber-400/10'
          : 'border-emerald-300/20 bg-emerald-400/10'
      }`}
    >
      <p
        className={`text-xs font-black uppercase tracking-[0.16em] ${
          caution ? 'text-amber-200' : 'text-emerald-200'
        }`}
      >
        {label}
      </p>

      <p className="mt-2 text-lg font-black text-white">{value}</p>

      <p className="mt-2 text-xs font-semibold leading-5 text-slate-300">
        {detail}
      </p>
    </div>
  );
}

function BenchmarkRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/10 py-2 last:border-b-0">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="text-sm font-black text-white">{value}</p>
    </div>
  );
}

export default function EnterpriseHealthcareImportanceCard({ drug }: Props) {
  const [payload, setPayload] = useState<EnterpriseHealthcareImportance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rxcui = (drug as any)?.rxcui || (drug as any)?.drug?.rxcui;

  useEffect(() => {
    if (!rxcui) return;

    let active = true;

    async function loadEhi() {
      setLoading(true);
      setError(null);

      try {
        const json = await getEnterpriseHealthcareImportance(String(rxcui));
        if (active) setPayload(json);
      } catch (err) {
        if (!active) return;
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load Enterprise Healthcare Importance.',
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

  const mergedDrug = useMemo(
    () => ({
      ...((drug as any) || {}),
      ...(payload || {}),
      drug: {
        ...((drug as any)?.drug || {}),
        ...(payload || {}),
      },
      scorecard: {
        ...((drug as any)?.scorecard || {}),
        ...(payload || {}),
      },
    }),
    [drug, payload],
  );

  if (!drug) return null;

  const executiveImpact = (mergedDrug as any)?.executive_impact || {};
  const eii = (mergedDrug as any)?.eii || {};
  const eis = (mergedDrug as any)?.eis || {};
  const ehiV6 = (mergedDrug as any)?.ehi_v6 || {};

  const drugName = getDrugName(mergedDrug, payload);

  const executiveImpactScore =
    executiveImpact.executive_impact_score ??
    eis.score ??
    valueFrom(mergedDrug, ['eis_score'], null) ??
    payload?.ehi_score ??
    0;

  const executiveImpactTier =
    executiveImpact.executive_impact_tier ||
    eis.tier ||
    String(valueFrom(mergedDrug, ['eis_tier'], null) || 'Executive Impact Pending');

  const executiveImpactRank =
    executiveImpact.executive_impact_rank ||
    eis.rank ||
    valueFrom(mergedDrug, ['eis_rank'], null);

  const executiveImpactPercentile =
    executiveImpact.executive_impact_percentile ||
    eis.percentile ||
    valueFrom(mergedDrug, ['eis_percentile'], null);

  const healthcareImportanceScore =
    executiveImpact.healthcare_importance_score ??
    ehiV6.score ??
    valueFrom(mergedDrug, ['ehi_v6_score', 'ehi_score'], payload?.ehi_score ?? 0);

  const healthcareImportanceTier =
    executiveImpact.healthcare_importance_tier ||
    ehiV6.tier_label ||
    String(valueFrom(mergedDrug, ['ehi_v6_tier_label', 'ehi_tier_label'], 'Not tiered'));

  const enterpriseIntelligenceScore =
    executiveImpact.enterprise_intelligence_score ??
    eii.score ??
    valueFrom(mergedDrug, ['eii_score', 'overall_intelligence_score'], 0);

  const enterpriseIntelligenceTier =
    executiveImpact.enterprise_intelligence_tier ||
    eii.tier ||
    String(valueFrom(mergedDrug, ['eii_tier'], 'Not tiered'));

  const validationScore =
    executiveImpact.validation_score ??
    ehiV6.validation_score ??
    valueFrom(mergedDrug, ['validation_score', 'ehi_v6_validation_score'], 0);

  const validationStatus =
    executiveImpact.validation_status ||
    ehiV6.validation_status ||
    String(valueFrom(mergedDrug, ['validation_status', 'ehi_v6_validation_status'], 'Validation pending'));

  const driverSet = buildDriverSet(mergedDrug, payload);
  const recommendedAction = buildRecommendedAction(String(executiveImpactTier), String(validationStatus));

  return (
    <section className="overflow-hidden rounded-3xl border border-cyan-400/30 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_36%),linear-gradient(135deg,#020617,#0f172a_48%,#082f49)] text-white shadow-2xl shadow-cyan-950/20">
      <div className="p-6 md:p-7">
        <div className="grid gap-6 xl:grid-cols-[1fr_20rem] xl:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full border border-cyan-300/40 bg-cyan-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.22em] text-cyan-100">
                Executive Impact Framework
              </span>

              <span className="inline-flex rounded-full border border-emerald-300/40 bg-emerald-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.22em] text-emerald-100">
                EHI → EII → EIS
              </span>
            </div>

            <h2 className="mt-4 text-3xl font-black tracking-tight md:text-4xl">
              Executive Impact Score
            </h2>

            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">
              {drugName} is evaluated through the complete executive hierarchy:
              Healthcare Importance, Enterprise Intelligence, and Executive
              Impact. The hero surfaces the score, supporting metrics, primary
              drivers, limiting factor, and recommended executive action in one
              decision-ready view.
            </p>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <SupportCard
                label="Healthcare Importance"
                value={formatScore(healthcareImportanceScore, 0)}
                helper={String(healthcareImportanceTier)}
              />

              <SupportCard
                label="Enterprise Intelligence"
                value={formatScore(enterpriseIntelligenceScore, 0)}
                helper={String(enterpriseIntelligenceTier)}
              />

              <SupportCard
                label="Validation Status"
                value={formatScore(validationScore, 0)}
                helper={String(validationStatus)}
              />
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <DriverCard
                label="Primary Driver"
                value={driverSet.primary.label}
                detail={driverSet.primary.detail}
              />

              <DriverCard
                label="Secondary Driver"
                value={driverSet.secondary.label}
                detail={driverSet.secondary.detail}
              />

              <DriverCard
                label="Limiting Factor"
                value={driverSet.limiting.label}
                detail={driverSet.limiting.detail}
                caution
              />
            </div>
          </div>

          <div className="rounded-3xl border border-cyan-300/30 bg-cyan-300/10 p-6 text-center shadow-2xl shadow-cyan-950/30 backdrop-blur">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
              Executive Impact Score
            </p>

            <p className="mt-3 text-6xl font-black leading-none text-white">
              {formatScore(executiveImpactScore, 0)}
            </p>

            <span
              className={`mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-black ${getTierStyle(
                String(executiveImpactTier),
              )}`}
            >
              {executiveImpactTier}
            </span>

            <p className="mt-3 text-sm font-bold text-cyan-100">
              {formatRank(executiveImpactRank)} · {formatPercentile(executiveImpactPercentile)}
            </p>

            <div className="mt-5 rounded-2xl border border-slate-700/80 bg-slate-950/70 p-4 text-left">
              <BenchmarkRow
                label="Universe"
                value={`${DEFAULT_POPULATION_SIZE.toLocaleString()} medications`}
              />
              <BenchmarkRow
                label="Score Layer"
                value="Executive Impact"
              />
              <BenchmarkRow
                label="Validation"
                value={String(validationStatus)}
              />
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">
            Recommended Action
          </p>

          <p className="mt-2 text-base font-semibold leading-7 text-emerald-50">
            {recommendedAction}
          </p>
        </div>
      </div>

      {loading && (
        <div className="border-t border-white/10 p-5 text-sm font-semibold text-slate-300">
          Loading executive impact signals…
        </div>
      )}

      {error && (
        <div className="m-6 rounded-2xl border border-rose-400/40 bg-rose-500/10 p-5 text-sm font-semibold text-rose-100">
          {error}
        </div>
      )}
    </section>
  );
}
