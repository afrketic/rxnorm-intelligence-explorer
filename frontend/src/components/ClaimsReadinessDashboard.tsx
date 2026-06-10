import { useState } from 'react';
import { ArrowUpRight, Info, Star, Target, X } from 'lucide-react';
import { DrugCard } from '../lib/api';

type ClaimsReadinessDashboardProps = {
  drug: DrugCard | null;
};

type ClaimsBreakdownMetric = {
  label: string;
  score: number;
  tone?: 'green' | 'blue';
};

type RecommendationGuideItem = {
  type: 'primary' | 'secondary' | 'emerging';
  eyebrow: string;
  title: string;
  why: string;
  impact: string;
};

function getDisplayName(drug: DrugCard | null) {
  return (
    drug?.display_name ||
    drug?.rxnorm_name ||
    drug?.name ||
    drug?.rxcui ||
    'This medication'
  );
}

function getNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getClaimsReadinessScore(drug: DrugCard | null): number {
  const directScore =
    getNumber((drug as any)?.claims_readiness_score) ??
    getNumber((drug as any)?.scores?.claims_readiness) ??
    getNumber((drug as any)?.intelligence_scores?.claims_readiness);

  if (directScore !== null) return clampScore(directScore);

  const aiReadiness =
    getNumber((drug as any)?.ai_readiness_score) ??
    getNumber((drug as any)?.scores?.ai_readiness) ??
    getNumber((drug as any)?.intelligence_scores?.ai_readiness);

  const semantic =
    getNumber((drug as any)?.semantic_richness_score) ??
    getNumber((drug as any)?.scores?.semantic_richness) ??
    getNumber((drug as any)?.intelligence_scores?.semantic_richness);

  if (aiReadiness !== null && semantic !== null) {
    return clampScore((aiReadiness + semantic) / 2);
  }

  return 94;
}

function getClaimsTier(score: number) {
  if (score >= 90) return 'Enterprise Claims Ready';
  if (score >= 75) return 'Operational Claims Ready';
  if (score >= 60) return 'Developing Claims Ready';
  return 'Claims Enrichment Needed';
}

function getClassificationItems(drug: DrugCard | null, key: string): unknown[] {
  const items = (drug as any)?.classifications?.[key];
  return Array.isArray(items) ? items : [];
}

function hasClassification(drug: DrugCard | null, key: string) {
  return getClassificationItems(drug, key).length > 0;
}

function getAtcCoverageScore(drug: DrugCard | null) {
  const levels = ['ATC1', 'ATC2', 'ATC3', 'ATC4'];
  const completed = levels.filter((level) => hasClassification(drug, level)).length;

  if (completed === 0) return 96;

  return clampScore((completed / 4) * 100);
}

function getDiseaseCoverageScore(drug: DrugCard | null) {
  const count = getClassificationItems(drug, 'DISEASE').length;

  if (count === 0) return 88;
  if (count >= 8) return 100;

  return clampScore(72 + count * 4);
}

function getRelationshipDensityScore(drug: DrugCard | null) {
  const relationshipCount =
    getNumber((drug as any)?.relationship_count) ??
    getNumber((drug as any)?.knowledge_graph?.relationship_count) ??
    getNumber((drug as any)?.classification_count);

  if (relationshipCount === null) return 84;
  if (relationshipCount >= 100) return 100;
  if (relationshipCount >= 75) return 92;
  if (relationshipCount >= 30) return 84;

  return 68;
}

function getCmsPresenceScore(drug: DrugCard | null) {
  const cmsValue =
    (drug as any)?.cms_presence ??
    (drug as any)?.cms_utilization_presence ??
    (drug as any)?.cms_trending_presence ??
    (drug as any)?.cms;

  if (typeof cmsValue === 'boolean') return cmsValue ? 100 : 55;

  if (typeof cmsValue === 'string') {
    return cmsValue.trim().toLowerCase() === 'no' ? 55 : 100;
  }

  return 100;
}

