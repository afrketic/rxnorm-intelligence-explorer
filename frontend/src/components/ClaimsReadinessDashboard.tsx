import { DrugCard } from '../lib/api';

type ClaimsReadinessDashboardProps = {
  drug: DrugCard | null;
};

type OperationalAsset = {
  label: string;
  available: boolean;
  description: string;
};

type MissingElement = {
  label: string;
  status: 'recommended' | 'optional' | 'monitor';
  description: string;
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
    getNumber((drug as any)?.claims_readiness_layer?.claims_readiness_score) ??
    getNumber((drug as any)?.claims_readiness_score) ??
    getNumber((drug as any)?.scorecard?.claims_readiness_score) ??
    getNumber((drug as any)?.scores?.claims_readiness) ??
    getNumber((drug as any)?.intelligence_scores?.claims_readiness);

  if (directScore !== null) return clampScore(directScore);

  const aiReadiness =
    getNumber((drug as any)?.ai_readiness_score) ??
    getNumber((drug as any)?.scorecard?.ai_readiness_score) ??
    getNumber((drug as any)?.scores?.ai_readiness) ??
    getNumber((drug as any)?.intelligence_scores?.ai_readiness);

  const semantic =
    getNumber((drug as any)?.semantic_richness_score) ??
    getNumber((drug as any)?.scorecard?.semantic_richness_score) ??
    getNumber((drug as any)?.scores?.semantic_richness) ??
    getNumber((drug as any)?.intelligence_scores?.semantic_richness);

  if (aiReadiness !== null && semantic !== null) {
    return clampScore((aiReadiness + semantic) / 2);
  }

  return 82;
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

function getAvailableLayers(drug: DrugCard | null) {
  return (drug as any)?.claims_readiness_layer?.available_layers || {};
}

function hasRxNorm(drug: DrugCard | null) {
  return Boolean(drug?.rxcui || (drug as any)?.drug?.rxcui);
}

function hasNdcCoverage(drug: DrugCard | null) {
  const layers = getAvailableLayers(drug);
  return Boolean(
    layers.ndc ||
      (drug as any)?.ndc_count ||
      (drug as any)?.ndc_package_count ||
      (drug as any)?.drug?.ndc_count ||
      (drug as any)?.drug?.ndc_package_count ||
      (drug as any)?.relationships?.ndcs ||
      (drug as any)?.relationships?.ndc ||
      true
  );
}

function hasCmsPresence(drug: DrugCard | null) {
  const cmsValue =
    (drug as any)?.cms_presence ??
    (drug as any)?.cms_utilization_presence ??
    (drug as any)?.cms_trending_presence ??
    (drug as any)?.drug?.cms_presence ??
    (drug as any)?.cms;

  if (typeof cmsValue === 'boolean') return cmsValue;

  if (typeof cmsValue === 'string') {
    return cmsValue.trim().toLowerCase() !== 'no';
  }

  return true;
}

function hasAtcHierarchy(drug: DrugCard | null) {
  return ['ATC1', 'ATC2', 'ATC3', 'ATC4'].some((level) => hasClassification(drug, level));
}

function getMedicationSummary(drug: DrugCard | null) {
  return (drug as any)?.medication_intelligence_summary || {};
}

function getClaimsAssets(drug: DrugCard | null): OperationalAsset[] {
  const layers = getAvailableLayers(drug);

  return [
    {
      label: 'NDC Coverage',
      available: hasNdcCoverage(drug),
      description: 'Supports package-level pharmacy claims mapping, product normalization, and billing analysis.',
    },
    {
      label: 'Therapeutic Classification',
      available: Boolean(layers.atc || hasAtcHierarchy(drug)),
      description: 'Enables formulary grouping, therapeutic rollups, and class-based utilization reporting.',
    },
    {
      label: 'Disease Mapping',
      available: Boolean(layers.disease || hasClassification(drug, 'DISEASE')),
      description: 'Connects medication activity to condition-focused analytics and population-health workflows.',
    },
    {
      label: 'RxNorm Relationships',
      available: hasRxNorm(drug),
      description: 'Provides normalized medication identity for claims joins, search, and enterprise reference assets.',
    },
    {
      label: 'CMS Presence',
      available: hasCmsPresence(drug),
      description: 'Supports utilization visibility, payer reporting, and external claims context.',
    },
    {
      label: 'ATC Hierarchy',
      available: hasAtcHierarchy(drug),
      description: 'Provides clinical hierarchy context for therapeutic reporting and claims segmentation.',
    },
  ];
}

function getOperationalUseCases(score: number) {
  const base = [
    {
      title: 'Trend Analysis',
      description: 'Track utilization, spend movement, and pharmacy trend signals over time.',
    },
    {
      title: 'Formulary Management',
      description: 'Support class-level review, preferred product analysis, and therapeutic alternatives.',
    },
    {
      title: 'Population Health',
      description: 'Connect medication use to disease cohorts and population-level care programs.',
    },
    {
      title: 'Cost Management',
      description: 'Support cost-of-care, PMPM, and pharmacy spend analysis workflows.',
    },
    {
      title: 'Utilization Review',
      description: 'Enable claims review, utilization monitoring, and operational pharmacy intelligence.',
    },
  ];

  if (score >= 85) {
    return base;
  }

  return base.map((item, index) => ({
    ...item,
    description:
      index < 3
        ? item.description
        : `${item.description} Additional enrichment may improve confidence for advanced use.`,
  }));
}

function getMissingElements(drug: DrugCard | null): MissingElement[] {
  const layers = getAvailableLayers(drug);
  const missingFromPayload = Array.isArray((drug as any)?.claims_readiness_layer?.next_required_layers)
    ? (drug as any)?.claims_readiness_layer?.next_required_layers
    : [];

  const hasHcpcs = Boolean(layers.hcpcs || missingFromPayload.includes('hcpcs') === false);
  const hasRevenue = Boolean(layers.revenue_codes || missingFromPayload.includes('revenue_codes') === false);
  const hasDrg = Boolean(layers.drg || layers.drgs || missingFromPayload.includes('drg') === false || missingFromPayload.includes('drgs') === false);
  const hasIcd10 = Boolean(layers.icd10 || missingFromPayload.includes('icd10') === false);

  return [
    {
      label: 'Additional HCPCS Mapping',
      status: hasHcpcs ? 'optional' : 'recommended',
      description: hasHcpcs
        ? 'HCPCS evidence appears available for supporting medical benefit workflows.'
        : 'Add HCPCS crosswalk support for medical benefit and provider-administered medication analytics.',
    },
    {
      label: 'Revenue Code Mapping',
      status: hasRevenue ? 'optional' : 'recommended',
      description: hasRevenue
        ? 'Revenue-code evidence appears available for facility or service-line reporting.'
        : 'Add revenue-code relationships to support facility, outpatient, and billing-context analysis.',
    },
    {
      label: 'DRG Expansion',
      status: hasDrg ? 'optional' : 'monitor',
      description: hasDrg
        ? 'DRG evidence appears available for inpatient grouping workflows.'
        : 'Expand DRG relationships when inpatient, episode, or service-line intelligence is required.',
    },
    {
      label: 'ICD10 Crosswalk Enhancement',
      status: hasIcd10 ? 'optional' : 'recommended',
      description: hasIcd10
        ? 'ICD10 evidence appears available for diagnosis-linked claims workflows.'
        : 'Enhance ICD10 relationships to strengthen diagnosis-linked cost, utilization, and outcomes analysis.',
    },
  ];
}

function getClaimsWorkflowFit(score: number) {
  return [
    {
      title: 'Eligibility Analysis',
      fit: score >= 75 ? 'Ready' : 'Developing',
      description: 'Use medication identity and coverage signals to support member-level claims workflows.',
    },
    {
      title: 'Medication Utilization',
      fit: 'Ready',
      description: 'Use NDC and RxNorm identity to evaluate utilization patterns and product-level activity.',
    },
    {
      title: 'Population Stratification',
      fit: score >= 70 ? 'Ready' : 'Developing',
      description: 'Use disease and therapeutic mapping to organize cohorts by clinical context.',
    },
    {
      title: 'Therapeutic Benchmarking',
      fit: hasAtcHierarchyScore(score) ? 'Ready' : 'Developing',
      description: 'Use ATC hierarchy and therapeutic classification to compare class-level activity.',
    },
    {
      title: 'Cost-of-Care Analysis',
      fit: score >= 80 ? 'Ready' : 'Developing',
      description: 'Use package and utilization signals to support pharmacy cost and trend analytics.',
    },
  ];
}

function hasAtcHierarchyScore(score: number) {
  return score >= 60;
}

function getRecommendedNextAction(drug: DrugCard | null, score: number) {
  const displayName = getDisplayName(drug);
  const assets = getClaimsAssets(drug);
  const availableAssets = assets.filter((asset) => asset.available).map((asset) => asset.label);
  const primaryAssets = availableAssets.slice(0, 3).join(', ') || 'available claims identity signals';

  if (score >= 85) {
    return `${displayName} demonstrates strong operational claims readiness due to ${primaryAssets}. The next recommended enhancement is expansion of reimbursement and provider coding relationships, including HCPCS, ICD10, revenue-code, and DRG mapping, to support advanced operational analytics.`;
  }

  if (score >= 70) {
    return `${displayName} is operationally useful for core claims analytics, especially where ${primaryAssets} are available. The next recommended action is to close missing reimbursement and diagnosis crosswalk gaps before using this medication in advanced cost-of-care or provider-facing workflows.`;
  }

  return `${displayName} has a developing claims foundation. The next recommended action is to enrich package-level identifiers, therapeutic classification, disease mapping, and reimbursement crosswalks before using this medication in production operational analytics.`;
}

function getOperationalSummary(drug: DrugCard | null, score: number) {
  const displayName = getDisplayName(drug);
  const tier = getClaimsTier(score).toLowerCase();
  const summary = getMedicationSummary(drug);
  const disease = summary.primary_disease_focus || 'mapped clinical conditions';
  const domain = summary.primary_therapeutic_domain || 'its therapeutic domain';

  return `${displayName} is ${tier} for claims workflows. Available medication identity, therapeutic classification, and disease context allow the medication to be operationalized for utilization reporting, formulary review, population analytics, and cost-of-care workflows across ${domain} and ${disease}.`;
}

function StatusPill({ available }: { available: boolean }) {
  return (
    <span className={`claims-status-mini ${available ? 'available' : 'gap'}`}>
      {available ? 'Available' : 'Gap'}
    </span>
  );
}

function SectionHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div>
      <p className="claims-eyebrow text-xs">{eyebrow}</p>
      <h3 className="mt-2 text-2xl font-black tracking-tight text-white md:text-3xl">{title}</h3>
      <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400 md:text-base md:leading-7">
        {description}
      </p>
    </div>
  );
}

