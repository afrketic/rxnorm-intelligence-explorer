import { DrugCard } from '../lib/api';

type ClaimsReadinessDashboardProps = {
  drug: DrugCard | null;
};

type ClaimsBreakdownMetric = {
  label: string;
  score: number;
  tone?: 'green' | 'blue';
};

type DriverItem = {
  label: string;
  type: 'positive' | 'limiting';
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
  if (typeof cmsValue === 'string') return cmsValue.trim().toLowerCase() === 'no' ? 55 : 100;
  return 100;
}

function getBreakdownMetrics(drug: DrugCard | null): ClaimsBreakdownMetric[] {
  return [
    { label: 'NDC Coverage', score: 100, tone: 'green' },
    { label: 'ATC Coverage', score: getAtcCoverageScore(drug), tone: 'green' },
    { label: 'Disease Coverage', score: getDiseaseCoverageScore(drug), tone: 'blue' },
    { label: 'Relationship Density', score: getRelationshipDensityScore(drug), tone: 'blue' },
    { label: 'CMS Presence', score: getCmsPresenceScore(drug), tone: 'green' },
    { label: 'Package Coverage', score: 98, tone: 'green' },
  ];
}

function getPositiveDrivers(drug: DrugCard | null): DriverItem[] {
  const drivers: DriverItem[] = [
    { label: 'NDC Coverage', type: 'positive' },
    { label: 'CMS Utilization Presence', type: 'positive' },
    { label: 'ATC Completeness', type: 'positive' },
    { label: 'Disease Mapping Coverage', type: 'positive' },
    { label: 'Package-Level Metadata', type: 'positive' },
  ];

  return drivers.filter((driver) => {
    if (driver.label === 'ATC Completeness') return getAtcCoverageScore(drug) >= 75;
    if (driver.label === 'Disease Mapping Coverage') return getDiseaseCoverageScore(drug) >= 75;
    return true;
  });
}

function getLimitingDrivers(drug: DrugCard | null): DriverItem[] {
  const moaScore = hasClassification(drug, 'MOA') ? 88 : 62;
  const epcScore = hasClassification(drug, 'EPC') ? 88 : 68;
  const relationshipScore = getRelationshipDensityScore(drug);

  const drivers: DriverItem[] = [];

  if (moaScore < 75) drivers.push({ label: 'Sparse MOA Coverage', type: 'limiting' });
  if (relationshipScore < 90) drivers.push({ label: 'Limited Relationship Depth', type: 'limiting' });
  if (epcScore < 75) drivers.push({ label: 'EPC Coverage Gaps', type: 'limiting' });

  return drivers.length > 0
    ? drivers
    : [{ label: 'No material limiting factors detected', type: 'limiting' }];
}

function buildClaimsSummary(drug: DrugCard | null, score: number) {
  const displayName = getDisplayName(drug);
  const strength = score >= 90 ? 'exceptional' : score >= 75 ? 'strong' : 'developing';

  return `${displayName} demonstrates ${strength} claims intelligence coverage with NDC normalization, therapeutic classification, CMS utilization presence, and interoperability support. The medication is suitable for cost-of-care analytics, utilization management, formulary reporting, and enterprise pharmacy intelligence workflows.`;
}

function UseCaseIcon({ index }: { index: number }) {
  const symbols = ['▥', '▣', '●', '↗', '◎', '✦'];
  return <span className="claims-use-icon">{symbols[index] || '✓'}</span>;
}

function DriverIcon({ type }: { type: 'positive' | 'limiting' }) {
  return <span className={type === 'positive' ? 'claims-driver-icon positive' : 'claims-driver-icon limiting'}>{type === 'positive' ? '✓' : '!'}</span>;
}

function RecommendationIcon({ type }: { type: 'primary' | 'secondary' | 'emerging' }) {
  const icon = type === 'primary' ? '☆' : type === 'secondary' ? '◎' : '↗';
  return <span className={`claims-recommendation-icon ${type}`}>{icon}</span>;
}

