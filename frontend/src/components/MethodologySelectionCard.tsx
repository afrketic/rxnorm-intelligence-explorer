import { useEffect, useMemo, useState } from 'react';
import { DrugCard } from '../lib/api';

type MethodologySelectionPayload = {
  rxcui: string;
  display_name?: string;
  selection: {
    methodology_selection_rank: number;
    winning_methodology: string;
    methodology_selection_score: number;
    methodology_selection_percentile: number;
    methodology_selection_tier: string;
    selection_confidence: number;
    winner_margin: number;
    selection_reason: string;
  };
  method_scores: Record<string, number>;
  selection_scores: Record<string, number>;
  validation_signals: Record<string, number>;
  reason_codes: any[];
  summary: any[];
  methodology: {
    selection_version: string;
    selection_methodology: string;
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

function prettyMethod(method?: string) {
  if (!method) return '—';
  return method.toUpperCase();
}

function tierStyle(tier?: string) {
  const normalized = (tier || '').toLowerCase();
  if (normalized.includes('gold')) return 'border-slate-700 bg-slate-950 text-white';
  if (normalized.includes('enterprise')) return 'border-blue-800 bg-blue-950/50 text-blue-100';
  if (normalized.includes('recommended')) return 'border-emerald-800 bg-emerald-950/40 text-emerald-100';
  if (normalized.includes('experimental')) return 'border-amber-800 bg-amber-950/40 text-amber-100';
  return 'border-slate-800 bg-slate-900/70 text-slate-300';
}

export default function MethodologySelectionCard({ drug }: Props) {
  const [payload, setPayload] = useState<MethodologySelectionPayload | null>(null);
  const [topRows, setTopRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rxcui = drug?.rxcui;

  useEffect(() => {
    fetch(`${API_BASE_URL}/methodology-selection/top?limit=5`)
      .then((response) => response.json())
      .then((json) => setTopRows(Array.isArray(json) ? json : []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!rxcui) return;

    let active = true;

    async function loadSelection() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/methodology-selection/${encodeURIComponent(rxcui)}`);

        if (!response.ok) {
          throw new Error(`Methodology selection request failed with status ${response.status}`);
        }

        const json = (await response.json()) as MethodologySelectionPayload;

        if (!active) return;
        setPayload(json);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load methodology selection profile.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadSelection();

    return () => {
      active = false;
    };
  }, [rxcui]);

  const comparisonRows = useMemo(() => {
    if (!payload) return [];

    return [
      ['Expert', payload.selection_scores.expert_selection_score, payload.method_scores.expert_score],
      ['PCA', payload.selection_scores.pca_selection_score, payload.method_scores.pca_score],
      ['EFA', payload.selection_scores.efa_selection_score, payload.method_scores.efa_score],
      ['Regression', payload.selection_scores.regression_selection_score, payload.method_scores.regression_score],
      ['AHP Proxy', payload.selection_scores.ahp_selection_score, payload.method_scores.ahp_score],
    ].sort((a, b) => toNumber(b[1]) - toNumber(a[1]));
  }, [payload]);

  if (!drug) return null;

  return (
    <section className="overflow-hidden rounded-3xl border border-blue-900/40 bg-slate-950/85 shadow-sm shadow-blue-950/30">
      <div className="bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-950 p-7 text-white">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-indigo-200">
              Sprint 25A · Methodology Selection Engine
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight">
              Statistical Defense Layer
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-indigo-100">
              Selects the most defensible methodology by evaluating expert, PCA, EFA, regression, and AHP proxy methods across accuracy, agreement, stability, explainability, and deployment utility.
            </p>
          </div>

          {payload && (
            <div className="rounded-3xl border border-white/10 bg-slate-950/80/10 px-6 py-5 text-right backdrop-blur">
              <p className="text-xs font-bold uppercase tracking-wide text-indigo-100">
                Winning Methodology
              </p>
              <p className="mt-1 text-5xl font-black text-white">
                {prettyMethod(payload.selection.winning_methodology)}
              </p>
              <p className="mt-1 text-sm font-bold text-indigo-100">
                {formatScore(payload.selection.selection_confidence)} confidence
              </p>
              <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-black ${tierStyle(payload.selection.methodology_selection_tier)}`}>
                {payload.selection.methodology_selection_tier}
              </span>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="p-7 text-sm font-semibold text-slate-400">
          Loading methodology selection profile…
        </div>
      )}

      {error && (
        <div className="m-7 rounded-2xl border border-rose-800 bg-rose-950/40 p-5 text-sm font-semibold text-rose-700">
          {error}
        </div>
      )}

      {!loading && !error && payload && (
        <div className="p-7">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricTile label="Selection Score" value={formatScore(payload.selection.methodology_selection_score)} />
            <MetricTile label="Selection Rank" value={`#${payload.selection.methodology_selection_rank?.toLocaleString()}`} />
            <MetricTile label="Winner Margin" value={formatScore(payload.selection.winner_margin)} />
            <MetricTile label="Percentile" value={`${formatScore(payload.selection.methodology_selection_percentile)}%`} />
          </div>

          <div className="mt-5 rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <h3 className="text-base font-black text-white">Selection Reason</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {payload.selection.selection_reason}
            </p>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm shadow-blue-950/30">
              <h3 className="text-base font-black text-white">Methodology Comparison</h3>
              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-800">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-900/70 text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Method</th>
                      <th className="px-4 py-3">Selection Score</th>
                      <th className="px-4 py-3">Raw Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonRows.map(([method, selectionScore, rawScore]) => (
                      <tr key={String(method)} className="border-t border-slate-800">
                        <td className="px-4 py-3 font-black text-white">{method}</td>
                        <td className="px-4 py-3 text-slate-300">{formatScore(selectionScore)}</td>
                        <td className="px-4 py-3 text-slate-300">{formatScore(rawScore)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm shadow-blue-950/30">
              <h3 className="text-base font-black text-white">Reason Codes</h3>
              <div className="mt-4 space-y-3">
                {payload.reason_codes.slice(0, 7).map((reason) => (
                  <div key={reason.reason_code} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-black text-white">{reason.reason_code}</p>
                      <span className="text-sm font-black text-white">{formatScore(reason.reason_score)}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{reason.reason_description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricTile label="Agreement" value={formatScore(payload.validation_signals.agreement_score)} />
            <MetricTile label="Bootstrap Stability" value={formatScore(payload.validation_signals.bootstrap_stability)} />
            <MetricTile label="Rank Stability" value={formatScore(payload.validation_signals.rank_stability)} />
            <MetricTile label="Regression R²" value={formatScore(payload.validation_signals.regression_model_r2)} />
          </div>

          <div className="mt-5 rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm shadow-blue-950/30">
            <h3 className="text-base font-black text-white">Top Methodology Selection Assets</h3>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {topRows.map((item) => (
                <div key={item.rxcui} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                  <p className="font-black text-white">
                    #{item.methodology_selection_rank} · {item.display_name}
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    {item.methodology_selection_tier} · {formatScore(item.methodology_selection_score)} · winner: {item.winning_methodology}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm shadow-blue-950/30">
            <h3 className="text-base font-black text-white">Methodology</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {payload.methodology.selection_methodology}
            </p>
            <p className="mt-3 text-xs font-semibold text-slate-400">
              Version: {payload.methodology.selection_version} · Built: {payload.methodology.build_timestamp}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function MetricTile({ label, value }: { label: string | number; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm shadow-blue-950/30">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-black text-white">{value}</p>
    </div>
  );
}
