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
  return toNumber(value).toFixed(1);
}

function formatPercentile(value: unknown) {
  return `${toNumber(value).toFixed(2)}th percentile`;
}

function formatRank(value: unknown) {
  const numeric = toNumber(value);
  return numeric > 0 ? `#${Math.round(numeric).toLocaleString()}` : 'Not ranked';
}

function formatPercent(value: unknown) {
  const numeric = toNumber(value);
  if (numeric < 1) return `${numeric.toFixed(2)}%`;
  return `${numeric.toFixed(1)}%`;
}

function getPopulationSize(payload: EnterpriseHealthcareImportance | null) {
  return Math.round(toNumber(payload?.population_size, DEFAULT_POPULATION_SIZE));
}

function getTopShare(payload: EnterpriseHealthcareImportance | null) {
  if (!payload) return 0;

  const explicitTopShare = Number(payload.top_population_share_pct);
  if (Number.isFinite(explicitTopShare) && explicitTopShare > 0) {
    return explicitTopShare;
  }

  const percentile = Number(payload.ehi_percentile);
  if (Number.isFinite(percentile) && percentile > 0) {
    return Math.max(0, 100 - percentile);
  }

  const rank = Number(payload.ehi_rank);
  const populationSize = getPopulationSize(payload);
  if (Number.isFinite(rank) && rank > 0 && populationSize > 0) {
    return (rank / populationSize) * 100;
  }

  return 0;
}

function getTierStyle(tier?: string) {
  const normalized = (tier || '').toLowerCase();

  if (normalized.includes('critical')) {
    return 'border-cyan-300/70 bg-cyan-300/15 text-cyan-100';
  }

  if (normalized.includes('strategic')) {
    return 'border-blue-300/60 bg-blue-300/15 text-blue-100';
  }

  if (normalized.includes('operational')) {
    return 'border-emerald-300/60 bg-emerald-300/15 text-emerald-100';
  }

  return 'border-slate-500/60 bg-slate-800 text-slate-200';
}

function buildExecutiveNarrative(payload: EnterpriseHealthcareImportance) {
  const drugName = payload.drug_name || 'This medication';
  const tier = payload.ehi_tier_label || 'enterprise healthcare relevance';
  const percentile = toNumber(payload.ehi_percentile).toFixed(2);
  const primary = payload.primary_driver || 'enterprise signal strength';
  const secondary = payload.secondary_driver || 'supporting platform evidence';
  const limiting = payload.limiting_factor || 'remaining data enrichment needs';

  return `${drugName} demonstrates ${tier.toLowerCase()} based on calibrated platform-derived signals across utilization, spend proxy, disease burden, population impact, and enterprise risk. The medication ranks in the ${percentile}th percentile across evaluated RxCUIs, primarily driven by ${primary} with additional support from ${secondary}. Current limiting evidence is concentrated in ${limiting}, which should improve as CMS, CDC, FDA, and spend data are integrated.`;
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
      { label: 'Utilization', value: payload.utilization_score },
      { label: 'Spend Proxy', value: payload.spend_score },
      { label: 'Disease Burden', value: payload.disease_burden_score },
      { label: 'Population Impact', value: payload.population_impact_score },
      { label: 'Risk Oversight', value: payload.risk_score },
    ];
  }, [payload]);

  const populationSize = getPopulationSize(payload);
  const topShare = getTopShare(payload);

  if (!drug) return null;

  return (
    <section className="overflow-hidden rounded-3xl border border-cyan-400/30 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white shadow-sm">
      <div className="p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-4xl">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
              Sprint H2I.1 + H2J · Enterprise Healthcare Importance
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight">
              Enterprise Healthcare Importance
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              A calibrated enterprise decision-support metric estimating how important a medication is to
              health plans, PBMs, consultants, health systems, and healthcare analytics organizations.
            </p>
          </div>

          {payload && (
            <div className="min-w-[280px] rounded-3xl border border-white/10 bg-white/10 px-6 py-5 text-right backdrop-blur">
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
          Loading Enterprise Healthcare Importance…
        </div>
      )}

      {error && (
        <div className="m-7 rounded-2xl border border-rose-400/40 bg-rose-500/10 p-5 text-sm font-semibold text-rose-100">
          {error}
        </div>
      )}

      {!loading && !error && payload && (
        <div className="border-t border-white/10 p-7">
          <div className="grid gap-3 md:grid-cols-3">
            <DriverTile label="Primary Driver" value={payload.primary_driver || 'Not available'} />
            <DriverTile label="Secondary Driver" value={payload.secondary_driver || 'Not available'} />
            <DriverTile label="Limiting Factor" value={payload.limiting_factor || 'Not available'} />
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-5">
            {domainScores.map((score) => (
              <DomainScoreTile key={score.label} label={score.label} value={score.value} />
            ))}
          </div>

          <div className="mt-5 rounded-3xl border border-cyan-300/20 bg-cyan-300/10 p-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">
              Enterprise Benchmark
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <BenchmarkTile
                label="Population Rank"
                value={`${formatRank(payload.ehi_rank)} of ${populationSize.toLocaleString()}`}
                detail="Evaluated RxCUIs"
              />
              <BenchmarkTile
                label="Top Population Share"
                value={`Top ${formatPercent(topShare)}`}
                detail="Distribution-based benchmark"
              />
              <BenchmarkTile
                label="Enterprise Tier"
                value={payload.ehi_tier_label || 'Not tiered'}
                detail={formatPercentile(payload.ehi_percentile)}
              />
            </div>
          </div>

          <div className="mt-5 rounded-3xl border border-white/10 bg-slate-950/50 p-5">
            <h3 className="text-base font-black text-white">Executive EHI Assessment</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {buildExecutiveNarrative(payload)}
            </p>
            <p className="mt-4 text-xs font-semibold text-slate-400">
              Methodology: {payload.methodology_version || 'EHI calibration methodology'}
              {payload.calculation_date ? ` · Calculated: ${payload.calculation_date}` : ''}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function DriverTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur">
      <p className="text-xs font-bold uppercase tracking-wide text-cyan-200">{label}</p>
      <p className="mt-2 text-lg font-black text-white">{value}</p>
    </div>
  );
}

function DomainScoreTile({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{formatScore(value)}</p>
      <div className="mt-3 h-2 rounded-full bg-slate-800">
        <div
          className="h-2 rounded-full bg-cyan-300"
          style={{ width: `${Math.max(0, Math.min(100, toNumber(value)))}%` }}
        />
      </div>
    </div>
  );
}

function BenchmarkTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-cyan-200/20 bg-slate-950/40 p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-cyan-200">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs font-semibold text-slate-400">{detail}</p>
    </div>
  );
}
