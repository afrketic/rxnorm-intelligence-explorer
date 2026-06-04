import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DrugCard } from '../lib/api';

type ExecutivePayload = {
  rxcui: string;
  display_name?: string;
  executive: {
    executive_rank: number;
    executive_portfolio_score: number;
    executive_percentile: number;
    executive_tier: string;
    executive_interpretation: string;
  };
  scores: Record<string, number>;
  flags: {
    is_executive_top_10: number;
    is_executive_top_25: number;
    is_executive_top_100: number;
  };
  methodology: {
    executive_version: string;
    executive_methodology: string;
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
  if (normalized.includes('flagship')) return 'border-slate-300 bg-slate-950 text-white';
  if (normalized.includes('leader')) return 'border-blue-200 bg-blue-50 text-blue-900';
  if (normalized.includes('recommended')) return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  if (normalized.includes('watchlist')) return 'border-amber-200 bg-amber-50 text-amber-900';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

export default function ExecutivePortfolioCard({ drug }: Props) {
  const [payload, setPayload] = useState<ExecutivePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rxcui = drug?.rxcui;

  useEffect(() => {
    if (!rxcui) return;

    let active = true;

    async function loadExecutive() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/executive/${encodeURIComponent(rxcui)}`);

        if (!response.ok) {
          throw new Error(`Executive portfolio request failed with status ${response.status}`);
        }

        const json = (await response.json()) as ExecutivePayload;

        if (!active) return;
        setPayload(json);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load executive portfolio ranking.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadExecutive();

    return () => {
      active = false;
    };
  }, [rxcui]);

  const scoreRows = useMemo(() => {
    if (!payload) return [];

    return [
      { metric: 'Production', score: toNumber(payload.scores.production_candidate_score) },
      { metric: 'Deploy', score: toNumber(payload.scores.deployment_priority_score) },
      { metric: 'Consensus', score: toNumber(payload.scores.consensus_score) },
      { metric: 'Confidence', score: toNumber(payload.scores.confidence_score) },
      { metric: 'Readiness', score: toNumber(payload.scores.overall_readiness_score) },
    ];
  }, [payload]);

  if (!drug) return null;

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-gradient-to-br from-slate-950 to-slate-800 p-7 text-white">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-blue-300">
              Sprint 20A · Executive Portfolio Ranking
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight">
              Executive Portfolio Intelligence
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Enterprise-level ranking across all RxCUIs using production candidacy, deployment priority,
              consensus, confidence, and readiness.
            </p>
          </div>

          {payload && (
            <div className="rounded-3xl border border-white/10 bg-white/10 px-6 py-5 text-right backdrop-blur">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-300">
                Executive Rank
              </p>
              <p className="mt-1 text-5xl font-black text-white">
                #{payload.executive.executive_rank?.toLocaleString()}
              </p>
              <p className="mt-1 text-3xl font-black text-white">
                {formatScore(payload.executive.executive_portfolio_score)}
              </p>
              <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-black ${tierStyle(payload.executive.executive_tier)}`}>
                {payload.executive.executive_tier}
              </span>
              <p className="mt-2 text-xs font-semibold text-slate-300">
                {formatPercent(payload.executive.executive_percentile)} percentile
              </p>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="p-7 text-sm font-semibold text-slate-500">
          Loading executive portfolio ranking…
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
            <MetricTile label="Portfolio Score" value={formatScore(payload.executive.executive_portfolio_score)} />
            <MetricTile label="Percentile" value={formatPercent(payload.executive.executive_percentile)} />
            <MetricTile label="Top 100" value={payload.flags.is_executive_top_100 ? 'Yes' : 'No'} />
            <MetricTile label="Tier" value={payload.executive.executive_tier} />
          </div>

          <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-black text-slate-950">Executive Score Inputs</h3>
            <p className="mt-1 text-sm text-slate-500">
              Weighted inputs feeding the executive portfolio score.
            </p>

            <div className="mt-5 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scoreRows}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="metric" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="score" name="Score" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <h3 className="text-base font-black text-slate-950">Executive Interpretation</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {payload.executive.executive_interpretation}
            </p>
            <p className="mt-3 text-xs font-semibold text-slate-500">
              Version: {payload.methodology.executive_version} · Built: {payload.methodology.build_timestamp}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function MetricTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-black text-slate-950">{value}</p>
    </div>
  );
}
