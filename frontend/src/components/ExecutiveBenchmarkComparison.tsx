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

type BenchmarkComparison = {
  rxcui: string;
  display_name: string;
  overall_intelligence_score: number;
  overall_intelligence_rank: number;
  overall_intelligence_percentile: number;
  overall_intelligence_vs_population_avg: number;
  benchmark_tier: string;
  claims_readiness_score: number;
  claims_readiness_percentile: number;
  ai_readiness_score: number;
  ai_readiness_percentile: number;
  semantic_richness_score: number;
  semantic_richness_percentile: number;
  graph_connectivity_score: number;
  graph_connectivity_percentile: number;
  node_count: number;
  edge_count: number;
  population_size: number;
  population_average_overall_score: number;
  population_median_overall_score: number;
  drugs_below_or_equal_overall_score: number;
  drugs_above_overall_score: number;
  executive_benchmark_summary: string;
};

type TierDistribution = {
  benchmark_tier: string;
  medication_count: number;
  population_share_pct: number;
  avg_overall_intelligence_score: number;
};

type ScoreDistribution = {
  overall_score_bucket: string;
  medication_count: number;
  population_share_pct: number;
  avg_graph_connectivity_score: number;
};

type BenchmarkPayload = {
  rxcui: string;
  comparison: BenchmarkComparison;
  tier_distribution: TierDistribution[];
  score_distribution: ScoreDistribution[];
  top_context: BenchmarkComparison[];
  peer_context: BenchmarkComparison[];
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
  return `${Math.round(toNumber(value))}%`;
}

function formatNumber(value: unknown) {
  return toNumber(value).toLocaleString();
}

function getTierStyle(tier?: string) {
  const normalized = (tier || '').toLowerCase();

  if (normalized.includes('platinum')) return 'border-slate-300 bg-slate-950 text-white';
  if (normalized.includes('enterprise')) return 'border-blue-200 bg-blue-50 text-blue-900';
  if (normalized.includes('gold')) return 'border-amber-200 bg-amber-50 text-amber-900';
  if (normalized.includes('silver')) return 'border-slate-200 bg-slate-50 text-slate-800';
  if (normalized.includes('bronze')) return 'border-orange-200 bg-orange-50 text-orange-900';
  return 'border-slate-200 bg-white text-slate-700';
}

