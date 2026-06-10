import { useEffect, useMemo, useState } from 'react';
import { DrugCard } from '../lib/api';

type UseCase = {
  use_case_rank: number;
  recommended_use_case: string;
  use_case_score: number;
  use_case_rationale: string;
};

type Audience = {
  audience_rank: number;
  recommended_audience: string;
  audience_score: number;
  audience_rationale: string;
};

type RecommendationPayload = {
  rxcui: string;
  display_name?: string;
  recommendation: {
    executive_recommendation_rank: number;
    executive_recommendation_score: number;
    executive_recommendation_percentile: number;
    business_impact_tier: string;
    recommendation_priority: string;
    primary_recommended_use_case: string;
    primary_recommended_audience: string;
    recommended_action_plan: string;
  };
  scores: Record<string, number>;
  use_cases: UseCase[];
  audiences: Audience[];
  methodology: {
    recommendation_version: string;
    recommendation_methodology: string;
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

  if (normalized.includes('transformational') || normalized.includes('critical')) {
    return 'border-cyan-300/50 bg-cyan-500/15 text-cyan-100';
  }

  if (normalized.includes('strategic')) {
    return 'border-blue-300/50 bg-blue-500/15 text-blue-100';
  }

  if (normalized.includes('operational')) {
    return 'border-emerald-300/50 bg-emerald-500/15 text-emerald-100';
  }

  if (normalized.includes('emerging')) {
    return 'border-amber-300/50 bg-amber-500/15 text-amber-100';
  }

  return 'border-slate-600 bg-slate-800 text-slate-200';
}

export default function ExecutiveRecommendationCard({ drug }: Props) {
  const [payload, setPayload] = useState<RecommendationPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rxcui = drug?.rxcui;

  useEffect(() => {
    if (!rxcui) return;

    let active = true;

    async function loadRecommendation() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/recommendations/${encodeURIComponent(rxcui)}`);

        if (!response.ok) {
          throw new Error(`Executive recommendation request failed with status ${response.status}`);
        }

        const json = (await response.json()) as RecommendationPayload;

        if (!active) return;
        setPayload(json);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load executive recommendation.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadRecommendation();

    return () => {
      active = false;
    };
  }, [rxcui]);

  const topUseCases = useMemo(() => payload?.use_cases?.slice(0, 5) || [], [payload]);
  const topAudiences = useMemo(() => payload?.audiences?.slice(0, 5) || [], [payload]);

  if (!drug) return null;

  return (
    <section className="overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-slate-950/90 text-white shadow-2xl shadow-slate-950/40">
      <div className="border-b border-cyan-300/10 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.16),_transparent_36%),linear-gradient(135deg,#020617,#0f172a_48%,#07152d)] p-6 md:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
              Executive Recommendation Engine
            </p>

            <h2 className="mt-3 text-3xl font-black tracking-tight text-white">
              What Should We Do With This Drug?
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Converts intelligence, explainability, readiness, confidence, and risk into recommended use cases,
              audiences, impact tiers, and action plans.
            </p>
          </div>

          {payload && (
            <div className="rounded-3xl border border-cyan-300/25 bg-cyan-500/10 px-6 py-5 text-right shadow-xl shadow-cyan-950/30 backdrop-blur">
              <p className="text-xs font-black uppercase tracking-wide text-cyan-200">
                Recommendation Score
              </p>

              <p className="mt-1 text-5xl font-black text-white">
                {formatScore(payload.recommendation.executive_recommendation_score)}
              </p>

              <p className="mt-1 text-sm font-bold text-cyan-100">
                Rank #{payload.recommendation.executive_recommendation_rank?.toLocaleString()}
              </p>

              <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-black ${tierStyle(payload.recommendation.business_impact_tier)}`}>
                {payload.recommendation.business_impact_tier}
              </span>

              <p className="mt-2 text-xs font-semibold text-cyan-100">
                {formatPercent(payload.recommendation.executive_recommendation_percentile)} percentile
              </p>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="p-7 text-sm font-semibold text-slate-400">
          Loading executive recommendation…
        </div>
      )}

      {error && (
        <div className="m-7 rounded-2xl border border-rose-400/40 bg-rose-950/40 p-5 text-sm font-semibold text-rose-200">
          {error}
        </div>
      )}

      {!loading && !error && payload && (
        <div className="space-y-5 p-6 md:p-7">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricTile label="Primary Use Case" value={payload.recommendation.primary_recommended_use_case} />
            <MetricTile label="Primary Audience" value={payload.recommendation.primary_recommended_audience} />
            <MetricTile label="Priority" value={payload.recommendation.recommendation_priority} />
            <MetricTile label="Risk" value={formatScore(payload.scores.risk_score)} />
          </div>

          <div className="rounded-3xl border border-cyan-300/15 bg-slate-900/70 p-5">
            <h3 className="text-base font-black text-white">Recommended Action Plan</h3>

            <p className="mt-2 text-sm leading-6 text-slate-300">
              {payload.recommendation.recommended_action_plan}
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <RecommendationList
              title="Recommended Use Cases"
              items={topUseCases.map((item) => ({
                rank: item.use_case_rank,
                title: item.recommended_use_case,
                score: item.use_case_score,
                rationale: item.use_case_rationale,
              }))}
            />

            <RecommendationList
              title="Recommended Audiences"
              items={topAudiences.map((item) => ({
                rank: item.audience_rank,
                title: item.recommended_audience,
                score: item.audience_score,
                rationale: item.audience_rationale,
              }))}
            />
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5">
            <h3 className="text-base font-black text-white">Methodology</h3>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              {payload.methodology.recommendation_methodology}
            </p>

            <p className="mt-3 text-xs font-semibold text-slate-500">
              Version: {payload.methodology.recommendation_version} · Built: {payload.methodology.build_timestamp}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function MetricTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-cyan-300/10 bg-slate-950/70 p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-cyan-300">
        {label}
      </p>

      <p className="mt-2 text-lg font-black text-white">
        {value}
      </p>
    </div>
  );
}

function RecommendationList({
  title,
  items,
}: {
  title: string;
  items: Array<{ rank: number; title: string; score: number; rationale: string }>;
}) {
  return (
    <div className="rounded-3xl border border-cyan-300/10 bg-slate-950/70 p-5 shadow-sm">
      <h3 className="text-base font-black text-white">{title}</h3>

      <div className="mt-4 space-y-3">
        {items.length === 0 && (
          <p className="text-sm text-slate-400">
            No recommendations identified.
          </p>
        )}

        {items.map((item) => (
          <div
            key={`${item.rank}-${item.title}`}
            className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-black text-white">
                  #{item.rank} · {item.title}
                </p>
              </div>

              <span className="text-sm font-black text-cyan-200">
                {formatScore(item.score)}
              </span>
            </div>

            <p className="mt-2 text-sm leading-5 text-slate-400">
              {item.rationale}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}