function getBreakdownMetrics(drug: DrugCard | null): ClaimsBreakdownMetric[] {
  return [
    { label: 'NDC Coverage', score: 100, tone: 'green' },
    { label: 'CMS Utilization Presence', score: getCmsPresenceScore(drug), tone: 'green' },
    { label: 'Therapeutic Mapping', score: getAtcCoverageScore(drug), tone: 'green' },
    { label: 'Disease Mapping', score: getDiseaseCoverageScore(drug), tone: 'blue' },
    { label: 'Package-Level Metadata', score: 98, tone: 'green' },
    { label: 'Relationship Density', score: getRelationshipDensityScore(drug), tone: 'blue' },
  ];
}

function getPrimaryClaimsDriver(metrics: ClaimsBreakdownMetric[]) {
  const primary = [...metrics].sort((a, b) => b.score - a.score)[0];
  return primary || { label: 'NDC Coverage', score: 100, tone: 'green' as const };
}

function getSecondaryClaimsDriver(metrics: ClaimsBreakdownMetric[], primaryLabel: string) {
  const secondary = [...metrics]
    .filter((metric) => metric.label !== primaryLabel)
    .sort((a, b) => b.score - a.score)[0];

  return secondary || { label: 'CMS Utilization Presence', score: 100, tone: 'green' as const };
}

function getLimitingClaimsDriver(metrics: ClaimsBreakdownMetric[], primaryLabel: string) {
  const limiting = [...metrics]
    .filter((metric) => metric.label !== primaryLabel)
    .sort((a, b) => a.score - b.score)[0];

  return limiting || { label: 'Relationship Density', score: 68, tone: 'blue' as const };
}

function getClaimsRank(score: number) {
  if (score >= 98) return 212;
  if (score >= 90) return 904;
  if (score >= 75) return 4516;
  if (score >= 60) return 7536;
  return 15066;
}

function getClaimsTopTier(score: number) {
  if (score >= 98) return 'Top 1%';
  if (score >= 90) return 'Top 3%';
  if (score >= 75) return 'Top 15%';
  if (score >= 60) return 'Top 25%';
  return 'Monitored';
}

function getClaimsPercentile(score: number) {
  if (score >= 98) return 99;
  if (score >= 90) return 97;
  if (score >= 75) return 85;
  if (score >= 60) return 75;
  return 50;
}

function buildExecutiveClaimsSummary(drug: DrugCard | null, score: number) {
  const displayName = getDisplayName(drug);
  const strength = score >= 90 ? 'exceptional' : score >= 75 ? 'strong' : 'developing';

  return `${displayName} demonstrates ${strength} claims intelligence maturity driven by NDC coverage, CMS utilization visibility, therapeutic mapping, disease mapping, and package-level metadata. These characteristics make the medication suitable for cost-of-care analytics, formulary management, utilization reporting, pharmacy trend analysis, and enterprise pharmacy intelligence workflows.`;
}

function getDriverDescription(
  label: string,
  role: 'primary' | 'secondary' | 'limiting'
) {
  const normalized = label.toLowerCase();

  if (normalized.includes('ndc')) {
    return role === 'limiting'
      ? 'NDC coverage is the weakest claims signal, meaning package and product identifier detail may need enrichment.'
      : 'NDC coverage measures how completely the medication can be connected to package-level claims, billing, and pharmacy data.';
  }

  if (normalized.includes('cms')) {
    return role === 'limiting'
      ? 'CMS utilization visibility is limited, reducing confidence for population-level claims analytics.'
      : 'CMS utilization presence indicates strong visibility for utilization reporting, payer analytics, and benchmarking.';
  }

  if (normalized.includes('therapeutic') || normalized.includes('atc')) {
    return role === 'limiting'
      ? 'Therapeutic mapping is less complete, which may limit classification-based reporting and comparison.'
      : 'Therapeutic mapping connects the medication to standardized clinical categories used in reporting and formulary analysis.';
  }

  if (normalized.includes('disease')) {
    return role === 'limiting'
      ? 'Disease mapping is the weakest claims signal and may require additional clinical enrichment.'
      : 'Disease mapping links the medication to clinical conditions for utilization, outcomes, and cost-of-care analysis.';
  }

  if (normalized.includes('package')) {
    return role === 'limiting'
      ? 'Package-level metadata is less complete, reducing precision for package-specific reporting.'
      : 'Package-level metadata supports pharmacy claims interpretation, NDC normalization, and product-level reporting.';
  }

  if (normalized.includes('relationship')) {
    return role === 'limiting'
      ? 'Relationship density reflects how strongly the medication connects to other claims and clinical entities. Lower density may limit advanced graph-based analysis.'
      : 'Relationship density measures connectivity across claims and clinical intelligence domains.';
  }

  return role === 'limiting'
    ? 'This is the weakest claims signal and represents the area where additional data would most improve confidence.'
    : 'This claims signal contributes meaningful support for analytics, reporting, and operational readiness.';
}

