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

type CandidatePayload = {
  rxcui: string;
  display_name?: string;
  rank: {
    production_rank: number;
    production_candidate_score: number;
    production_candidate_percentile: number;
    production_candidate_tier: string;
    production_status: string;
    showcase_recommendation: string;
  };
  signals: Record<string, number>;
  flags: {
    is_top_10_candidate: number;
    is_top_100_candidate: number;
    is_flagship_candidate: number;
  };
  methodology: {
    candidate_engine_version: string;
    candidate_methodology: string;
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
  if (normalized.includes('tier 1')) return 'border-slate-300 bg-slate-950 text-white';
  if (normalized.includes('tier 2')) return 'border-blue-200 bg-blue-50 text-blue-900';
  if (normalized.includes('tier 3')) return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  if (normalized.includes('tier 4')) return 'border-amber-200 bg-amber-50 text-amber-900';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

export default function ProductionCandidateCard({ drug }: Props) {
  const [payload, setPayload] = useState<CandidatePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rxcui = drug?.rxcui;

  useEffect(() => {
    if (!rxcui) return;

    let active = true;

    async function loadCandidate() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/production-candidates/${encodeURIComponent(rxcui)}`);

        if (!response.ok) {
          throw new Error(`Production candidate request failed with status ${response.status}`);
        }

        const json = (await response.json()) as CandidatePayload;

        if (!active) return;
        setPayload(json);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load production candidate ranking.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadCandidate();

    return () => {
      active = false;
    };
  }, [rxcui]);

  const signalRows = useMemo(() => {
    if (!payload) return [];

    return [
      { signal: 'Deploy', score: toNumber(payload.signals.deployment_priority_score) },
      { signal: 'Opportunity', score: toNumber(payload.signals.opportunity_score) },
      { signal: 'Confidence', score: toNumber(payload.signals.confidence_score) },
      { signal: 'Consensus', score: toNumber(payload.signals.consensus_score) },
      { signal: 'Graph', score: toNumber(payload.signals.graph_connectivity_score) },
      { signal: 'Risk', score: toNumber(payload.signals.risk_score) },
    ];
  }, [payload]);

  if (!drug) return null;

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-white p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-blue-600">
              Sprint 19B · Production Candidate Ranking
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
              Production Candidate Rank
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Ranks medications by deployment utility, confidence, consensus, graph strength, benchmark position, and risk.
            </p>
          </div>

          {payload && (
            <div className="rounded-3xl border border-slate-200 bg-slate-50 px-6 py-5 text-right">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Production Rank
              </p>
              <p className="mt-1 text-5xl font-black text-slate-950">
                #{payload.rank.production_rank?.toLocaleString()}
              </p>
              <p className="mt-1 text-3xl font-black text-slate-950">
                {formatScore(payload.rank.production_candidate_score)}
              </p>
              <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-black ${tierStyle(payload.rank.production_candidate_tier)}`}>
                {payload.rank.production_candidate_tier}
              </span>
              <p className="mt-2 text-xs font-semibold text-slate-500">
                {formatPercent(payload.rank.production_candidate_percentile)} percentile
              </p>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="px-7 pb-7 text-sm font-semibold text-slate-500">
          Loading production candidate ranking…
        </div>
      )}

      {error && (
        <div className="mx-7 mb-7 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700">
          {error}
        </div>
      )}

      {!loading && !error && payload && (
        <div className="px-7 pb-7">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricTile label="Status" value={payload.rank.production_status} />
            <MetricTile label="Top 100" value={payload.flags.is_top_100_candidate ? 'Yes' : 'No'} />
            <MetricTile label="Flagship" value={payload.flags.is_flagship_candidate ? 'Yes' : 'No'} />
            <MetricTile label="Risk" value={formatScore(payload.signals.risk_score)} />
          </div>

          <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-black text-slate-950">Candidate Signal Profile</h3>
            <p className="mt-1 text-sm text-slate-500">
              Signals used to rank the medication as a production or demo candidate.
            </p>

            <div className="mt-5 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={signalRows}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="signal" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="score" name="Score" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <h3 className="text-base font-black text-slate-950">Showcase Recommendation</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {payload.rank.showcase_recommendation}
            </p>
            <p className="mt-3 text-xs font-semibold text-slate-500">
              Version: {payload.methodology.candidate_engine_version} · Built: {payload.methodology.build_timestamp}
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
