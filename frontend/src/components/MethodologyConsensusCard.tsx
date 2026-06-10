import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DrugCard } from '../lib/api';

type MethodologyPayload = {
  rxcui: string;
  display_name?: string;
  methodology_scores: {
    intelligence_score: number;
    readiness_score: number;
    confidence_score: number;
    pca_score: number;
  };
  consensus: {
    consensus_score: number;
    consensus_percentile: number;
    consensus_tier: string;
    agreement_index: number;
    methodology_variance: number;
    methodology_range: number;
    methodology_min_score: number;
    methodology_max_score: number;
    model_count: number;
  };
  methodology: {
    consensus_version: string;
    consensus_methodology: string;
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
  if (normalized.includes('exceptional')) return 'border-slate-700 bg-slate-950 text-white';
  if (normalized.includes('strong')) return 'border-blue-800 bg-blue-950/50 text-blue-100';
  if (normalized.includes('moderate')) return 'border-emerald-800 bg-emerald-950/40 text-emerald-100';
  if (normalized.includes('weak')) return 'border-amber-800 bg-amber-950/40 text-amber-100';
  return 'border-rose-800 bg-rose-950/40 text-rose-100';
}

export default function MethodologyConsensusCard({ drug }: Props) {
  const [payload, setPayload] = useState<MethodologyPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rxcui = drug?.rxcui;

  useEffect(() => {
    if (!rxcui) return;

    let active = true;

    async function loadMethodology() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/methodology/${encodeURIComponent(rxcui)}`);

        if (!response.ok) {
          throw new Error(`Methodology consensus request failed with status ${response.status}`);
        }

        const json = (await response.json()) as MethodologyPayload;

        if (!active) return;
        setPayload(json);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load methodology consensus.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadMethodology();

    return () => {
      active = false;
    };
  }, [rxcui]);

  const scoreRows = useMemo(() => {
    if (!payload) return [];

    return [
      { methodology: 'Intelligence', score: toNumber(payload.methodology_scores.intelligence_score) },
      { methodology: 'Readiness', score: toNumber(payload.methodology_scores.readiness_score) },
      { methodology: 'Confidence', score: toNumber(payload.methodology_scores.confidence_score) },
      { methodology: 'PCA', score: toNumber(payload.methodology_scores.pca_score) },
    ];
  }, [payload]);

  if (!drug) return null;

  return (
    <section className="overflow-hidden rounded-3xl border border-blue-900/40 bg-slate-950/85 shadow-sm shadow-blue-950/30">
      <div className="bg-slate-950/80 p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-blue-600">
              Sprint 18B · Methodology Consensus Engine
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-white">
              Cross-Methodology Validation
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Compares intelligence, readiness, confidence, and PCA models to quantify agreement across independent scoring methodologies.
            </p>
          </div>

          {payload && (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 px-6 py-5 text-right">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Consensus Score
              </p>
              <p className="mt-1 text-5xl font-black text-white">
                {formatScore(payload.consensus.consensus_score)}
              </p>
              <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-black ${tierStyle(payload.consensus.consensus_tier)}`}>
                {payload.consensus.consensus_tier}
              </span>
              <p className="mt-2 text-xs font-semibold text-slate-400">
                {formatPercent(payload.consensus.consensus_percentile)} percentile
              </p>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="px-7 pb-7 text-sm font-semibold text-slate-400">
          Loading methodology consensus…
        </div>
      )}

      {error && (
        <div className="mx-7 mb-7 rounded-2xl border border-rose-800 bg-rose-950/40 p-5 text-sm font-semibold text-rose-700">
          {error}
        </div>
      )}

      {!loading && !error && payload && (
        <div className="px-7 pb-7">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricTile label="Agreement Index" value={formatScore(payload.consensus.agreement_index)} />
            <MetricTile label="Variance" value={formatScore(payload.consensus.methodology_variance)} />
            <MetricTile label="Score Range" value={formatScore(payload.consensus.methodology_range)} />
            <MetricTile label="Models Compared" value={payload.consensus.model_count} />
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <ChartCard title="Methodology Radar" subtitle="Visual agreement across four independent scoring models.">
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={scoreRows}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="methodology" />
                  <Tooltip  contentStyle={{ backgroundColor: "#020617", border: "1px solid #1e3a8a", borderRadius: "16px", color: "#e2e8f0" }} labelStyle={{ color: "#bfdbfe" }} />
                  <Radar dataKey="score" name="Score" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.25} />
                </RadarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Score Comparison" subtitle="Raw score values by methodology.">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={scoreRows}>
                  <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                  <XAxis dataKey="methodology"  tick={{ fill: "#94a3b8" }} />
                  <YAxis domain={[0, 100]}  tick={{ fill: "#94a3b8" }} />
                  <Tooltip  contentStyle={{ backgroundColor: "#020617", border: "1px solid #1e3a8a", borderRadius: "16px", color: "#e2e8f0" }} labelStyle={{ color: "#bfdbfe" }} />
                  <Bar dataKey="score" name="Score" radius={[10, 10, 0, 0]}  fill="#38bdf8" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="mt-5 rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <h3 className="text-base font-black text-white">Consensus Interpretation</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Higher consensus indicates stronger alignment between independent scoring methodologies.
              Lower consensus highlights drugs where expert-weighted, confidence, readiness, and PCA models disagree.
            </p>
            <p className="mt-3 text-xs font-semibold text-slate-400">
              Version: {payload.methodology.consensus_version} · Built: {payload.methodology.build_timestamp}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function MetricTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm shadow-blue-950/30">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm shadow-blue-950/30">
      <h3 className="text-base font-black text-white">{title}</h3>
      <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
      <div className="mt-5">{children}</div>
    </div>
  );
}
