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

function formatPercentile(value: unknown) {
  const numeric = toNumber(value);
  return numeric > 0 ? `${numeric.toFixed(2)}th percentile` : 'Percentile unavailable';
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

function getTierStyle(tier?: string) {
  const normalized = (tier || '').toLowerCase();

  if (normalized.includes('strategic')) {
    return 'border-cyan-300/60 bg-cyan-300/15 text-cyan-100';
  }

  if (normalized.includes('enterprise')) {
    return 'border-blue-300/60 bg-blue-300/15 text-blue-100';
  }

  if (normalized.includes('high')) {
    return 'border-emerald-300/60 bg-emerald-300/15 text-emerald-100';
  }

  if (normalized.includes('moderate')) {
    return 'border-yellow-300/60 bg-yellow-300/15 text-yellow-100';
  }

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

export default function EnterpriseHealthcareImportanceCard({ drug }: Props) {
  const [payload, setPayload] = useState<EnterpriseHealthcareImportance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rxcui = drug?.rxcui;

  useEffect(() => {
    if (!rxcui) return;

    let active = true;

    async function loadEhi() {
      setLoading(true);
      setError(null);

      try {
        const json = await getEnterpriseHealthcareImportance(rxcui);
        if (!active) return;
        setPayload(json);
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
      {
        label: 'Disease Burden',
        value: payload.disease_burden_score,
        detail: 'Clinical and CDC burden signal',
      },
      {
        label: 'Utilization',
        value: payload.utilization_score,
        detail: 'Observed use intensity',
      },
      {
        label: 'Population Impact',
        value: payload.population_impact_score,
        detail: 'Breadth of healthcare relevance',
      },
      {
        label: 'Spend',
        value: payload.spend_score,
        detail: 'Economic importance signal',
      },
      {
        label: 'Risk',
        value: payload.risk_score,
        detail: 'FDA and safety-informed signal',
      },
      {
        label: 'CDC Mortality Burden',
        value: payload.cdc_burden_score,
        detail: 'CDC WONDER burden layer',
      },
    ].filter((item) => item.value !== undefined && item.value !== null);
  }, [payload]);

  if (!drug) return null;

  const drugName = payload?.drug_name || payload?.display_name || drug.drug_name || drug.display_name || drug.rxnorm_name || 'Selected medication';
  const methodologyBadge = getMethodologyBadge(payload);
  const topShare = getTopShare(payload);
  const productionStatus = payload?.dashboard_status || payload?.methodology?.status || 'PRODUCTION';

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
            </div>

            <h2 className="mt-4 text-3xl font-black tracking-tight">
              Healthcare Importance Score
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-300">
              A production-ready healthcare intelligence score that combines clinical burden, utilization, spend,
              population impact, risk, CDC mortality burden, explainability, and predictive validation into one
              medication-level signal.
            </p>
          </div>

          {payload && (
            <div className="min-w-[300px] rounded-3xl border border-white/10 bg-white/10 px-6 py-5 text-right backdrop-blur">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-300">EHI Score</p>
              <p className="mt-1 text-6xl font-black text-white">{formatScore(payload.ehi_score)}</p>
              <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-black ${getTierStyle(payload.ehi_tier_label)}`}>
                {payload.ehi_tier_label || 'Not tiered'}
              </span>
              <p className="mt-2 text-sm font-bold text-cyan-100">
                {formatRank(payload.ehi_rank)} · {formatPercentile(payload.ehi_percentile)}
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
          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">
                Why this medication matters
              </p>
              <h3 className="mt-2 text-2xl font-black text-white">{drugName}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {buildPlainEnglishExplanation(payload)}
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <DriverTile
                  label="Primary Driver"
                  value={payload.primary_driver || 'Not available'}
                  detail={payload.driver_explanation || 'Strongest positive contributor to the score.'}
                  tone="positive"
                />
                <DriverTile
                  label="Limiting Factor"
                  value={payload.limiting_factor || 'Not available'}
                  detail={payload.limiting_factor_explanation || 'Main evidence layer limiting additional score strength.'}
                  tone="caution"
                />
              </div>
            </div>

            <div className="rounded-3xl border border-cyan-300/20 bg-cyan-300/10 p-5">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">
                Enterprise Benchmark
              </p>
              <div className="mt-4 space-y-3">
                <BenchmarkRow label="Population Rank" value={`${formatRank(payload.ehi_rank)} of ${toNumber(payload.population_size, DEFAULT_POPULATION_SIZE).toLocaleString()}`} />
                <BenchmarkRow label="Top Population Share" value={`Top ${formatPercent(topShare)}`} />
                <BenchmarkRow label="Enterprise Tier" value={payload.ehi_tier_label || 'Not tiered'} />
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
                    'EHI V6 Calibrated preserves production dashboard stability while incorporating a conservative predictive refinement from validated CMS outcome modeling.'}
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

          <details className="mt-5 rounded-3xl border border-white/10 bg-slate-950/50 p-5 open:bg-white/5">
            <summary className="cursor-pointer select-none text-base font-black text-white">
              Technical details
            </summary>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <TechnicalTile label="Methodology Version" value={payload.methodology_version || 'Not available'} />
              <TechnicalTile label="Dashboard Version" value={payload.dashboard_ehi_version || payload.ehi_version || 'EHI V6 Calibrated'} />
              <TechnicalTile label="Current Status" value={payload.dashboard_status || 'PRODUCTION'} />
              <TechnicalTile label="Benchmark Label" value={payload.benchmark_label || `Top ${formatPercent(topShare)}`} />
            </div>
          </details>
        </div>
      )}
    </section>
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

function TechnicalTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 break-words text-sm font-black text-white">{value}</p>
    </div>
  );
}
