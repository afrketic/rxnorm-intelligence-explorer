import { useEffect, useMemo, useState } from 'react';
import { DrugCard } from '../lib/api';

type ValidationPayload = {
  rxcui: string;
  regression: {
    regression: Record<string, any>;
    model_summary: any[];
  };
  efa: {
    efa: Record<string, any>;
    loadings: any[];
    model_summary: any[];
  };
  bootstrap: {
    score_stability: Record<string, any> | null;
    rank_stability: Record<string, any> | null;
    confidence_interval: Record<string, any> | null;
  };
  sensitivity: {
    volatility: Record<string, any>;
    scenarios: any[];
  };
  methodology_selection: {
    methodology: Record<string, any>;
    selection_summary: any[];
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

function tierStyle(tier?: string) {
  const normalized = (tier || '').toLowerCase();
  if (normalized.includes('strategic') || normalized.includes('elite')) return 'border-slate-300 bg-slate-950 text-white';
  if (normalized.includes('enterprise') || normalized.includes('strong')) return 'border-blue-200 bg-blue-50 text-blue-900';
  if (normalized.includes('emerging') || normalized.includes('moderate')) return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  if (normalized.includes('monitor')) return 'border-amber-200 bg-amber-50 text-amber-900';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

export default function ValidationTrackCard({ drug }: Props) {
  const [payload, setPayload] = useState<ValidationPayload | null>(null);
  const [topRows, setTopRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rxcui = drug?.rxcui;

  useEffect(() => {
    fetch(`${API_BASE_URL}/validation/top?limit=5`)
      .then((response) => response.json())
      .then((json) => setTopRows(Array.isArray(json) ? json : []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!rxcui) return;

    let active = true;

    async function loadValidation() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/validation/${encodeURIComponent(rxcui)}`);
        if (!response.ok) {
          throw new Error(`Validation request failed with status ${response.status}`);
        }
        const json = (await response.json()) as ValidationPayload;
        if (!active) return;
        setPayload(json);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load validation track profile.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadValidation();

    return () => {
      active = false;
    };
  }, [rxcui]);

  const methodology = payload?.methodology_selection?.methodology;
  const regression = payload?.regression?.regression;
  const efa = payload?.efa?.efa;
  const bootstrap = payload?.bootstrap?.score_stability;
  const ci = payload?.bootstrap?.confidence_interval;
  const volatility = payload?.sensitivity?.volatility;

  const topLoadings = useMemo(() => payload?.efa?.loadings?.slice(0, 6) || [], [payload]);

  if (!drug) return null;

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-gradient-to-br from-slate-950 via-violet-950 to-blue-950 p-7 text-white">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-violet-200">
              Validation Track · V1–V5
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight">
              Statistical Validation Suite
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-violet-100">
              Adds regression, exploratory factor analysis, bootstrap stability, sensitivity testing, and methodology selection to support publication-quality methodology validation.
            </p>
          </div>

          {methodology && (
            <div className="rounded-3xl border border-white/10 bg-white/10 px-6 py-5 text-right backdrop-blur">
              <p className="text-xs font-bold uppercase tracking-wide text-violet-100">
                Final Selected Score
              </p>
              <p className="mt-1 text-5xl font-black text-white">
                {formatScore(methodology.final_selected_score)}
              </p>
              <p className="mt-1 text-sm font-bold text-violet-100">
                Rank #{methodology.methodology_v2_rank?.toLocaleString()}
              </p>
              <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-black ${tierStyle(methodology.methodology_v2_tier)}`}>
                {methodology.methodology_v2_tier}
              </span>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="p-7 text-sm font-semibold text-slate-500">
          Loading validation profile…
        </div>
      )}

      {error && (
        <div className="m-7 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700">
          {error}
        </div>
      )}

      {!loading && !error && payload && methodology && (
        <div className="p-7">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricTile label="Winning Methodology" value={methodology.winning_methodology} />
            <MetricTile label="Agreement Score" value={formatScore(methodology.methodology_agreement_score)} />
            <MetricTile label="Validation Stability" value={formatScore(methodology.validation_stability_score)} />
            <MetricTile label="Methodology Range" value={formatScore(methodology.methodology_range)} />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <MetricTile label="Expert" value={formatScore(methodology.expert_score)} />
            <MetricTile label="PCA" value={formatScore(methodology.pca_score)} />
            <MetricTile label="Regression" value={formatScore(methodology.regression_readiness_score)} />
            <MetricTile label="EFA" value={formatScore(methodology.efa_overall_score)} />
            <MetricTile label="AHP Proxy" value={formatScore(methodology.ahp_score)} />
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <Panel title="Regression Engine">
              <p className="text-sm text-slate-600">
                Score: <strong>{formatScore(regression?.regression_readiness_score)}</strong> · R²: <strong>{regression?.regression_model_r2}</strong> · RMSE: <strong>{regression?.regression_model_rmse}</strong>
              </p>
              <p className="mt-2 text-xs text-slate-500">{regression?.regression_methodology}</p>
            </Panel>

            <Panel title="Exploratory Factor Analysis">
              <p className="text-sm text-slate-600">
                EFA Score: <strong>{formatScore(efa?.efa_overall_score)}</strong> · Percentile: <strong>{formatScore(efa?.efa_percentile)}%</strong>
              </p>
              <div className="mt-3 grid gap-2">
                {topLoadings.map((item) => (
                  <div key={`${item.factor_number}-${item.feature_name}`} className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    Factor {item.factor_number}: <strong>{item.feature_name}</strong> · loading {formatScore(item.factor_loading)}
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Bootstrap Validation">
              <p className="text-sm text-slate-600">
                Mean Score: <strong>{formatScore(bootstrap?.bootstrap_mean_score)}</strong> · Score Stability: <strong>{formatScore(bootstrap?.bootstrap_score_stability)}</strong>
              </p>
              <p className="mt-2 text-sm text-slate-600">
                95% CI: <strong>{formatScore(ci?.score_ci_lower_95)}–{formatScore(ci?.score_ci_upper_95)}</strong> · Width: <strong>{formatScore(ci?.score_ci_width_95)}</strong>
              </p>
            </Panel>

            <Panel title="Sensitivity Analysis">
              <p className="text-sm text-slate-600">
                Rank Stability: <strong>{formatScore(volatility?.rank_stability_score)}</strong> · Score Stability: <strong>{formatScore(volatility?.score_stability_score)}</strong>
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Max Rank Delta: <strong>{formatScore(volatility?.max_abs_rank_delta)}</strong> · Max Score Delta: <strong>{formatScore(volatility?.max_abs_score_delta)}</strong>
              </p>
            </Panel>
          </div>

          <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-black text-slate-950">Top Validation Assets</h3>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {topRows.map((item) => (
                <div key={item.rxcui} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-black text-slate-950">
                    #{item.methodology_v2_rank} · {item.display_name}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {item.methodology_v2_tier} · {formatScore(item.final_selected_score)} · winner: {item.winning_methodology}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-black text-slate-950">{title}</h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function MetricTile({ label, value }: { label: string | number; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}
