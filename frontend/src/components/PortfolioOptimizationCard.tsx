import { useEffect, useMemo, useState } from 'react';
import { DrugCard } from '../lib/api';

type OptimizationAction = {
  action_rank: number;
  optimization_action: string;
  action_score: number;
  action_rationale: string;
};

type OptimizationPayload = {
  rxcui: string;
  display_name?: string;
  optimization: {
    portfolio_optimization_rank: number;
    portfolio_optimization_score: number;
    portfolio_optimization_percentile: number;
    portfolio_segment: string;
    primary_optimization_action: string;
    investment_priority: string;
    optimization_action_plan: string;
  };
  scores: Record<string, number>;
  actions: OptimizationAction[];
  methodology: {
    optimization_version: string;
    optimization_methodology: string;
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

function segmentStyle(segment?: string) {
  const normalized = (segment || '').toLowerCase();
  if (normalized.includes('flagship')) return 'border-slate-300 bg-slate-950 text-white';
  if (normalized.includes('strategic')) return 'border-blue-200 bg-blue-50 text-blue-900';
  if (normalized.includes('operational')) return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  if (normalized.includes('enrichment')) return 'border-amber-200 bg-amber-50 text-amber-900';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

export default function PortfolioOptimizationCard({ drug }: Props) {
  const [payload, setPayload] = useState<OptimizationPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rxcui = drug?.rxcui;

  useEffect(() => {
    if (!rxcui) return;

    let active = true;

    async function loadOptimization() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/portfolio-optimization/${encodeURIComponent(rxcui)}`);

        if (!response.ok) {
          throw new Error(`Portfolio optimization request failed with status ${response.status}`);
        }

        const json = (await response.json()) as OptimizationPayload;

        if (!active) return;
        setPayload(json);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load portfolio optimization.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadOptimization();

    return () => {
      active = false;
    };
  }, [rxcui]);

  const topActions = useMemo(() => payload?.actions?.slice(0, 5) || [], [payload]);

  if (!drug) return null;

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-950 p-7 text-white">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-blue-300">
              Sprint 22B · Portfolio Optimization Engine
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight">
              Portfolio Optimization Decision
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-100">
              Converts opportunity and recommendation intelligence into portfolio actions: promote, scale, selectively use, enrich, or monitor.
            </p>
          </div>

          {payload && (
            <div className="rounded-3xl border border-white/10 bg-white/10 px-6 py-5 text-right backdrop-blur">
              <p className="text-xs font-bold uppercase tracking-wide text-blue-100">
                Optimization Score
              </p>
              <p className="mt-1 text-5xl font-black text-white">
                {formatScore(payload.optimization.portfolio_optimization_score)}
              </p>
              <p className="mt-1 text-sm font-bold text-blue-100">
                Rank #{payload.optimization.portfolio_optimization_rank?.toLocaleString()}
              </p>
              <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-black ${segmentStyle(payload.optimization.portfolio_segment)}`}>
                {payload.optimization.portfolio_segment}
              </span>
              <p className="mt-2 text-xs font-semibold text-blue-100">
                {formatPercent(payload.optimization.portfolio_optimization_percentile)} percentile
              </p>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="p-7 text-sm font-semibold text-slate-500">
          Loading portfolio optimization…
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
            <MetricTile label="Primary Action" value={payload.optimization.primary_optimization_action} />
            <MetricTile label="Investment Priority" value={payload.optimization.investment_priority} />
            <MetricTile label="Strategic Opportunity" value={formatScore(payload.scores.strategic_opportunity_score)} />
            <MetricTile label="Risk" value={formatScore(payload.scores.risk_score)} />
          </div>

          <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <h3 className="text-base font-black text-slate-950">Optimization Action Plan</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {payload.optimization.optimization_action_plan}
            </p>
          </div>

          <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-black text-slate-950">Action Options</h3>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {topActions.map((action) => (
                <div key={`${action.action_rank}-${action.optimization_action}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-black text-slate-950">
                      #{action.action_rank} · {action.optimization_action}
                    </p>
                    <span className="text-sm font-black text-slate-900">
                      {formatScore(action.action_score)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{action.action_rationale}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-black text-slate-950">Methodology</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {payload.methodology.optimization_methodology}
            </p>
            <p className="mt-3 text-xs font-semibold text-slate-500">
              Version: {payload.methodology.optimization_version} · Built: {payload.methodology.build_timestamp}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function MetricTile({ label, value }: { label: string | number; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}
