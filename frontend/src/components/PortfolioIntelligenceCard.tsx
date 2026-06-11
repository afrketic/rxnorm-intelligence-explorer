import { useEffect, useMemo, useState } from 'react';
import {
  getPortfolioOpportunity,
  getPortfolioTopOpportunities,
  getTherapeuticPortfolios,
  getDiseaseBurdenForecasting,
  PortfolioIntelligenceItem,
  DiseaseBurdenForecastProfile,
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

function getPortfolioName(item: PortfolioIntelligenceItem | null | undefined) {
  return (
    item?.portfolio_name ||
    item?.primary_therapeutic_domain_name ||
    item?.atc_name ||
    item?.disease_name ||
    item?.portfolio_code ||
    item?.atc_code ||
    'Portfolio'
  );
}

function getPortfolioRank(item: PortfolioIntelligenceItem | null | undefined) {
  const rank = item?.executive_opportunity_rank ?? item?.portfolio_rank ?? item?.source_portfolio_rank;
  const numeric = Number(rank);
  return Number.isFinite(numeric) && numeric > 0 ? `#${Math.round(numeric).toLocaleString()}` : '—';
}

function PortfolioMiniRow({ item }: { item: PortfolioIntelligenceItem }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">
            {item.portfolio_type || item.atc_level || 'Portfolio'}
          </p>
          <p className="mt-2 text-sm font-black leading-5 text-white">
            {getPortfolioName(item)}
          </p>
        </div>
        <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-black text-cyan-100">
          {getPortfolioRank(item)}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="font-bold uppercase tracking-wide text-slate-500">Meds</p>
          <p className="mt-1 font-black text-slate-100">{formatNumber(item.medication_count)}</p>
        </div>
        <div>
          <p className="font-bold uppercase tracking-wide text-slate-500">Avg EHI</p>
          <p className="mt-1 font-black text-slate-100">{formatScore(item.average_ehi_v6_score)}</p>
        </div>
        <div>
          <p className="font-bold uppercase tracking-wide text-slate-500">Critical</p>
          <p className="mt-1 font-black text-slate-100">{formatNumber(item.enterprise_critical_count)}</p>
        </div>
      </div>
    </div>
  );
}


function DiseaseForecastRow({ item }: { item: DiseaseBurdenForecastProfile }) {
  return (
    <div className="rounded-2xl border border-amber-300/15 bg-amber-400/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-300">Future Disease Priority</p>
          <p className="mt-2 text-sm font-black leading-5 text-white">
            {item.disease_domain || item.canonical_disease_name || 'Disease Area'}
          </p>
        </div>
        <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-xs font-black text-amber-100">
          {item.trend_signal || item.burden_trend_signal || 'Stable'}
        </span>
      </div>
      <p className="mt-3 text-xs font-semibold leading-5 text-amber-50/80">
        {item.forecast_narrative || 'Disease burden trend context supports forward-looking portfolio planning.'}
      </p>
    </div>
  );
}

function HeroMetric({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-200">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs font-semibold leading-5 text-emerald-50/80">{helper}</p>
    </div>
  );
}