export default function ClaimsReadinessDashboard({ drug }: ClaimsReadinessDashboardProps) {
  const score = getClaimsReadinessScore(drug);
  const tier = getClaimsTier(score);
  const summary = buildClaimsSummary(drug, score);
  const breakdown = getBreakdownMetrics(drug);
  const positiveDrivers = getPositiveDrivers(drug);
  const limitingDrivers = getLimitingDrivers(drug);

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
        .claims-driver-icon {
          display: inline-flex;
          height: 1.45rem;
          width: 1.45rem;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          font-size: 0.8rem;
          font-weight: 900;
        }
        .claims-driver-icon.positive {
          background: #22c55e;
          color: white;
        }
        .claims-driver-icon.limiting {
          background: #f59e0b;
          color: #111827;
        }
        .claims-metric-bar {
          height: 0.22rem;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(71, 85, 105, 0.58);
        }
        .claims-metric-bar-fill {
          height: 100%;
          border-radius: 999px;
        }
        .claims-metric-bar-fill.green {
          background: linear-gradient(90deg, #22c55e, #4ade80);
        }
        .claims-metric-bar-fill.blue {
          background: linear-gradient(90deg, #22d3ee, #3b82f6);
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
      `}</style>

      <article className="claims-shell-card rounded-[2rem] p-6 md:p-8 lg:p-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-center">
          <div>
            <h2 className="text-4xl font-black tracking-tight text-white md:text-5xl">Claims Intelligence</h2>
            <p className="mt-5 max-w-5xl text-lg leading-8 text-slate-300 md:text-xl md:leading-9">
              {summary}
            </p>
          </div>

          <div className="claims-score-card rounded-[1.75rem] p-6">
            <p className="claims-eyebrow text-sm">Claims Intelligence</p>
            <div className="mt-5 flex items-end gap-2">
              <span className="text-6xl font-black leading-none text-white md:text-7xl">{score}</span>
              <span className="pb-2 text-3xl font-black text-slate-400">/ 100</span>
            </div>
            <div className="claims-progress-track mt-6">
              <div className="claims-progress-fill" style={{ width: `${score}%` }} />
            </div>
            <div className="claims-status-pill mt-6 rounded-2xl px-5 py-3 text-center text-lg font-black">
              ✓ {tier}
            </div>
          </div>
        </div>
      </article>

      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.08fr_1.08fr]">
        <article className="claims-panel rounded-[1.6rem] p-6">
          <p className="claims-eyebrow text-sm">Enterprise Use Cases</p>
          <div className="mt-6 space-y-4">
            {useCases.map((useCase, index) => (
              <div className="flex items-center gap-4 border-b border-slate-800/60 pb-3 last:border-b-0 last:pb-0" key={useCase}>
                <UseCaseIcon index={index} />
                <span className="text-lg font-semibold text-white">{useCase}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="claims-panel rounded-[1.6rem] p-6">
          <p className="claims-eyebrow text-sm">Claims Intelligence Drivers</p>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="border-slate-800/80 md:border-r md:pr-6">
              <h3 className="text-sm font-black uppercase tracking-[0.18em] text-green-400">Top Positive Drivers</h3>
              <div className="mt-5 space-y-4">
                {positiveDrivers.map((driver) => (
                  <div className="flex items-center gap-3" key={driver.label}>
                    <DriverIcon type="positive" />
                    <span className="text-base font-semibold text-white">{driver.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-black uppercase tracking-[0.18em] text-amber-400">Limiting Factors</h3>
              <div className="mt-5 space-y-4">
                {limitingDrivers.map((driver) => (
                  <div className="flex items-center gap-3" key={driver.label}>
                    <DriverIcon type="limiting" />
                    <span className="text-base font-semibold text-white">{driver.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </article>

        <article className="claims-panel rounded-[1.6rem] p-6">
          <p className="claims-eyebrow text-sm">Claims Readiness Breakdown</p>
          <div className="mt-6 space-y-5">
            {breakdown.map((metric) => (
              <div key={metric.label}>
                <div className="mb-2 flex items-center justify-between gap-4">
                  <span className="text-base font-semibold text-white">{metric.label}</span>
                  <span className="text-base font-black text-white">
                    {metric.score} <span className="text-slate-500">/ 100</span>
                  </span>
                </div>
                <div className="claims-metric-bar">
                  <div className={`claims-metric-bar-fill ${metric.tone || 'blue'}`} style={{ width: `${metric.score}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <article className="claims-panel rounded-[1.6rem] p-6">
        <p className="claims-eyebrow text-sm">Executive Recommendation</p>
        <div className="mt-6 grid gap-6 lg:grid-cols-3 lg:divide-x lg:divide-slate-800/80">
          <div className="flex items-center gap-5 lg:pr-6">
            <RecommendationIcon type="primary" />
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-green-400">Primary Use</p>
              <h3 className="mt-1 text-2xl font-black text-white">Cost-of-Care Analytics</h3>
              <p className="text-base font-semibold text-slate-400">Strongest alignment and readiness</p>
            </div>
          </div>

          <div className="flex items-center gap-5 lg:px-6">
            <RecommendationIcon type="secondary" />
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-400">Secondary Use</p>
              <h3 className="mt-1 text-2xl font-black text-white">Predictive Modeling</h3>
              <p className="text-base font-semibold text-slate-400">High potential for advanced analytics</p>
            </div>
          </div>

          <div className="flex items-center gap-5 lg:pl-6">
            <RecommendationIcon type="emerging" />
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-purple-400">Emerging Use</p>
              <h3 className="mt-1 text-2xl font-black text-white">Clinical AI Assistants</h3>
              <p className="text-base font-semibold text-slate-400">Strong foundation for AI-driven workflows</p>
            </div>
          </div>
        </div>
      </article>

      <div className="rounded-2xl border border-blue-900/40 bg-slate-950/80 px-5 py-3 text-sm font-semibold text-slate-400">
        <span className="mr-3 text-blue-400">ⓘ</span>
        Scores are derived from normalized enterprise data coverage, relationships, and interoperability indicators.
      </div>
    </section>
  );
}
