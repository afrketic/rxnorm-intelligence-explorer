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

type ReadinessPayload = {
  rxcui: string;
  display_name?: string;
  scores: {
    interoperability_readiness_score: number;
    claims_readiness_score: number;
    ai_readiness_score: number;
    overall_readiness_score: number;
  };
  percentiles: {
    interoperability_percentile: number;
    claims_percentile: number;
    ai_percentile: number;
    overall_readiness_percentile: number;
  };
  tier: string;
  methodology: {
    score_version: string;
    score_methodology: string;
    build_timestamp: string;
  };
  drivers: {
    interoperability: Record<string, number>;
    claims: Record<string, number>;
    ai: Record<string, number>;
  };
  tier_distribution: Array<Record<string, any>>;
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
  return `${toNumber(value).toFixed(1)}`;
}

function formatPercent(value: unknown) {
  return `${toNumber(value).toFixed(1)}%`;
}

function tierStyle(tier?: string) {
  const normalized = (tier || '').toLowerCase();
  if (normalized.includes('elite')) return 'border-slate-300 bg-slate-950 text-white';
  if (normalized.includes('advanced')) return 'border-blue-200 bg-blue-50 text-blue-900';
  if (normalized.includes('established')) return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  if (normalized.includes('emerging')) return 'border-amber-200 bg-amber-50 text-amber-900';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

export default function MedicationReadinessScorecard({ drug }: Props) {
  const [payload, setPayload] = useState<ReadinessPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rxcui = drug?.rxcui;

  useEffect(() => {
    if (!rxcui) return;

    let active = true;

    async function loadReadiness() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/readiness/${encodeURIComponent(rxcui)}`);

        if (!response.ok) {
          throw new Error(`Readiness request failed with status ${response.status}`);
        }

        const json = (await response.json()) as ReadinessPayload;

        if (!active) return;
        setPayload(json);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load readiness scores.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadReadiness();

    return () => {
      active = false;
    };
  }, [rxcui]);

  const scoreRows = useMemo(() => {
    if (!payload) return [];
    return [
      {
        domain: 'Interoperability',
        score: toNumber(payload.scores.interoperability_readiness_score),
        percentile: toNumber(payload.percentiles.interoperability_percentile),
      },
      {
        domain: 'Claims',
        score: toNumber(payload.scores.claims_readiness_score),
        percentile: toNumber(payload.percentiles.claims_percentile),
      },
      {
        domain: 'AI',
        score: toNumber(payload.scores.ai_readiness_score),
        percentile: toNumber(payload.percentiles.ai_percentile),
      },
    ];
  }, [payload]);

  if (!drug) return null;

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-gradient-to-br from-slate-950 to-slate-800 p-7 text-white">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-blue-300">
              Sprint 17A · Medication Readiness Scorecard
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight">
              Readiness Scoring Engine
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Expert-weighted baseline scores for interoperability readiness, claims readiness,
              and AI readiness across the RxNorm Intelligence Platform.
            </p>
          </div>

          {payload && (
            <div className="rounded-3xl border border-white/10 bg-white/10 px-6 py-5 text-right backdrop-blur">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-300">
                Overall Readiness
              </p>
              <p className="mt-1 text-5xl font-black text-white">
                {formatScore(payload.scores.overall_readiness_score)}
              </p>
              <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-black ${tierStyle(payload.tier)}`}>
                {payload.tier}
              </span>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="p-6 text-sm font-semibold text-slate-500">
          Loading readiness scores…
        </div>
      )}

      {error && (
        <div className="m-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700">
          {error}
        </div>
      )}

      {!loading && !error && payload && (
        <div className="p-7">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ScoreTile
              label="Interoperability"
              score={payload.scores.interoperability_readiness_score}
              percentile={payload.percentiles.interoperability_percentile}
            />
            <ScoreTile
              label="Claims"
              score={payload.scores.claims_readiness_score}
              percentile={payload.percentiles.claims_percentile}
            />
            <ScoreTile
              label="AI"
              score={payload.scores.ai_readiness_score}
              percentile={payload.percentiles.ai_percentile}
            />
            <ScoreTile
              label="Overall"
              score={payload.scores.overall_readiness_score}
              percentile={payload.percentiles.overall_readiness_percentile}
            />
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_0.8fr]">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-black text-slate-950">Readiness Domain Comparison</h3>
              <p className="mt-1 text-sm text-slate-500">
                Score and percentile by readiness construct.
              </p>

              <div className="mt-5 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={scoreRows}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="domain" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Bar dataKey="score" name="Score" radius={[10, 10, 0, 0]} />
                    <Bar dataKey="percentile" name="Percentile" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-base font-black text-slate-950">Methodology</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                This is the first expert-weighted baseline readiness model. Later sprints will compare
                this model against PCA, EFA, regression, AHP, bootstrap, and sensitivity-tested alternatives.
              </p>

              <div className="mt-5 space-y-3">
                <MetaRow label="Version" value={payload.methodology.score_version} />
                <MetaRow label="Method" value={payload.methodology.score_methodology} />
                <MetaRow label="Built" value={payload.methodology.build_timestamp} />
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ScoreTile({
  label,
  score,
  percentile,
}: {
  label: string;
  score: number;
  percentile: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-950">{formatScore(score)}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500">
        {formatPercent(percentile)} percentile
      </p>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
      <span className="text-sm font-black text-slate-950">{value || '—'}</span>
    </div>
  );
}