export default function ExecutiveBenchmarkComparison({ drug }: Props) {
  const [payload, setPayload] = useState<BenchmarkPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rxcui = drug?.rxcui;

  useEffect(() => {
    if (!rxcui) return;

    let active = true;

    async function loadBenchmark() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/benchmark/comparison/${encodeURIComponent(rxcui)}`);

        if (!response.ok) {
          throw new Error(`Benchmark request failed with status ${response.status}`);
        }

        const json = (await response.json()) as BenchmarkPayload;

        if (!active) return;

        setPayload(json);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load benchmark comparison.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadBenchmark();

    return () => {
      active = false;
    };
  }, [rxcui]);

  const comparison = payload?.comparison;

  const percentileRows = useMemo(() => {
    if (!comparison) return [];

    return [
      {
        metric: 'Overall',
        percentile: toNumber(comparison.overall_intelligence_percentile),
      },
      {
        metric: 'Claims',
        percentile: toNumber(comparison.claims_readiness_percentile),
      },
      {
        metric: 'AI',
        percentile: toNumber(comparison.ai_readiness_percentile),
      },
      {
        metric: 'Semantic',
        percentile: toNumber(comparison.semantic_richness_percentile),
      },
      {
        metric: 'Graph',
        percentile: toNumber(comparison.graph_connectivity_percentile),
      },
    ];
  }, [comparison]);

  if (!drug) {
    return null;
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-600">
            Sprint 15B · Executive Benchmark Comparison
          </p>

          <h3 className="mt-2 text-2xl font-black text-slate-950">
            Population Benchmark Position
          </h3>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Compares the selected medication against the full RxNorm Intelligence Platform population.
          </p>
        </div>

        {comparison && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-right">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Percentile Rank
            </p>
            <p className="mt-1 text-4xl font-black text-slate-950">
              {toNumber(comparison.overall_intelligence_percentile).toFixed(1)}
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              out of {formatNumber(comparison.population_size)} RxCUIs
            </p>
          </div>
        )}
      </div>

      {loading && (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
          Loading benchmark comparison…
        </div>
      )}

      {error && (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700">
          {error}
        </div>
      )}

      {!loading && !error && comparison && (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <BenchmarkMetric
              label="Overall Rank"
              value={`#${formatNumber(comparison.overall_intelligence_rank)}`}
              helper={`of ${formatNumber(comparison.population_size)}`}
            />
            <BenchmarkMetric
              label="Benchmark Tier"
              value={comparison.benchmark_tier}
              helper="Calibrated comparison tier"
              valueClassName={getTierStyle(comparison.benchmark_tier)}
            />
            <BenchmarkMetric
              label="Above Population Avg"
              value={`+${toNumber(comparison.overall_intelligence_vs_population_avg).toFixed(2)}`}
              helper="Score points"
            />
            <BenchmarkMetric
              label="Drugs Below / Equal"
              value={formatNumber(comparison.drugs_below_or_equal_overall_score)}
              helper="RxCUIs at or below score"
            />
            <BenchmarkMetric
              label="Drugs Above"
              value={formatNumber(comparison.drugs_above_overall_score)}
              helper="RxCUIs scoring higher"
            />
          </div>

          <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-700">
              Executive Benchmark Assessment
            </p>
            <p className="mt-3 text-base leading-8 text-slate-700">
              {comparison.executive_benchmark_summary}
            </p>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr]">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h4 className="text-base font-black text-slate-950">
                Percentile Comparison
              </h4>
              <p className="mt-1 text-sm text-slate-500">
                Selected medication percentile across core intelligence dimensions.
              </p>

              <div className="mt-5 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={percentileRows}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="metric" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Bar dataKey="percentile" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h4 className="text-base font-black text-slate-950">
                Tier Distribution
              </h4>
              <p className="mt-1 text-sm text-slate-500">
                Share of RxCUIs by calibrated benchmark tier.
              </p>

              <div className="mt-5 space-y-3">
                {(payload?.tier_distribution || []).map((row) => (
                  <div key={row.benchmark_tier} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <span className={`rounded-full border px-3 py-1 text-xs font-black ${getTierStyle(row.benchmark_tier)}`}>
                        {row.benchmark_tier}
                      </span>

                      <span className="text-sm font-black text-slate-950">
                        {formatNumber(row.medication_count)}
                      </span>
                    </div>

                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-slate-950"
                        style={{ width: `${Math.min(toNumber(row.population_share_pct), 100)}%` }}
                      />
                    </div>

                    <p className="mt-2 text-xs font-semibold text-slate-500">
                      {toNumber(row.population_share_pct).toFixed(2)}% of population · Avg score {toNumber(row.avg_overall_intelligence_score).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
            <h4 className="text-base font-black">
              Benchmark Interpretation
            </h4>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              A high percentile rank means this medication has stronger intelligence maturity than most
              RxCUIs in the platform. This includes scoring strength, classification evidence, graph
              connectivity, and readiness for claims analytics, interoperability, explainability, and AI workflows.
            </p>
          </div>
        </>
      )}
    </section>
  );
}

function BenchmarkMetric({
  label,
  value,
  helper,
  valueClassName,
}: {
  label: string;
  value: string | number;
  helper: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      {valueClassName ? (
        <span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-black ${valueClassName}`}>
          {value}
        </span>
      ) : (
        <p className="mt-1 text-2xl font-black text-slate-950">
          {value}
        </p>
      )}

      <p className="mt-2 text-xs font-semibold text-slate-500">
        {helper}
      </p>
    </div>
  );
}
