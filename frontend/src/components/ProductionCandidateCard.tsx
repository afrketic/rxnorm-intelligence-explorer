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
import { formatPercentile, formatScore, releaseBadgeClass } from '../lib/uiFormat';

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
    <section className="overflow-hidden rounded-3xl border border-slate-800/70 bg-slate-950/70 shadow-sm">
      <div className="bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-7 text-white">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-blue-200">
              Sprint 19B · Production Candidate Ranking
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight">
              Production Candidate Rank
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-100">
              Ranks medications by deployment utility, confidence, consensus, graph strength, benchmark position, and risk.
            </p>
          </div>

          {payload && (
            <div className="rounded-3xl border border-white/10 bg-white/10 px-6 py-5 text-right backdrop-blur">
              <p className="text-xs font-bold uppercase tracking-wide text-blue-100">
                Production Rank
              </p>
              <p className="mt-1 text-5xl font-black text-white">
                #{payload.rank.production_rank?.toLocaleString()}
              </p>
              <p className="mt-1 text-3xl font-black text-white">
                {formatScore(payload.rank.production_candidate_score)}
              </p>
              <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-black ${releaseBadgeClass(payload.rank.production_candidate_tier)}`}>
                {payload.rank.production_candidate_tier}
              </span>
              <p className="mt-2 text-xs font-semibold text-blue-100">
                {formatPercentile(payload.rank.production_candidate_percentile)}
              </p>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="p-7 text-sm font-semibold text-slate-500">
          Loading production candidate ranking…
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
            <MetricTile label="Status" value={payload.rank.production_status} />
            <MetricTile label="Top 100" value={payload.flags.is_top_100_candidate ? 'Yes' : 'No'} />
            <MetricTile label="Flagship" value={payload.flags.is_flagship_candidate ? 'Yes' : 'No'} />
            <MetricTile label="Risk" value={formatScore(payload.signals.risk_score)} />
          </div>

          <div className="mt-5 rounded-3xl border border-slate-800/70 bg-slate-950/70 p-5 shadow-sm">
            <h3 className="text-base font-black text-white">Candidate Signal Profile</h3>
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

          <div className="mt-5 rounded-3xl border border-slate-800/70 bg-slate-900/70 p-5">
            <h3 className="text-base font-black text-white">Showcase Recommendation</h3>
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
    <div className="rounded-2xl border border-slate-800/70 bg-slate-950/70 p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-black text-white">{value}</p>
    </div>
  );
}
