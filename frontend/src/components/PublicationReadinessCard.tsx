import { useEffect, useMemo, useState } from 'react';
import { DrugCard } from '../lib/api';

type PublicationPayload = {
  rxcui: string;
  display_name?: string;
  publication: Record<string, any>;
  validation: Record<string, any>;
  reason_codes: any[];
  methodology_performance: any[];
  methodology: Record<string, any>;
};

type ScientificPayload = {
  rxcui: string;
  display_name?: string;
  scientific: Record<string, any>;
  publication: Record<string, any>;
  summary: any[];
  methodology: Record<string, any>;
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
  if (normalized.includes('publication') || normalized.includes('gold')) return 'border-slate-300 bg-slate-950 text-white';
  if (normalized.includes('research') || normalized.includes('defensible')) return 'border-blue-200 bg-blue-50 text-blue-900';
  if (normalized.includes('review') || normalized.includes('moderate')) return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  if (normalized.includes('additional') || normalized.includes('exploratory')) return 'border-amber-200 bg-amber-50 text-amber-900';
  return 'border-slate-800/70 bg-slate-900/70 text-slate-300';
}

export default function PublicationReadinessCard({ drug }: Props) {
  const [publication, setPublication] = useState<PublicationPayload | null>(null);
  const [scientific, setScientific] = useState<ScientificPayload | null>(null);
  const [topRows, setTopRows] = useState<any[]>([]);
  const [whiteMetrics, setWhiteMetrics] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rxcui = drug?.rxcui;

  useEffect(() => {
    fetch(`${API_BASE_URL}/publication-validation/top?limit=5`)
      .then((response) => response.json())
      .then((json) => setTopRows(Array.isArray(json) ? json : []))
      .catch(console.error);

    fetch(`${API_BASE_URL}/white-paper/metrics`)
      .then((response) => response.json())
      .then((json) => setWhiteMetrics(Array.isArray(json) ? json : []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!rxcui) return;

    let active = true;

    async function loadPublicationReadiness() {
      setLoading(true);
      setError(null);

      try {
        const [publicationResponse, scientificResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/publication-validation/${encodeURIComponent(rxcui)}`),
          fetch(`${API_BASE_URL}/scientific-benchmark/${encodeURIComponent(rxcui)}`),
        ]);

        if (!publicationResponse.ok) {
          throw new Error(`Publication validation request failed with status ${publicationResponse.status}`);
        }

        if (!scientificResponse.ok) {
          throw new Error(`Scientific benchmark request failed with status ${scientificResponse.status}`);
        }

        const publicationJson = (await publicationResponse.json()) as PublicationPayload;
        const scientificJson = (await scientificResponse.json()) as ScientificPayload;

        if (!active) return;
        setPublication(publicationJson);
        setScientific(scientificJson);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load publication readiness profile.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadPublicationReadiness();

    return () => {
      active = false;
    };
  }, [rxcui]);

  const topReasons = useMemo(() => publication?.reason_codes?.slice(0, 6) || [], [publication]);
  const performance = useMemo(() => publication?.methodology_performance || [], [publication]);

  if (!drug) return null;

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-800/70 bg-slate-950/70 shadow-sm">
      <div className="bg-gradient-to-br from-slate-950 via-purple-950 to-blue-950 p-7 text-white">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-purple-200">
              Sprint 25B–26B · Publication Readiness Release
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight">
              Publication Validation + Scientific Benchmarking
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-purple-100">
              Converts methodology selection into research-grade validation, scientific benchmark rankings, and a white-paper-ready data mart.
            </p>
          </div>

          {publication && (
            <div className="rounded-3xl border border-white/10 bg-white/10 px-6 py-5 text-right backdrop-blur">
              <p className="text-xs font-bold uppercase tracking-wide text-purple-100">
                Publication Score
              </p>
              <p className="mt-1 text-5xl font-black text-white">
                {formatScore(publication.publication.publication_score)}
              </p>
              <p className="mt-1 text-sm font-bold text-purple-100">
                Rank #{publication.publication.publication_rank?.toLocaleString()}
              </p>
              <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-black ${tierStyle(publication.publication.publication_tier)}`}>
                {publication.publication.publication_tier}
              </span>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="p-7 text-sm font-semibold text-slate-500">
          Loading publication readiness profile…
        </div>
      )}

      {error && (
        <div className="m-7 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700">
          {error}
        </div>
      )}

      {!loading && !error && publication && scientific && (
        <div className="p-7">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricTile label="Readiness" value={publication.publication.publication_readiness} />
            <MetricTile label="Winner" value={publication.publication.winning_methodology} />
            <MetricTile label="Scientific Score" value={formatScore(scientific.scientific.overall_scientific_score)} />
            <MetricTile label="Scientific Tier" value={scientific.scientific.scientific_tier} />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricTile label="Statistical Defense" value={formatScore(publication.validation.statistical_defensibility_score)} />
            <MetricTile label="Interpretability" value={formatScore(publication.validation.interpretability_readiness_score)} />
            <MetricTile label="Bootstrap Stability" value={formatScore(publication.validation.bootstrap_stability)} />
            <MetricTile label="Regression R²" value={formatScore(publication.validation.regression_model_r2)} />
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div className="rounded-3xl border border-slate-800/70 bg-slate-950/70 p-5 shadow-sm">
              <h3 className="text-base font-black text-white">Scientific Benchmark Profile</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <MetricTile label="Accuracy" value={formatScore(scientific.scientific.accuracy_score)} />
                <MetricTile label="Stability" value={formatScore(scientific.scientific.stability_score)} />
                <MetricTile label="Interpretability" value={formatScore(scientific.scientific.interpretability_score)} />
                <MetricTile label="Deployment Utility" value={formatScore(scientific.scientific.deployment_utility_score)} />
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800/70 bg-slate-950/70 p-5 shadow-sm">
              <h3 className="text-base font-black text-white">Publication Reason Codes</h3>
              <div className="mt-4 space-y-3">
                {topReasons.map((reason) => (
                  <div key={reason.reason_code} className="rounded-2xl border border-slate-800/70 bg-slate-900/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-black text-white">{reason.reason_code}</p>
                      <span className="text-sm font-black text-white">{formatScore(reason.reason_score)}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{reason.reason_description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-3xl border border-slate-800/70 bg-slate-950/70 p-5 shadow-sm">
            <h3 className="text-base font-black text-white">Methodology Performance Comparison</h3>
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-800/70">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Methodology</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Performance</th>
                    <th className="px-4 py-3">Interpretability</th>
                  </tr>
                </thead>
                <tbody>
                  {performance.map((item) => (
                    <tr key={item.methodology} className="border-t border-slate-800/70">
                      <td className="px-4 py-3 font-black text-white">{item.methodology}</td>
                      <td className="px-4 py-3 text-slate-300">{item.scientific_role}</td>
                      <td className="px-4 py-3 text-slate-300">{formatScore(item.performance_score)}</td>
                      <td className="px-4 py-3 text-slate-300">{formatScore(item.interpretability_score)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-5 rounded-3xl border border-slate-800/70 bg-slate-950/70 p-5 shadow-sm">
            <h3 className="text-base font-black text-white">White Paper Data Mart Metrics</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {whiteMetrics.slice(0, 8).map((item) => (
                <MetricTile key={item.metric_name} label={item.metric_name} value={String(item.metric_value)} />
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-3xl border border-slate-800/70 bg-slate-950/70 p-5 shadow-sm">
            <h3 className="text-base font-black text-white">Top Publication-Ready Assets</h3>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {topRows.map((item) => (
                <div key={item.rxcui} className="rounded-2xl border border-slate-800/70 bg-slate-900/70 p-4">
                  <p className="font-black text-white">
                    #{item.publication_rank} · {item.display_name}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {item.publication_tier} · {formatScore(item.publication_score)} · winner: {item.winning_methodology}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-3xl border border-slate-800/70 bg-slate-950/70 p-5 shadow-sm">
            <h3 className="text-base font-black text-white">Methodology</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {publication.methodology.publication_methodology}
            </p>
            <p className="mt-3 text-xs font-semibold text-slate-500">
              Version: {publication.methodology.publication_release_version} · Built: {publication.methodology.build_timestamp}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function MetricTile({ label, value }: { label: string | number; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-800/70 bg-slate-950/70 p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-black text-white">{value}</p>
    </div>
  );
}
