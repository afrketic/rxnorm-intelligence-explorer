import { useEffect, useState } from 'react';
import { DrugCard } from '../lib/api';

type WebsiteDemoPayload = {
  rxcui: string;
  display_name?: string;
  website_demo: {
    website_demo_rank: number;
    website_demo_score: number;
    website_demo_percentile: number;
    website_demo_badge: string;
    website_visibility: string;
    website_card_title: string;
    website_card_subtitle: string;
    website_hero_copy: string;
    website_cta_label: string;
    website_route: string;
  };
  scores: Record<string, number>;
  deployment: {
    enterprise_deployment_tier: string;
    enterprise_deployment_status: string;
  };
  methodology: {
    website_layer_version: string;
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

function badgeStyle(badge?: string) {
  const normalized = (badge || '').toLowerCase();
  if (normalized.includes('flagship')) return 'border-slate-300 bg-slate-950 text-white';
  if (normalized.includes('executive')) return 'border-blue-200 bg-blue-50 text-blue-900';
  if (normalized.includes('technical')) return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  if (normalized.includes('enrichment')) return 'border-amber-200 bg-amber-50 text-amber-900';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

export default function WebsiteDeploymentCard({ drug }: Props) {
  const [payload, setPayload] = useState<WebsiteDemoPayload | null>(null);
  const [featured, setFeatured] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rxcui = drug?.rxcui;

  useEffect(() => {
    fetch(`${API_BASE_URL}/website-demo/featured?limit=5`)
      .then((response) => response.json())
      .then((json) => setFeatured(Array.isArray(json) ? json : []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!rxcui) return;

    let active = true;

    async function loadWebsiteDemo() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/website-demo/assets/${encodeURIComponent(rxcui)}`);

        if (!response.ok) {
          throw new Error(`Website demo asset request failed with status ${response.status}`);
        }

        const json = (await response.json()) as WebsiteDemoPayload;

        if (!active) return;
        setPayload(json);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load website demo asset.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadWebsiteDemo();

    return () => {
      active = false;
    };
  }, [rxcui]);

  if (!drug) return null;

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-gradient-to-br from-slate-950 via-sky-950 to-blue-950 p-7 text-white">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-sky-200">
              Sprint 24A · Website Deployment Layer
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight">
              Website Demo Packaging
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-sky-100">
              Packages this medication intelligence asset for alexknowsai.com/live-demos with visibility, demo badge, route, hero copy, and website-ready card content.
            </p>
          </div>

          {payload && (
            <div className="rounded-3xl border border-white/10 bg-white/10 px-6 py-5 text-right backdrop-blur">
              <p className="text-xs font-bold uppercase tracking-wide text-sky-100">
                Website Demo Score
              </p>
              <p className="mt-1 text-5xl font-black text-white">
                {formatScore(payload.website_demo.website_demo_score)}
              </p>
              <p className="mt-1 text-sm font-bold text-sky-100">
                Rank #{payload.website_demo.website_demo_rank?.toLocaleString()}
              </p>
              <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-black ${badgeStyle(payload.website_demo.website_demo_badge)}`}>
                {payload.website_demo.website_demo_badge}
              </span>
              <p className="mt-2 text-xs font-semibold text-sky-100">
                {formatPercent(payload.website_demo.website_demo_percentile)} percentile
              </p>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="p-7 text-sm font-semibold text-slate-500">
          Loading website demo asset…
        </div>
      )}

      {error && (
        <div className="m-7 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700">
          {error}
        </div>
      )}

      {!loading && !error && payload && (
        <div className="p-7">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Website Card Preview
            </p>
            <h3 className="mt-2 text-2xl font-black text-slate-950">
              {payload.website_demo.website_card_title}
            </h3>
            <p className="mt-1 text-sm font-bold text-blue-700">
              {payload.website_demo.website_card_subtitle}
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {payload.website_demo.website_hero_copy}
            </p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricTile label="Visibility" value={payload.website_demo.website_visibility} />
            <MetricTile label="Deployment Status" value={payload.deployment.enterprise_deployment_status} />
            <MetricTile label="CTA" value={payload.website_demo.website_cta_label} />
            <MetricTile label="Gate Pass Rate" value={formatPercent(payload.scores.deployment_gate_pass_rate)} />
          </div>

          <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-black text-slate-950">Website Route</h3>
            <p className="mt-2 rounded-2xl bg-slate-50 px-4 py-3 font-mono text-sm text-slate-700">
              {payload.website_demo.website_route}
            </p>
          </div>

          <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-black text-slate-950">Top Featured Demo Assets</h3>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {featured.map((item) => (
                <div key={item.rxcui} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-black text-slate-950">
                    #{item.featured_rank} · {item.display_name}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {item.website_demo_badge} · {formatScore(item.website_demo_score)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-black text-slate-950">Methodology</h3>
            <p className="mt-2 text-xs font-semibold text-slate-500">
              Version: {payload.methodology.website_layer_version} · Built: {payload.methodology.build_timestamp}
            </p>
          </div>
        </div>
      )}
    </section>
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
