import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { DrugCard } from '../lib/api';

type Reason = {
  reason_domain: string;
  reason_code: string;
  reason_label: string;
  reason_direction: string;
  reason_score: number;
  reason_evidence: string;
  reason_impact: string;
};

type ExplainabilityPayload = {
  rxcui: string;
  display_name?: string;
  explainability: {
    explainability_score: number;
    explainability_tier: string;
    positive_driver_count: number;
    limiting_factor_count: number;
    executive_narrative: string;
    recommended_action: string;
  };
  scores: Record<string, number>;
  reasons: Reason[];
  methodology: {
    explainability_version: string;
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

const TOTAL_EVALUATED_RXCUIS = 30132;

function toNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function formatScore(value: unknown) {
  return toNumber(value).toFixed(1);
}

function formatPercent(value: number) {
  return value.toFixed(1);
}

function extractRank(text?: string) {
  if (!text) return null;
  const match = text.match(/ranked\s+#?([\d,]+)/i);
  if (!match) return null;
  return Number(match[1].replace(/,/g, ''));
}

function getDisplayName(drug: DrugCard | null, payload: ExplainabilityPayload | null) {
  return (
    payload?.display_name ||
    (drug as any)?.display_name ||
    (drug as any)?.rxnorm_name ||
    (drug as any)?.drug_name ||
    (drug as any)?.name ||
    'This medication'
  );
}

function getIntelligenceTier(score: number) {
  if (score >= 95) return 'Platinum-tier';
  if (score >= 90) return 'Enterprise-ready';
  if (score >= 75) return 'Strong';
  if (score >= 50) return 'Developing';
  if (score >= 25) return 'Limited';
  return 'Foundational';
}

function buildExecutiveNarrative(drug: DrugCard | null, payload: ExplainabilityPayload) {
  const originalNarrative = payload.explainability.executive_narrative;
  const rank = extractRank(originalNarrative);

  if (!rank) return originalNarrative;

  const name = getDisplayName(drug, payload);
  const percentile = (rank / TOTAL_EVALUATED_RXCUIS) * 100;
  const intelligenceScore =
    toNumber((drug as any)?.overall_intelligence_score, 0) ||
    toNumber(payload.scores?.overall_intelligence_score, 0) ||
    toNumber(payload.scores?.executive_portfolio_score, 0);

  const tier = getIntelligenceTier(intelligenceScore);

  return `${name} achieved a ${tier} intelligence profile, ranking in the top ${formatPercent(
    percentile,
  )}% of ${TOTAL_EVALUATED_RXCUIS.toLocaleString()} evaluated RxCUIs. Its position is supported by strong claims readiness, confidence, semantic richness, graph connectivity, and production deployment readiness.`;
}

function tierStyle(tier?: string) {
  const normalized = (tier || '').toLowerCase();

  if (normalized.includes('highly')) return 'border-cyan-400/60 bg-cyan-950/50 text-cyan-100';
  if (normalized.includes('strongly')) return 'border-blue-400/60 bg-blue-950/60 text-blue-100';
  if (normalized.includes('moderately')) return 'border-emerald-400/60 bg-emerald-950/50 text-emerald-100';
  if (normalized.includes('limited')) return 'border-amber-400/60 bg-amber-950/50 text-amber-100';

  return 'border-slate-600 bg-slate-900 text-slate-200';
}

function driverCategory(reason: Reason) {
  const domain = reason.reason_domain.toUpperCase();

  if (domain.includes('INTELLIGENCE')) return 'Intelligence';
  if (domain.includes('GRAPH')) return 'Connectivity';
  if (domain.includes('READINESS') || domain.includes('READYNESS')) return 'Readiness';
  if (domain.includes('CONFIDENCE')) return 'Confidence';
  if (domain.includes('PRODUCTION')) return 'Production';
  if (domain.includes('PREDICTIVE')) return 'Deployment';
  if (domain.includes('PCA')) return 'Model Variability';

  return reason.reason_domain
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function executiveDriverLabel(reason: Reason) {
  const domain = reason.reason_domain.toUpperCase();
  const code = reason.reason_code.toUpperCase();

  if (domain.includes('INTELLIGENCE')) return 'High Intelligence Maturity';
  if (domain.includes('GRAPH')) return 'Strong Graph Connectivity';
  if (domain.includes('READINESS') || domain.includes('READYNESS')) return 'Strong Enterprise Readiness';
  if (domain.includes('CONFIDENCE')) return 'High Confidence';
  if (domain.includes('PRODUCTION')) return 'Strong Production Candidacy';
  if (domain.includes('PREDICTIVE') || code.includes('DEPLOY')) return 'High Deployment Priority';
  if (domain.includes('PCA')) return 'Model Variability Detected';

  return reason.reason_label;
}

function executiveDriverDescription(reason: Reason) {
  const domain = reason.reason_domain.toUpperCase();
  const code = reason.reason_code.toUpperCase();

  if (domain.includes('INTELLIGENCE')) return 'Strong overall medication intelligence coverage.';
  if (domain.includes('GRAPH')) return 'Rich relationship network supporting explainability.';
  if (domain.includes('READINESS') || domain.includes('READYNESS')) {
    return 'Supports production deployment and analytics use cases.';
  }
  if (domain.includes('CONFIDENCE')) return 'Increases trust in score interpretation.';
  if (domain.includes('PRODUCTION')) return 'Supports executive demo and production readiness.';
  if (domain.includes('PREDICTIVE') || code.includes('DEPLOY')) {
    return 'Supports prioritization for platform showcase.';
  }
  if (domain.includes('PCA')) return 'Empirical model divergence from expert-weighted scores.';

  return reason.reason_impact || reason.reason_evidence || 'Supports interpretation of the medication intelligence profile.';
}

export default function ExplainabilityEngineCard({ drug }: Props) {
  const [payload, setPayload] = useState<ExplainabilityPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rxcui = drug?.rxcui;

  useEffect(() => {
    if (!rxcui) return;

    let active = true;

    async function loadExplainability() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/explainability/${encodeURIComponent(rxcui)}`);

        if (!response.ok) {
          throw new Error(`Explainability request failed with status ${response.status}`);
        }

        const json = (await response.json()) as ExplainabilityPayload;

        if (!active) return;
        setPayload(json);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load explainability profile.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadExplainability();

    return () => {
      active = false;
    };
  }, [rxcui]);

  const positiveReasons = useMemo(
    () => payload?.reasons?.filter((reason) => reason.reason_direction === 'positive') || [],
    [payload],
  );

  const limitingReasons = useMemo(
    () => payload?.reasons?.filter((reason) => reason.reason_direction !== 'positive') || [],
    [payload],
  );

  if (!drug) return null;

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80 text-white shadow-sm">
      <div className="bg-[radial-gradient(circle_at_top_right,_rgba(37,99,235,0.18),_transparent_35%),linear-gradient(135deg,#020617,#0f172a)] p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-blue-300">
              Sprint 21A · Explainability Engine
            </p>

            <h2 className="mt-3 text-3xl font-black tracking-tight text-white">
              Why This Drug Scored This Way
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Converts portfolio metrics into reason codes, drivers, limiting factors, and executive-ready explanations.
            </p>
          </div>

          {payload && (
            <div className="rounded-3xl border border-slate-700 bg-slate-950/80 px-6 py-5 text-right shadow-lg shadow-slate-950/40">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Explainability Score
              </p>

              <p className="mt-1 text-5xl font-black text-white">
                {formatScore(payload.explainability.explainability_score)}
              </p>

              <span
                className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-black ${tierStyle(
                  payload.explainability.explainability_tier,
                )}`}
              >
                {payload.explainability.explainability_tier}
              </span>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="px-7 py-7 text-sm font-semibold text-slate-400">
          Loading explainability profile…
        </div>
      )}

      {error && (
        <div className="mx-7 my-7 rounded-2xl border border-rose-500/40 bg-rose-950/40 p-5 text-sm font-semibold text-rose-200">
          {error}
        </div>
      )}

      {!loading && !error && payload && (
        <div className="px-7 pb-7">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricTile label="Positive Drivers" value={payload.explainability.positive_driver_count} />
            <MetricTile label="Limiting Factors" value={payload.explainability.limiting_factor_count} />
            <MetricTile label="Executive Score" value={formatScore(payload.scores.executive_portfolio_score)} />
            <MetricTile label="Risk" value={formatScore(payload.scores.risk_score)} />
          </div>

          <div className="mt-5 rounded-3xl border border-slate-700 bg-slate-950/70 p-5">
            <h3 className="text-base font-black text-white">Executive Narrative</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {buildExecutiveNarrative(drug, payload)}
            </p>
          </div>

          <DriverSummary
            positiveReasons={positiveReasons}
            limitingReasons={limitingReasons}
          />
        </div>
      )}
    </section>
  );
}

function MetricTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-950 p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function DriverSummary({
  positiveReasons,
  limitingReasons,
}: {
  positiveReasons: Reason[];
  limitingReasons: Reason[];
}) {
  const [showMorePositive, setShowMorePositive] = useState(false);
  const [showMoreLimiting, setShowMoreLimiting] = useState(false);

  const topPositiveReasons = positiveReasons.slice(0, 3);
  const additionalPositiveReasons = positiveReasons.slice(3);

  const primaryLimitingFactor = limitingReasons[0];
  const additionalLimitingReasons = limitingReasons.slice(1);

  return (
    <div className="mt-5 rounded-3xl border border-slate-700 bg-slate-950/70 p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-base font-black text-white">Driver Summary</h3>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="min-h-[190px] rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-black text-white">Top Positive Drivers</h4>

            {additionalPositiveReasons.length > 0 && (
              <MoreBadge
                label={`+${additionalPositiveReasons.length} more drivers`}
                tone="positive"
                open={showMorePositive}
                onToggle={() => setShowMorePositive((current) => !current)}
                onMouseEnter={() => setShowMorePositive(true)}
                onMouseLeave={() => setShowMorePositive(false)}
              >
                <ReasonPopover title="Technical Driver Details" reasons={additionalPositiveReasons} tone="positive" />
              </MoreBadge>
            )}
          </div>

          <div className="mt-4 space-y-2">
            {topPositiveReasons.length === 0 && (
              <p className="text-sm text-slate-400">No positive drivers identified.</p>
            )}

            {topPositiveReasons.map((reason) => (
              <ExecutiveReasonRow
                key={`${reason.reason_code}-${reason.reason_domain}`}
                reason={reason}
                tone="positive"
              />
            ))}
          </div>
        </div>

        <div className="min-h-[190px] rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-black text-white">Primary Limiting Factor</h4>

            {additionalLimitingReasons.length > 0 && (
              <MoreBadge
                label={`+${additionalLimitingReasons.length} more factors`}
                tone="limiting"
                open={showMoreLimiting}
                onToggle={() => setShowMoreLimiting((current) => !current)}
                onMouseEnter={() => setShowMoreLimiting(true)}
                onMouseLeave={() => setShowMoreLimiting(false)}
              >
                <ReasonPopover title="Technical Limiting Factor Details" reasons={additionalLimitingReasons} tone="limiting" />
              </MoreBadge>
            )}
          </div>

          {!primaryLimitingFactor && (
            <p className="mt-4 text-sm text-slate-400">No limiting factors identified.</p>
          )}

          {primaryLimitingFactor && (
            <ExecutiveReasonRow reason={primaryLimitingFactor} tone="limiting" expanded />
          )}
        </div>
      </div>
    </div>
  );
}

function ExecutiveReasonRow({
  reason,
  tone,
  expanded = false,
}: {
  reason: Reason;
  tone: 'positive' | 'limiting';
  expanded?: boolean;
}) {
  const category = driverCategory(reason);
  const label = executiveDriverLabel(reason);
  const description = executiveDriverDescription(reason);

  const toneClass =
    tone === 'positive'
      ? 'border-emerald-500/20 bg-slate-950/60 text-emerald-300'
      : 'border-amber-500/30 bg-slate-950/60 text-amber-300';

  return (
    <div className={`rounded-xl border px-4 py-3 ${toneClass} ${expanded ? 'mt-4' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <span
            className={`mb-2 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${
              tone === 'positive'
                ? 'border-emerald-500/30 bg-emerald-950/40 text-emerald-200'
                : 'border-amber-500/30 bg-amber-950/40 text-amber-200'
            }`}
          >
            {category}
          </span>

          <p className="text-sm font-black text-white">{label}</p>

          <p className="mt-1 text-sm leading-5 text-slate-300">
            {description}
          </p>
        </div>

        <span className="shrink-0 text-sm font-black text-white">
          {formatScore(reason.reason_score)}
        </span>
      </div>

      {expanded && (
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/80 p-3">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">
            Technical Details
          </p>

          <div className="mt-3 grid gap-2 text-sm">
            <DetailRow label="Domain" value={reason.reason_domain} />
            <DetailRow label="Code" value={reason.reason_code} />
            <DetailRow label="Evidence" value={reason.reason_evidence} />
            <DetailRow label="Impact" value={reason.reason_impact} />
          </div>
        </div>
      )}
    </div>
  );
}

function MoreBadge({
  label,
  tone,
  open,
  children,
  onToggle,
  onMouseEnter,
  onMouseLeave,
}: {
  label: string;
  tone: 'positive' | 'limiting';
  open: boolean;
  children: ReactNode;
  onToggle: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const toneClass =
    tone === 'positive'
      ? 'border-emerald-500/40 bg-emerald-950/50 text-emerald-200 hover:bg-emerald-900/50'
      : 'border-amber-500/40 bg-amber-950/50 text-amber-200 hover:bg-amber-900/50';

  return (
    <div className="relative" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <button
        type="button"
        onClick={onToggle}
        className={`rounded-full border px-3 py-1 text-xs font-black transition ${toneClass}`}
      >
        {label}
      </button>

      {open && children}
    </div>
  );
}

function ReasonPopover({
  title,
  reasons,
  tone,
}: {
  title: string;
  reasons: Reason[];
  tone: 'positive' | 'limiting';
}) {
  const borderClass = tone === 'positive' ? 'border-emerald-500/40' : 'border-amber-500/40';
  const titleClass = tone === 'positive' ? 'text-emerald-300' : 'text-amber-300';

  return (
    <div
      className={`absolute right-0 top-full z-50 mt-2 max-h-[420px] w-[min(28rem,calc(100vw-3rem))] overflow-y-auto rounded-2xl border ${borderClass} bg-slate-950 p-4 shadow-2xl shadow-slate-950/70`}
    >
      <p className={`sticky top-0 z-10 bg-slate-950 pb-3 text-xs font-black uppercase tracking-[0.22em] ${titleClass}`}>
        {title}
      </p>

      <div className="space-y-3 pr-1">
        {reasons.map((reason) => (
          <div
            key={`${reason.reason_code}-${reason.reason_domain}`}
            className="rounded-xl border border-slate-800 bg-slate-900/80 p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span
                  className={`mb-2 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${
                    tone === 'positive'
                      ? 'border-emerald-500/30 bg-emerald-950/40 text-emerald-200'
                      : 'border-amber-500/30 bg-amber-950/40 text-amber-200'
                  }`}
                >
                  {driverCategory(reason)}
                </span>

                <p className="text-sm font-black text-white">
                  {executiveDriverLabel(reason)}
                </p>

                <p className="mt-1 text-sm leading-5 text-slate-300">
                  {executiveDriverDescription(reason)}
                </p>
              </div>

              <span className="shrink-0 text-sm font-black text-white">
                {formatScore(reason.reason_score)}
              </span>
            </div>

            <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/80 p-3">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                Technical Details
              </p>

              <div className="mt-3 grid gap-2 text-sm">
                <DetailRow label="Domain" value={reason.reason_domain} />
                <DetailRow label="Code" value={reason.reason_code} />
                <DetailRow label="Evidence" value={reason.reason_evidence} />
                <DetailRow label="Impact" value={reason.reason_impact} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[80px_1fr] gap-3">
      <span className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <span className="text-sm font-semibold leading-5 text-slate-300">
        {value}
      </span>
    </div>
  );
}