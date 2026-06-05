import { useEffect, useMemo, useState } from 'react';
import { DrugCard } from '../lib/api';

type DeploymentGate = {
  gate_rank: number;
  deployment_gate: string;
  gate_score: number;
  gate_threshold: number;
  gate_result: string;
  gate_rationale: string;
};

type DeploymentAction = {
  action_rank: number;
  deployment_action: string;
  action_score: number;
  action_rationale: string;
};

type DeploymentPayload = {
  rxcui: string;
  display_name?: string;
  deployment: {
    enterprise_deployment_rank: number;
    enterprise_deployment_score: number;
    enterprise_deployment_percentile: number;
    enterprise_deployment_tier: string;
    enterprise_deployment_status: string;
    deployment_gate_pass_count: number;
    deployment_gate_total_count: number;
    deployment_gate_pass_rate: number;
    deployment_action_plan: string;
  };
  scores: Record<string, number>;
  gates: DeploymentGate[];
  actions: DeploymentAction[];
  methodology: {
    deployment_version: string;
    deployment_methodology: string;
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
  if (normalized.includes('flagship')) return 'border-slate-300 bg-slate-950 text-white';
  if (normalized.includes('enterprise')) return 'border-blue-200 bg-blue-50 text-blue-900';
  if (normalized.includes('internal')) return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  if (normalized.includes('enrichment')) return 'border-amber-200 bg-amber-50 text-amber-900';
  return 'border-slate-800/70 bg-slate-900/70 text-slate-300';
}

export default function EnterpriseDeploymentCard({ drug }: Props) {
  const [payload, setPayload] = useState<DeploymentPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rxcui = drug?.rxcui;

  useEffect(() => {
    if (!rxcui) return;

    let active = true;

    async function loadDeployment() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/deployment/${encodeURIComponent(rxcui)}`);

        if (!response.ok) {
          throw new Error(`Enterprise deployment request failed with status ${response.status}`);
        }

        const json = (await response.json()) as DeploymentPayload;

        if (!active) return;
        setPayload(json);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load enterprise deployment profile.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadDeployment();

    return () => {
      active = false;
    };
  }, [rxcui]);

  const topActions = useMemo(() => payload?.actions?.slice(0, 4) || [], [payload]);

  if (!drug) return null;

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-800/70 bg-slate-950/70 shadow-sm">
      <div className="bg-gradient-to-br from-slate-950 via-cyan-950 to-blue-950 p-7 text-white">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-200">
              Sprint 23B · Enterprise Deployment Layer
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight">
              Enterprise Deployment Readiness
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-cyan-100">
              Converts the full intelligence stack into deployment gates, launch status, demo readiness, and production-facing recommendations.
            </p>
          </div>

          {payload && (
            <div className="rounded-3xl border border-white/10 bg-white/10 px-6 py-5 text-right backdrop-blur">
              <p className="text-xs font-bold uppercase tracking-wide text-cyan-100">
                Deployment Score
              </p>
              <p className="mt-1 text-5xl font-black text-white">
                {formatScore(payload.deployment.enterprise_deployment_score)}
              </p>
              <p className="mt-1 text-sm font-bold text-cyan-100">
                Rank #{payload.deployment.enterprise_deployment_rank?.toLocaleString()}
              </p>
              <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-black ${tierStyle(payload.deployment.enterprise_deployment_tier)}`}>
                {payload.deployment.enterprise_deployment_tier}
              </span>
              <p className="mt-2 text-xs font-semibold text-cyan-100">
                {formatPercent(payload.deployment.enterprise_deployment_percentile)} percentile
              </p>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="p-7 text-sm font-semibold text-slate-500">
          Loading enterprise deployment profile…
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
            <MetricTile label="Launch Status" value={payload.deployment.enterprise_deployment_status} />
            <MetricTile label="Gate Pass Rate" value={formatPercent(payload.deployment.deployment_gate_pass_rate)} />
            <MetricTile label="Gates Passed" value={`${payload.deployment.deployment_gate_pass_count}/${payload.deployment.deployment_gate_total_count}`} />
            <MetricTile label="Risk" value={formatScore(payload.scores.risk_score)} />
          </div>

          <div className="mt-5 rounded-3xl border border-slate-800/70 bg-slate-900/70 p-5">
            <h3 className="text-base font-black text-white">Deployment Action Plan</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {payload.deployment.deployment_action_plan}
            </p>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div className="rounded-3xl border border-slate-800/70 bg-slate-950/70 p-5 shadow-sm">
              <h3 className="text-base font-black text-white">Deployment Gates</h3>
              <div className="mt-4 space-y-3">
                {payload.gates.map((gate) => (
                  <div key={`${gate.gate_rank}-${gate.deployment_gate}`} className="rounded-2xl border border-slate-800/70 bg-slate-900/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-black text-white">
                        #{gate.gate_rank} · {gate.deployment_gate}
                      </p>
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${gate.gate_result === 'PASS' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {gate.gate_result}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      Score {formatScore(gate.gate_score)} · Threshold {formatScore(gate.gate_threshold)}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{gate.gate_rationale}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800/70 bg-slate-950/70 p-5 shadow-sm">
              <h3 className="text-base font-black text-white">Deployment Actions</h3>
              <div className="mt-4 space-y-3">
                {topActions.map((action) => (
                  <div key={`${action.action_rank}-${action.deployment_action}`} className="rounded-2xl border border-slate-800/70 bg-slate-900/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-black text-white">
                        #{action.action_rank} · {action.deployment_action}
                      </p>
                      <span className="text-sm font-black text-white">
                        {formatScore(action.action_score)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{action.action_rationale}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-3xl border border-slate-800/70 bg-slate-950/70 p-5 shadow-sm">
            <h3 className="text-base font-black text-white">Methodology</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {payload.methodology.deployment_methodology}
            </p>
            <p className="mt-3 text-xs font-semibold text-slate-500">
              Version: {payload.methodology.deployment_version} · Built: {payload.methodology.build_timestamp}
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
