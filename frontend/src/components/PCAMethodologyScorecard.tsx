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

type PcaPayload = {
  rxcui: string;
  display_name?: string;
  pca: {
    pca_component_1: number;
    pca_component_2: number;
    pca_component_3: number;
    pca_component_1_score: number;
    pca_component_2_score: number;
    pca_component_3_score: number;
    pca_overall_score: number;
    pca_percentile: number;
    pca_tier: string;
  };
  comparison: {
    expert_overall_readiness_score: number;
    overall_intelligence_score: number;
    confidence_score: number;
    pca_vs_expert_delta: number;
  };
  model_summary: Array<{
    component: string;
    explained_variance_pct: number;
    cumulative_variance_pct: number;
  }>;
  methodology: {
    pca_model_version: string;
    pca_build_timestamp: string;
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
  if (normalized.includes('elite')) return 'border-slate-700 bg-slate-950 text-white';
  if (normalized.includes('advanced')) return 'border-blue-800 bg-blue-950/50 text-blue-100';
  if (normalized.includes('established')) return 'border-emerald-800 bg-emerald-950/40 text-emerald-100';
  if (normalized.includes('emerging')) return 'border-amber-800 bg-amber-950/40 text-amber-100';
  return 'border-slate-800 bg-slate-900/70 text-slate-300';
}

export default function PCAMethodologyScorecard({ drug }: Props) {
  const [payload, setPayload] = useState<PcaPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rxcui = drug?.rxcui;

  useEffect(() => {
    if (!rxcui) return;

    let active = true;

    async function loadPca() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/pca/${encodeURIComponent(rxcui)}`);

        if (!response.ok) {
          throw new Error(`PCA request failed with status ${response.status}`);
        }

        const json = (await response.json()) as PcaPayload;

        if (!active) return;
        setPayload(json);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load PCA model score.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadPca();

    return () => {
      active = false;
    };
  }, [rxcui]);

  const componentRows = useMemo(() => {
    if (!payload) return [];
    return [
      { component: 'PC1', score: toNumber(payload.pca.pca_component_1_score) },
      { component: 'PC2', score: toNumber(payload.pca.pca_component_2_score) },
      { component: 'PC3', score: toNumber(payload.pca.pca_component_3_score) },
    ];
  }, [payload]);

  const comparisonRows = useMemo(() => {
    if (!payload) return [];
    return [
      { metric: 'PCA', score: toNumber(payload.pca.pca_overall_score) },
      { metric: 'Expert', score: toNumber(payload.comparison.expert_overall_readiness_score) },
      { metric: 'Intelligence', score: toNumber(payload.comparison.overall_intelligence_score) },
      { metric: 'Confidence', score: toNumber(payload.comparison.confidence_score) },
    ];
  }, [payload]);

  if (!drug) return null;

  return (
    <section className="overflow-hidden rounded-3xl border border-blue-900/40 bg-slate-950/85 shadow-sm shadow-blue-950/30">
      <div className="bg-slate-950/80 p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-blue-600">
              Sprint 18A · PCA Model Framework
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-white">
              Empirical PCA Readiness Model
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Principal Component Analysis creates the first empirical scoring model to compare against the expert-weighted baseline.
            </p>
          </div>

          {payload && (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 px-6 py-5 text-right">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                PCA Readiness
              </p>
              <p className="mt-1 text-5xl font-black text-white">
                {formatScore(payload.pca.pca_overall_score)}
              </p>
              <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-black ${tierStyle(payload.pca.pca_tier)}`}>
                {payload.pca.pca_tier}
              </span>
              <p className="mt-2 text-xs font-semibold text-slate-400">
                {formatPercent(payload.pca.pca_percentile)} percentile
              </p>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="px-7 pb-7 text-sm font-semibold text-slate-400">
          Loading PCA model score…
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
            <MetricTile label="PCA Score" value={formatScore(payload.pca.pca_overall_score)} />
            <MetricTile label="PCA Percentile" value={formatPercent(payload.pca.pca_percentile)} />
            <MetricTile label="Expert Score" value={formatScore(payload.comparison.expert_overall_readiness_score)} />
            <MetricTile label="PCA vs Expert" value={formatScore(payload.comparison.pca_vs_expert_delta)} />
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <ChartCard title="PCA Components" subtitle="Normalized scores for the first three principal components.">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={componentRows}>
                  <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                  <XAxis dataKey="component"  tick={{ fill: "#94a3b8" }} />
                  <YAxis domain={[0, 100]}  tick={{ fill: "#94a3b8" }} />
                  <Tooltip  contentStyle={{ backgroundColor: "#020617", border: "1px solid #1e3a8a", borderRadius: "16px", color: "#e2e8f0" }} labelStyle={{ color: "#bfdbfe" }} />
                  <Bar dataKey="score" name="Score" radius={[10, 10, 0, 0]}  fill="#38bdf8" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Methodology Comparison" subtitle="PCA compared with expert readiness, intelligence, and confidence scores.">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={comparisonRows}>
                  <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                  <XAxis dataKey="metric"  tick={{ fill: "#94a3b8" }} />
                  <YAxis domain={[0, 100]}  tick={{ fill: "#94a3b8" }} />
                  <Tooltip  contentStyle={{ backgroundColor: "#020617", border: "1px solid #1e3a8a", borderRadius: "16px", color: "#e2e8f0" }} labelStyle={{ color: "#bfdbfe" }} />
                  <Bar dataKey="score" name="Score" radius={[10, 10, 0, 0]}  fill="#38bdf8" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="mt-5 rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <h3 className="text-base font-black text-white">PCA Model Summary</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              PC1 explains {formatPercent(payload.model_summary?.[0]?.explained_variance_pct)} of variance.
              Top-three cumulative variance is {formatPercent(payload.model_summary?.[2]?.cumulative_variance_pct)}.
            </p>
            <p className="mt-3 text-xs font-semibold text-slate-400">
              Version: {payload.methodology.pca_model_version} · Built: {payload.methodology.pca_build_timestamp}
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