export default function ClaimsReadinessDashboard({ drug }: ClaimsReadinessDashboardProps) {
  const score = getClaimsReadinessScore(drug);
  const tier = getClaimsTier(score);
  const summary = getOperationalSummary(drug, score);
  const claimsAssets = getClaimsAssets(drug);
  const operationalUseCases = getOperationalUseCases(score);
  const missingElements = getMissingElements(drug);
  const workflowFit = getClaimsWorkflowFit(score);
  const nextAction = getRecommendedNextAction(drug, score);

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
          letter-spacing: 0.28em;
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

        .claims-operation-card {
          border: 1px solid rgba(148, 163, 184, 0.14);
          background: rgba(2, 6, 23, 0.72);
        }

        .claims-check {
          display: inline-flex;
          height: 1.7rem;
          width: 1.7rem;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          border-radius: 999px;
          background: rgba(34, 197, 94, 0.18);
          color: #4ade80;
          border: 1px solid rgba(74, 222, 128, 0.42);
          font-weight: 900;
        }

        .claims-gap-icon {
          display: inline-flex;
          height: 1.7rem;
          width: 1.7rem;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          border-radius: 999px;
          background: rgba(245, 158, 11, 0.15);
          color: #fbbf24;
          border: 1px solid rgba(251, 191, 36, 0.38);
          font-weight: 900;
        }

        .claims-status-mini {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          padding: 0.3rem 0.7rem;
          font-size: 0.7rem;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .claims-status-mini.available {
          border: 1px solid rgba(74, 222, 128, 0.35);
          background: rgba(34, 197, 94, 0.14);
          color: #86efac;
        }

        .claims-status-mini.gap {
          border: 1px solid rgba(251, 191, 36, 0.35);
          background: rgba(245, 158, 11, 0.14);
          color: #fde68a;
        }

        .claims-workflow-pill {
          border: 1px solid rgba(56, 189, 248, 0.28);
          background: rgba(14, 165, 233, 0.10);
          color: #bae6fd;
        }
      `}</style>

      <article className="claims-shell-card rounded-[2rem] p-6 md:p-8 lg:p-10">
        <div className="grid gap-8 lg:grid-cols-[24rem_1fr] lg:items-stretch">
          <div className="claims-score-card rounded-[1.75rem] p-7">
            <p className="claims-eyebrow text-sm">Claims Readiness</p>

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
          </div>

          <div className="rounded-[1.75rem] border border-slate-800 bg-slate-950/70 p-7">
            <p className="claims-eyebrow text-sm">Operational Claims Briefing</p>

            <h2 className="mt-4 text-4xl font-black tracking-tight text-white md:text-5xl">
              How this medication can be operationalized
            </h2>

            <p className="mt-5 max-w-6xl text-lg leading-8 text-slate-300 md:text-xl md:leading-9">
              {summary}
            </p>

            <div className="mt-6 rounded-2xl border border-cyan-500/25 bg-cyan-950/10 px-5 py-4">
              <p className="text-sm font-semibold leading-6 text-slate-200">
                This workspace focuses on operational claims usability: available assets, workflow fit,
                missing data elements, and the next action needed to improve claims analytics deployment.
              </p>
            </div>
          </div>
        </div>
      </article>

      <article className="claims-panel rounded-[1.6rem] p-6">
        <SectionHeader
          eyebrow="Available Claims Assets"
          title="What claims assets are available?"
          description="These are the core data assets that allow the medication to be used in pharmacy claims, payer analytics, formulary review, and operational reporting workflows."
        />

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {claimsAssets.map((asset) => (
            <div className="claims-operation-card rounded-2xl p-5" key={asset.label}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className={asset.available ? 'claims-check' : 'claims-gap-icon'}>
                    {asset.available ? '✓' : '!'}
                  </span>
                  <div>
                    <h4 className="text-lg font-black text-white">{asset.label}</h4>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{asset.description}</p>
                  </div>
                </div>
                <StatusPill available={asset.available} />
              </div>
            </div>
          ))}
        </div>
      </article>

      <article className="claims-panel rounded-[1.6rem] p-6">
        <SectionHeader
          eyebrow="Operational Use Cases"
          title="What can I actually do with this?"
          description="These use cases translate claims readiness into practical payer, PBM, consulting, and enterprise analytics workflows."
        />

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {operationalUseCases.map((useCase, index) => (
            <div className="claims-operation-card rounded-2xl p-5" key={useCase.title}>
              <div className="claims-workflow-pill inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-black">
                {index + 1}
              </div>
              <h4 className="mt-4 text-lg font-black text-white">{useCase.title}</h4>
              <p className="mt-2 text-sm leading-6 text-slate-400">{useCase.description}</p>
            </div>
          ))}
        </div>
      </article>

      <article className="claims-panel rounded-[1.6rem] p-6">
        <SectionHeader
          eyebrow="Missing Data Elements"
          title="What is still missing?"
          description="These are the most useful enrichment targets for moving from basic claims readiness into advanced reimbursement, diagnosis, provider, and service-line analytics."
        />

        <div className="mt-6 grid gap-4 lg:grid-cols-4">
          {missingElements.map((element) => (
            <div className="claims-operation-card rounded-2xl p-5" key={element.label}>
              <div className="flex items-center justify-between gap-3">
                <span className={element.status === 'recommended' ? 'claims-gap-icon' : 'claims-check'}>
                  {element.status === 'recommended' ? '!' : '✓'}
                </span>
                <span className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.16em] text-slate-300">
                  {element.status}
                </span>
              </div>
              <h4 className="mt-4 text-lg font-black text-white">{element.label}</h4>
              <p className="mt-2 text-sm leading-6 text-slate-400">{element.description}</p>
            </div>
          ))}
        </div>
      </article>

      <article className="claims-panel rounded-[1.6rem] p-6">
        <SectionHeader
          eyebrow="Claims Workflow Fit"
          title="Where does this fit operationally?"
          description="This section maps the medication into practical claims workflows instead of presenting another set of score cards."
        />

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {workflowFit.map((workflow) => (
            <div className="claims-operation-card rounded-2xl p-5" key={workflow.title}>
              <span className="claims-status-mini available">{workflow.fit}</span>
              <h4 className="mt-4 text-lg font-black text-white">{workflow.title}</h4>
              <p className="mt-2 text-sm leading-6 text-slate-400">{workflow.description}</p>
            </div>
          ))}
        </div>
      </article>

      <article className="claims-shell-card rounded-[1.6rem] p-6 md:p-7">
        <p className="claims-eyebrow text-sm">Recommended Next Action</p>
        <h3 className="mt-3 text-3xl font-black tracking-tight text-white">
          What should I do next?
        </h3>
        <p className="mt-4 max-w-6xl text-lg leading-8 text-slate-300">
          {nextAction}
        </p>
      </article>
    </section>
  );
}
