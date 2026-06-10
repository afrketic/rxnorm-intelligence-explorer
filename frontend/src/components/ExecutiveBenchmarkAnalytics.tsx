import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DrugCard } from '../lib/api';

type RankCard = {
  rank: number;
  population_size: number;
  percentile: number;
  top_population_share_pct: number;
  top_population_label: string;
  benchmark_tier: string;
  overall_intelligence_score: number;
};

type AnalyticsPayload = {
  rxcui: string;
  rank_card: RankCard;
  percentile_breakdown: Record<string, number>;
  population_comparison: Record<string, any>;
  driver_breakdown: Record<string, number>;
  peer_comparison: Array<{
    rxcui: string;
    display_name: string;
    overall_intelligence_score: number;
    benchmark_tier: string;
    claims_readiness_score: number;
    ai_readiness_score: number;
    semantic_richness_score: number;
    graph_connectivity_score: number;
  }>;
  analytics_narrative: string;
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

function formatNumber(value: unknown) {
  return toNumber(value).toLocaleString();
}

function formatScore(value: unknown) {
  return `${Math.round(toNumber(value))}%`;
}

function getTierStyle(tier?: string) {
  const normalized = (tier || '').toLowerCase();

  if (normalized.includes('platinum')) return 'border-slate-300 bg-slate-950 text-white';
  if (normalized.includes('enterprise')) return 'border-blue-200 bg-blue-50 text-blue-900';
  if (normalized.includes('gold')) return 'border-amber-200 bg-amber-50 text-amber-900';
  if (normalized.includes('silver')) return 'border-slate-200 bg-slate-50 text-slate-800';
  return 'border-slate-200 bg-white text-slate-700';
}

export default function ExecutiveBenchmarkAnalytics({ drug }: Props) {
  const [payload, setPayload] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rxcui = drug?.rxcui;

  useEffect(() => {
    if (!rxcui) return;

    let active = true;

    async function loadAnalytics() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/benchmark/analytics/${encodeURIComponent(rxcui)}`);

        if (!response.ok) {
          throw new Error(`Benchmark analytics request failed with status ${response.status}`);
        }

        const json = (await response.json()) as AnalyticsPayload;

        if (!active) return;
        setPayload(json);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load benchmark analytics.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadAnalytics();

    return () => {
      active = false;
    };
  }, [rxcui]);

  const percentileData = useMemo(() => {
    if (!payload) return [];

    return [
      { metric: 'Overall', percentile: toNumber(payload.percentile_breakdown.overall) },
      { metric: 'Claims', percentile: toNumber(payload.percentile_breakdown.claims) },
      { metric: 'AI', percentile: toNumber(payload.percentile_breakdown.ai) },
      { metric: 'Semantic', percentile: toNumber(payload.percentile_breakdown.semantic) },
      { metric: 'Graph', percentile: toNumber(payload.percentile_breakdown.graph) },
    ];
  }, [payload]);

  const driverData = useMemo(() => {
    if (!payload) return [];

    return Object.entries(payload.driver_breakdown).map(([driver, points]) => ({
      driver,
      points: toNumber(points),
    }));
  }, [payload]);

  const peerData = useMemo(() => {
    if (!payload) return [];

    const selectedName = drug?.rxnorm_name || drug?.drug_name || drug?.name || `RxCUI ${payload.rxcui}`;

    return [
      {
        medication: selectedName,
        overall: toNumber(payload.rank_card.overall_intelligence_score),
        claims: toNumber((payload.population_comparison.claims || {}).selected),
        ai: toNumber((payload.population_comparison.ai || {}).selected),
        graph: toNumber((payload.population_comparison.graph || {}).selected),
      },
      ...(payload.peer_comparison || []).map((peer) => ({
        medication: peer.display_name,
        overall: toNumber(peer.overall_intelligence_score),
        claims: toNumber(peer.claims_readiness_score),
        ai: toNumber(peer.ai_readiness_score),
        graph: toNumber(peer.graph_connectivity_score),
      })),
    ];
  }, [payload, drug]);

  if (!drug) return null;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-600">
            Sprint 16A · Intelligence Benchmark Analytics
          </p>

          <h3 className="mt-2 text-2xl font-black text-slate-950">
            Why This Medication Scores Higher
          </h3>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Explains ranking strength, percentile position, score drivers, and peer medication context.
          </p>
        </div>

        {payload && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-right">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Intelligence Rank
            </p>
            <p className="mt-1 text-4xl font-black text-slate-950">
              #{formatNumber(payload.rank_card.rank)}
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              of {formatNumber(payload.rank_card.population_size)}
            </p>
          </div>
        )}
      </div>

      {loading && (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
          Loading intelligence benchmark analytics…
        </div>
      )}

      {error && (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700">
          {error}
        </div>
      )}

      {!loading && !error && payload && (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <RankMetric label="Top Population Share" value={payload.rank_card.top_population_label} />
            <RankMetric label="Percentile" value={`${toNumber(payload.rank_card.percentile).toFixed(2)}th`} />
            <RankMetric label="Benchmark Tier" value={payload.rank_card.benchmark_tier} badge />
            <RankMetric label="Overall Score" value={formatScore(payload.rank_card.overall_intelligence_score)} />
          </div>

          <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-700">
              Analytics Interpretation
            </p>
            <p className="mt-3 text-base leading-8 text-slate-700">
              {payload.analytics_narrative}
            </p>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <ChartCard title="Percentile Breakdown" subtitle="How the selected medication ranks across benchmark dimensions.">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={percentileData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="metric" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="percentile" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Intelligence Driver Breakdown" subtitle="Approximate point contribution from major evidence categories.">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={driverData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 25]} />
                  <YAxis type="category" dataKey="driver" width={145} />
                  <Tooltip />
                  <Bar dataKey="points" radius={[0, 10, 10, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h4 className="text-base font-black text-slate-950">
              Peer Medication Comparison
            </h4>
            <p className="mt-1 text-sm text-slate-500">
              Closest score peers compared across overall, claims, AI, and graph intelligence.
            </p>

            <div className="mt-5 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={peerData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="medication" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="overall" name="Overall" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="claims" name="Claims" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="ai" name="AI" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="graph" name="Graph" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function RankMetric({
  label,
  value,
  badge = false,
}: {
  label: string;
  value: string | number;
  badge?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      {badge ? (
        <span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-black ${getTierStyle(String(value))}`}>
          {value}
        </span>
      ) : (
        <p className="mt-1 text-2xl font-black text-slate-950">
          {value}
        </p>
      )}
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
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h4 className="text-base font-black text-slate-950">{title}</h4>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      <div className="mt-5">{children}</div>
    </div>
  );
}
