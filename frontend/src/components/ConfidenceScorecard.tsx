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

type ConfidencePayload = {
  rxcui: string;
  display_name?: string;
  confidence_score: number;
  confidence_percentile: number;
  confidence_tier: string;
  components: {
    evidence_strength_score: number;
    explainability_confidence_score: number;
    benchmark_reliability_score: number;
    readiness_stability_score: number;
  };
  methodology: {
    confidence_version: string;
    confidence_methodology: string;
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
  if (normalized.includes('very high')) return 'border-slate-700 bg-slate-950 text-white';
  if (normalized === 'high') return 'border-blue-800 bg-blue-950/50 text-blue-100';
  if (normalized.includes('moderate')) return 'border-emerald-800 bg-emerald-950/40 text-emerald-100';
  if (normalized.includes('limited')) return 'border-amber-800 bg-amber-950/40 text-amber-100';
  return 'border-slate-800 bg-slate-900/70 text-slate-300';
}

export default function ConfidenceScorecard({ drug }: Props) {
  const [payload, setPayload] = useState<ConfidencePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rxcui = drug?.rxcui;

  useEffect(() => {
    if (!rxcui) return;

    let active = true;

    async function loadConfidence() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/confidence/${encodeURIComponent(rxcui)}`);

        if (!response.ok) {
          throw new Error(`Confidence request failed with status ${response.status}`);
        }

        const json = (await response.json()) as ConfidencePayload;

        if (!active) return;
        setPayload(json);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load confidence score.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadConfidence();

    return () => {
      active = false;
    };
  }, [rxcui]);

  const componentRows = useMemo(() => {
    if (!payload) return [];
    return [
      {
        component: 'Evidence',
        score: toNumber(payload.components.evidence_strength_score),
      },
      {
        component: 'Explainability',
        score: toNumber(payload.components.explainability_confidence_score),
      },
      {
        component: 'Benchmark',
        score: toNumber(payload.components.benchmark_reliability_score),
      },
      {
        component: 'Stability',
        score: toNumber(payload.components.readiness_stability_score),
      },
    ];
  }, [payload]);

  if (!drug) return null;

  return (
    <section className="overflow-hidden rounded-3xl border border-blue-900/40 bg-slate-950/85 shadow-sm shadow-blue-950/30">
      <div className="bg-slate-950/80 p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-blue-600">
              Sprint 17B · Confidence Engine
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-white">
              Trust & Confidence Layer
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Measures how much trust should be placed in the medication intelligence and readiness scores
              using evidence strength, explainability, benchmark reliability, and domain stability.
            </p>
          </div>

          {payload && (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 px-6 py-5 text-right">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Confidence Score
              </p>
              <p className="mt-1 text-5xl font-black text-white">
                {formatScore(payload.confidence_score)}
              </p>
              <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-black ${tierStyle(payload.confidence_tier)}`}>
                {payload.confidence_tier}
              </span>
              <p className="mt-2 text-xs font-semibold text-slate-400">
                {formatPercent(payload.confidence_percentile)} percentile
              </p>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="px-7 pb-7 text-sm font-semibold text-slate-400">
          Loading confidence score…
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
            <ComponentTile label="Evidence Strength" score={payload.components.evidence_strength_score} />
            <ComponentTile label="Explainability" score={payload.components.explainability_confidence_score} />
            <ComponentTile label="Benchmark Reliability" score={payload.components.benchmark_reliability_score} />
            <ComponentTile label="Readiness Stability" score={payload.components.readiness_stability_score} />
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_0.8fr]">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm shadow-blue-950/30">
              <h3 className="text-base font-black text-white">Confidence Components</h3>
              <p className="mt-1 text-sm text-slate-400">
                Component-level scores feeding the final confidence engine.
              </p>

              <div className="mt-5 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={componentRows}>
                    <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                    <XAxis dataKey="component"  tick={{ fill: "#94a3b8" }} />
                    <YAxis domain={[0, 100]}  tick={{ fill: "#94a3b8" }} />
                    <Tooltip  contentStyle={{ backgroundColor: "#020617", border: "1px solid #1e3a8a", borderRadius: "16px", color: "#e2e8f0" }} labelStyle={{ color: "#bfdbfe" }} />
                    <Bar dataKey="score" name="Score" radius={[10, 10, 0, 0]}  fill="#38bdf8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-950 p-5 text-white">
              <h3 className="text-base font-black">Trust Interpretation</h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                A higher confidence score means the medication has stronger underlying evidence,
                better explainability, more reliable benchmark positioning, and more stable readiness
                signals across interoperability, claims, and AI domains.
              </p>

              <div className="mt-5 space-y-3">
                <MetaRow label="Version" value={payload.methodology.confidence_version} />
                <MetaRow label="Built" value={payload.methodology.build_timestamp} />
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ComponentTile({
  label,
  score,
}: {
  label: string;
  score: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm shadow-blue-950/30">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{formatScore(score)}</p>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/80/10 px-4 py-3">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-300">{label}</span>
      <span className="text-sm font-black text-white">{value || '—'}</span>
    </div>
  );
}
