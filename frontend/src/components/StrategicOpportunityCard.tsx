import { useEffect, useMemo, useState } from 'react';
import { DrugCard } from '../lib/api';

type Driver = {
  driver_rank: number;
  opportunity_driver: string;
  driver_score: number;
  driver_rationale: string;
};

type OpportunityPayload = {
  rxcui: string;
  display_name?: string;
  opportunity: {
    strategic_opportunity_rank: number;
    strategic_opportunity_score: number;
    strategic_opportunity_percentile: number;
    strategic_opportunity_tier: string;
    strategic_opportunity_type: string;
    market_position: string;
    strategic_action_plan: string;
  };
  scores: Record<string, number>;
  leaderboard: {
    leaderboard_appearance_count: number;
    best_leaderboard_rank: number | null;
  };
  drivers: Driver[];
  methodology: {
    opportunity_version: string;
    opportunity_methodology: string;
    build_timestamp: string;
  };
};

type Props = {
  drug: DrugCard | null;
};

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'http://127.0.0.1:8000';

function toNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function formatScore(value: unknown) {
  return toNumber(value).toFixed(1);
}

function formatPercent(value: unknown) {
  return `${toNumber(value).toFixed(1)}%`;
}

function tierStyle(tier?: string) {
  const normalized = (tier || '').toLowerCase();
  if (normalized.includes('transformational')) return 'border-slate-300 bg-slate-950 text-white';
  if (normalized.includes('strategic')) return 'border-blue-200 bg-blue-50 text-blue-900';
  if (normalized.includes('operational')) return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  if (normalized.includes('emerging')) return 'border-amber-200 bg-amber-50 text-amber-900';
  return 'border-slate-800/70 bg-slate-900/70 text-slate-300';
}

export default function StrategicOpportunityCard({ drug }: Props) {
  const [payload, setPayload] = useState<OpportunityPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rxcui = drug?.rxcui;

  useEffect(() => {
    if (!rxcui) return;

    let active = true;

    async function loadOpportunity() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/opportunities/${encodeURIComponent(rxcui)}`);

        if (!response.ok) {
          throw new Error(`Strategic opportunity request failed with status ${response.status}`);
        }

        const json = (await response.json()) as OpportunityPayload;

        if (!active) return;
        setPayload(json);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load strategic opportunity.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadOpportunity();

    return () => {
      active = false;
    };
  }, [rxcui]);

  const topDrivers = useMemo(() => payload?.drivers?.slice(0, 6) || [], [payload]);

  if (!drug) return null;

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-800/70 bg-slate-950/70 shadow-sm">
      <div className="bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-7 text-white">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-blue-300">
              Sprint 22A · Strategic Opportunity Engine
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight">
              Strategic Opportunity Profile
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-100">
              Converts recommendation, executive portfolio, production candidacy, confidence, explainability,
              leaderboard proof, and risk into strategic opportunity positioning.
            </p>
          </div>

          {payload && (
            <div className="rounded-3xl border border-white/10 bg-white/10 px-6 py-5 text-right backdrop-blur">
              <p className="text-xs font-bold uppercase tracking-wide text-blue-100">
                Opportunity Score
              </p>
              <p className="mt-1 text-5xl font-black text-white">
                {formatScore(payload.opportunity.strategic_opportunity_score)}
              </p>
              <p className="mt-1 text-sm font-bold text-blue-100">
                Rank #{payload.opportunity.strategic_opportunity_rank?.toLocaleString()}
              </p>
              <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-black ${tierStyle(payload.opportunity.strategic_opportunity_tier)}`}>
                {payload.opportunity.strategic_opportunity_tier}
              </span>
              <p className="mt-2 text-xs font-semibold text-blue-100">
                {formatPercent(payload.opportunity.strategic_opportunity_percentile)} percentile
              </p>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="p-7 text-sm font-semibold text-slate-500">
          Loading strategic opportunity…
        </div>
      )}

      {error && (
        <div className="m-7 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700">
          {error}
        </div>
      )}

      {!loading && !error && payload && (
        <div className="p-7">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricTile label="Opportunity Type" value={payload.opportunity.strategic_opportunity_type} />
            <MetricTile label="Market Position" value={payload.opportunity.market_position} />
            <MetricTile label="Leaderboard Appearances" value={payload.leaderboard.leaderboard_appearance_count ?? 0} />
            <MetricTile label="Risk" value={formatScore(payload.scores.risk_score)} />
          </div>

          <div className="mt-5 rounded-3xl border border-slate-800/70 bg-slate-900/70 p-5">
            <h3 className="text-base font-black text-white">Strategic Action Plan</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {payload.opportunity.strategic_action_plan}
            </p>
          </div>

          <div className="mt-5 rounded-3xl border border-slate-800/70 bg-slate-950/70 p-5 shadow-sm">
            <h3 className="text-base font-black text-white">Top Opportunity Drivers</h3>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {topDrivers.map((driver) => (
                <div key={`${driver.driver_rank}-${driver.opportunity_driver}`} className="rounded-2xl border border-slate-800/70 bg-slate-900/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-black text-white">
                      #{driver.driver_rank} · {driver.opportunity_driver}
                    </p>
                    <span className="text-sm font-black text-white">
                      {formatScore(driver.driver_score)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{driver.driver_rationale}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-3xl border border-slate-800/70 bg-slate-950/70 p-5 shadow-sm">
            <h3 className="text-base font-black text-white">Methodology</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {payload.methodology.opportunity_methodology}
            </p>
            <p className="mt-3 text-xs font-semibold text-slate-500">
              Version: {payload.methodology.opportunity_version} · Built: {payload.methodology.build_timestamp}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function MetricTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-800/70 bg-slate-950/70 p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-black text-white">{value}</p>
    </div>
  );
}