export default function PortfolioIntelligenceCard() {
  const [therapeutic, setTherapeutic] = useState<PortfolioIntelligenceItem[]>([]);
  const [opportunities, setOpportunities] = useState<PortfolioIntelligenceItem[]>([]);
  const [glp1, setGlp1] = useState<PortfolioIntelligenceItem | null>(null);
  const [diseaseForecasts, setDiseaseForecasts] = useState<DiseaseBurdenForecastProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadPortfolioIntelligence() {
      setLoading(true);
      setError(null);

      try {
        const [therapeuticRows, opportunityRows, glp1Row, diseaseForecastRows] = await Promise.all([
          getTherapeuticPortfolios(5),
          getPortfolioTopOpportunities(25),
          getPortfolioOpportunity('ATC4', 'A10BJ').catch(() => null),
          getDiseaseBurdenForecasting(10).catch(() => []),
        ]);

        if (!active) return;
        setTherapeutic(therapeuticRows);
        setOpportunities(opportunityRows);
        setGlp1(glp1Row);
        setDiseaseForecasts(diseaseForecastRows);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load Portfolio Intelligence.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadPortfolioIntelligence();

    return () => {
      active = false;
    };
  }, []);

  const topAtcOpportunities = useMemo(
    () => opportunities.filter((item) => String(item.portfolio_type || '').startsWith('ATC')).slice(0, 3),
    [opportunities],
  );

  const topDiseaseOpportunities = useMemo(
    () => opportunities.filter((item) => item.portfolio_type === 'Disease Area').slice(0, 3),
    [opportunities],
  );

  const glp1Rank = getPortfolioRank(glp1);
  const glp1CriticalCount = formatNumber(glp1?.enterprise_critical_count);
  const glp1MedicationCount = formatNumber(glp1?.medication_count);
  const glp1Score = formatScore(glp1?.portfolio_importance_score);

  return (
    <section className="overflow-hidden rounded-3xl border border-blue-400/25 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_34%),linear-gradient(135deg,#020617,#0f172a_52%,#172554)] text-white shadow-2xl shadow-blue-950/20">
      <div className="p-6 md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-300">
              Portfolio Intelligence
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">
              Healthcare Portfolio Intelligence
            </h2>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">
              EHI V6 now rolls up from individual medications into therapeutic, ATC, and disease portfolios so executives can identify where enterprise value concentrates across the healthcare ecosystem.
            </p>
          </div>

          <span className="rounded-full border border-blue-300/30 bg-blue-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-blue-100">
            H3B.3 Portfolio Layer
          </span>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <HeroMetric
            label="GLP-1 Portfolio Position"
            value={glp1Rank}
            helper={`${glp1MedicationCount} GLP-1 medications · score ${glp1Score}`}
          />
          <HeroMetric
            label="Enterprise Critical Count"
            value={glp1CriticalCount}
            helper="Enterprise Critical medications in the GLP-1 portfolio"
          />
          <HeroMetric
            label="Portfolio Opportunity Rank"
            value={glp1Rank}
            helper="Executive opportunity rank for GLP-1 analogues"
          />
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-3">
          <div className="rounded-3xl border border-cyan-300/15 bg-slate-950/45 p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
              Top Therapeutic Portfolios
            </p>
            <div className="mt-4 space-y-3">
              {therapeutic.slice(0, 3).map((item) => (
                <PortfolioMiniRow key={`therapeutic-${item.primary_therapeutic_domain_code || item.portfolio_name}`} item={item} />
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-blue-300/15 bg-slate-950/45 p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-300">
              Top ATC Opportunities
            </p>
            <div className="mt-4 space-y-3">
              {topAtcOpportunities.map((item) => (
                <PortfolioMiniRow key={`atc-${item.portfolio_type}-${item.portfolio_code || item.portfolio_name}`} item={item} />
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-300/15 bg-slate-950/45 p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
              Top Disease Portfolios
            </p>
            <div className="mt-4 space-y-3">
              {topDiseaseOpportunities.map((item) => (
                <PortfolioMiniRow key={`disease-${item.portfolio_name}`} item={item} />
              ))}
            </div>
          </div>
        </div>


        <div className="mt-5 rounded-3xl border border-amber-300/15 bg-slate-950/45 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">
                Future Disease Priorities
              </p>
              <h3 className="mt-2 text-2xl font-black text-white">
                Population burden trend signals
              </h3>
              <p className="mt-2 max-w-4xl text-sm font-semibold leading-6 text-slate-300">
                H4B.3 converts CDC population-burden evidence into forward-looking disease-area signals so portfolio planning can identify which disease areas are becoming more important to healthcare.
              </p>
            </div>
            <span className="w-fit rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-amber-100">
              No forecast score
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {diseaseForecasts.slice(0, 6).map((item) => (
              <DiseaseForecastRow
                key={`disease-forecast-${item.disease_domain || item.canonical_disease_name}`}
                item={item}
              />
            ))}
          </div>
        </div>

        {loading && (
          <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm font-semibold text-slate-300">
            Loading portfolio intelligence…
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