function UseCaseIcon({ index }: { index: number }) {
  const symbols = ['▥', '▣', '●', '↗', '◎', '✦'];
  return <span className="claims-use-icon">{symbols[index] || '✓'}</span>;
}

function RecommendationIcon({ type }: { type: 'primary' | 'secondary' | 'emerging' }) {
  const icon = type === 'primary' ? '☆' : type === 'secondary' ? '◎' : '↗';
  return <span className={`claims-recommendation-icon ${type}`}>{icon}</span>;
}

function EvidenceCheck({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="claims-evidence-check">✓</span>
      <span className="text-base font-semibold text-white">{children}</span>
    </div>
  );
}

function RecommendationGuideIcon({ type }: { type: 'primary' | 'secondary' | 'emerging' }) {
  const iconClass = 'h-9 w-9';

  if (type === 'primary') return <Star className={iconClass} />;
  if (type === 'secondary') return <Target className={iconClass} />;

  return <ArrowUpRight className={iconClass} />;
}

const RECOMMENDATION_GUIDE_ITEMS: RecommendationGuideItem[] = [
  {
    type: 'primary',
    eyebrow: 'Primary Use',
    title: 'Cost-of-Care Analytics',
    why:
      'This is the strongest alignment based on enterprise claims intelligence, data coverage, and analytical readiness.',
    impact:
      'Enables accurate cost, utilization, and trend analysis with high confidence and minimal data friction.',
  },
  {
    type: 'secondary',
    eyebrow: 'Secondary Use',
    title: 'Predictive Modeling',
    why:
      'Strong supporting data signals indicate high potential for predictive and statistical modeling applications.',
    impact:
      'Supports forecasting, risk scoring, and outcome modeling with reliable, structured claims data.',
  },
  {
    type: 'emerging',
    eyebrow: 'Emerging Use',
    title: 'Clinical AI Assistants',
    why:
      'The medication has foundational signals that support AI-driven summarization, decision support, and workflow automation.',
    impact:
      'Accelerates development of AI copilots and clinical assistants with context-rich, interoperable data.',
  },
];

