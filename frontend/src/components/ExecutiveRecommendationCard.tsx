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
  if (normalized.includes('transformational')) return 'border-slate-300 bg-slate-950 text-white';
  if (normalized.includes('strategic')) return 'border-blue-200 bg-blue-50 text-blue-900';
  if (normalized.includes('operational')) return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  if (normalized.includes('emerging')) return 'border-amber-200 bg-amber-50 text-amber-900';
  return 'border-slate-200 bg-slate-50 text-slate-700';
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
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-gradient-to-br from-blue-950 to-slate-950 p-7 text-white">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-blue-300">
              Sprint 21B · Executive Recommendation Engine
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight">
              What Should We Do With This Drug?
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-100">
              Converts intelligence, explainability, readiness, confidence, and risk into recommended use cases,
              audiences, impact tiers, and action plans.
            </p>
          </div>

          {payload && (
            <div className="rounded-3xl border border-white/10 bg-white/10 px-6 py-5 text-right backdrop-blur">
              <p className="text-xs font-bold uppercase tracking-wide text-blue-100">
                Recommendation Score
              </p>
              <p className="mt-1 text-5xl font-black text-white">
                {formatScore(payload.recommendation.executive_recommendation_score)}
              </p>
              <p className="mt-1 text-sm font-bold text-blue-100">
                Rank #{payload.recommendation.executive_recommendation_rank?.toLocaleString()}
              </p>
              <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-black ${tierStyle(payload.recommendation.business_impact_tier)}`}>
                {payload.recommendation.business_impact_tier}
              </span>
              <p className="mt-2 text-xs font-semibold text-blue-100">
                {formatPercent(payload.recommendation.executive_recommendation_percentile)} percentile
              </p>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="p-7 text-sm font-semibold text-slate-500">
          Loading executive recommendation…
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
            <MetricTile label="Primary Use Case" value={payload.recommendation.primary_recommended_use_case} />
            <MetricTile label="Primary Audience" value={payload.recommendation.primary_recommended_audience} />
            <MetricTile label="Priority" value={payload.recommendation.recommendation_priority} />
            <MetricTile label="Risk" value={formatScore(payload.scores.risk_score)} />
          </div>

          <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <h3 className="text-base font-black text-slate-950">Recommended Action Plan</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {payload.recommendation.recommended_action_plan}
            </p>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
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

          <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-black text-slate-950">Methodology</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
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
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-black text-slate-950">{value}</p>
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
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-black text-slate-950">{title}</h3>
      <div className="mt-4 space-y-3">
        {items.length === 0 && <p className="text-sm text-slate-500">No recommendations identified.</p>}

        {items.map((item) => (
          <div key={`${item.rank}-${item.title}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-black text-slate-950">
                  #{item.rank} · {item.title}
                </p>
              </div>
              <span className="text-sm font-black text-slate-900">
                {formatScore(item.score)}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{item.rationale}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