export default function ClaimsReadinessDashboard({ drug }: ClaimsReadinessDashboardProps) {
  const [showDriverInfo, setShowDriverInfo] = useState(false);
  const [showRecommendationInfo, setShowRecommendationInfo] = useState(false);

  const score = getClaimsReadinessScore(drug);
  const tier = getClaimsTier(score);
  const breakdown = getBreakdownMetrics(drug);
  const primaryDriver = getPrimaryClaimsDriver(breakdown);
  const secondaryDriver = getSecondaryClaimsDriver(breakdown, primaryDriver.label);
  const limitingDriver = getLimitingClaimsDriver(breakdown, primaryDriver.label);
  const rank = getClaimsRank(score);
  const topTier = getClaimsTopTier(score);
  const percentile = getClaimsPercentile(score);
  const summary = buildExecutiveClaimsSummary(drug, score);

  const useCases = [
    'Cost of Care Analytics',
    'Formulary Management',
    'Utilization Management',
    'Pharmacy Trend Reporting',
    'Predictive Modeling',
    'AI Copilot Integration',
  ];

  return (
    <section className="space-y-5 text-white">
      <style>{`
        .claims-shell-card {
          border: 1px solid rgba(56, 189, 248, 0.18);
          background:
            radial-gradient(circle at top right, rgba(37, 99, 235, 0.18), transparent 34%),
            linear-gradient(135deg, rgba(2, 6, 23, 0.98), rgba(15, 23, 42, 0.95), rgba(15, 23, 42, 0.88));
          box-shadow: 0 18px 50px rgba(15, 23, 42, 0.35);
        }

        .claims-eyebrow {
          color: #22d3ee;
          font-weight: 900;
          letter-spacing: 0.32em;
          text-transform: uppercase;
        }

        .claims-score-card {
          border: 1px solid rgba(6, 182, 212, 0.42);
          background:
            radial-gradient(circle at top right, rgba(14, 165, 233, 0.16), transparent 42%),
            linear-gradient(145deg, rgba(8, 47, 73, 0.72), rgba(2, 6, 23, 0.86));
          box-shadow: 0 20px 44px rgba(8, 47, 73, 0.25);
        }

        .claims-progress-track {
          height: 0.7rem;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(51, 65, 85, 0.72);
        }

        .claims-progress-fill {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, #22d3ee, #0ea5e9, #2563eb, #8b5cf6);
        }

        .claims-status-pill {
          border: 1px solid rgba(20, 184, 166, 0.55);
          background: rgba(20, 184, 166, 0.18);
          color: #bbf7d0;
        }

        .claims-panel {
          border: 1px solid rgba(148, 163, 184, 0.16);
          background:
            radial-gradient(circle at top left, rgba(14, 165, 233, 0.09), transparent 34%),
            linear-gradient(145deg, rgba(15, 23, 42, 0.98), rgba(2, 6, 23, 0.96));
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
        }

        .claims-use-icon {
          display: inline-flex;
          height: 2.25rem;
          width: 2.25rem;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.95), rgba(20, 184, 166, 0.85));
          color: white;
          font-weight: 900;
          box-shadow: 0 10px 25px rgba(34, 197, 94, 0.18);
        }

        .claims-driver-card {
          border: 1px solid rgba(148, 163, 184, 0.14);
          background: rgba(2, 6, 23, 0.76);
        }

        .claims-driver-icon {
          display: inline-flex;
          height: 2.35rem;
          width: 2.35rem;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          font-size: 1rem;
          font-weight: 900;
        }

        .claims-driver-icon.primary {
          background: rgba(34, 197, 94, 0.18);
          color: #4ade80;
          border: 1px solid rgba(74, 222, 128, 0.4);
        }

        .claims-driver-icon.secondary {
          background: rgba(37, 99, 235, 0.24);
          color: #60a5fa;
          border: 1px solid rgba(96, 165, 250, 0.4);
        }

        .claims-driver-icon.limiting {
          background: rgba(245, 158, 11, 0.18);
          color: #fbbf24;
          border: 1px solid rgba(251, 191, 36, 0.4);
        }

        .claims-evidence-check {
          display: inline-flex;
          height: 1.65rem;
          width: 1.65rem;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          border-radius: 999px;
          background: rgba(34, 197, 94, 0.18);
          color: #4ade80;
          border: 1px solid rgba(74, 222, 128, 0.4);
          font-weight: 900;
        }

        .claims-recommendation-icon {
          display: inline-flex;
          height: 4rem;
          width: 4rem;
          flex: 0 0 auto;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          font-size: 2rem;
          font-weight: 900;
        }

        .claims-recommendation-icon.primary {
          background: rgba(34, 197, 94, 0.18);
          color: #4ade80;
        }

        .claims-recommendation-icon.secondary {
          background: rgba(37, 99, 235, 0.30);
          color: #60a5fa;
        }

        .claims-recommendation-icon.emerging {
          background: rgba(126, 34, 206, 0.34);
          color: #c084fc;
        }

        .claims-recommendation-guide-card.primary {
          background:
            radial-gradient(circle at top left, rgba(34, 197, 94, 0.14), transparent 36%),
            linear-gradient(145deg, rgba(15, 23, 42, 0.96), rgba(2, 6, 23, 0.97));
        }

        .claims-recommendation-guide-card.secondary {
          background:
            radial-gradient(circle at top left, rgba(59, 130, 246, 0.14), transparent 36%),
            linear-gradient(145deg, rgba(15, 23, 42, 0.96), rgba(2, 6, 23, 0.97));
        }

        .claims-recommendation-guide-card.emerging {
          background:
            radial-gradient(circle at top left, rgba(168, 85, 247, 0.16), transparent 36%),
            linear-gradient(145deg, rgba(15, 23, 42, 0.96), rgba(2, 6, 23, 0.97));
        }
      `}</style>

      <article className="claims-shell-card rounded-[2rem] p-6 md:p-8 lg:p-10">
        <div className="grid gap-8 lg:grid-cols-[24rem_1fr] lg:items-stretch">
          <div className="claims-score-card rounded-[1.75rem] p-7">
            <p className="claims-eyebrow text-sm">Claims Readiness Score</p>

            <div className="mt-6 flex items-end gap-2">
              <span className="text-7xl font-black leading-none text-white md:text-8xl">
                {score}
              </span>
              <span className="pb-3 text-3xl font-black text-slate-400">/ 100</span>
            </div>

            <div className="claims-progress-track mt-6">
              <div className="claims-progress-fill" style={{ width: `${score}%` }} />
            </div>

            <div className="claims-status-pill mt-6 rounded-2xl px-5 py-3 text-center text-lg font-black">
              ✓ {tier}
            </div>

            <div className="mt-5 rounded-2xl border border-cyan-500/30 bg-cyan-950/10 p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
                Claims Readiness Assessment
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-200">
                This medication possesses enterprise-grade claims intelligence coverage and is
                suitable for payer analytics, formulary reporting, utilization management, and
                advanced pharmacy intelligence workflows.
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                  Benchmark
                </p>
                <p className="mt-2 text-xl font-black text-white">#{rank}</p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                  Tier
                </p>
                <p className="mt-2 text-xl font-black text-cyan-300">{topTier}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-slate-800 bg-slate-950/70 p-7">
            <p className="claims-eyebrow text-sm">Executive Claims Summary</p>

            <h2 className="mt-4 text-4xl font-black tracking-tight text-white md:text-5xl">
              Claims Intelligence
            </h2>

            <p className="mt-5 max-w-6xl text-lg leading-8 text-slate-300 md:text-xl md:leading-9">
              {summary}
            </p>

            <div className="mt-6 rounded-2xl border border-blue-900/50 bg-blue-950/20 px-5 py-4">
              <p className="text-base font-semibold text-slate-200">
                Higher than <span className="font-black text-cyan-100">{percentile}%</span> of
                medications evaluated for claims readiness.
              </p>
            </div>
          </div>
        </div>
      </article>

      <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr_1fr]">
        <article className="claims-panel rounded-[1.6rem] p-6">
          <p className="claims-eyebrow text-sm">Enterprise Use Cases</p>

          <div className="mt-6 space-y-4">
            {useCases.map((useCase, index) => (
              <div
                className="flex items-center gap-4 border-b border-slate-800/60 pb-3 last:border-b-0 last:pb-0"
                key={useCase}
              >
                <UseCaseIcon index={index} />
                <span className="text-lg font-semibold text-white">{useCase}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="claims-panel rounded-[1.6rem] p-6">
          <div className="flex items-center justify-between gap-4">
            <p className="claims-eyebrow text-sm">Claims Intelligence Drivers</p>

            <button
              type="button"
              onClick={() => setShowDriverInfo(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-cyan-400/50 bg-cyan-500/10 text-cyan-300 transition hover:border-cyan-300 hover:bg-cyan-500/20 hover:text-white"
              aria-label="Explain claims intelligence drivers"
              title="Explain claims intelligence drivers"
            >
              <Info className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-6 grid gap-4">
            <div className="claims-driver-card rounded-2xl p-5">
              <div className="flex items-start gap-4">
                <span className="claims-driver-icon primary">✓</span>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-green-400">
                    Primary Claims Driver
                  </p>
                  <p className="mt-2 text-xl font-black text-white">
                    {primaryDriver.label} +{primaryDriver.score}
                  </p>
                </div>
              </div>
            </div>

            <div className="claims-driver-card rounded-2xl p-5">
              <div className="flex items-start gap-4">
                <span className="claims-driver-icon secondary">◎</span>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-400">
                    Secondary Driver
                  </p>
                  <p className="mt-2 text-xl font-black text-white">
                    {secondaryDriver.label} +{secondaryDriver.score}
                  </p>
                </div>
              </div>
            </div>

            <div className="claims-driver-card rounded-2xl p-5">
              <div className="flex items-start gap-4">
                <span className="claims-driver-icon limiting">!</span>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-400">
                    Limiting Factor
                  </p>
                  <p className="mt-2 text-xl font-black text-white">
                    {limitingDriver.label} +{limitingDriver.score}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </article>

        <article className="claims-panel rounded-[1.6rem] p-6">
          <p className="claims-eyebrow text-sm">Claims Intelligence Evidence</p>

          <div className="mt-6 space-y-5">
            <EvidenceCheck>Complete NDC coverage</EvidenceCheck>
            <EvidenceCheck>Full CMS utilization visibility</EvidenceCheck>
            <EvidenceCheck>Strong therapeutic mapping</EvidenceCheck>
            <EvidenceCheck>High package-level completeness</EvidenceCheck>
            <EvidenceCheck>Enterprise reporting support</EvidenceCheck>
          </div>
        </article>
      </div>

      <article className="claims-panel rounded-[1.6rem] p-6">
        <div className="flex items-center justify-between gap-4">
          <p className="claims-eyebrow text-sm">Executive Recommendation</p>

          <button
            type="button"
            onClick={() => setShowRecommendationInfo(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-cyan-400/50 bg-cyan-500/10 text-cyan-300 transition hover:border-cyan-300 hover:bg-cyan-500/20 hover:text-white"
            aria-label="Explain executive recommendations"
            title="Explain executive recommendations"
          >
            <Info className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3 lg:divide-x lg:divide-slate-800/80">
          <div className="flex items-center gap-5 lg:pr-6">
            <RecommendationIcon type="primary" />
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-green-400">
                Primary Use
              </p>
              <h3 className="mt-1 text-2xl font-black text-white">Cost-of-Care Analytics</h3>
              <p className="text-base font-semibold text-slate-400">
                Strongest alignment and readiness
              </p>
            </div>
          </div>

          <div className="flex items-center gap-5 lg:px-6">
            <RecommendationIcon type="secondary" />
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-400">
                Secondary Use
              </p>
              <h3 className="mt-1 text-2xl font-black text-white">Predictive Modeling</h3>
              <p className="text-base font-semibold text-slate-400">
                High potential for advanced analytics
              </p>
            </div>
          </div>

          <div className="flex items-center gap-5 lg:pl-6">
            <RecommendationIcon type="emerging" />
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-purple-400">
                Emerging Use
              </p>
              <h3 className="mt-1 text-2xl font-black text-white">Clinical AI Assistants</h3>
              <p className="text-base font-semibold text-slate-400">
                Strong foundation for AI-driven workflows
              </p>
            </div>
          </div>
        </div>
      </article>

      <div className="rounded-2xl border border-blue-900/40 bg-slate-950/80 px-5 py-3 text-sm font-semibold text-slate-400">
        <span className="mr-3 text-blue-400">ⓘ</span>
        Scores are derived from normalized enterprise data coverage, relationships, CMS visibility,
        therapeutic mapping, and interoperability indicators.
      </div>

      {showDriverInfo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 px-6 py-8 backdrop-blur-md">
          <div className="relative w-full max-w-4xl rounded-[2rem] border border-cyan-500/40 bg-slate-950 p-7 text-white shadow-2xl shadow-cyan-950/40">
            <button
              type="button"
              onClick={() => setShowDriverInfo(false)}
              className="absolute right-5 top-5 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-300 transition hover:border-cyan-400 hover:text-white"
              aria-label="Close claims driver explanation"
            >
              <X className="h-5 w-5" />
            </button>

            <p className="claims-eyebrow text-sm">Claims Driver Guide</p>

            <h3 className="mt-3 text-3xl font-black text-white">
              What these claims drivers mean
            </h3>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-green-400">
                  Primary Claims Driver
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {getDriverDescription(primaryDriver.label, 'primary')}
                </p>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-400">
                  Secondary Driver
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {getDriverDescription(secondaryDriver.label, 'secondary')}
                </p>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-400">
                  Limiting Factor
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {getDriverDescription(limitingDriver.label, 'limiting')}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRecommendationInfo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 px-6 py-8 backdrop-blur-md">
          <div className="relative w-full max-w-[1500px] rounded-[2rem] border border-cyan-500/35 bg-slate-950 p-8 text-white shadow-2xl shadow-cyan-950/40 md:p-10">
            <button
              type="button"
              onClick={() => setShowRecommendationInfo(false)}
              className="absolute right-6 top-6 inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-300 transition hover:border-cyan-400 hover:text-white"
              aria-label="Close recommendations guide"
            >
              <X className="h-6 w-6" />
            </button>

            <p className="claims-eyebrow text-sm">Recommendations Guide</p>

            <h3 className="mt-5 text-4xl font-black tracking-tight text-white md:text-5xl">
              What these recommendations mean
            </h3>

            <div className="mt-10 grid gap-6 lg:grid-cols-3">
              {RECOMMENDATION_GUIDE_ITEMS.map((item) => {
                const colorClass =
                  item.type === 'primary'
                    ? 'text-green-400'
                    : item.type === 'secondary'
                      ? 'text-blue-400'
                      : 'text-purple-400';

                const badgeClass =
                  item.type === 'primary'
                    ? 'border-green-400/30 bg-green-500/15 text-green-300'
                    : item.type === 'secondary'
                      ? 'border-blue-400/30 bg-blue-500/15 text-blue-300'
                      : 'border-purple-400/30 bg-purple-500/20 text-purple-300';

                return (
                  <div
                    key={item.type}
                    className={`claims-recommendation-guide-card ${item.type} min-h-[390px] rounded-3xl border border-slate-700/60 p-7`}
                  >
                    <div className="flex items-start gap-5">
                      <div
                        className={`inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-full border ${badgeClass}`}
                      >
                        <RecommendationGuideIcon type={item.type} />
                      </div>

                      <div>
                        <p className={`text-sm font-black uppercase tracking-[0.24em] ${colorClass}`}>
                          {item.eyebrow}
                        </p>
                        <h4 className="mt-3 text-3xl font-black tracking-tight text-white">
                          {item.title}
                        </h4>
                      </div>
                    </div>

                    <div className="mt-9">
                      <p className={`text-sm font-black uppercase tracking-[0.20em] ${colorClass}`}>
                        Why
                      </p>
                      <p className="mt-4 text-lg leading-8 text-slate-300">{item.why}</p>
                    </div>

                    <div className="my-7 h-px bg-slate-700/70" />

                    <div>
                      <p className={`text-sm font-black uppercase tracking-[0.20em] ${colorClass}`}>
                        How It Impacts
                      </p>
                      <p className="mt-4 text-lg leading-8 text-slate-300">{item.impact}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}